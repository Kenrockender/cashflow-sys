/**
 * CASHFLOW.SYS Service Worker
 * Portfolio-style strategy:
 * - App shell: cache-first
 * - Firebase/Firestore: network-only (no caching)
 * - Auth/token endpoints: network-only
 */

const CACHE_NAME = 'cashflow-shell-v6';

const PRECACHE_URLS = [
  '/',
  '/app',
  '/public/index.html',
  '/public/landing.html',
  '/public/landing.js',
  '/public/styles/landing.css',
  '/public/styles/styles.css',
  '/public/styles/mobile.css',
  '/public/styles/reimburse.css',
  '/public/styles/polish.css',
  '/public/manifest.json',
  '/public/favicon.ico',
  // Core scripts
  '/src/core/constants.js',
  '/src/core/state.js',
  '/src/core/helpers.js',
  // Data
  '/src/data/firebase-config.js',
  '/src/data/firebase-init.js',
  '/src/data/store.js',
  // i18n
  '/src/i18n/en.js',
  '/src/i18n/id.js',
  '/src/i18n/i18n.js',
  // Services
  '/src/services/exchange-rates.js',
  '/src/services/parser.js',
  '/src/services/auth.js',
  // UI
  '/src/ui/components/charts.js',
  '/src/ui/components/events.js',
  '/src/ui/components/skeleton.js',
  '/src/ui/components/toast.js',
  '/src/ui/components/command-palette.js',
  '/src/ui/render/ui-render.js',
  '/src/ui/render/dashboard-render.js',
  '/src/ui/render/transactions-render.js',
  '/src/ui/render/budget-render.js',
  '/src/ui/render/goals-render.js',
  '/src/ui/render/reports-render.js',
  '/src/ui/render/filters-render.js',
  '/src/ui/render/modals-render.js',
  // Features
  '/src/features/transactions/transactions.js',
  '/src/features/transactions/recurring.js',
  '/src/features/transactions/import-export.js',
  '/src/features/goals/goals.js',
  '/src/features/goals/contributions.js',
  '/src/features/goals/milestones.js',
  '/src/features/budget/budget.js',
  '/src/features/insights/forecast-math.js',
  '/src/features/insights/insights.js',
  '/src/features/accounts/accounts.js',
  '/src/features/accounts/transfers.js',
  '/src/features/accounts/categories.js',
  '/src/features/reimbursement/reimburse.js',
  '/src/features/ai-insights/ai-insights.js',
  '/src/features/notifications/cf-notifications.js',
  '/src/app.js',
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

