// Logging in, out and between accounts, by grain-serve's routes:
//
//   GET  /oauth/session   who the browser is logged in as, and the others
//                         it can switch to
//   POST /oauth/login     {handle, back} or {create: true}: the PDS page to
//                         approve the login at, where the browser goes next
//   POST /oauth/switch    {did}: another account the browser is logged in to
//   POST /oauth/logout    the account in use; the browser goes on as the
//                         other it used last, if any
//
// grain-serve keeps the session and sets the `grain_session` cookie, which
// the browser sends with every call; nothing here reads the cookie.

import { onUnauthorized, type Fetch } from "$lib/xrpc";

/** An account the browser is logged in to. */
export interface Account {
  did: string;
  handle: string;
}

/** Who the browser is logged in as, and the other accounts it can switch to. */
export interface Session {
  account: Account | null;
  accounts: Account[];
}

/** A login, logout or switch grain-serve refused. */
export class AuthError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

/** Who `fetch`'s cookie names: no one for a cookie that no longer holds. */
export async function whoami(fetch: Fetch): Promise<Session> {
  const res = await fetch("/oauth/session", { headers: { accept: "application/json" } });
  if (!res.ok) return { account: null, accounts: [] };
  const body = await res.json().catch(() => ({}));
  const account = isAccount(body?.account) ? body.account : null;
  const accounts = Array.isArray(body?.accounts) ? body.accounts.filter(isAccount) : [];
  return { account, accounts };
}

function isAccount(value: unknown): value is Account {
  return !!value && typeof (value as Account).did === "string";
}

async function post(path: string, body: unknown, fetch: Fetch): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AuthError(0, "Could not reach grain.");
  }
  const answer = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = typeof answer?.message === "string" ? answer.message : "Login failed";
    throw new AuthError(res.status, message);
  }
  return answer ?? {};
}

/** The page a login comes back to: the one it started on. */
function here(): string {
  if (typeof window === "undefined") return "/";
  return window.location.pathname + window.location.search;
}

/** Starts logging in as `handle`, and goes to its PDS to approve it. */
export async function login(
  handle: string,
  back = here(),
  fetch: Fetch = globalThis.fetch,
): Promise<void> {
  const { url } = await post("/oauth/login", { handle, back }, fetch);
  if (typeof url !== "string") throw new AuthError(502, "Login failed");
  window.location.href = url;
}

/** Starts making an account, on the PDS grain sends new accounts to. */
export async function createAccount(fetch: Fetch = globalThis.fetch): Promise<void> {
  const { url } = await post("/oauth/login", { create: true, back: here() }, fetch);
  if (typeof url !== "string") throw new AuthError(502, "Sign up failed");
  window.location.href = url;
}

/** Switches to `did`, another account this browser is logged in to. */
export async function switchTo(did: string, fetch: Fetch = globalThis.fetch): Promise<void> {
  await post("/oauth/switch", { did }, fetch);
}

/** Logs the account in use out. A failure leaves it logged in. */
export async function logout(fetch: Fetch = globalThis.fetch): Promise<void> {
  await post("/oauth/logout", {}, fetch).catch(() => {});
}

/**
 * A call the server answered 401 had the session end under it: the browser
 * logs in again as the same account, coming back to the same page.
 */
export function relogin(handle: string | null | undefined): void {
  if (handle) login(handle).catch(() => {});
}

let viewerHandle: string | null = null;

/** Sets who a call answered 401 logs in again as. */
export function setViewerHandle(handle: string | null): void {
  viewerHandle = handle;
}

onUnauthorized(() => relogin(viewerHandle));
