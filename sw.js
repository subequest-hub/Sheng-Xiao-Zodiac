// Sheng Xiao Zodiac — Service Worker
//
// Strategy: network-first for the app (HTML/JS), so every reload checks
// GitHub Pages for a newer version automatically — no manual cache-bumping
// needed on each deploy. Falls back to cache only when offline.
// Static icons/manifest use cache-first (they rarely change and benefit
// from instant loading).
const CACHE = 'sheng-xiao-v3';
const STATIC_ASSETS = [
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// Install: pre-cache static assets only (not the main HTML/JS).
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

// Activate: delete old caches and take over immediately.
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch:
// - HTML/JS (the app itself): network-first, so updates show up on next reload
//   without needing to clear cache. Falls back to cache if offline.
// - Everything else (icons, manifest): cache-first for speed.
self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);

  // Never intercept cross-origin requests (Firebase, Google APIs, etc.)
  if (url.origin !== self.location.origin) return;

  const isAppShell = req.mode === 'navigate'
    || req.destination === 'document'
    || req.destination === 'script'
    || url.pathname.endsWith('.html');

  if (isAppShell) {
    // Network-first
    e.respondWith(
      fetch(req, { cache: 'no-store' }).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
        }
        return response;
      }).catch(() => caches.match(req).then(cached => cached || caches.match('./zodiac_battle_v2.html')))
    );
  } else {
    // Cache-first for static assets
    e.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(response => {
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE).then(c => c.put(req, clone));
          }
          return response;
        });
      })
    );
  }
});
