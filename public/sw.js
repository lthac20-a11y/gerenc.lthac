// LTHAC - Service Worker for Progressive Web App (PWA)
const CACHE_NAME = 'lthac-pwa-v3';
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icone.png',
  './pwa-192x192.png',
  './pwa-512x512.png',
  './pwa-maskable-512x512.png',
  './apple-touch-icon.png',
  './icon.svg',
  './favicon.png'
];

// Install: Precache shell assets resiliently without failing if one asset has issues
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        PRECACHE_ASSETS.map((asset) =>
          cache.add(asset).catch((err) => {
            console.warn(`PWA: Cache add error for ${asset}:`, err);
          })
        )
      );
    })
  );
});

// Activate: Clean up older cache versions and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Message listener to trigger immediate skipWaiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch: Network first with cache fallback; bypass Firebase, Google APIs & chrome-extensions
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Bypass Google APIs, Firebase, or external dynamic services from caching
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit') ||
    url.hostname.includes('firebaseio.com') ||
    url.pathname.startsWith('/api/') ||
    url.protocol.startsWith('chrome-extension')
  ) {
    return;
  }

  // Network First with fallback to cache
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache).catch(() => {});
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
          const indexHtml = (await caches.match('./index.html')) || (await caches.match('./'));
          if (indexHtml) {
            return indexHtml;
          }
        }
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      })
  );
});
