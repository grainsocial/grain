import { defineQuery } from "$hatk";
import { hydrateGalleries } from "../feeds/_hydrate.ts";

export default defineQuery("social.grain.unspecced.searchGalleries", async (ctx) => {
  const { params, search, ok } = ctx;
  const { q, limit, cursor, fuzzy } = params;

  const result = await search("social.grain.gallery", q, {
    limit,
    cursor,
    fuzzy,
  });

  const galleries = await hydrateGalleries(ctx, result.records);

  return ok({ items: galleries, cursor: result.cursor });
});
