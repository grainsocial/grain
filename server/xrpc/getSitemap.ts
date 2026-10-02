// Pages of public profiles and galleries for /sitemap.xml.
//   GET /xrpc/social.grain.unspecced.getSitemap?kind=galleries&page=0
//
// A gallery is listed if it is public (not in a space), has photos, and
// neither it nor its author carries a label, and the author's account is
// active: not taken down, deactivated, or deleted. A profile is listed
// if it has at least one such gallery: an empty profile is a thin page.
//
// Crawlers fetch every page of the sitemap in one sweep, so each page is
// cached for an hour rather than recomputed per request.

import { defineQuery } from "$hatk";
import { unlabeledFilter } from "../labels/_hidden.ts";
import { actorSegment } from "../helpers/resolveHandle.ts";

/** Well under the protocol's 50,000 URLs, to keep each file quick to build. */
const PAGE_SIZE = 10_000;
const TTL = 60 * 60 * 1000;

type Entry = { path: string; lastmod?: string };
type Page = { entries: Entry[]; pageCount: number };
const cache = new Map<string, { data: Page; expires: number }>();

const indexableGallery = `
  g.space IS NULL
  AND (r.status IS NULL OR r.status NOT IN ('takendown', 'deactivated', 'deleted'))
  AND ${unlabeledFilter("g.uri")}
  AND ${unlabeledFilter("g.did")}
  AND NOT EXISTS (
    SELECT 1 FROM "social.grain.gallery__labels_self_labels" sl WHERE sl.parent_uri = g.uri
  )
  AND EXISTS (SELECT 1 FROM "social.grain.gallery.item" gi WHERE gi.gallery = g.uri)`;

function isoDate(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

async function galleries(db: any, page: number): Promise<Page> {
  const [{ n }] = (await db.query(
    `SELECT COUNT(*) AS n FROM "social.grain.gallery" g
     LEFT JOIN _repos r ON r.did = g.did
     WHERE ${indexableGallery}`,
  )) as { n: number }[];
  const rows = (await db.query(
    `SELECT g.uri, g.did, r.handle, g.created_at, g.updated_at
     FROM "social.grain.gallery" g
     LEFT JOIN _repos r ON r.did = g.did
     WHERE ${indexableGallery}
     ORDER BY g.created_at DESC, g.uri
     LIMIT $1 OFFSET $2`,
    [PAGE_SIZE, page * PAGE_SIZE],
  )) as {
    uri: string;
    did: string;
    handle: string | null;
    created_at: string;
    updated_at: string | null;
  }[];
  return {
    pageCount: Math.ceil(Number(n) / PAGE_SIZE),
    entries: rows.map((row) => ({
      path: `/profile/${actorSegment(row.did, row.handle)}/gallery/${row.uri.split("/").pop()}`,
      lastmod: isoDate(row.updated_at ?? row.created_at),
    })),
  };
}

async function profiles(db: any, page: number): Promise<Page> {
  const from = `
    FROM "social.grain.gallery" g
    JOIN "social.grain.actor.profile" p ON p.did = g.did
    LEFT JOIN _repos r ON r.did = g.did
    WHERE ${indexableGallery} AND ${unlabeledFilter("p.uri")}`;
  const [{ n }] = (await db.query(`SELECT COUNT(DISTINCT g.did) AS n ${from}`)) as { n: number }[];
  const rows = (await db.query(
    `SELECT g.did, r.handle, MAX(g.created_at) AS lastmod ${from}
     GROUP BY g.did, r.handle
     ORDER BY g.did
     LIMIT $1 OFFSET $2`,
    [PAGE_SIZE, page * PAGE_SIZE],
  )) as { did: string; handle: string | null; lastmod: string }[];
  return {
    pageCount: Math.ceil(Number(n) / PAGE_SIZE),
    entries: rows.map((row) => ({
      path: `/profile/${actorSegment(row.did, row.handle)}`,
      lastmod: isoDate(row.lastmod),
    })),
  };
}

export default defineQuery("social.grain.unspecced.getSitemap", async (ctx) => {
  const { db, ok, params } = ctx;
  const kind = params.kind === "profiles" ? "profiles" : "galleries";
  const page = Math.max(0, Math.floor(Number(params.page ?? 0)) || 0);
  const key = `${kind}:${page}`;

  const hit = cache.get(key);
  if (hit && Date.now() < hit.expires) return ok(hit.data);

  const data = kind === "profiles" ? await profiles(db, page) : await galleries(db, page);
  // Past the last page there is nothing to keep, and caching it would let any
  // page number grow the map.
  if (page < data.pageCount) cache.set(key, { data, expires: Date.now() + TTL });
  return ok(data);
});
