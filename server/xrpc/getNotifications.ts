import { defineQuery, InvalidRequestError } from "$hatk";
import type { GrainActorProfile, Photo, Gallery, Story } from "$hatk";
import { views } from "$hatk";
import { lookupHandles } from "../helpers/lookupHandles.ts";

function blockMuteNotifFilter(didCol = "did"): string {
  return `
    AND ${didCol} NOT IN (SELECT subject FROM "social.grain.graph.block" WHERE did = $1)
    AND ${didCol} NOT IN (SELECT did FROM "social.grain.graph.block" WHERE subject = $1)
    AND ${didCol} NOT IN (SELECT subject FROM _mutes WHERE did = $1)
  `;
}

/** Builds the UNION ALL query for notification sources. Pass select columns or `count(*) as cnt`. */
function notificationUnion(select: "count" | "full", extraFilter: string): string {
  const favCols =
    select === "count"
      ? "uri"
      : "uri, did, created_at, 'favorite' as source, subject as subject_uri, NULL as text, NULL as facets, NULL as reply_to, NULL as focus";

  const commentCols =
    select === "count"
      ? "uri"
      : "uri, did, created_at, 'comment' as source, subject as subject_uri, text, facets, reply_to, focus";

  const replyCols =
    select === "count"
      ? "c.uri"
      : "c.uri, c.did, c.created_at, 'reply' as source, c.subject as subject_uri, c.text, c.facets, c.reply_to, c.focus";

  const followCols =
    select === "count"
      ? "uri"
      : "uri, did, created_at, 'follow' as source, NULL as subject_uri, NULL as text, NULL as facets, NULL as reply_to, NULL as focus";

  const mentionCommentCols =
    select === "count"
      ? "uri"
      : "uri, did, created_at, 'comment-mention' as source, subject as subject_uri, text, facets, NULL as reply_to, focus";

  const mentionGalleryCols =
    select === "count"
      ? "uri"
      : "uri, did, created_at, 'gallery-mention' as source, uri as subject_uri, description as text, facets, NULL as reply_to, NULL as focus";

  const storyFavCols =
    select === "count"
      ? "uri"
      : "uri, did, created_at, 'story-favorite' as source, subject as subject_uri, NULL as text, NULL as facets, NULL as reply_to, NULL as focus";

  const storyCommentCols =
    select === "count"
      ? "uri"
      : "uri, did, created_at, 'story-comment' as source, subject as subject_uri, text, facets, reply_to, focus";

  const commentFavCols =
    select === "count"
      ? "uri"
      : "uri, did, created_at, 'comment-favorite' as source, subject as subject_uri, NULL as text, NULL as facets, NULL as reply_to, NULL as focus";

  return `
    SELECT ${favCols} FROM "social.grain.favorite"
    WHERE subject IN (SELECT uri FROM "social.grain.gallery" WHERE did = $1)
      AND did != $1 ${blockMuteNotifFilter()} ${extraFilter}

    UNION ALL

    SELECT ${commentCols} FROM "social.grain.comment"
    WHERE subject IN (SELECT uri FROM "social.grain.gallery" WHERE did = $1)
      AND did != $1 AND reply_to IS NULL ${blockMuteNotifFilter()} ${extraFilter}

    UNION ALL

    SELECT ${replyCols} FROM "social.grain.comment" c
    WHERE c.reply_to IN (SELECT uri FROM "social.grain.comment" WHERE did = $1)
      AND c.did != $1 ${blockMuteNotifFilter("c.did")} ${extraFilter}

    UNION ALL

    SELECT ${followCols} FROM "social.grain.graph.follow"
    WHERE subject = $1 AND did != $1 ${blockMuteNotifFilter()} ${extraFilter}

    UNION ALL

    SELECT ${mentionCommentCols} FROM "social.grain.comment"
    WHERE facets LIKE '%' || $1 || '%' AND did != $1
      AND subject NOT IN (SELECT uri FROM "social.grain.gallery" WHERE did = $1)
      AND reply_to NOT IN (SELECT uri FROM "social.grain.comment" WHERE did = $1)
      ${blockMuteNotifFilter()} ${extraFilter}

    UNION ALL

    SELECT ${mentionGalleryCols} FROM "social.grain.gallery"
    WHERE facets LIKE '%' || $1 || '%' AND did != $1 ${blockMuteNotifFilter()} ${extraFilter}

    UNION ALL

    SELECT ${storyFavCols} FROM "social.grain.favorite"
    WHERE subject IN (SELECT uri FROM "social.grain.story" WHERE did = $1)
      AND did != $1 ${blockMuteNotifFilter()} ${extraFilter}

    UNION ALL

    SELECT ${storyCommentCols} FROM "social.grain.comment"
    WHERE subject IN (SELECT uri FROM "social.grain.story" WHERE did = $1)
      AND did != $1 AND reply_to IS NULL ${blockMuteNotifFilter()} ${extraFilter}

    UNION ALL

    SELECT ${commentFavCols} FROM "social.grain.favorite"
    WHERE subject IN (SELECT uri FROM "social.grain.comment" WHERE did = $1)
      AND did != $1 ${blockMuteNotifFilter()} ${extraFilter}
  `;
}

