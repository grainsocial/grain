export async function login(handle: string): Promise<void> {
  const res = await fetch(`/oauth/login?handle=${encodeURIComponent(handle)}`, {
    redirect: "manual",
  });
  if (res.type === "opaqueredirect") {
    window.location.href = `/oauth/login?handle=${encodeURIComponent(handle)}`;
    return;
  }
  if (res.ok) return;
  const body = await res.json().catch(() => ({ error: "Login failed" }));
  throw new Error(body.error || "Login failed");
}

export async function logout(): Promise<void> {
  (globalThis as any).__hatk_viewer = null;
  await fetch("/auth/logout", { method: "POST" }).catch(() => {});
}

export function viewerDid(): string | null {
  if (typeof window === "undefined") return null;
  const viewer = (globalThis as any).__hatk_viewer;
  return viewer?.did ?? null;
}

// Expose viewer for getViewer() bridge
(globalThis as any).__hatk_auth = { viewerDid };
