// Service worker: maakt Visvrienden installeerbaar als app en laadt de spelbestanden razendsnel uit de cache.
// - /b/<build>/...  (spelcode, verandert nooit onder hetzelfde adres): eerst uit de cache
// - /vendor, /models, iconen: uit de cache, op de achtergrond ververst
// - de pagina zelf: eerst van het netwerk (zodat je altijd de nieuwste versie krijgt), anders uit de cache
// - /api en /ws: nooit cachen
const CACHE = 'visvrienden-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
      await self.clients.claim();
    })(),
  );
});

/** Oude builds opruimen zodra er een nieuwe in de cache komt. */
async function pruneBuilds(current) {
  const c = await caches.open(CACHE);
  for (const req of await c.keys()) {
    const m = /\/b\/([A-Za-z0-9]+)\//.exec(new URL(req.url).pathname);
    if (m && m[1] !== current) await c.delete(req);
  }
}

self.addEventListener('fetch', e => {
  const req = e.request,
    url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/') || url.pathname === '/ws') return;
  const build = /^\/b\/([A-Za-z0-9]+)\//.exec(url.pathname);
  if (build) {
    e.respondWith(
      caches.match(req).then(
        hit =>
          hit ||
          fetch(req).then(res => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then(c => c.put(req, copy).then(() => pruneBuilds(build[1])));
            }
            return res;
          }),
      ),
    );
    return;
  }
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }
  if (/^\/(vendor|models)\//.test(url.pathname) || /\.(png|svg|webmanifest)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then(hit => {
        const net = fetch(req)
          .then(res => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then(c => c.put(req, copy));
            }
            return res;
          })
          .catch(() => hit);
        return hit || net;
      }),
    );
  }
});
