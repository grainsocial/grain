// Records that the viewer watched some stories.
//   POST /xrpc/social.grain.unspecced.markStoriesViewed { stories: [at-uri] }
//
// Viewed state lives in _story_views, private to the viewer, so what you
// watched on the web is what your phone sees as watched and the other way
// round. Marking the same story twice is a no-op, and a URI that is not a
// story the appview knows is dropped silently: the client got the URI from us,
// and the only way it is missing now is that the story was deleted in between.

import { defineProcedure, InvalidRequestError } from "$hatk";

const MAX_STORIES = 100;

export default defineProcedure("social.grain.unspecced.markStoriesViewed", async (ctx) => {
  const { ok, db, viewer } = ctx;
  if (!viewer) throw new Error("Authentication required");

  const { stories } = ctx.input;
  if (!Array.isArray(stories) || stories.length === 0) {
    throw new InvalidRequestError("stories must be a non-empty array of AT URIs");
  }
  if (stories.length > MAX_STORIES) {
    throw new InvalidRequestError(`stories may hold at most ${MAX_STORIES} URIs`);
  }
  const uris = [...new Set(stories)];
  if (uris.some((u) => typeof u !== "string" || !u.startsWith("at://"))) {
    throw new InvalidRequestError("stories must be AT URIs");
  }

  const known = (await db.query(
    `SELECT uri FROM "social.grain.story"
     WHERE uri IN (${uris.map((_, i) => `$${i + 1}`).join(",")})`,
    uris,
  )) as { uri: string }[];

  const now = new Date().toISOString();
  for (const { uri } of known) {
    await db.run(
      `INSERT INTO _story_views (did, subject, created_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (did, subject) DO NOTHING`,
      [viewer.did, uri, now],
    );
  }

  return ok({});
});
