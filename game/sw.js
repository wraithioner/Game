// Minimal offline-first service worker. The whole game (including the Daily
// Ring, which derives its seed from the device clock) needs zero network
// access after first load - see docs/PRODUCT_PLAN.md - Technical Architecture.

const CACHE_NAME = 'ringtrue-v1';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './src/main.js',
  './src/game.js',
  './src/rng.js',
  './src/input.js',
  './src/render.js',
  './src/audio.js',
  './src/share.js',
  './src/storage.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Cache-first for the app shell, since none of it ever changes without a new
// service-worker version; falls back to network for anything uncached.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
