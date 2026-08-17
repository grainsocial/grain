import { build, files, version } from "$service-worker";

const CACHE = `cache-${version}`;
const ASSETS = new Set([...build, ...files]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([...ASSETS]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      for (const key of keys) {
        if (key !== CACHE) await caches.delete(key);
      }
      self.clients.claim();
    }),
  );
});

function offlineResponse() {
  return new Response("You appear to be offline.", {
    status: 503,
    statusText: "Offline",
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

// caches.match() resolves to undefined on a miss, and respondWith(undefined)
// throws "Failed to convert value to 'Response'" as an unhandled rejection.
// Navigations are never precached (only build + files are), so every network
// blip during one used to hit that. Always hand back a real Response.
async function fromCache(request) {
  return (await caches.match(request)) || offlineResponse();
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Skip cross-origin requests and API calls
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/xrpc/")) return;

  // For navigation requests, try network first (so new deploys are picked up)
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => fromCache(event.request)));
    return;
  }

  // For assets, use cache-first with network fallback
  if (ASSETS.has(url.pathname)) {
    event.respondWith(
      caches
        .match(event.request)
        .then((cached) => cached || fetch(event.request))
        .catch(() => offlineResponse()),
    );
    return;
  }

  // For everything else, network-first with cache fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // cache.put rejects on partial (206) and opaque responses, which
        // surfaces as another unhandled rejection — only store plain 200s, and
        // never let a caching failure take down the response itself.
        if (response.status === 200 && response.type === "basic") {
          const clone = response.clone();
          caches
            .open(CACHE)
            .then((cache) => cache.put(event.request, clone))
            .catch(() => {});
        }
        return response;
      })
      .catch(() => fromCache(event.request)),
  );
});
