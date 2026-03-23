import { callXrpc } from "$hatk/client";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ cookies }) => {
  const parseSessionCookie = (globalThis as any).__hatk_parseSessionCookie;
  const cookieName: string = (globalThis as any).__hatk_sessionCookieName ?? "__hatk_session";
  let viewer: { did: string; handle?: string } | null = null;

  if (parseSessionCookie) {
    const cookieValue = cookies.get(cookieName);
    if (cookieValue) {
      try {
        const request = new Request("http://localhost", {
          headers: { cookie: `${cookieName}=${cookieValue}` },
        });
        viewer = await parseSessionCookie(request);
      } catch {}
    }
  }

  if (viewer) {
    (globalThis as any).__hatk_viewer = viewer;
  }

  return {
    viewer,
    profile: viewer
      ? callXrpc("social.grain.unspecced.getActorProfile", { actor: viewer.did }).catch(() => null)
      : null,
    preferences: viewer ? callXrpc("dev.hatk.getPreferences").catch(() => null) : null,
  };
};
