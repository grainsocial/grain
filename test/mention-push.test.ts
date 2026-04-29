import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

vi.mock("$hatk", () => ({
  defineHook: (_event: string, _opts: unknown, handler: any) => handler,
}));

let commentHook: (ctx: any) => Promise<void>;
let galleryHook: (ctx: any) => Promise<void>;
beforeAll(async () => {
  commentHook = (await import("../server/hooks/on-commit-comment.ts")).default as any;
  galleryHook = (await import("../server/hooks/on-commit-gallery.ts")).default as any;
});

const REPO = "did:plc:author";
const GALLERY_OWNER = "did:plc:gowner";
const GALLERY_URI = "at://did:plc:gowner/social.grain.gallery/g1";
const STORY_URI = "at://did:plc:sowner/social.grain.story/s1";
const COMMENT_URI = "at://did:plc:author/social.grain.comment/c1";
const PARENT_COMMENT_URI = "at://did:plc:pca/social.grain.comment/p1";
const PARENT_COMMENT_AUTHOR = "did:plc:pca";

function mention(did: string) {
  return {
    index: { byteStart: 0, byteEnd: 5 },
    features: [{ $type: "app.bsky.richtext.facet#mention", did }],
  };
}

type Row = Record<string, unknown>;
type Route = { match: (sql: string, params: unknown[]) => Row[] | null };

/**
 * Mock route for the atomic claim `INSERT OR IGNORE ... RETURNING`. Returns []
 * when the (uri, did) was already in the set (simulating a conflict-suppressed
 * insert), otherwise returns one row to mimic the new claim.
 */
function mentionClaim(alreadyClaimed: Set<string> = new Set()): Route {
  return {
    match: (sql, params) => {
      if (!sql.includes("INSERT OR IGNORE INTO _mention_pushes")) return null;
      const did = (params as string[])[1];
      return alreadyClaimed.has(did) ? [] : [{ recipient_did: did }];
    },
  };
}

function makeDb(routes: Route[]) {
  return {
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      for (const r of routes) {
        const out = r.match(sql, params);
        if (out !== null) return out;
      }
      return [];
    }),
    run: vi.fn(async () => {}),
  };
}

const lookup = vi.fn(async () =>
  new Map([[REPO, { did: REPO, value: { displayName: "Author" } }]]),
);

const sendSpy = vi.fn(async () => {});
const push = { send: sendSpy };

beforeEach(() => {
  sendSpy.mockClear();
  lookup.mockClear();
});

