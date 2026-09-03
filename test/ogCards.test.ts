// The three OpenGraph cards — a gallery, a profile, a story.
//
// They return a satori element tree rather than a rendered image, so what is
// worth asserting is what goes *into* the picture: the right title and handle,
// the right photos, the right fallback when the thing does not exist, and the
// meta a crawler reads. Nothing here rasterises anything.
//
// `defineOG` hands back `{ generate }` untouched, so these run against a real
// database. `fetchImage` and `blobUrl` are stubbed — the first fetches remote
// bytes, the second builds CDN URLs — and `lookup`/`getRecords` stand in for
// hatk's record loaders.

import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startTestServer } from "@hatk/hatk/test";
import galleryOg from "../server/og/gallery.ts";
import profileOg from "../server/og/profile.ts";
import storyOg from "../server/og/story.ts";
import { allFonts, syneBrandFont, fallbackFonts } from "../server/og/fonts.ts";

const ALICE = "did:plc:alice";
const BARE = "did:plc:bare"; // no profile record

let server: any;

/** Every string in the element tree, in document order. */
function textOf(node: any): string[] {
  if (node == null) return [];
  if (typeof node === "string") return [node];
  if (Array.isArray(node)) return node.flatMap(textOf);
  return textOf(node.props?.children);
}

