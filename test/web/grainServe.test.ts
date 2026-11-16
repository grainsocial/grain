import { describe, expect, test } from "vitest";
import { parseSetCookie, servedByGrainServe, toGrainServe } from "$lib/server/grainServe";

const page = new URL("https://grain.social/alice.test");
const browser = new Headers({ cookie: "grain_session=abc; other=1" });

describe("toGrainServe", () => {
  test("sends grain-serve's paths to it, with the browser's cookie", () => {
    const request = new Request("https://grain.social/xrpc/social.grain.actor.getProfile?actor=a");
    const sent = toGrainServe(request, page, browser, "http://grain-serve:2600")!;
    expect(sent.url).toBe("http://grain-serve:2600/xrpc/social.grain.actor.getProfile?actor=a");
    expect(sent.headers.get("cookie")).toBe("grain_session=abc; other=1");
    expect(sent.method).toBe("GET");
  });

  test("defaults to where grain-serve listens", () => {
    const request = new Request("https://grain.social/oauth/session");
    expect(toGrainServe(request, page, browser, undefined)!.url).toBe(
      "http://127.0.0.1:2600/oauth/session",
    );
  });

  test("sends a request with no cookie, for a browser with none", () => {
    const request = new Request("https://grain.social/oauth/session", {
      headers: { cookie: "stale=1" },
    });
    const sent = toGrainServe(request, page, new Headers(), undefined)!;
    expect(sent.headers.get("cookie")).toBeNull();
  });

  test("keeps a procedure's body", async () => {
    const request = new Request("https://grain.social/xrpc/social.grain.notification.updateSeen", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"seenAt":"x"}',
    });
    const sent = toGrainServe(request, page, browser, undefined)!;
    expect(sent.method).toBe("POST");
    expect(await sent.text()).toBe('{"seenAt":"x"}');
  });

  test("leaves anything else where it was going", () => {
    for (const url of [
      "https://grain.social/profile/alice.test",
      "https://cdn.example/xrpc/x",
      "https://grain.social/xrpcs",
    ]) {
      expect(toGrainServe(new Request(url), page, browser, undefined)).toBeNull();
    }
  });

  test("names grain-serve's paths", () => {
    expect(servedByGrainServe("/xrpc/a.b.c")).toBe(true);
    expect(servedByGrainServe("/oauth/login")).toBe(true);
    expect(servedByGrainServe("/oauth-client-metadata.json")).toBe(true);
    expect(servedByGrainServe("/.well-known/did.json")).toBe(true);
    expect(servedByGrainServe("/.well-known/apple-app-site-association")).toBe(false);
    expect(servedByGrainServe("/oauth")).toBe(false);
    expect(servedByGrainServe("/settings")).toBe(false);
  });
});

describe("parseSetCookie", () => {
  test("reads a cookie grain-serve sets", () => {
    const cookie = parseSetCookie(
      "grain_session=a.b.c; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax; Secure",
    )!;
    expect(cookie.name).toBe("grain_session");
    expect(cookie.value).toBe("a.b.c");
    expect(cookie.options).toMatchObject({
      path: "/",
      maxAge: 2592000,
      httpOnly: true,
      sameSite: "lax",
      secure: true,
    });
    expect(cookie.options.encode?.("a~b")).toBe("a~b");
  });

  test("reads one it clears", () => {
    const cookie = parseSetCookie("grain_login=; Path=/; Max-Age=0")!;
    expect(cookie).toMatchObject({ name: "grain_login", value: "", options: { maxAge: 0 } });
    expect(cookie.options.httpOnly).toBe(false);
  });

  test("keeps an = in the value", () => {
    expect(parseSetCookie("a=b=c; Path=/x")).toMatchObject({
      value: "b=c",
      options: { path: "/x" },
    });
  });

  test("takes no cookie from a header with no name", () => {
    expect(parseSetCookie("=x")).toBeNull();
    expect(parseSetCookie("junk")).toBeNull();
  });
});