export default defineQuery("social.grain.unspecced.getNotifications", async (ctx) => {
  const { ok, params, db, lookup, blobUrl, getRecords, viewer: viewerObj } = ctx;
  if (!viewerObj) throw new InvalidRequestError("Authentication required");
  const viewer = viewerObj.did;
  const { limit = 20, cursor, countOnly } = params;

  // Get preferences
  const prefRows = (await db.query(
    `SELECT key, value FROM _preferences WHERE did = $1 AND key IN ('lastSeenNotifications', 'notificationPrefs')`,
    [viewer],
  )) as { key: string; value: string }[];
  let lastSeen: string | null = null;
  let notifPrefs: Record<string, { push: boolean; inApp: boolean; from: string }> | null = null;
  for (const row of prefRows) {
    const val = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
    if (row.key === "lastSeenNotifications") lastSeen = val;
    if (row.key === "notificationPrefs") notifPrefs = val;
  }

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
    subject_uri: string | null;
    text: string | null;
    facets: string | null;
    reply_to: string | null;
    focus: string | null;
  }>;

  // Map source to preference category
  function prefCategory(source: string): string | null {
    if (source === "favorite" || source === "story-favorite" || source === "comment-favorite") return "favorites";
    if (source === "follow") return "follows";
    if (source === "comment" || source === "reply" || source === "story-comment") return "comments";
    if (source === "comment-mention" || source === "gallery-mention") return "mentions";
    return null;
  }

  // Filter by inApp preference
  let filtered = rows;
  if (notifPrefs) {
    filtered = rows.filter((row) => {
      const cat = prefCategory(row.source);
      if (!cat || !notifPrefs![cat]) return true;
      return notifPrefs![cat].inApp !== false;
    });
  }

  // Filter by "from" preference (follows only)
  let followingSet: Set<string> | null = null;
  if (notifPrefs) {
    const needsFollowCheck = filtered.some((row) => {
      const cat = prefCategory(row.source);
      return cat && notifPrefs![cat]?.from === "follows";
    });
    if (needsFollowCheck) {
      const followDids = filtered.map((r) => r.did);
      const uniq = [...new Set(followDids)];
      if (uniq.length > 0) {
        const ph = uniq.map((_, i) => `$${i + 2}`).join(",");
        const followRows = (await db.query(
          `SELECT subject FROM "social.grain.graph.follow" WHERE did = $1 AND subject IN (${ph})`,
          [viewer, ...uniq],
        )) as { subject: string }[];
        followingSet = new Set(followRows.map((r) => r.subject));
      }
    }
    if (followingSet) {
      filtered = filtered.filter((row) => {
        const cat = prefCategory(row.source);
        if (!cat || notifPrefs![cat]?.from !== "follows") return true;
        return followingSet!.has(row.did);
      });
    }
  }

  // Use cursor from unfiltered rows to avoid skipping notifications
  const hasMoreRows = rows.length > limit;
  const nextCursor = hasMoreRows ? rows[rows.length - 1]?.created_at : undefined;
  const items = filtered.slice(0, limit);

  // Determine notification reason
  function getReason(row: (typeof items)[0]): string {
    if (row.source === "favorite") return "gallery-favorite";
    if (row.source === "story-favorite") return "story-favorite";
    if (row.source === "comment-favorite") return "comment-favorite";
    if (row.source === "story-comment") return "story-comment";
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
  const handleMap = await lookupHandles(db, dids);

  // Hydrate comment-favorite notifications — look up the favorited comment's text and parent subject
  const commentFavUris = items.filter((r) => r.source === "comment-favorite" && r.subject_uri).map((r) => r.subject_uri!);
  const commentFavMap = new Map<string, { text: string; subject: string }>();
  if (commentFavUris.length > 0) {
    const ph = commentFavUris.map((_, i) => `$${i + 1}`).join(",");
    const commentRows = (await db.query(
      `SELECT uri, text, subject FROM "social.grain.comment" WHERE uri IN (${ph})`,
      commentFavUris,
    )) as Array<{ uri: string; text: string; subject: string }>;
    for (const row of commentRows) commentFavMap.set(row.uri, { text: row.text, subject: row.subject });
  }

  // Separate subject URIs into gallery and story URIs (include parent subjects from comment-favorites)
  const allSubjectUris = [...new Set([
    ...items.map((r) => r.subject_uri).filter(Boolean) as string[],
    ...[...commentFavMap.values()].map((c) => c.subject),
  ])];

  // Look up which subjects are galleries vs stories
  const galleryUriSet = new Set<string>();
  const storyUriSet = new Set<string>();
  if (allSubjectUris.length > 0) {
    const ph = allSubjectUris.map((_, i) => `$${i + 1}`).join(",");
    const [galRows, storyRows] = await Promise.all([
      db.query(`SELECT uri FROM "social.grain.gallery" WHERE uri IN (${ph})`, allSubjectUris) as Promise<{ uri: string }[]>,
      db.query(`SELECT uri FROM "social.grain.story" WHERE uri IN (${ph})`, allSubjectUris) as Promise<{ uri: string }[]>,
    ]);
    for (const r of galRows) galleryUriSet.add(r.uri);
    for (const r of storyRows) storyUriSet.add(r.uri);
  }

  const galleryUris = [...galleryUriSet];
  const storyUris = [...storyUriSet];

  // Hydrate galleries for thumbnails
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

  // Hydrate story thumbnails
  const storyThumbs = new Map<string, string>();
  if (storyUris.length > 0) {
    const storyRows = (await db.query(
      `SELECT uri, did, media FROM "social.grain.story"
       WHERE uri IN (${storyUris.map((_, i) => `$${i + 1}`).join(",")})`,
      storyUris,
    )) as Array<{ uri: string; did: string; media: string }>;
    for (const row of storyRows) {
      let blobRef: any;
      try {
        blobRef = typeof row.media === "string" ? JSON.parse(row.media) : row.media;
      } catch {
        blobRef = row.media;
      }
      const thumb = blobUrl(row.did, blobRef, "avatar");
      if (thumb) storyThumbs.set(row.uri, thumb);
    }
  }

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
    const reason = getReason(row);

    // For comment-favorites, resolve the parent gallery/story from the comment
    const commentFavInfo = reason === "comment-favorite" && row.subject_uri ? commentFavMap.get(row.subject_uri) : null;
    const effectiveSubject = commentFavInfo ? commentFavInfo.subject : row.subject_uri;

    const isGallery = effectiveSubject ? galleryUriSet.has(effectiveSubject) : false;
    const isStory = effectiveSubject ? storyUriSet.has(effectiveSubject) : false;

    const gallery = isGallery && effectiveSubject ? galleries.get(effectiveSubject) : null;
    const photoUri = isGallery && effectiveSubject ? firstPhotoByGallery.get(effectiveSubject) : null;
    const photo = photoUri ? photos.get(photoUri) : null;
    const galleryThumb = photo
      ? (blobUrl(photo.did, photo.value.photo, "avatar") ?? undefined)
      : undefined;

    const storyThumb = isStory && effectiveSubject ? storyThumbs.get(effectiveSubject) : undefined;

    return {
      uri: row.uri,
      reason,
      createdAt: row.created_at,
      author: author
        ? views.grainActorDefsProfileView({
            cid: author.cid,
            did: author.did,
            handle: author.handle ?? handleMap.get(author.did) ?? author.did,
            displayName: author.value.displayName,
            description: author.value.description,
            avatar: blobUrl(author.did, author.value.avatar) ?? undefined,
          })
        : views.grainActorDefsProfileView({
            cid: row.uri,
            did: row.did,
            handle: handleMap.get(row.did) ?? row.did,
          }),
      ...(gallery ? { galleryUri: effectiveSubject!, galleryTitle: gallery.value.title } : {}),
      ...(galleryThumb ? { galleryThumb } : {}),
      ...(isStory && effectiveSubject ? { storyUri: effectiveSubject } : {}),
      ...(storyThumb ? { storyThumb } : {}),
      ...(commentFavInfo ? { commentText: commentFavInfo.text } : row.text ? { commentText: row.text } : {}),
      ...(row.reply_to && replyToTextMap.has(row.reply_to)
        ? { replyToText: replyToTextMap.get(row.reply_to) }
        : {}),
    };
  });

  return ok({ notifications, ...(nextCursor ? { cursor: nextCursor } : {}), unseenCount });
});
