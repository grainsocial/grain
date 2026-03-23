import { defineQuery, InvalidRequestError } from "$hatk";
import type { GrainActorProfile, Photo, Gallery } from "$hatk";
import { views } from "$hatk";

/** Builds the UNION ALL query for notification sources. Pass select columns or `count(*) as cnt`. */
function notificationUnion(select: "count" | "full", extraFilter: string): string {
  const favCols =
    select === "count"
      ? "uri"
      : "uri, did, created_at, 'favorite' as source, subject as gallery_uri, NULL as text, NULL as facets, NULL as reply_to, NULL as focus";

  const commentCols =
    select === "count"
      ? "uri"
      : "uri, did, created_at, 'comment' as source, subject as gallery_uri, text, facets, reply_to, focus";

  const replyCols =
    select === "count"
      ? "c.uri"
      : "c.uri, c.did, c.created_at, 'reply' as source, c.subject as gallery_uri, c.text, c.facets, c.reply_to, c.focus";

  const followCols =
    select === "count"
      ? "uri"
      : "uri, did, created_at, 'follow' as source, NULL as gallery_uri, NULL as text, NULL as facets, NULL as reply_to, NULL as focus";

  const mentionCommentCols =
    select === "count"
      ? "uri"
      : "uri, did, created_at, 'comment-mention' as source, subject as gallery_uri, text, facets, NULL as reply_to, focus";

  const mentionGalleryCols =
    select === "count"
      ? "uri"
      : "uri, did, created_at, 'gallery-mention' as source, uri as gallery_uri, description as text, facets, NULL as reply_to, NULL as focus";

  return `
    SELECT ${favCols} FROM "social.grain.favorite"
    WHERE subject IN (SELECT uri FROM "social.grain.gallery" WHERE did = $1)
      AND did != $1 ${extraFilter}

    UNION ALL

    SELECT ${commentCols} FROM "social.grain.comment"
    WHERE subject IN (SELECT uri FROM "social.grain.gallery" WHERE did = $1)
      AND did != $1 AND reply_to IS NULL ${extraFilter}

    UNION ALL

    SELECT ${replyCols} FROM "social.grain.comment" c
    WHERE c.reply_to IN (SELECT uri FROM "social.grain.comment" WHERE did = $1)
      AND c.did != $1 ${extraFilter}

    UNION ALL

    SELECT ${followCols} FROM "social.grain.graph.follow"
    WHERE subject = $1 AND did != $1 ${extraFilter}

    UNION ALL

    SELECT ${mentionCommentCols} FROM "social.grain.comment"
    WHERE facets LIKE '%' || $1 || '%' AND did != $1
      AND subject NOT IN (SELECT uri FROM "social.grain.gallery" WHERE did = $1)
      AND reply_to NOT IN (SELECT uri FROM "social.grain.comment" WHERE did = $1)
      ${extraFilter}

    UNION ALL

    SELECT ${mentionGalleryCols} FROM "social.grain.gallery"
    WHERE facets LIKE '%' || $1 || '%' AND did != $1 ${extraFilter}
  `;
}

