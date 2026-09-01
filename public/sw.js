const SHELL = "mitnimm-shell-v8";
const TILES = "mitnimm-tiles-v8";
const DATA = "mitnimm-data-v8";

const PRECACHE = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      await cache.addAll(PRECACHE);
      const tiles = await caches.open(TILES);
      await tiles.add("https://tiles.openfreemap.org/styles/liberty").catch(() => {});
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  const keep = new Set([SHELL, TILES, DATA]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isMapHost(url) {
  const h = url.hostname;
  return (
    h.endsWith("openfreemap.org") ||
    h.endsWith("geo.admin.ch") ||
    h.endsWith("googleapis.com") ||
    h.endsWith("gstatic.com")
  );
}

function isApiRead(url) {
  if (url.origin !== self.location.origin) return false;
  return (
    url.pathname === "/api/spots" ||
    url.pathname === "/api/history" ||
    url.pathname === "/api/categories"
  );
}

function cacheable(res) {
  return res && res.ok && (res.type === "basic" || res.type === "cors");
}

async function put(name, req, res) {
  if (!cacheable(res)) return;
  const cache = await caches.open(name);
  await cache.put(req, res.clone());
}

async function networkFirst(req, name) {
  try {
    const res = await fetch(req);
    await put(name, req, res);
    return res;
  } catch {
    const hit = await caches.match(req);
    if (hit) return hit;
    throw new Error("offline");
  }
}

async function cacheFirst(req, name) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  await put(name, req, res);
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (isApiRead(url)) {
    event.respondWith(
      networkFirst(req, DATA).catch(() => caches.match(req).then((h) => h || Response.json([]))),
    );
    return;
  }

  if (url.pathname.startsWith("/api")) return;

  if (isMapHost(url)) {
    event.respondWith(cacheFirst(req, TILES).catch(() => caches.match(req)));
    return;
  }

  event.respondWith(
    networkFirst(req, SHELL).catch(() =>
      caches.match(req).then((hit) => hit || caches.match("/")),
    ),
  );
});
