import { defineQuery } from "$hatk";
import type { GrainActorProfile, Photo } from "$hatk";
import { views } from "$hatk";

export default defineQuery("social.grain.unspecced.getGalleryThread", async (ctx) => {
  const { ok, params, db, lookup, blobUrl, getRecords } = ctx;
  const { gallery, limit = 20, cursor } = params;

  // Count total comments for this gallery
  const countRows = (await db.query(
    `SELECT count(*) as cnt FROM "social.grain.comment" WHERE subject = $1`,
    [gallery],
  )) as { cnt: number }[];
  const totalCount = countRows[0]?.cnt ?? 0;

  // Fetch comments with cursor-based pagination (oldest first)
  let query = `SELECT uri, did, cid, text, facets, focus, reply_to, created_at
    FROM "social.grain.comment"
    WHERE subject = $1`;
  const queryParams: any[] = [gallery];

  if (cursor) {
    query += ` AND created_at > $2`;
    queryParams.push(cursor);
  }

  query += ` ORDER BY created_at ASC LIMIT $${queryParams.length + 1}`;
  queryParams.push(limit + 1); // fetch one extra for cursor

  const rows = (await db.query(query, queryParams)) as Array<{
    uri: string;
    did: string;
    cid: string;
    text: string;
    facets: string | null;
    focus: string | null;
    reply_to: string | null;
    created_at: string;
  }>;

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1]?.created_at : undefined;

  // Hydrate author profiles
  const dids = [...new Set(items.map((r) => r.did))];
  const profiles = await lookup<GrainActorProfile>("social.grain.actor.profile", "did", dids);

  // Hydrate focus photos
  const focusUris = items.map((r) => r.focus).filter(Boolean) as string[];
  const focusPhotos =
    focusUris.length > 0 ? await getRecords<Photo>("social.grain.photo", focusUris) : new Map();

  const comments = items.map((row) => {
    const author = profiles.get(row.did);
    const parsedFacets = row.facets ? JSON.parse(row.facets) : undefined;
    const focusPhoto = row.focus ? focusPhotos.get(row.focus) : null;

    return views.commentView({
      uri: row.uri,
      cid: row.cid,
      text: row.text,
      facets: parsedFacets,
      replyTo: row.reply_to ?? undefined,
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
            cid: row.cid,
            did: row.did,
            handle: row.did,
          }),
      ...(focusPhoto
        ? {
            focus: views.photoView({
              uri: focusPhoto.uri,
              cid: focusPhoto.cid,
              thumb: blobUrl(focusPhoto.did, focusPhoto.value.photo, "feed_thumbnail") ?? "",
              fullsize: blobUrl(focusPhoto.did, focusPhoto.value.photo, "feed_fullsize") ?? "",
              alt: focusPhoto.value.alt,
              aspectRatio: focusPhoto.value.aspectRatio ?? { width: 4, height: 3 },
            }),
          }
        : {}),
    });
  });

  return ok({ comments, ...(nextCursor ? { cursor: nextCursor } : {}), totalCount });
});
