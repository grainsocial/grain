import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

// Make defineQuery a passthrough so the default export is the raw handler.
vi.mock("$hatk", () => ({
  defineQuery: (_nsid: string, fn: (ctx: unknown) => Promise<unknown>) => fn,
}));

const mockLookupHandles = vi.fn();
vi.mock("../server/helpers/lookupHandles.ts", () => ({
  lookupHandles: mockLookupHandles,
}));

// Import after mocks are set up (vi.mock calls are hoisted, so this is safe).
let handler: (ctx: unknown) => Promise<unknown>;
beforeAll(async () => {
  handler = (await import("../server/xrpc/getGalleryKnownFavorites.ts")).default as typeof handler;
});

const GALLERY = "at://did:plc:abc/social.grain.gallery/tid123";
const VIEWER = "did:plc:viewer";
const FOLLOWER_A = "did:plc:followerA";
const FOLLOWER_B = "did:plc:followerB";

function makeCtx(overrides: Record<string, unknown> = {}) {
  return {
    ok: (data: unknown) => data,
    params: { gallery: GALLERY, viewer: VIEWER, limit: 50 },
    db: { query: vi.fn().mockResolvedValue([]) },
    lookup: vi.fn().mockResolvedValue(new Map()),
    blobUrl: vi.fn().mockReturnValue(undefined),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockLookupHandles.mockResolvedValue(new Map());
});

describe("getGalleryKnownFavorites", () => {
  it("returns empty when gallery param is missing", async () => {
    const ctx = makeCtx({ params: { viewer: VIEWER } });
    const result = await handler(ctx);
    expect(result).toEqual({ items: [] });
    expect(ctx.db.query).not.toHaveBeenCalled();
  });

  it("returns empty when viewer param is missing", async () => {
    const ctx = makeCtx({ params: { gallery: GALLERY } });
    const result = await handler(ctx);
    expect(result).toEqual({ items: [] });
    expect(ctx.db.query).not.toHaveBeenCalled();
  });

  it("queries with follows as the driving side, filtered by gallery and viewer", async () => {
    const ctx = makeCtx();
    await handler(ctx);

    expect(ctx.db.query).toHaveBeenCalledOnce();
    const [sql, params] = ctx.db.query.mock.calls[0];
    expect(sql).toContain('"social.grain.graph.follow"');
    expect(sql).toContain('"social.grain.favorite"');
    // gallery URI is $1, viewer is $2 — confirms join order
    expect(params[0]).toBe(GALLERY);
    expect(params[1]).toBe(VIEWER);
  });

  it("passes limit through to the query", async () => {
    const ctx = makeCtx({ params: { gallery: GALLERY, viewer: VIEWER, limit: 10 } });
    await handler(ctx);

    const [, params] = ctx.db.query.mock.calls[0];
    expect(params[2]).toBe(10);
  });

  it("returns items for followers who faved the gallery", async () => {
    const ctx = makeCtx({
      db: {
        query: vi.fn().mockResolvedValue([
          { did: FOLLOWER_A },
          { did: FOLLOWER_B },
        ]),
      },
      lookup: vi.fn().mockResolvedValue(
        new Map([
          [FOLLOWER_A, { handle: "alice.bsky.social", value: { displayName: "Alice", avatar: undefined } }],
          [FOLLOWER_B, { handle: "bob.bsky.social", value: { displayName: "Bob", avatar: undefined } }],
        ]),
      ),
    });

    const result = await handler(ctx) as { items: Record<string, unknown>[] };
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({ did: FOLLOWER_A, handle: "alice.bsky.social", displayName: "Alice" });
    expect(result.items[1]).toMatchObject({ did: FOLLOWER_B, handle: "bob.bsky.social", displayName: "Bob" });
  });

  it("deduplicates DIDs in case the join produces duplicates", async () => {
    const ctx = makeCtx({
      db: {
        query: vi.fn().mockResolvedValue([
          { did: FOLLOWER_A },
          { did: FOLLOWER_A },
        ]),
      },
    });

    const result = await handler(ctx) as { items: Record<string, unknown>[] };
    expect(result.items).toHaveLength(1);
  });

  it("falls back to handleMap when no grain profile exists", async () => {
    const ctx = makeCtx({
      db: {
        query: vi.fn().mockResolvedValue([{ did: FOLLOWER_A }]),
      },
      lookup: vi.fn().mockResolvedValue(new Map()),
    });
    mockLookupHandles.mockResolvedValue(new Map([[FOLLOWER_A, "alice-handle.bsky.social"]]));

    const result = await handler(ctx) as { items: { did: string; handle: string }[] };
    expect(result.items[0].handle).toBe("alice-handle.bsky.social");
  });
});
