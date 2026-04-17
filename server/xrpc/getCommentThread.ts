import { defineQuery } from "$hatk";
import type { GrainActorProfile, Photo } from "$hatk";
import { views } from "$hatk";
import { NOT_ORPHANED } from "../hydrate/comments.ts";
import { blockFilter } from "../filters/blockMute.ts";
import { lookupHandles } from "../helpers/lookupHandles.ts";

export default defineQuery("social.grain.unspecced.getCommentThread", async (ctx) => {
  const { ok, params, db, lookup, blobUrl, getRecords, viewer } = ctx;
  const { subject, limit = 20, cursor } = params;

  const viewerDid = viewer?.did;

  // Build block filter — blocked comments are removed entirely
  const countParams: any[] = [subject];
  let countBmParam = "";
  if (viewerDid) {
    countParams.push(viewerDid);
    countBmParam = `AND ${blockFilter("c.did", `$${countParams.length}`)}`;
  }

  // Count total comments for this subject, excluding orphaned replies
  const countRows = (await db.query(
    `SELECT count(*) as cnt FROM "social.grain.comment" c
     WHERE c.subject = $1 AND ${NOT_ORPHANED} ${countBmParam}`,
    countParams,
  )) as { cnt: number }[];
  const totalCount = countRows[0]?.cnt ?? 0;

  // Fetch comments with cursor-based pagination (oldest first), excluding orphaned replies
  const queryParams: any[] = [subject];
  let query = `SELECT c.uri, c.did, c.cid, c.text, c.facets, c.focus, c.reply_to, c.created_at
    FROM "social.grain.comment" c
    WHERE c.subject = $1 AND ${NOT_ORPHANED}`;

  if (cursor) {
    query += ` AND c.created_at > $2`;
    queryParams.push(cursor);
  }

  if (viewerDid) {
    queryParams.push(viewerDid);
    query += ` AND ${blockFilter("c.did", `$${queryParams.length}`)}`;
  }

  query += ` ORDER BY c.created_at ASC LIMIT $${queryParams.length + 1}`;
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
  const [profiles, handleMap] = await Promise.all([
    lookup<GrainActorProfile>("social.grain.actor.profile", "did", dids),
    lookupHandles(db, dids),
  ]);

  // Check which comment authors the viewer has muted
  let mutedDids = new Set<string>();
  if (viewerDid && dids.length > 0) {
    const ph = dids.map((_, i) => `$${i + 2}`).join(",");
    const mutedRows = (await db.query(
      `SELECT subject FROM _mutes WHERE did = $1 AND subject IN (${ph})`,
      [viewerDid, ...dids],
    )) as { subject: string }[];
    mutedDids = new Set(mutedRows.map((r) => r.subject));
  }

  // Hydrate focus photos
  const focusUris = items.map((r) => r.focus).filter(Boolean) as string[];
  const focusPhotos =
    focusUris.length > 0 ? await getRecords<Photo>("social.grain.photo", focusUris) : new Map();

  // Hydrate comment favorite counts and viewer favorites
  const commentUris = items.map((r) => r.uri);
  const [favCounts, viewerFavs] = await Promise.all([
    commentUris.length > 0
      ? (
          db.query(
            `SELECT subject, COUNT(DISTINCT did) as count FROM "social.grain.favorite"
             WHERE subject IN (${commentUris.map((_, i) => `$${i + 1}`).join(",")}) GROUP BY subject`,
            commentUris,
          ) as Promise<{ subject: string; count: number }[]>
        ).then((rows) => {
          const m = new Map<string, number>();
          for (const r of rows) m.set(r.subject, Number(r.count));
          return m;
        })
      : Promise.resolve(new Map<string, number>()),
    viewerDid && commentUris.length > 0
      ? (
          db.query(
            `SELECT subject, uri FROM "social.grain.favorite"
             WHERE did = $1 AND subject IN (${commentUris.map((_, i) => `$${i + 2}`).join(",")})`,
            [viewerDid, ...commentUris],
          ) as Promise<{ subject: string; uri: string }[]>
        ).then((rows) => {
          const m = new Map<string, string>();
          for (const r of rows) m.set(r.subject, r.uri);
          return m;
        })
      : Promise.resolve(new Map<string, string>()),
  ]);

  const comments = items.map((row) => {
    const author = profiles.get(row.did);
    const parsedFacets = row.facets ? JSON.parse(row.facets) : undefined;
    const focusPhoto = row.focus ? focusPhotos.get(row.focus) : null;

    return {
      ...views.commentView({
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
              handle: author.handle ?? handleMap.get(author.did) ?? author.did,
              displayName: author.value.displayName,
              avatar: blobUrl(author.did, author.value.avatar) ?? undefined,
            })
          : views.grainActorDefsProfileView({
              cid: row.cid,
              did: row.did,
              handle: handleMap.get(row.did) ?? row.did,
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
      }),
      favCount: favCounts.get(row.uri) ?? 0,
      ...(viewerFavs.has(row.uri) ? { viewer: { fav: viewerFavs.get(row.uri) } } : {}),
      ...(mutedDids.has(row.did) ? { muted: true } : {}),
    };
  });

  return ok({ comments, ...(nextCursor ? { cursor: nextCursor } : {}), totalCount });
});
