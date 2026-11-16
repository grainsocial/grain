import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { query } from "$lib/xrpc";
import { KINDS, STATIC_PATHS, escapeXml, xml } from "$lib/sitemap";
import type * as serverGetSitemap from "$lib/lexicons/social/grain/server/getSitemap.ts";

export const GET: RequestHandler = async ({ params, url, fetch }) => {
  const page = Number(params.page);
  if (!Number.isInteger(page) || page < 0) error(404, "Not found");

  let entries: { path: string; lastmod?: string }[];
  if (params.kind === "pages") {
    if (page !== 0) error(404, "Not found");
    entries = STATIC_PATHS.map((path) => ({ path }));
  } else if ((KINDS as readonly string[]).includes(params.kind)) {
    const res = await query<typeof serverGetSitemap.main>(
      "social.grain.server.getSitemap",
      { kind: params.kind as (typeof KINDS)[number], page },
      fetch,
    );
    if (page >= res.pageCount) error(404, "Not found");
    entries = res.entries;
  } else {
    error(404, "Not found");
  }

  return xml(
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (e) =>
      `  <url><loc>${escapeXml(url.origin + encodeURI(e.path))}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ""}</url>`,
  )
  .join("\n")}
</urlset>`,
  );
};
