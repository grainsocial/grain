import type { RequestHandler } from "./$types";
import { query } from "$lib/xrpc";
import { KINDS, xml } from "$lib/sitemap";
import type * as serverGetSitemap from "$lib/lexicons/social/grain/server/getSitemap.ts";

// The sitemap index: the static pages, then one child sitemap per page of
// profiles and galleries. robots.txt points crawlers here.
export const GET: RequestHandler = async ({ url, fetch }) => {
  const counts = await Promise.all(
    KINDS.map((kind) =>
      query<typeof serverGetSitemap.main>(
        "social.grain.server.getSitemap",
        { kind, page: 0 },
        fetch,
      ),
    ),
  );
  const children = [`${url.origin}/sitemap/pages-0.xml`];
  KINDS.forEach((kind, i) => {
    for (let page = 0; page < counts[i].pageCount; page++) {
      children.push(`${url.origin}/sitemap/${kind}-${page}.xml`);
    }
  });

  return xml(
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${children.map((loc) => `  <sitemap><loc>${loc}</loc></sitemap>`).join("\n")}
</sitemapindex>`,
  );
};
