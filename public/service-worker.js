/**
 * CASHFLOW.SYS Service Worker
 * Portfolio-style strategy:
 * - App shell: cache-first
 * - Firebase/Firestore: network-only (no caching)
 * - Auth/token endpoints: network-only
 */

const CACHE_NAME = 'cashflow-shell-v3';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/styles.css',
  '/mobile.css',
  '/app.js',
  '/store.js',
  '/firebase-init.js',
  '/firebase-config.js',
  '/charts.js',
  '/constants.js',
  '/i18n.js',
  '/parser.js',
  '/manifest.json',
  '/favicon.ico'
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

  event.respondWith(cacheFirstWithNetworkFallback(req));
});

async function cacheFirstWithNetworkFallback(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res && res.status === 200 && res.type !== 'opaque') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, res.clone());
    }
    return res;
  } catch (_) {
    if (request.destination === 'document') {
      const indexCached = await caches.match('/index.html');
      if (indexCached) return indexCached;
    }
    throw _;
  }
}

