// HISTORY BLAST service worker - caches the core game shell so it can
// launch and play offline after the first successful load. Deliberately
// small scope: this is the "offline-capable shell" from the PWA spec, not
// a full asset pipeline (no missions/achievements/collection content exist
// yet in this build to cache).

const CACHE_NAME = 'history-blast-shell-v1';
const SHELL_FILES = [
  './',
  './index.html',
  './css/style.css',
  './js/content.js',
  './js/game.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Cache same-origin shell responses opportunistically; don't try to
        // manage cache growth beyond the fixed shell list for this pass.
        if (response.ok && event.request.url.startsWith(self.location.origin)) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
