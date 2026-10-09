/* Lean Studio service worker: keeps the app working with no network.
   - The first visit downloads every file the page names (index.html, css, scripts) into a cache.
   - After that the page opens from the cache, offline or not. When there is a network it is asked first,
     so a new version arrives on the next load.
   - The deploy replaces __BUILD__ with the commit id, so each release gets its own cache and the old one
     is deleted. Project data is never touched here: it lives in IndexedDB.
   Nothing is fetched from any other site. */
const BUILD = "__BUILD__";
const CACHE = "lean-studio-" + BUILD;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // the page itself says which files it needs, so there is no list to keep up to date
      const res = await fetch("./index.html", { cache: "reload" });
      const html = await res.clone().text();
      const files = new Set([
        "./",
        "./index.html",
        "./manifest.webmanifest",
        "./icons/icon-192.png",
        "./icons/icon-512.png",
        "./icons/apple-touch-icon.png",
      ]);
      for (const m of html.matchAll(/(?:src|href)="((?:js|css)\/[^"]+)"/g))
        files.add("./" + m[1]);
      await cache.put("./index.html", res);
      await cache.addAll([...files].filter((f) => f !== "./index.html"));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const k of await caches.keys())
        if (k.startsWith("lean-studio-") && k !== CACHE) await caches.delete(k);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  const page = req.mode === "navigate";
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      if (page) {
        // the page: the network first (so updates arrive), the saved copy when offline
        try {
          const fresh = await fetch(req);
          if (fresh.ok) cache.put("./index.html", fresh.clone());
          return fresh;
        } catch {
          return (
            (await cache.match("./index.html")) ||
            (await cache.match("./")) ||
            Response.error()
          );
        }
      }
      // everything else is stamped with the commit id in its address, so a saved copy is the right one
      const hit = await cache.match(req, { ignoreSearch: false });
      if (hit) return hit;
      try {
        const fresh = await fetch(req);
        if (fresh.ok) cache.put(req, fresh.clone());
        return fresh;
      } catch {
        return (
          (await cache.match(req, { ignoreSearch: true })) || Response.error()
        );
      }
    })(),
  );
});
