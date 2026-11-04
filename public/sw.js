// LTHAC - Service Worker for Progressive Web App (PWA)
const CACHE_NAME = 'lthac-pwa-v1';
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './pwa-192x192.png',
  './pwa-512x512.png',
  './apple-touch-icon.png',
  './icon.svg',
  './favicon.png'
];

// Install: Precache shell assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('PWA: Failed to cache some static assets during install', err);
      });
    })
  );
});

// Activate: Clean up older cache versions and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Network first with cache fallback for HTML/assets; bypass Firebase & non-GET
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Bypass Google APIs, Firebase, or external dynamic services from caching issues
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit') ||
    url.hostname.includes('firebaseio.com') ||
    url.pathname.startsWith('/api/')
  ) {
    return;
  }

  // Network First, fallback to cache (ideal for real-time applications with offline fallback)
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        // If successful response, clone and update cache
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }
        // Fallback to index.html for navigation requests
        if (request.mode === 'navigate') {
          return caches.match('./') || caches.match('./index.html');
        }
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      })
  );
});