/** Every `src` on an <img> in the tree. */
function imgSrcs(node: any): string[] {
  if (node == null || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(imgSrcs);
  const here = node.type === "img" && node.props?.src ? [node.props.src as string] : [];
  return [...here, ...imgSrcs(node.props?.children)];
}

/** Builds the context an OG handler expects, and records what it asked for. */
function ctxFor(params: Record<string, string>) {
  const fetched: string[] = [];
  return {
    fetched,
    ctx: {
      db: server.db,
      params,
      // The real one downloads the bytes; a data URL derived from the input is
      // enough to tell which image ended up where.
      fetchImage: async (url: string) => {
        fetched.push(url);
        return `data:image/jpeg;base64,${Buffer.from(url).toString("base64url").slice(0, 24)}`;
      },
      blobUrl: (did: string, ref: any, size?: string) => {
        const link = ref?.ref?.$link ?? ref?.$link;
        return link ? `https://cdn.test/${did}/${link}${size ? `?s=${size}` : ""}` : null;
      },
      lookup: async (_collection: string, _field: string, dids: string[]) => {
        const rows = (await server.db.query(
          `SELECT did, cid, display_name, description, avatar FROM "social.grain.actor.profile"
           WHERE did IN (${dids.map((_: any, i: number) => `$${i + 1}`).join(",")})`,
          dids,
        )) as any[];
        const map = new Map();
        for (const r of rows) {
          map.set(r.did, {
            did: r.did,
            cid: r.cid,
            handle: `${r.did.split(":").pop()}.test`,
            value: {
              displayName: r.display_name ?? undefined,
              description: r.description ?? undefined,
              avatar: r.avatar ? JSON.parse(r.avatar) : undefined,
            },
          });
        }
        return map;
      },
      getRecords: async (_collection: string, uris: string[]) => {
        const rows = (await server.db.query(
          `SELECT uri, cid, did, photo, aspect_ratio FROM "social.grain.photo"
           WHERE uri IN (${uris.map((_: any, i: number) => `$${i + 1}`).join(",")})`,
          uris,
        )) as any[];
        const map = new Map();
        for (const r of rows) {
          map.set(r.uri, {
            uri: r.uri,
            cid: r.cid,
            did: r.did,
            value: {
              photo: JSON.parse(r.photo),
              aspectRatio: r.aspect_ratio ? JSON.parse(r.aspect_ratio) : undefined,
            },
          });
        }
        return map;
      },
    } as any,
  };
}

const blob = (link: string) => ({
  $type: "blob",
  ref: { $link: link },
  mimeType: "image/jpeg",
  size: 1,
});

beforeAll(async () => {
  server = await startTestServer();
  const { db } = server;

  for (const did of [ALICE, BARE]) {
    await db.run(`INSERT INTO _repos (did, status, handle) VALUES ($1, 'active', $2)`, [
      did,
      `${did.split(":").pop()}.test`,
    ]);
  }

  await db.run(
    `INSERT INTO "social.grain.actor.profile" (uri, cid, did, indexed_at, display_name, description, avatar, created_at)
     VALUES ($1, 'cid-p', $2, 'i', 'Alice Anders', 'landscape photographer', $3, '2026-01-01')`,
    [`at://${ALICE}/social.grain.actor.profile/self`, ALICE, JSON.stringify(blob("bafy-avatar"))],
  );

  // Eight photos in one gallery: the card takes at most six.
  await db.run(
    `INSERT INTO "social.grain.gallery" (uri, cid, did, indexed_at, title, description, created_at)
     VALUES ($1, 'cid-g1', $2, 'i', 'Portland Sunsets', 'evenings on the river', '2026-03-01')`,
    [`at://${ALICE}/social.grain.gallery/g1`, ALICE],
  );
  for (let i = 0; i < 8; i++) {
    const photoUri = `at://${ALICE}/social.grain.photo/p${i}`;
    await db.run(
      `INSERT INTO "social.grain.photo" (uri, cid, did, indexed_at, photo, aspect_ratio, created_at)
       VALUES ($1, $2, $3, 'i', $4, '{"width":3,"height":2}', '2026-03-01')`,
      [photoUri, `cid-p${i}`, ALICE, JSON.stringify(blob(`bafy-p${i}`))],
    );
    await db.run(
      `INSERT INTO "social.grain.gallery.item" (uri, cid, did, indexed_at, created_at, gallery, item, position)
       VALUES ($1, $2, $3, 'i', '2026-03-01', $4, $5, $6)`,
      [
        `at://${ALICE}/social.grain.gallery.item/i${i}`,
        `cid-i${i}`,
        ALICE,
        `at://${ALICE}/social.grain.gallery/g1`,
        photoUri,
        i,
      ],
    );
  }

  // A gallery with no title text worth speaking of, for the description fallback.
  await db.run(
    `INSERT INTO "social.grain.gallery" (uri, cid, did, indexed_at, title, created_at)
     VALUES ($1, 'cid-g2', $2, 'i', 'Untitled', '2026-03-02')`,
    [`at://${ALICE}/social.grain.gallery/g2`, ALICE],
  );

  await db.run(
    `INSERT INTO "social.grain.story" (uri, cid, did, indexed_at, media, aspect_ratio, created_at)
     VALUES ($1, 'cid-s1', $2, 'i', $3, '{"width":9,"height":16}', '2026-04-01')`,
    [`at://${ALICE}/social.grain.story/s1`, ALICE, JSON.stringify(blob("bafy-story"))],
  );
});

afterAll(async () => await server?.close());

describe("gallery card", () => {
  test("shows the gallery's title and its author's handle", async () => {
    const { ctx } = ctxFor({ did: ALICE, rkey: "g1" });
    const { element } = await galleryOg.generate(ctx);
    const text = textOf(element);
    expect(text).toContain("Portland Sunsets");
    expect(text).toContain("@alice.test");
    expect(text).toContain("grain");
  });

  test("gives a crawler a title and description", async () => {
    const { ctx } = ctxFor({ did: ALICE, rkey: "g1" });
    const { meta } = await galleryOg.generate(ctx);
    expect(meta).toEqual({
      title: "Portland Sunsets by @alice.test — Grain",
      description: "evenings on the river",
    });
  });

  test("falls back to a generic description when the gallery has none", async () => {
    const { ctx } = ctxFor({ did: ALICE, rkey: "g2" });
    const { meta } = await galleryOg.generate(ctx);
    expect(meta!.description).toBe("Photo gallery on Grain");
  });

  test("lays out at most six photos, however many the gallery holds", async () => {
    const { ctx } = ctxFor({ did: ALICE, rkey: "g1" });
    const { element } = await galleryOg.generate(ctx);
    const srcs = imgSrcs(element);
    // One <img> per collage placement, plus the author's avatar.
    expect(srcs.length).toBeLessThanOrEqual(7);
    expect(srcs.length).toBeGreaterThan(1);
  });

  test("fetches the photo bytes and the avatar, not the CDN urls verbatim", async () => {
    const { ctx, fetched } = ctxFor({ did: ALICE, rkey: "g1" });
    const { element } = await galleryOg.generate(ctx);
    expect(fetched.some((u) => u.includes("bafy-avatar"))).toBe(true);
    expect(fetched.filter((u) => u.includes("bafy-p")).length).toBe(6);
    // Nothing in the rendered tree points at the CDN — satori gets data URLs.
    expect(imgSrcs(element).every((s) => s.startsWith("data:"))).toBe(true);
  });

  test("says so when the gallery does not exist", async () => {
    const { ctx } = ctxFor({ did: ALICE, rkey: "nope" });
    const { element } = await galleryOg.generate(ctx);
    expect(textOf(element)).toEqual(["Gallery not found"]);
  });

  test("ships the fonts it needs to draw the title", async () => {
    const { ctx } = ctxFor({ did: ALICE, rkey: "g1" });
    const { options } = await galleryOg.generate(ctx);
    expect(options!.fonts!.map((f: any) => f.name)).toEqual(allFonts().map((f) => f.name));
  });
});

describe("profile card", () => {
  test("shows the display name and handle", async () => {
    const { ctx } = ctxFor({ did: ALICE });
    const { element } = await profileOg.generate(ctx);
    // The description goes to the crawler in `meta` but is deliberately not
    // drawn on the card — the card is name, handle and branding.
    expect(textOf(element)).toEqual(["Alice Anders", "@alice.test", "grain"]);
  });

  test("accepts a handle in place of a did", async () => {
    const byHandle = await profileOg.generate(ctxFor({ did: "alice.test" }).ctx);
    const byDid = await profileOg.generate(ctxFor({ did: ALICE }).ctx);
    expect(byHandle.meta).toEqual(byDid.meta);
  });

  test("gives a crawler a title and description", async () => {
    const { ctx } = ctxFor({ did: ALICE });
    const { meta } = await profileOg.generate(ctx);
    expect(meta).toEqual({
      title: "Alice Anders (@alice.test) — Grain",
      description: "landscape photographer",
    });
  });

  test("falls back to the did when there is no profile record", async () => {
    const { ctx } = ctxFor({ did: BARE });
    const { meta } = await profileOg.generate(ctx);
    // No profile means no handle either — the truncated did stands in for both.
    expect(meta!.title).toBe(`${BARE.slice(0, 24)} (@${BARE.slice(0, 24)}) — Grain`);
    expect(meta!.description).toBe(`@${BARE.slice(0, 24)} on Grain`);
  });

  test("draws a cover photo from each recent gallery", async () => {
    const { ctx, fetched } = ctxFor({ did: ALICE });
    await profileOg.generate(ctx);
    // Only position 0 of g1 qualifies; g2 has no items.
    expect(fetched.filter((u) => u.includes("bafy-p")).length).toBe(1);
    expect(fetched.some((u) => u.includes("bafy-p0"))).toBe(true);
  });
});

describe("story card", () => {
  test("shows the author and draws the story image", async () => {
    const { ctx, fetched } = ctxFor({ did: ALICE, rkey: "s1" });
    const { element } = await storyOg.generate(ctx);
    // The card names the author; the handle appears only in the meta title.
    expect(textOf(element)).toEqual(["Alice Anders", "grain"]);
    expect(fetched.some((u) => u.includes("bafy-story"))).toBe(true);
    expect(imgSrcs(element).every((s) => s.startsWith("data:"))).toBe(true);
  });

  test("gives a crawler a title", async () => {
    const { ctx } = ctxFor({ did: ALICE, rkey: "s1" });
    const { meta } = await storyOg.generate(ctx);
    expect(meta).toEqual({
      title: "Story by @alice.test — Grain",
      description: "Photo story on Grain",
    });
  });

  test("says so when the story does not exist", async () => {
    const { ctx } = ctxFor({ did: ALICE, rkey: "nope" });
    const { element } = await storyOg.generate(ctx);
    expect(textOf(element)).toEqual(["Story not found"]);
  });
});

describe("fonts", () => {
  test("loads the brand font and the fallbacks", () => {
    expect(syneBrandFont()).toMatchObject({ name: "Syne", weight: 800, style: "normal" });
    expect(syneBrandFont().data.byteLength).toBeGreaterThan(0);
    expect(fallbackFonts().map((f) => f.name)).toEqual(["Noto Sans JP", "Noto Emoji"]);
    expect(allFonts()).toHaveLength(3);
  });

  test("reads each font file once and caches it", () => {
    // Every card asks for the whole set; re-reading three files per request
    // would be a per-request disk hit for bytes that never change.
    expect(syneBrandFont().data).toBe(syneBrandFont().data);
    expect(fallbackFonts()[0].data).toBe(fallbackFonts()[0].data);
  });
});
