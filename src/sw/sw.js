/* Service worker. The build prepends `self.__SW_CONFIG__ = {...}` (see build/plugin.ts).
 *
 * Caches
 *   shell-<version>   precached app shell: catalog, offline page, hashed JS/CSS, icons, posters
 *   pages-<version>   recently viewed product pages (network first, bounded)
 *   models            runtime 3D models, content-hashed URLs (cache first, bounded)
 *   posters           extra images fetched at runtime (cache first, bounded)
 * Retailer pages and other cross-origin requests are never intercepted or cached.
 */
/* global self, caches */
const { version, base, precache, maxPages, maxModels, maxPosters } = self.__SW_CONFIG__;
const SHELL = `shell-${version}`;
const PAGES = `pages-${version}`;
const MODELS = 'models';
const POSTERS = 'posters';
const KEEP = new Set([SHELL, PAGES, MODELS, POSTERS]);
const OFFLINE_URL = `${base}offline.html`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      // cache: 'reload' bypasses the HTTP cache so a deploy never mixes versions.
      await cache.addAll(precache.map((url) => new Request(url, { cache: 'reload' })));
      // First install takes control straight away; updates wait for the page to ask.
      if (!self.registration.active) await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      const oldPages = names.filter((n) => n.startsWith('pages-') && n !== PAGES);
      // Carry recently viewed products into the new version by refetching them.
      for (const name of oldPages) {
        const old = await caches.open(name);
        const fresh = await caches.open(PAGES);
        await Promise.allSettled(
          (await old.keys()).map(async (req) => {
            const res = await fetch(req.url, { cache: 'reload' });
            if (res.ok) await fresh.put(req.url, res);
          }),
        );
      }
      await Promise.all(names.filter((n) => !KEEP.has(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

/** Moves an entry to the end of the cache's insertion order so trimming drops the least recent. */
async function touch(cacheName, request, response) {
  const cache = await caches.open(cacheName);
  await cache.delete(request);
  await cache.put(request, response);
}

async function handleNavigation(request) {
  try {
    const response = await fetch(request);
    const url = new URL(request.url);
    if (response.ok && response.type === 'basic' && url.pathname.startsWith(`${base}products/`)) {
      await touch(PAGES, url.pathname, response.clone());
      await trim(PAGES, maxPages);
    }
    return response;
  } catch {
    const path = new URL(request.url).pathname;
    const candidates = [path, path.endsWith('/') ? `${path}index.html` : `${path}/`];
    for (const key of candidates) {
      const hit = (await caches.match(key, { cacheName: PAGES })) || (await caches.match(key, { cacheName: SHELL }));
      if (hit) return hit;
    }
    if (path === base) {
      const shell = await caches.match(`${base}index.html`, { cacheName: SHELL });
      if (shell) return shell;
    }
    return (await caches.match(OFFLINE_URL, { cacheName: SHELL })) || Response.error();
  }
}

async function cacheFirst(request, cacheName, max) {
  // URLs are content-hashed, so query strings (e.g. viewer retries) never change the file.
  const key = new URL(request.url).pathname;
  const hit = (await caches.match(key, { cacheName: SHELL })) || (await caches.match(key, { cacheName }));
  if (hit) {
    if (cacheName !== SHELL) await touch(cacheName, key, hit.clone());
    return hit;
  }
  const response = await fetch(request);
  if (response.ok && response.status === 200) {
    const cache = await caches.open(cacheName);
    await cache.put(key, response.clone());
    if (max) await trim(cacheName, max);
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(base)) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }
  if (request.headers.has('range')) return;
  const path = url.pathname;
  if (/\.(glb|usdz)$/.test(path)) event.respondWith(cacheFirst(request, MODELS, maxModels));
  else if (path.startsWith(`${base}assets/posters/`)) event.respondWith(cacheFirst(request, POSTERS, maxPosters));
  // Hashed build output is immutable, so lazily loaded chunks join the shell cache.
  else if (path.startsWith(`${base}assets/`)) event.respondWith(cacheFirst(request, SHELL));
});
