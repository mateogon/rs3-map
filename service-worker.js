const CACHE_NAME = 'rs3-map-cache-v1';
const URLS_TO_CACHE = [
  './',
  './index.html',
  './css/main.css',
  './css/leaflet.css',
  './js/leaflet.js',
  './js/main/main.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(URLS_TO_CACHE))
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Cache-First for Map Tiles (CDN images)
  // Check for cdn.jsdelivr.net AND image extensions or map path signatures
  if (url.hostname === 'cdn.jsdelivr.net' && 
     (url.pathname.includes('/mejrs/layers_rs3') || url.pathname.endsWith('.png'))) {
     
    event.respondWith(
      caches.match(event.request).then(response => {
        if (response) {
          return response; // Return cached tile
        }
        return fetch(event.request).then(networkResponse => {
            // Check if we received a valid response
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'cors') {
              return networkResponse;
            }

            // Clone to cache
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });

            return networkResponse;
        });
      })
    );
    return;
  }

  // Network-First for everything else (ensures code updates are seen)
  // Or standard Stale-While-Revalidate could be better for code?
  // Let's stick to default browser behavior (Network) unless it's in our precache list.
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
