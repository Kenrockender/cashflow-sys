/* ══════════════════════════════════════════════════════════
   CASHFLOW.SYS — firebase-init.js
   Initializes Firebase app, Firestore, and Auth.
   Must be loaded AFTER firebase-config.js and Firebase SDKs.
══════════════════════════════════════════════════════════ */
if (!window.FIREBASE_CONFIG) throw new Error('firebase-config.js must be loaded before firebase-init.js');

console.log('[FIREBASE] Initializing with project:', window.FIREBASE_CONFIG.projectId);
firebase.initializeApp(window.FIREBASE_CONFIG);

// Use var so `db` / `auth` are normal globals for all later classic scripts (store.js, app.js).
var db = firebase.firestore();
var auth = firebase.auth();

// Disable persistence to avoid cache-only mode issues
// Enable offline persistence (optional - fails silently in private browsing)
window.__cfFirestoreReady = Promise.resolve(); // Skip persistence for now

// App Check: activate if reCAPTCHA site key is configured
// To enable: set window.RECAPTCHA_SITE_KEY before this script loads,
// and add the appcheck-compat SDK to index.html.
if (window.RECAPTCHA_SITE_KEY && firebase.appCheck) {
  firebase.appCheck().activate(window.RECAPTCHA_SITE_KEY, /* isTokenAutoRefreshEnabled */ true);
  console.log('[FIREBASE] App Check activated');
}

console.log('[FIREBASE] Init complete. db:', !!db, 'auth:', !!auth);

/* ─── ESM window bridge (auto-generated) ─── */
Object.assign(window, { db, auth });
