// The sitemap behind /sitemap.xml. What matters is what it leaves out: a search
// engine's index cannot blur or warn, so labeled galleries and labeled,
// taken-down or deactivated accounts stay out, as do galleries in a space and empty ones.

import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startTestServer } from "@hatk/hatk/test";

const ALICE = "did:plc:alice";
const BOB = "did:plc:bob"; // account-labeled
const CAROL = "did:plc:carol"; // taken down
const DAN = "did:plc:dan"; // deactivated
const NOHANDLE = "did:plc:nohandle";

let server: Awaited<ReturnType<typeof startTestServer>>;

async function account(did: string, handle: string | null, status = "active") {
  await server.db.run(`INSERT INTO _repos (did, status, handle) VALUES ($1, $2, $3)`, [
    did,
    status,
    handle,
  ]);
  await server.db.run(
    `INSERT INTO "social.grain.actor.profile" (uri, cid, did, indexed_at, created_at)
     VALUES ($1, 'cid', $2, 'i', '2026-01-01')`,
    [`at://${did}/social.grain.actor.profile/self`, did],
  );
}

async function gallery(
  did: string,
  rkey: string,
  opts: { createdAt?: string; space?: string; empty?: boolean } = {},
) {
  const uri = `at://${did}/social.grain.gallery/${rkey}`;
  const createdAt = opts.createdAt ?? "2026-03-01T00:00:00.000Z";
  await server.db.run(
    `INSERT INTO "social.grain.gallery" (uri, cid, did, space, indexed_at, title, created_at)
     VALUES ($1, $2, $3, $4, 'i', $5, $6)`,
    [uri, `cid-${rkey}`, did, opts.space ?? null, rkey, createdAt],
  );
  if (opts.empty) return uri;
  await server.db.run(
    `INSERT INTO "social.grain.gallery.item" (uri, cid, did, space, indexed_at, created_at, gallery, item, position)
     VALUES ($1, $2, $3, $4, 'i', $5, $6, $7, 0)`,
    [
      `at://${did}/social.grain.gallery.item/${rkey}`,
      `cid-i-${rkey}`,
      did,
      opts.space ?? null,
      createdAt,
      uri,
      `at://${did}/social.grain.photo/${rkey}`,
    ],
  );
  return uri;
}

async function label(uri: string, val: string, neg = 0, cts = "2026-03-02T00:00:00.000Z") {
  await server.db.run(
    `INSERT INTO _labels (src, uri, val, neg, cts) VALUES ('did:plc:mod', $1, $2, $3, $4)`,
    [uri, val, neg, cts],
  );
}

async function sitemap(kind: string, page = 0) {
  const res = await server.fetch(
    `/xrpc/social.grain.unspecced.getSitemap?kind=${kind}&page=${page}`,
  );
  expect(res.status).toBe(200);
  return (await res.json()) as { entries: { path: string; lastmod?: string }[]; pageCount: number };
}

beforeAll(async () => {
  server = await startTestServer();
  await account(ALICE, "alice.test");
  await account(BOB, "bob.test");
  await account(CAROL, "carol.test", "takendown");
  await account(DAN, "dan.test", "deactivated");
  await account(NOHANDLE, null);

  await gallery(ALICE, "public", { createdAt: "2026-03-05T00:00:00.000Z" });
  await gallery(ALICE, "older", { createdAt: "2026-03-01T00:00:00.000Z" });
  await gallery(ALICE, "empty", { empty: true });
  await gallery(ALICE, "inspace", { space: "at://did:plc:group/space/social.grain.group/pool" });
  await label(await gallery(ALICE, "porn"), "porn");
  const selfLabeled = await gallery(ALICE, "selfnsfw");
  await server.db.run(
    `INSERT INTO "social.grain.gallery__labels_self_labels" (parent_uri, parent_did, val) VALUES ($1, $2, 'nudity')`,
    [selfLabeled, ALICE],
  );
  // Labeled, then the label withdrawn: back in.
  const cleared = await gallery(ALICE, "cleared", { createdAt: "2026-03-03T00:00:00.000Z" });
  await label(cleared, "sexual", 0, "2026-03-02T00:00:00.000Z");
  await label(cleared, "sexual", 1, "2026-03-04T00:00:00.000Z");

  await gallery(BOB, "bobs");
  await label(BOB, "!hide");
  await gallery(CAROL, "carols");
  await gallery(DAN, "dans");
  await gallery(NOHANDLE, "anon");
});

afterAll(async () => await server?.close());

describe("getSitemap", () => {
  test("galleries: public, non-empty, unlabeled, newest first", async () => {
    const { entries, pageCount } = await sitemap("galleries");
    expect(pageCount).toBe(1);
    expect(entries.map((e) => e.path)).toEqual([
      "/profile/alice.test/gallery/public",
      "/profile/alice.test/gallery/cleared",
      // Same timestamp as `anon`; the URI breaks the tie.
      "/profile/alice.test/gallery/older",
      "/profile/did:plc:nohandle/gallery/anon",
    ]);
    expect(entries[0].lastmod).toBe("2026-03-05T00:00:00.000Z");
  });

  test("profiles: accounts with an indexable gallery, by DID when there is no handle", async () => {
    const { entries } = await sitemap("profiles");
    expect(entries.map((e) => e.path)).toEqual([
      "/profile/alice.test",
      "/profile/did:plc:nohandle",
    ]);
    expect(entries[0].lastmod).toBe("2026-03-05T00:00:00.000Z");
  });

  test("a page past the end is empty", async () => {
    const { entries, pageCount } = await sitemap("galleries", 5);
    expect(entries).toEqual([]);
    expect(pageCount).toBe(1);
  });
});
