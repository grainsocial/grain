// Known-account list backing the settings account switcher.
//
// The server session is a single HttpOnly cookie holding one DID, so the
// browser can't hold two live sessions at once. What it can remember is which
// accounts have signed in on this device; switching re-runs the OAuth login for
// that handle, which the PDS usually waves straight through because it still
// has a device session and an existing grant for this client.

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

/**
 * Send the browser through a fresh sign-in for `account`. hatk clears the
 * current session cookie on the way out, so a user who backs out of the PDS
 * page lands signed out — the account stays in the list, one click from
 * signing back in.
 */
export function switchAccount(account: StoredAccount): void {
  const hint = account.handle || account.did;
  window.location.href = `/oauth/login?handle=${encodeURIComponent(hint)}`;
}
