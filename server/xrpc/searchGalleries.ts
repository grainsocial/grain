import { defineQuery } from "$hatk";
import { hydrateGalleries } from "../hydrate/galleries.ts";
import { hideLabelsFilter } from "../labels/_hidden.ts";

export default defineQuery("social.grain.unspecced.searchGalleries", async (ctx) => {
  const { params, search, db, ok } = ctx;
  const { q, limit, cursor, fuzzy } = params;

  const result = await search("social.grain.gallery", q, {
    limit,
    cursor,
    fuzzy,
  });

  // Search takes no filter, so hide-labelled galleries are dropped after the
  // fact, the same set every feed leaves out. A page can come back short.
  const uris = result.records.map((r) => r.uri);
  const visible = uris.length
    ? ((await db.query(
        `SELECT t.uri FROM "social.grain.gallery" t
         WHERE t.uri IN (${uris.map((_, i) => `$${i + 1}`).join(", ")})
           AND ${hideLabelsFilter("t.uri")}`,
        uris,
      )) as { uri: string }[])
    : [];
  const shown = new Set(visible.map((r) => r.uri));

  const galleries = await hydrateGalleries(
    ctx,
    result.records.filter((r) => shown.has(r.uri)),
  );

  return ok({ items: galleries, cursor: result.cursor });
});
