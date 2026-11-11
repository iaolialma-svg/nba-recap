// Service worker : appli utilisable hors ligne avec la dernière nuit chargée.
const CACHE = 'nba-recap-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest'])));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  const sameOrigin = url.origin === self.location.origin;
  const isData = sameOrigin && url.pathname.includes('/data/');
  const isImage = /espncdn|akamaized/.test(url.host);
  if (!sameOrigin && !isImage) return;

  if (isData || e.request.mode === 'navigate') {
    // Réseau d'abord (données fraîches), cache si hors ligne.
    e.respondWith(
      fetch(e.request)
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res; })
        .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html'))),
    );
  } else {
    // Cache d'abord pour les fichiers de l'appli et les logos.
    e.respondWith(
      caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
        if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
        return res;
      })),
    );
  }
});