export default defineQuery("social.grain.unspecced.getNotifications", async (ctx) => {
  const { ok, params, db, lookup, blobUrl, getRecords, viewer: viewerObj } = ctx;
  if (!viewerObj) throw new InvalidRequestError("Authentication required");
  const viewer = viewerObj.did;
  const { limit = 20, cursor, countOnly } = params;

  // Get lastSeenNotifications from preferences
  const prefRows = (await db.query(
    `SELECT value FROM _preferences WHERE did = $1 AND key = 'lastSeenNotifications'`,
    [viewer],
  )) as { value: string }[];
  const rawValue = prefRows[0]?.value ?? null;
  const lastSeen = rawValue ? JSON.parse(rawValue) : null;

  // Count unseen — if no lastSeen, all notifications are unseen
  const timeFilter = lastSeen ? `AND created_at > $2` : "";
  const countParams = lastSeen ? [viewer, lastSeen] : [viewer];
  const countRows = (await db.query(
    `SELECT count(*) as cnt FROM (${notificationUnion("count", timeFilter)})`,
    countParams,
  )) as { cnt: number }[];
  const unseenCount = countRows[0]?.cnt ?? 0;

  // Short-circuit for count-only requests (badge polling)
  if (countOnly) {
    return ok({ notifications: [], unseenCount });
  }

  // Build paginated query
  let queryParams: any[] = [viewer, limit + 1];
  let cursorFilter = "";
  if (cursor) {
    cursorFilter = `AND created_at < $3`;
    queryParams.push(cursor);
  }

  const rows = (await db.query(
    `${notificationUnion("full", cursorFilter)} ORDER BY created_at DESC LIMIT $2`,
    queryParams,
  )) as Array<{
    uri: string;
    did: string;
    created_at: string;
    source: string;
    gallery_uri: string | null;
    text: string | null;
    facets: string | null;
    reply_to: string | null;
    focus: string | null;
  }>;

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1]?.created_at : undefined;

  // Determine notification reason
  function getReason(row: (typeof items)[0]): string {
    if (row.source === "favorite") return "gallery-favorite";
    if (row.source === "follow") return "follow";
    if (row.source === "comment-mention") return "gallery-comment-mention";
    if (row.source === "gallery-mention") return "gallery-mention";
    if (row.source === "reply") return "reply";
    // Regular comment — check for mention facets
    if (row.facets) {
      try {
        const facets = JSON.parse(row.facets);
        const hasMention =
          Array.isArray(facets) &&
          facets.some((f: any) =>
            f.features?.some(
              (feat: any) =>
                feat.$type === "app.bsky.richtext.facet#mention" && feat.did === viewer,
            ),
          );
        if (hasMention) return "gallery-comment-mention";
      } catch {}
    }
    return "gallery-comment";
  }

  // Hydrate author profiles
  const dids = [...new Set(items.map((r) => r.did))];
  const profiles = await lookup<GrainActorProfile>("social.grain.actor.profile", "did", dids);

  // Hydrate galleries for thumbnails
  const galleryUris = [...new Set(items.map((r) => r.gallery_uri).filter(Boolean))] as string[];
  const galleries =
    galleryUris.length > 0
      ? await getRecords<Gallery>("social.grain.gallery", galleryUris)
      : new Map();

  // Get first photo thumbnail for each gallery
  const galleryItemRows =
    galleryUris.length > 0
      ? ((await db.query(
          `SELECT gallery, item FROM "social.grain.gallery.item"
           WHERE gallery IN (${galleryUris.map((_, i) => `$${i + 1}`).join(",")})
           ORDER BY position ASC`,
          galleryUris,
        )) as Array<{ gallery: string; item: string }>)
      : [];

  const firstPhotoByGallery = new Map<string, string>();
  for (const row of galleryItemRows) {
    if (!firstPhotoByGallery.has(row.gallery)) {
      firstPhotoByGallery.set(row.gallery, row.item);
    }
  }

  const allPhotoUris = [...new Set(firstPhotoByGallery.values())];
  const photos =
    allPhotoUris.length > 0
      ? await getRecords<Photo>("social.grain.photo", allPhotoUris)
      : new Map();

  // Hydrate reply-to texts
  const replyToUris = items.map((r) => r.reply_to).filter(Boolean) as string[];
  const replyToComments =
    replyToUris.length > 0
      ? ((await db.query(
          `SELECT uri, text FROM "social.grain.comment"
           WHERE uri IN (${replyToUris.map((_, i) => `$${i + 1}`).join(",")})`,
          replyToUris,
        )) as Array<{ uri: string; text: string }>)
      : [];
  const replyToTextMap = new Map<string, string>();
  for (const row of replyToComments) replyToTextMap.set(row.uri, row.text);

  const notifications = items.map((row) => {
    const author = profiles.get(row.did);
    const gallery = row.gallery_uri ? galleries.get(row.gallery_uri) : null;
    const photoUri = row.gallery_uri ? firstPhotoByGallery.get(row.gallery_uri) : null;
    const photo = photoUri ? photos.get(photoUri) : null;
    const thumb = photo
      ? (blobUrl(photo.did, photo.value.photo, "feed_thumbnail") ?? undefined)
      : undefined;

    return {
      uri: row.uri,
      reason: getReason(row),
      createdAt: row.created_at,
      author: author
        ? views.grainActorDefsProfileView({
            cid: author.cid,
            did: author.did,
            handle: author.handle ?? author.did,
            displayName: author.value.displayName,
            avatar: blobUrl(author.did, author.value.avatar) ?? undefined,
          })
        : views.grainActorDefsProfileView({
            cid: row.uri,
            did: row.did,
            handle: row.did,
          }),
      ...(gallery ? { galleryUri: row.gallery_uri!, galleryTitle: gallery.value.title } : {}),
      ...(thumb ? { galleryThumb: thumb } : {}),
      ...(row.text ? { commentText: row.text } : {}),
      ...(row.reply_to && replyToTextMap.has(row.reply_to)
        ? { replyToText: replyToTextMap.get(row.reply_to) }
        : {}),
    };
  });

  return ok({ notifications, ...(nextCursor ? { cursor: nextCursor } : {}), unseenCount });
});
