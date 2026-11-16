// The web's server side reaching grain-serve: where it is, which of this
// site's paths are its, and the cookies it answers with.

import type { Cookies } from "@sveltejs/kit";

/** Where grain-serve listens unless `GRAIN_SERVE_URL` says otherwise. */
export const DEFAULT_URL = "http://127.0.0.1:2600";

/** Whether `pathname`, on this site, is one grain-serve answers. */
export function servedByGrainServe(pathname: string): boolean {
  return (
    pathname.startsWith("/xrpc/") ||
    pathname.startsWith("/oauth/") ||
    pathname === "/oauth-client-metadata.json" ||
    pathname === "/.well-known/did.json"
  );
}

/**
 * `request`, made by a load on the page at `page`, sent to grain-serve at
 * `base` with the cookie of the browser's request (`from`); null for a
 * request of anything else, which goes where it was going.
 */
export function toGrainServe(
  request: Request,
  page: URL,
  from: Headers,
  base: string | undefined,
): Request | null {
  const url = new URL(request.url);
  if (url.origin !== page.origin || !servedByGrainServe(url.pathname)) return null;
  const target = new URL(url.pathname + url.search, base || DEFAULT_URL);
  const headers = new Headers(request.headers);
  const cookie = from.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  else headers.delete("cookie");
  return new Request(target, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    // A body that streams goes once; `half` says so.
    ...(request.body ? { duplex: "half" } : {}),
  } as RequestInit);
}

type CookieOptions = Parameters<Cookies["set"]>[2];

/** A `Set-Cookie` header's cookie, and what it says of it. */
export function parseSetCookie(
  header: string,
): { name: string; value: string; options: CookieOptions } | null {
  const [pair, ...attrs] = header.split(";").map((part) => part.trim());
  const eq = pair.indexOf("=");
  if (eq <= 0) return null;
  const options: CookieOptions = {
    path: "/",
    httpOnly: false,
    secure: false,
    // grain-serve's cookies are written as they are to be sent.
    encode: (v: string) => v,
  };
  for (const attr of attrs) {
    const [k, ...rest] = attr.split("=");
    const v = rest.join("=");
    switch (k.toLowerCase()) {
      case "path":
        options.path = v || "/";
        break;
      case "max-age":
        options.maxAge = Number(v);
        break;
      case "expires":
        options.expires = new Date(v);
        break;
      case "httponly":
        options.httpOnly = true;
        break;
      case "secure":
        options.secure = true;
        break;
      case "samesite":
        options.sameSite = v.toLowerCase() as "lax" | "strict" | "none";
        break;
      case "domain":
        options.domain = v;
        break;
    }
  }
  return { name: pair.slice(0, eq), value: pair.slice(eq + 1), options };
}
