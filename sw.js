/* Project Spear — minimal service worker (app-shell cache for installable PWA + offline shell).
   Network-first, and the site's own files are always re-checked with the server (no-cache) so a
   new version shows up on the next normal load instead of sitting behind the browser's cache. */
const CACHE = 'spear-v2';
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const own = new URL(req.url).origin === self.location.origin;
  const net = own ? fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(req);
  e.respondWith(
    net.then(r => {
      if (own && r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); }
      return r;
    }).catch(() => caches.match(req))
  );
});
