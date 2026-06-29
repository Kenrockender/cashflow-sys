/**
 * CASHFLOW.SYS Service Worker
 * Portfolio-style strategy:
 * - App shell: cache-first
 * - Firebase/Firestore: network-only (no caching)
 * - Auth/token endpoints: network-only
 */

const CACHE_NAME = 'cashflow-shell-v10';

// App shell. The JS/CSS bundles are content-hashed by Vite at build time, so
// their exact filenames aren't known here — they're cached on first fetch by
// the stale-while-revalidate handler below. Precache only stable shell URLs.
const PRECACHE_URLS = [
  '/',
  '/app',
  '/index.html',
  '/landing.html',
  '/landing.js',
  '/styles/landing.css',
  '/styles/styles.css',
  '/styles/mobile.css',
  '/styles/reimburse.css',
  '/styles/polish.css',
  '/manifest.json',
  '/favicon.ico',
  '/logo.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Never cache these - let them go straight to network
const NETWORK_ONLY_PATTERNS = [
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'firebase',
  'googleapis.com'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.allSettled(PRECACHE_URLS.map(url => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  
  // Skip non-http(s) requests
  if (!url.protocol.startsWith('http')) return;
  
  // IMPORTANT: Don't intercept ANY Firebase/Google API requests
  if (NETWORK_ONLY_PATTERNS.some(p => url.hostname.includes(p) || url.href.includes(p))) {
    return; // Let browser handle it directly
  }
  
  // Only cache GET requests for app shell
  if (req.method !== 'GET') return;

  event.respondWith(staleWhileRevalidate(req));
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const networkFetch = fetch(request).then(res => {
    if (res && res.status === 200 && res.type !== 'opaque') {
      cache.put(request, res.clone());
    }
    return res;
  }).catch(() => null);

  if (cached) {
    networkFetch.catch(() => {});
    return cached;
  }

  const res = await networkFetch;
  if (res) return res;

  if (request.destination === 'document') {
    const indexCached = await cache.match('/index.html');
    if (indexCached) return indexCached;
  }

  return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
}