describe("on-commit-comment mention fan-out", () => {
  it("pushes gallery-comment-mention to mentioned DID on a top-level gallery comment", async () => {
    const db = makeDb([
      { match: (sql) => (sql.includes('FROM "social.grain.gallery"') && sql.includes("WHERE uri =") ? [{ author: GALLERY_OWNER }] : null) },
      mentionClaim(),
      { match: () => [] },
    ]);
    await commentHook({
      action: "create",
      record: { subject: GALLERY_URI, text: "hi @bob", facets: [mention("did:plc:bob")] },
      repo: REPO,
      uri: COMMENT_URI,
      db,
      lookup,
      push,
    });
    const mentionPush = sendSpy.mock.calls.map((c) => c[0]).find((p: any) => p.data?.type === "gallery-comment-mention");
    expect(mentionPush).toBeDefined();
    expect(mentionPush.did).toBe("did:plc:bob");
    expect(mentionPush.data.uri).toBe(GALLERY_URI);
    expect(mentionPush.data.commentUri).toBe(COMMENT_URI);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT OR IGNORE INTO _mention_pushes"),
      [COMMENT_URI, "did:plc:bob", expect.any(String)],
    );
  });

  it("skips self-mention", async () => {
    const db = makeDb([
      { match: (sql) => (sql.includes('FROM "social.grain.gallery"') ? [{ author: GALLERY_OWNER }] : null) },
      mentionClaim(),
      { match: () => [] },
    ]);
    await commentHook({
      action: "create",
      record: { subject: GALLERY_URI, text: "@me", facets: [mention(REPO)] },
      repo: REPO, uri: COMMENT_URI, db, lookup, push,
    });
    expect(sendSpy.mock.calls.find((c: any) => c[0].data?.type === "gallery-comment-mention")).toBeUndefined();
  });

  it("does not double-notify the gallery owner if they were also mentioned", async () => {
    const db = makeDb([
      { match: (sql) => (sql.includes('FROM "social.grain.gallery"') ? [{ author: GALLERY_OWNER }] : null) },
      mentionClaim(),
      { match: () => [] },
    ]);
    await commentHook({
      action: "create",
      record: { subject: GALLERY_URI, text: "hi @owner", facets: [mention(GALLERY_OWNER)] },
      repo: REPO, uri: COMMENT_URI, db, lookup, push,
    });
    const types = sendSpy.mock.calls.map((c: any) => c[0].data?.type);
    expect(types).toContain("gallery-comment");
    expect(types).not.toContain("gallery-comment-mention");
  });

  it("does not double-notify the parent comment author if they were also mentioned", async () => {
    const db = makeDb([
      { match: (sql) => (sql.includes('FROM "social.grain.comment" WHERE uri =') ? [{ author: PARENT_COMMENT_AUTHOR }] : null) },
      { match: (sql) => (sql.includes('FROM "social.grain.gallery"') ? [{ author: GALLERY_OWNER }] : null) },
      mentionClaim(),
      { match: () => [] },
    ]);
    await commentHook({
      action: "create",
      record: {
        subject: GALLERY_URI,
        replyTo: PARENT_COMMENT_URI,
        text: "@parent",
        facets: [mention(PARENT_COMMENT_AUTHOR)],
      },
      repo: REPO, uri: COMMENT_URI, db, lookup, push,
    });
    const types = sendSpy.mock.calls.map((c: any) => c[0].data?.type);
    expect(types).toContain("comment-reply");
    expect(types).not.toContain("gallery-comment-mention");
  });

  it("sends to nobody when more than 5 distinct mentions remain after dedup", async () => {
    const db = makeDb([
      { match: (sql) => (sql.includes('FROM "social.grain.gallery"') ? [{ author: GALLERY_OWNER }] : null) },
      mentionClaim(),
      { match: () => [] },
    ]);
    const facets = ["a","b","c","d","e","f"].map((x) => mention(`did:plc:${x}`));
    await commentHook({
      action: "create",
      record: { subject: GALLERY_URI, text: "spam", facets },
      repo: REPO, uri: COMMENT_URI, db, lookup, push,
    });
    expect(sendSpy.mock.calls.find((c: any) => c[0].data?.type === "gallery-comment-mention")).toBeUndefined();
  });

  it("still fires mention push when parent author has comments-off but mentions-on", async () => {
    // Regression: previously the supersede set was populated before shouldPush,
    // so a parent author with the reply push disabled was also denied the
    // mention push they had explicitly opted in to.
    const prefsByDid: Record<string, any> = {
      [PARENT_COMMENT_AUTHOR]: { comments: { push: false, inApp: true, from: "all" } },
    };
    const db = makeDb([
      { match: (sql) => (sql.includes('FROM "social.grain.comment" WHERE uri =') ? [{ author: PARENT_COMMENT_AUTHOR }] : null) },
      { match: (sql) => (sql.includes('FROM "social.grain.gallery"') ? [{ author: GALLERY_OWNER }] : null) },
      { match: (sql, params) => {
          if (!sql.includes("_preferences") || !sql.includes("notificationPrefs")) return null;
          const did = (params as any[])[0];
          return prefsByDid[did] ? [{ value: JSON.stringify(prefsByDid[did]) }] : [];
        }
      },
      mentionClaim(),
      { match: () => [] },
    ]);
    await commentHook({
      action: "create",
      record: {
        subject: GALLERY_URI,
        replyTo: PARENT_COMMENT_URI,
        text: "@parent",
        facets: [mention(PARENT_COMMENT_AUTHOR)],
      },
      repo: REPO, uri: COMMENT_URI, db, lookup, push,
    });
    const types = sendSpy.mock.calls.map((c: any) => c[0].data?.type);
    expect(types).not.toContain("comment-reply");      // comments-off honored
    expect(types).toContain("gallery-comment-mention"); // mention push fires
    const mentionTarget = sendSpy.mock.calls.find((c: any) => c[0].data?.type === "gallery-comment-mention");
    expect(mentionTarget?.[0].did).toBe(PARENT_COMMENT_AUTHOR);
  });

  it("does not re-push when the same comment is re-indexed (edit dedup)", async () => {
    // Atomic INSERT OR IGNORE ... RETURNING returns no rows when the dedup row
    // already exists, so an edit re-fire claims nothing and pushes nobody.
    const db = makeDb([
      { match: (sql) => (sql.includes('FROM "social.grain.gallery"') ? [{ author: GALLERY_OWNER }] : null) },
      mentionClaim(new Set(["did:plc:bob"])),
      { match: () => [] },
    ]);
    await commentHook({
      action: "create",
      record: { subject: GALLERY_URI, text: "@bob still", facets: [mention("did:plc:bob")] },
      repo: REPO, uri: COMMENT_URI, db, lookup, push,
    });
    expect(sendSpy.mock.calls.find((c: any) => c[0].data?.type === "gallery-comment-mention")).toBeUndefined();
  });

  it("blocked target still claims a dedup row, so unblocking doesn't re-trigger", async () => {
    // Regression: dedup must be claimed at evaluation time, not after push,
    // otherwise a recipient skipped by block/mute or pref gets pushed on the
    // next re-index after their state changes.
    const db = makeDb([
      { match: (sql) => (sql.includes('FROM "social.grain.gallery"') ? [{ author: GALLERY_OWNER }] : null) },
      mentionClaim(),
      // bob has blocked the actor
      { match: (sql, params) => {
          if (!sql.includes("social.grain.graph.block") && !sql.includes("_mutes")) return null;
          const [recipient, actor] = params as string[];
          return recipient === "did:plc:bob" && actor === REPO ? [{ "1": 1 }] : [];
        }
      },
      { match: () => [] },
    ]);
    await commentHook({
      action: "create",
      record: { subject: GALLERY_URI, text: "hi @bob", facets: [mention("did:plc:bob")] },
      repo: REPO, uri: COMMENT_URI, db, lookup, push,
    });
    expect(sendSpy.mock.calls.find((c: any) => c[0].data?.type === "gallery-comment-mention")).toBeUndefined();
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT OR IGNORE INTO _mention_pushes"),
      [COMMENT_URI, "did:plc:bob", expect.any(String)],
    );
  });

  it("pref-disabled target still claims a dedup row", async () => {
    // Same regression as block path, exercised through shouldPush returning false.
    const prefs = { mentions: { push: false, inApp: true, from: "all" } };
    const db = makeDb([
      { match: (sql) => (sql.includes('FROM "social.grain.gallery"') ? [{ author: GALLERY_OWNER }] : null) },
      mentionClaim(),
      { match: (sql, params) => {
          if (!sql.includes("_preferences") || !sql.includes("notificationPrefs")) return null;
          return (params as string[])[0] === "did:plc:bob" ? [{ value: JSON.stringify(prefs) }] : [];
        }
      },
      { match: () => [] },
    ]);
    await commentHook({
      action: "create",
      record: { subject: GALLERY_URI, text: "hi @bob", facets: [mention("did:plc:bob")] },
      repo: REPO, uri: COMMENT_URI, db, lookup, push,
    });
    expect(sendSpy.mock.calls.find((c: any) => c[0].data?.type === "gallery-comment-mention")).toBeUndefined();
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT OR IGNORE INTO _mention_pushes"),
      [COMMENT_URI, "did:plc:bob", expect.any(String)],
    );
  });

  it("delete action clears _mention_pushes rows for the comment", async () => {
    const db = makeDb([{ match: () => [] }]);
    await commentHook({
      action: "delete", record: null, repo: REPO, uri: COMMENT_URI, db, lookup, push,
    });
    expect(db.run).toHaveBeenCalledWith(
      expect.stringMatching(/DELETE FROM _mention_pushes\s+WHERE record_uri = \$1/),
      [COMMENT_URI],
    );
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it("does NOT push mentions for story comments (in-app only)", async () => {
    const db = makeDb([
      { match: (sql) => (sql.includes('FROM "social.grain.gallery"') ? [] : null) },
      { match: (sql) => (sql.includes('FROM "social.grain.story"') ? [{ author: "did:plc:sowner" }] : null) },
      { match: () => [] },
    ]);
    await commentHook({
      action: "create",
      record: { subject: STORY_URI, text: "@bob", facets: [mention("did:plc:bob")] },
      repo: REPO, uri: COMMENT_URI, db, lookup, push,
    });
    expect(sendSpy.mock.calls.find((c: any) => c[0].data?.type === "gallery-comment-mention")).toBeUndefined();
  });
});

