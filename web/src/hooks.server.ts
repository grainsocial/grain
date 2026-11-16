import type { HandleFetch } from "@sveltejs/kit";
import { parseSetCookie, toGrainServe } from "$lib/server/grainServe";

/**
 * A load's fetch of grain-serve's paths on this site (`/xrpc/...`,
 * `/oauth/...`) goes to grain-serve itself, at `GRAIN_SERVE_URL`, with the
 * browser's cookie; a cookie grain-serve sets in answer is set in the page's.
 */
export const handleFetch: HandleFetch = async ({ event, request, fetch }) => {
  const sent = toGrainServe(request, event.url, event.request.headers, process.env.GRAIN_SERVE_URL);
  if (!sent) return fetch(request);
  const res = await fetch(sent);
  for (const header of res.headers.getSetCookie()) {
    const cookie = parseSetCookie(header);
    if (cookie) event.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  return res;
};
