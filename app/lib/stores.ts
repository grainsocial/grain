import { writable } from "svelte/store";

export interface ViewerProfile {
  did: string;
  handle: string | null;
  displayName: string;
  avatar: string | null;
}

export const viewer = writable<ViewerProfile | null>(null);
export const isAuthenticated = writable(false);
export const loginModalOpen = writable(false);

/** Check auth and open login modal if not authenticated. Returns true if authenticated. */
export function requireAuth(): boolean {
  let authed = false;
  isAuthenticated.subscribe((v) => (authed = v))();
  if (!authed) {
    loginModalOpen.set(true);
    return false;
  }
  return true;
}
