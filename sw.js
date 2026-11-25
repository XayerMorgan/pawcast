/* PawCast Service Worker — Shell Cache-First, Weather APIs Network-Only (never cache stale weather as live) */
const CACHE_NAME = 'pawcast-shell-v7';
const SHELL_ASSETS = [
  './',
  './weather.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './favicon-32.png',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './field_station_day.webp',
  './field_station_night.webp'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS.map((url) => new Request(url, { cache: 'reload' }))))
      .catch(() => { /* ignore optional asset miss */ })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const reqUrl = new URL(event.request.url);
  // Only cache same-origin app shell assets; third-party weather/radar APIs stay network-only
  if (reqUrl.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return res;
      });
    })
  );
});
