import { afterEach, describe, expect, test, vi } from "vitest";
import {
  AuthError,
  createAccount,
  login,
  logout,
  setViewerHandle,
  switchTo,
  whoami,
} from "$lib/auth";
import { call, type Fetch } from "$lib/xrpc";
import type * as deleteRecord from "$lib/lexicons/social/grain/repo/deleteRecord.ts";

type Sent = { url: string; init: RequestInit };

/** A fetch answering each path as `answers` says, keeping what it was sent. */
function server(answers: Record<string, [number, unknown]>) {
  const sent: Sent[] = [];
  const fetch = (async (url: string, init: RequestInit = {}) => {
    sent.push({ url, init });
    const [status, body] = answers[url] ?? [404, {}];
    return new Response(JSON.stringify(body), { status });
  }) as unknown as Fetch;
  return { fetch, sent };
}

function inBrowser(path = "/alice.test/gallery/x", search = "?y=1") {
  const location = { pathname: path, search, href: `https://grain.social${path}${search}` };
  vi.stubGlobal("window", { location });
  return location;
}

const body = (s: Sent) => JSON.parse(s.init.body as string);

afterEach(() => {
  vi.unstubAllGlobals();
  setViewerHandle(null);
});

describe("whoami", () => {
  test("names the account in use and the others", async () => {
    const { fetch, sent } = server({
      "/oauth/session": [
        200,
        {
          account: { did: "did:plc:a", handle: "a.test" },
          accounts: [{ did: "did:plc:b", handle: "b.test" }, { nope: true }],
        },
      ],
    });
    expect(await whoami(fetch)).toEqual({
      account: { did: "did:plc:a", handle: "a.test" },
      accounts: [{ did: "did:plc:b", handle: "b.test" }],
    });
    expect(sent[0].init.method).toBeUndefined();
  });

  test("names no one for no session, or a server that fails", async () => {
    const none = { account: null, accounts: [] };
    expect(
      await whoami(server({ "/oauth/session": [200, { account: null, accounts: [] }] }).fetch),
    ).toEqual(none);
    expect(await whoami(server({ "/oauth/session": [200, {}] }).fetch)).toEqual(none);
    expect(await whoami(server({ "/oauth/session": [501, {}] }).fetch)).toEqual(none);
  });
});

describe("login", () => {
  test("asks for the handle's login, coming back here, and goes to approve it", async () => {
    const location = inBrowser();
    const { fetch, sent } = server({
      "/oauth/login": [200, { url: "https://pds.test/authorize?x" }],
    });
    await login("alice.test", undefined, fetch);
    expect(sent[0].init.method).toBe("POST");
    expect(body(sent[0])).toEqual({ handle: "alice.test", back: "/alice.test/gallery/x?y=1" });
    expect(location.href).toBe("https://pds.test/authorize?x");
  });

  test("says why a login is refused", async () => {
    const location = inBrowser();
    const { fetch } = server({
      "/oauth/login": [
        400,
        { error: "InvalidRequest", message: "No account answers to nobody.test." },
      ],
    });
    const err = await login("nobody.test", "/", fetch).catch((e) => e);
    expect(err).toBeInstanceOf(AuthError);
    expect(err.status).toBe(400);
    expect(err.message).toBe("No account answers to nobody.test.");
    expect(location.href).toBe("https://grain.social/alice.test/gallery/x?y=1");
  });

  test("making an account asks for one", async () => {
    const location = inBrowser("/", "");
    const { fetch, sent } = server({ "/oauth/login": [200, { url: "https://pds.test/signup" }] });
    await createAccount(fetch);
    expect(body(sent[0])).toEqual({ create: true, back: "/" });
    expect(location.href).toBe("https://pds.test/signup");
  });
});

describe("switching and logging out", () => {
  test("switches by DID", async () => {
    const { fetch, sent } = server({ "/oauth/switch": [200, {}] });
    await switchTo("did:plc:b", fetch);
    expect(body(sent[0])).toEqual({ did: "did:plc:b" });
  });

  test("a switch refused throws", async () => {
    const { fetch } = server({ "/oauth/switch": [400, { message: "not logged in to that" }] });
    await expect(switchTo("did:plc:z", fetch)).rejects.toThrow("not logged in to that");
  });

  test("logging out asks once, and a failure is not thrown", async () => {
    const { fetch, sent } = server({ "/oauth/logout": [403, {}] });
    await logout(fetch);
    expect(sent.map((s) => [s.url, s.init.method])).toEqual([["/oauth/logout", "POST"]]);
  });
});

describe("a session that ends", () => {
  test("a call answered 401 logs in again as the viewer", async () => {
    inBrowser();
    const sent: Sent[] = [];
    const answers: Record<string, [number, unknown]> = {
      "/xrpc/social.grain.repo.deleteRecord": [401, { error: "AuthenticationRequired" }],
      "/oauth/login": [200, { url: "https://pds.test/authorize" }],
    };
    vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
      sent.push({ url, init });
      const [status, out] = answers[url];
      return new Response(JSON.stringify(out), { status });
    });
    setViewerHandle("alice.test");
    await call<typeof deleteRecord.main>("social.grain.repo.deleteRecord", {
      collection: "social.grain.favorite",
      rkey: "a",
    }).catch(() => {});
    await vi.waitFor(() => expect(sent.map((s) => s.url)).toContain("/oauth/login"));
    expect(body(sent[1]).handle).toBe("alice.test");
  });
});
