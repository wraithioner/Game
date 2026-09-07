// Minimal offline-first service worker. The whole game (including the Daily
// Run, which derives its seed from the device clock) needs zero network
// access after first load - see docs/PRODUCT_PLAN.md - Technical Architecture.

// This placeholder is replaced with the deployed commit SHA by
// .github/workflows/deploy.yml at deploy time, so every deploy that changes
// any cached file automatically invalidates old clients' caches - forgetting
// to bump a hardcoded version string by hand is a classic, easy-to-miss PWA
// bug (users silently stuck on stale JS forever), so nothing here depends on
// a human remembering to do it. Local development keeps this literal string,
// which is fine - a developer testing sw.js changes locally already knows to
// hard-reload/unregister the service worker between iterations.
const CACHE_NAME = 'swerve-dev';
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
  './src/analytics.js',
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
