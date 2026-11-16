// The accounts the settings switcher lists.
//
// grain-serve holds an OAuth session for each account, and the browser a
// cookie for each it is logged in to, so switching is grain-serve's to do
// (`switchTo`), and which accounts it can switch to is what `whoami` says.
//
// localStorage carries only what that list does not, an account's avatar and
// display name, so rows show them on first paint.

import { login, switchTo, whoami, type Account } from "./auth";

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
 * The accounts grain-serve will switch this browser to without a login, the
 * one in use first, and which that is. Null when it cannot be asked, which
 * leaves the switcher to the accounts this browser remembers.
 */
export async function fetchServerAccounts(): Promise<{
  accounts: Account[];
  active: string | null;
} | null> {
  try {
    const session = await whoami(globalThis.fetch);
    const accounts = session.account ? [session.account, ...session.accounts] : [];
    return { accounts, active: session.account?.did ?? null };
  } catch {
    return null;
  }
}

/**
 * Logs in to an account again, at its PDS. Backing out of the PDS's page comes
 * back logged in as before, and the account stays in the list.
 */
export function loginAsAccount(account: StoredAccount): void {
  login(account.handle || account.did).catch(() => {});
}

/**
 * Switches to an account. grain-serve switches to one this browser is logged
 * in to already; any other logs in again at its PDS.
 */
export async function switchAccount(account: StoredAccount): Promise<void> {
  let switched = false;
  try {
    await switchTo(account.did);
    switched = true;
  } catch {
    // Not logged in to it here, or grain-serve unreachable: log in instead.
  }

  if (switched) {
    // A full load rather than a client navigation: the cookie changed, so
    // every page and query loaded so far is the account left's.
    window.location.href = "/";
    return;
  }
  loginAsAccount(account);
}
