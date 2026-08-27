// Known-account list backing the settings account switcher.
//
// The server holds an OAuth session per DID, so switching accounts is a
// server-side operation: `POST /auth/switch` re-issues the session cookie for
// an account this browser has already signed in as. hatk tracks that set in an
// encrypted cookie, which `GET /auth/accounts` reads back — the source of
// truth for what can be switched to.
//
// localStorage carries only display detail (avatar, display name) that the
// server list doesn't have, so rows render fully populated on first paint.
// On hatk builds without the switch endpoints, everything degrades to the
// original behaviour: re-run the OAuth login for that handle.

const STORAGE_KEY = "grain:accounts";
const MAX_ACCOUNTS = 10;

export interface StoredAccount {
  did: string;
  handle: string | null;
  displayName?: string | null;
  avatar?: string | null;
}

function isAccount(value: unknown): value is StoredAccount {
  return !!value && typeof value === "object" && typeof (value as StoredAccount).did === "string";
}

export function listAccounts(): StoredAccount[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isAccount) : [];
  } catch {
    return [];
  }
}

function writeAccounts(accounts: StoredAccount[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts.slice(0, MAX_ACCOUNTS)));
  } catch {
    // Private browsing or a full quota — the switcher degrades to whatever is
    // already stored, which is better than breaking the page.
  }
}

/**
 * Record (or refresh) an account in the list. Existing entries keep their
 * position so the switcher doesn't reshuffle under the user, and null fields
 * on the incoming account don't clobber details we already resolved.
 */
export function rememberAccount(account: StoredAccount): void {
  const accounts = listAccounts();
  const existing = accounts.findIndex((a) => a.did === account.did);
  const merged: StoredAccount =
    existing === -1
      ? account
      : {
          ...accounts[existing],
          ...account,
          handle: account.handle ?? accounts[existing].handle,
          displayName: account.displayName ?? accounts[existing].displayName,
          avatar: account.avatar ?? accounts[existing].avatar,
        };
  if (existing === -1) accounts.push(merged);
  else accounts[existing] = merged;
  writeAccounts(accounts);
}

export function forgetAccount(did: string): void {
  writeAccounts(listAccounts().filter((a) => a.did !== did));
}

/** An account the server will switch to without a trip to the PDS. */
export interface ServerAccount {
  did: string;
  handle: string;
  available: boolean;
}

/**
 * Accounts the server recognises for this browser. Returns null when the
 * endpoint isn't there (older hatk), which is the signal to fall back to
 * re-login switching rather than to show an empty list.
 */
export async function fetchServerAccounts(): Promise<{
  accounts: ServerAccount[];
  active: string | null;
} | null> {
  try {
    const res = await fetch("/auth/accounts", { headers: { accept: "application/json" } });
    if (!res.ok) return null;
    const body = await res.json();
    if (!Array.isArray(body?.accounts)) return null;
    return { accounts: body.accounts, active: body.active ?? null };
  } catch {
    return null;
  }
}

/**
 * Re-run the OAuth login for an account. hatk clears the session cookie on the
 * way out to the PDS, so backing out of it lands the user signed out — the
 * account stays in the list, one click from signing back in.
 */
export function loginAsAccount(account: StoredAccount): void {
  const hint = account.handle || account.did;
  window.location.href = `/oauth/login?handle=${encodeURIComponent(hint)}`;
}

/**
 * Switch the active account. Asks the server to re-issue the session cookie
 * from the grant it already holds; only if that isn't possible — no endpoint,
 * or the stored grant is gone — does the user go back through the PDS.
 */
export async function switchAccount(account: StoredAccount): Promise<void> {
  let switched = false;
  try {
    const res = await fetch("/auth/switch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ did: account.did }),
    });
    switched = res.ok;
  } catch {
    // Network error — fall through to the login redirect.
  }

  if (switched) {
    // Full reload rather than a client navigation: the session cookie changed,
    // so every cached SSR payload and query on the page belongs to the account
    // we just left.
    window.location.href = "/";
    return;
  }
  loginAsAccount(account);
}
