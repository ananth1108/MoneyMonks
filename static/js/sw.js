// static/js/sw.js

const CACHE_NAME = "cashflow-canvas-v2";

// Everything we want cached up front
const URLS_TO_CACHE = [
  "/",
  "/static/css/styles.css",
  "/static/js/app.js",
  "/static/js/api.js",
  "/static/js/sw.js",
  "/static/manifest.json",

  // Recommended once you add icons:
  // "/static/icons/icon-192.png",
  // "/static/icons/icon-512.png"
];

// -------------------------------
// INSTALL
// -------------------------------
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[SW] Installing and caching core files");
      return cache.addAll(URLS_TO_CACHE);
    })
  );
  // Activate immediately
  self.skipWaiting();
});

// -------------------------------
// ACTIVATE
// -------------------------------
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// -------------------------------
// FETCH — network-first for API + cache-first for static
// -------------------------------
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1) API requests should be "network → cache fallback"
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(req));
    return;
  }

  // 2) Everything else (CSS, JS, HTML, icons) should be "cache → network fallback"
  event.respondWith(cacheFirst(req));
});

// -------------------------------
// STRATEGIES
// -------------------------------

// For static files (CSS, JS, HTML)
async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;

  try {
    const fresh = await fetch(req);
    const cache = await caches.open(CACHE_NAME);
    cache.put(req, fresh.clone());
    return fresh;
  } catch (err) {
    return cached || Response.error();
  }
}

// For API calls (we want the newest)
async function networkFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(req);
    cache.put(req, fresh.clone());
    return fresh;
  } catch (err) {
    const cached = await cache.match(req);
    return cached || Response.error();
  }
}
