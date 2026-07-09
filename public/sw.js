const CACHE_NAME = "fab-dashboard-v1";
const APP_SHELL = [
  "/",
  "/icon.svg",
  "/manifest.webmanifest",
  "/icons/apple-touch-icon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

async function precacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  const shellResponse = await fetch("/", { cache: "no-store" });
  if (!shellResponse.ok) throw new Error("failed to fetch app shell");
  const shellHtml = await shellResponse.clone().text();
  await cache.put("/", shellResponse);

  const criticalAssetPaths = new Set();
  for (const match of shellHtml.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
    const url = new URL(match[1], self.location.origin);
    if (url.origin === self.location.origin && url.pathname.startsWith("/assets/")) {
      criticalAssetPaths.add(url.pathname);
    }
  }

  await Promise.all([...criticalAssetPaths].map((path) => cache.add(path)));

  const optionalPaths = APP_SHELL.filter((path) => path !== "/" && !criticalAssetPaths.has(path));
  await Promise.all(
    optionalPaths.map((path) =>
      cache.add(path).catch(() => {
        // Install should survive one missing optional icon/asset; runtime fetch
        // will still try the network when a cached entry is absent.
      })
    )
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheAppShell().catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await caches.match(request)) ?? (await caches.match("/")) ?? Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/icon.svg"
  ) {
    event.respondWith(cacheFirst(request));
  }
});
