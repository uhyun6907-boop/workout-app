// 운동기록 service worker (scope /workout-app/)
const VERSION = 10;
const CACHE = 'workout-app-v' + VERSION;
const ASSETS = ['./', 'index.html', 'styles.css?v=10', 'js/exercises.js?v=10', 'js/csv.js?v=10', 'js/sd.js?v=10', 'js/app.js?v=10', 'manifest.webmanifest', 'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', e => {
  // cache:'reload' so install never picks up stale copies from the 10-minute HTTP cache
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  const done = (async () => {
    const ks = await caches.keys();
    const old = ks.filter(k => k.startsWith('workout-app-') && k !== CACHE);
    await Promise.all(old.map(k => caches.delete(k)));
    await self.clients.claim();
    return old.length > 0;
  })();
  e.waitUntil(done);
  // Upgraded from an older version: reload open windows so they run the new code.
  // Must happen AFTER activation finishes (navigation fetches wait for activation -> deadlock if awaited inside waitUntil).
  done.then(upgraded => {
    if (!upgraded) return;
    setTimeout(async () => {
      const cs = await self.clients.matchAll({ type: 'window' });
      for (const c of cs) { if (new URL(c.url).pathname.startsWith('/workout-app/')) c.navigate(c.url).catch(() => {}); }
    }, 50);
  });
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || !url.pathname.startsWith('/workout-app/')) return;
  if (url.pathname.endsWith('/version.json') || url.pathname.endsWith('/sw.js')) return; // always network
  if (req.mode === 'navigate') {
    e.respondWith(fetch(new Request(url.pathname, { cache: 'no-store', credentials: 'same-origin' })).then(r => {
      if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put('index.html', c)); }
      return r;
    }).catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { if (res.ok && url.search) { const c = res.clone(); caches.open(CACHE).then(x => x.put(req, c)); } return res; })));
});