describe("on-commit-gallery mention fan-out", () => {
  it("pushes gallery-mention on create with a description mention", async () => {
    const db = makeDb([
      mentionClaim(),
      { match: () => [] },
    ]);
    await galleryHook({
      action: "create",
      record: { title: "Sunset", description: "@bob look", facets: [mention("did:plc:bob")] },
      repo: REPO, uri: GALLERY_URI, db, lookup, push,
    });
    expect(sendSpy.mock.calls).toHaveLength(1);
    expect(sendSpy.mock.calls[0][0].data).toEqual({ type: "gallery-mention", uri: GALLERY_URI });
    expect(sendSpy.mock.calls[0][0].did).toBe("did:plc:bob");
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT OR IGNORE INTO _mention_pushes"),
      [GALLERY_URI, "did:plc:bob", expect.any(String)],
    );
  });

  it("does not re-push mentions already in _mention_pushes (gallery edit)", async () => {
    const db = makeDb([
      mentionClaim(new Set(["did:plc:bob"])),
      { match: () => [] },
    ]);
    await galleryHook({
      action: "create",
      record: { title: "Sunset", description: "@bob still here", facets: [mention("did:plc:bob")] },
      repo: REPO, uri: GALLERY_URI, db, lookup, push,
    });
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it("on edit, only pushes for newly added mentions", async () => {
    const db = makeDb([
      mentionClaim(new Set(["did:plc:bob"])),
      { match: () => [] },
    ]);
    await galleryHook({
      action: "create",
      record: {
        title: "Sunset",
        description: "@bob @alice",
        facets: [mention("did:plc:bob"), mention("did:plc:alice")],
      },
      repo: REPO, uri: GALLERY_URI, db, lookup, push,
    });
    expect(sendSpy.mock.calls.map((c: any) => c[0].did)).toEqual(["did:plc:alice"]);
  });

  it("sends to nobody when more than 5 mentions on a gallery", async () => {
    const db = makeDb([
      mentionClaim(),
      { match: () => [] },
    ]);
    const facets = ["a","b","c","d","e","f"].map((x) => mention(`did:plc:${x}`));
    await galleryHook({
      action: "create",
      record: { title: "x", description: "spam", facets },
      repo: REPO, uri: GALLERY_URI, db, lookup, push,
    });
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it("skips self-mentions", async () => {
    const db = makeDb([
      mentionClaim(),
      { match: () => [] },
    ]);
    await galleryHook({
      action: "create",
      record: { title: "x", description: "@me", facets: [mention(REPO)] },
      repo: REPO, uri: GALLERY_URI, db, lookup, push,
    });
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it("delete action clears _mention_pushes rows for the gallery", async () => {
    const db = makeDb([{ match: () => [] }]);
    await galleryHook({
      action: "delete", record: null, repo: REPO, uri: GALLERY_URI, db, lookup, push,
    });
    expect(db.run).toHaveBeenCalledWith(
      expect.stringMatching(/DELETE FROM _mention_pushes\s+WHERE record_uri = \$1/),
      [GALLERY_URI],
    );
    expect(sendSpy).not.toHaveBeenCalled();
  });
});
