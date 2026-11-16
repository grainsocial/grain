import { afterEach, describe, expect, test, vi } from "vitest";
import { call, onUnauthorized, query, searched, upload, XrpcError, type Fetch } from "$lib/xrpc";
import type * as describeFeeds from "$lib/lexicons/social/grain/feed/describeFeeds.ts";
import type * as getProfile from "$lib/lexicons/social/grain/actor/getProfile.ts";
import type * as putPreferences from "$lib/lexicons/social/grain/actor/putPreferences.ts";
import type * as deleteRecord from "$lib/lexicons/social/grain/repo/deleteRecord.ts";
import type * as updateSeen from "$lib/lexicons/social/grain/notification/updateSeen.ts";
import type * as uploadBlob from "$lib/lexicons/social/grain/repo/uploadBlob.ts";

/** A fetch that answers `body` with `status`, keeping what it was sent. */
function answering(status: number, body: unknown) {
  const sent: { url: string; init: RequestInit }[] = [];
  const fetch = (async (url: string, init: RequestInit = {}) => {
    sent.push({ url, init });
    return new Response(body === undefined ? "" : JSON.stringify(body), { status });
  }) as unknown as Fetch;
  return { fetch, sent };
}

afterEach(() => {
  vi.unstubAllGlobals();
  onUnauthorized(null);
});

describe("searched", () => {
  test("repeats arrays and leaves out nulls", () => {
    expect(searched({ a: "x y", b: [1, 2], c: undefined, d: null, e: false })).toBe(
      "?a=x+y&b=1&b=2&e=false",
    );
    expect(searched({})).toBe("");
    expect(searched(undefined)).toBe("");
  });
});

describe("query", () => {
  test("a query's parameters go in its URL", async () => {
    const { fetch, sent } = answering(200, { did: "did:plc:a", handle: "a.test" });
    const out = await query<typeof getProfile.main>(
      "social.grain.actor.getProfile",
      { actor: "a.test" },
      fetch,
    );
    expect(out.handle).toBe("a.test");
    expect(sent[0].url).toBe("/xrpc/social.grain.actor.getProfile?actor=a.test");
    expect(sent[0].init.method).toBeUndefined();
  });

  test("a refusal throws with its status and the server's error", async () => {
    const { fetch } = answering(400, { error: "InvalidRequest", message: "No account" });
    const err = await query<typeof getProfile.main>(
      "social.grain.actor.getProfile",
      { actor: "x" },
      fetch,
    ).catch((e) => e);
    expect(err).toBeInstanceOf(XrpcError);
    expect(err.message).toBe("XRPC social.grain.actor.getProfile failed: 400");
    expect(err.status).toBe(400);
    expect(err.error).toBe("InvalidRequest");
    expect(err.reason).toBe("No account");
  });

  test("a call that never arrives throws with status 0", async () => {
    const fetch = (async () => {
      throw new TypeError("offline");
    }) as unknown as Fetch;
    const err = await query<typeof describeFeeds.main>(
      "social.grain.feed.describeFeeds",
      {},
      fetch,
    ).catch((e) => e);
    expect(err).toBeInstanceOf(XrpcError);
    expect(err.status).toBe(0);
  });

  test("on the server, a call takes the load's fetch", async () => {
    await expect(
      query<typeof describeFeeds.main>("social.grain.feed.describeFeeds", {}),
    ).rejects.toThrow(/pass the load's fetch/);
  });
});

describe("call and upload", () => {
  test("a procedure's input goes as JSON", async () => {
    const { fetch, sent } = answering(200, {});
    await call<typeof updateSeen.main>(
      "social.grain.notification.updateSeen",
      { seenAt: "2026-10-31T00:00:00.000Z" },
      fetch,
    );
    expect(sent[0].url).toBe("/xrpc/social.grain.notification.updateSeen");
    expect(sent[0].init.method).toBe("POST");
    expect(new Headers(sent[0].init.headers).get("content-type")).toBe("application/json");
    expect(JSON.parse(sent[0].init.body as string)).toEqual({
      seenAt: "2026-10-31T00:00:00.000Z",
    });
  });

  test("bytes go as atproto's JSON writes them", async () => {
    const { fetch, sent } = answering(200, {});
    const input = { preferences: [], raw: new Uint8Array([1, 2, 3]) } as never;
    await call<typeof putPreferences.main>("social.grain.actor.putPreferences", input, fetch);
    expect(JSON.parse(sent[0].init.body as string).raw).toEqual({ $bytes: "AQID" });
  });

  test("an empty answer reads as an empty object", async () => {
    const { fetch } = answering(200, undefined);
    const out = await call<typeof putPreferences.main>(
      "social.grain.actor.putPreferences",
      { preferences: [] },
      fetch,
    );
    expect(out).toEqual({});
  });

  test("a blob goes as its bytes, typed as it is", async () => {
    const { fetch, sent } = answering(200, { blob: { $type: "blob" } });
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" });
    await upload<typeof uploadBlob.main>("social.grain.repo.uploadBlob", blob, fetch);
    expect(sent[0].init.body).toBe(blob);
    expect(new Headers(sent[0].init.headers).get("content-type")).toBe("image/jpeg");
  });
});

describe("a 401", () => {
  test("in the browser, calls the handler", async () => {
    vi.stubGlobal("window", {});
    const seen: string[] = [];
    onUnauthorized((nsid) => seen.push(nsid));
    const { fetch } = answering(401, { error: "AuthenticationRequired" });
    await expect(
      call<typeof deleteRecord.main>(
        "social.grain.repo.deleteRecord",
        { collection: "social.grain.favorite", rkey: "a" },
        fetch,
      ),
    ).rejects.toBeInstanceOf(XrpcError);
    expect(seen).toEqual(["social.grain.repo.deleteRecord"]);
  });

  test("on the server, calls no handler", async () => {
    const seen: string[] = [];
    onUnauthorized((nsid) => seen.push(nsid));
    const { fetch } = answering(401, {});
    await query<typeof describeFeeds.main>("social.grain.feed.describeFeeds", {}, fetch).catch(
      () => {},
    );
    expect(seen).toEqual([]);
  });
});
