/* ══════════════════════════════════════════════════════════
   CASHFLOW.SYS — auth.js
   Firebase auth state, live Firestore listeners,
   cloud health monitoring, and offline queue sync.
   Load order: FIFTH (after transactions.js)
   Depends on: state.js, helpers.js, ui-render.js,
               transactions.js, firebase-init.js, store.js
══════════════════════════════════════════════════════════ */

/* ── LIVE LISTENER MANAGEMENT ────────────────────────────── */
function clearLiveListeners() {
  _liveUnsubs.forEach(fn => { try { fn(); } catch (_) { } });
  _liveUnsubs = [];
}

function setupLiveListeners(uid) {
  clearLiveListeners();
  if (!uid) return;

  const txQ = db.collection('users').doc(uid).collection('transactions').orderBy('date', 'desc').limit(1200);
  const goalsQ = db.collection('users').doc(uid).collection('goals').orderBy('createdAt', 'asc');
  const budgetRef = db.collection('users').doc(uid).collection('settings').doc('budgets');

  _liveUnsubs.push(txQ.onSnapshot(snap => {
    const freshTxs = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => !t.deleted).sort(sortTxByInput);
    // Keep offline_ items that are NOT yet represented in the fresh snapshot
    // (fingerprint-based: same date|amount|description means it's already synced)
    const freshFps = new Set(freshTxs.map(window.txSyncFingerprint));
    const stillPending = S.transactions.filter(t =>
      String(t.id).startsWith('offline_') && !freshFps.has(window.txSyncFingerprint(t))
    );
    S.transactions = [...freshTxs, ...stillPending].sort(sortTxByInput);
    _lastTxRenderHash = ''; // tx data changed — force tx tab re-render
    S._oldestTxDate = S.transactions.length ? S.transactions[S.transactions.length - 1].date : null;
    S._hasMoreTx = S.transactions.length >= 1200;
    Charts.invalidate(); render();
  }, e => console.warn('tx listener:', e && (e.code || e.message))));

  _liveUnsubs.push(goalsQ.onSnapshot(snap => {
    S.goals = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderGoalsTab();
  }, e => console.warn('goals listener:', e && (e.code || e.message))));

  _liveUnsubs.push(budgetRef.onSnapshot(doc => {
    if (!doc.exists) { S.budgets = { ...DEF_BUDGETS }; if (S.activeTab === 'budget') renderBudgetTab(); render(); return; }
    const raw = doc.data() || {};
    const percents = raw.__percents__ || {};
    const income = raw.__income__ || parseInt(localStorage.getItem('cf-total-income')) || 10000000;
    const amounts = {};
    for (const k of Object.keys(raw)) { if (!k.startsWith('__')) amounts[k] = raw[k]; }
    S.budgets = amounts;
    S.budgetPercents = Object.keys(percents).length ? percents : S.budgetPercents;
    S.totalIncome = income;
    if (S.activeTab === 'budget') renderBudgetTab();
    render();
  }, e => console.warn('budget listener:', e && (e.code || e.message))));
}

/* ── CLOUD STATUS ────────────────────────────────────────── */
function setCloudStatus(kind, text) {
  const pill = document.getElementById('cloud-status-pill');
  const label = document.getElementById('cloud-status-text');
  if (!pill || !label) return;
  pill.classList.remove('online', 'offline', 'cache');
  if (kind) pill.classList.add(kind);
  label.textContent = text || '';
}

async function withTimeout(promise, ms = 4500, code = 'cf-timeout') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => { const err = new Error('Timeout'); err.code = code; reject(err); }, ms);
  });
  return Promise.race([promise.finally(() => clearTimeout(timer)), timeout]);
}

async function checkCloudHealth() {
  if (!auth.currentUser) { setCloudStatus('', t('status.connecting')); return; }
  if (!navigator.onLine) { setCloudStatus('offline', t('status.offline')); return; }

  const pending = await OQ.getAll().catch(() => []);
  if (pending.length > 0) { setCloudStatus('cache', t('status.pending', { n: pending.length })); return; }

  setCloudStatus('online', t('status.online'));

  // Background verification (non-blocking) — only every 2 minutes
  if (!window._lastCloudVerify || Date.now() - window._lastCloudVerify > 120000) {
    window._lastCloudVerify = Date.now();
    (async () => {
      try {
        const probe = db.collection('users').doc(auth.currentUser.uid).collection('settings').doc('budgets');
        await withTimeout(probe.get({ source: 'server' }), 3000, 'cf-cloud-probe-timeout');
      } catch (e) {
        if ((typeof isOfflineFirestoreError === 'function' && isOfflineFirestoreError(e)) || e?.code === 'cf-cloud-probe-timeout') {
          setCloudStatus('cache', t('status.cache'));
        }
      }
    })();
  }
}

function startCloudHealthMonitor() {
  if (_cloudHealthTimer) clearInterval(_cloudHealthTimer);
  void checkCloudHealth();
  _cloudHealthTimer = setInterval(() => { void checkCloudHealth(); }, 30000);
}

function stopCloudHealthMonitor() {
  if (_cloudHealthTimer) clearInterval(_cloudHealthTimer);
  _cloudHealthTimer = null;
}

/* ── OFFLINE QUEUE SYNC ──────────────────────────────────── */
/**
 * Push queued offline transactions to Firestore.
 * Runs on `online`, tab focus, login, periodic timer, and manual button.
 * @param {{ silent?: boolean, manual?: boolean }} [options]
 */
async function syncQueuedTransactionsIfAny(options = {}) {
  const silent = options.silent === true;
  const manual = options.manual === true;
  try {
    if (!auth.currentUser) { if (manual) toast(t('toast.sync.need.login')); return { n: 0, failed: 0 }; }
    if (manual) {
      const pre = await OQ.getAll();
      if (!pre.length) { toast(t('toast.sync.nothing')); return { n: 0, failed: 0 }; }
    }
    const { n, failed, syncedFingerprints } = await OQ.flush();
    if (n > 0) {
      const fresh = await Store.getLatest(2000);
      S.transactions = mergeTransactionsAfterQueueFlush(fresh, S.transactions, syncedFingerprints);
      Charts.invalidate(); render();
    }
    if (!silent && (n > 0 || failed > 0)) {
      if (failed > 0) toast(t('toast.sync.partial', { ok: n, fail: failed }));
      else toast(t('toast.synced', { n }));
    }
    return { n, failed };
  } catch (e) {
    console.warn('syncQueuedTransactionsIfAny:', e?.message);
    if (manual) toast(t('toast.sync.error') + (e.message || ''));
    throw e;
  }
}

/* ── DATA REFRESH ────────────────────────────────────────── */
async function refreshFromFirestore() {
  const [txs, budgetsFull, goals] = await Promise.all([Store.getLatest(2000), Store.getBudgetsFull(), Store.getGoals()]);
  S.transactions = txs;
  S.budgets = budgetsFull.amounts;
  S.budgetPercents = Object.keys(budgetsFull.percents || {}).length ? budgetsFull.percents : S.budgetPercents;
  S.totalIncome = budgetsFull.income || S.totalIncome || 10000000;
  S.goals = goals;
  S._hasMoreTx = txs.length >= 1;
  S._oldestTxDate = txs.length ? txs[txs.length - 1].date : null;
  Charts.invalidate(); render();
}

/* ── SECURITY PROBE ──────────────────────────────────────── */
async function checkFirestoreRules() {
  const banner = document.getElementById('security-banner');
  if (!banner || localStorage.getItem('cf-rules-ok')) return;
  try {
    await db.collection('users').doc('__security_probe__').collection('transactions').limit(1).get();
    banner.classList.remove('hidden');
  } catch (e) {
    if (e.code === 'permission-denied') { localStorage.setItem('cf-rules-ok', '1'); banner.classList.add('hidden'); return; }
    if (typeof isOfflineFirestoreError === 'function' && isOfflineFirestoreError(e)) return;
  }
}

/* ── PULL TO REFRESH INIT ────────────────────────────────── */
function initPullToRefresh() {
  const THRESHOLD = 90;
  const atTop = () => (document.scrollingElement || document.documentElement).scrollTop <= 0;
  const blockedTarget = el => {
    while (el) {
      if (el.classList?.contains('modal') || el.classList?.contains('tx-list') || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return true;
      el = el.parentElement;
    }
    return false;
  };

  const onStart = e => {
    if (_ptrState.busy || !auth.currentUser) return;
    if (blockedTarget(e.target)) return;
    if (!atTop() || !e.touches || e.touches.length !== 1) return;
    _ptrState.startY = e.touches[0].clientY;
    _ptrState.pulling = true;
    _ptrState.armed = false;
  };

  const onMove = e => {
    if (!_ptrState.pulling || _ptrState.busy) return;
    const dy = e.touches[0].clientY - _ptrState.startY;
    if (dy <= 10) return;
    if (dy <= 0 || !atTop()) { _ptrState.pulling = false; hidePullIndicator(); return; }
    _ptrState.armed = dy >= THRESHOLD;
    showPullIndicator(_ptrState.armed ? 'Release to sync' : 'Pull to sync', dy);
  };

  const onEnd = async () => {
    if (!_ptrState.pulling) return;
    _ptrState.pulling = false;
    if (!_ptrState.armed || _ptrState.busy) { _ptrState.armed = false; hidePullIndicator(); return; }
    _ptrState.armed = false;
    _ptrState.busy = true;
    showPullIndicator('Syncing...', 120);
    try {
      const syncRes = await syncQueuedTransactionsIfAny({ silent: true });
      await refreshFromFirestore();
      if (syncRes?.n > 0 || syncRes?.failed > 0) {
        if (syncRes.failed > 0) toast(t('toast.sync.partial', { ok: syncRes.n, fail: syncRes.failed }));
        else toast(t('toast.synced', { n: syncRes.n }));
      } else { toast(t('toast.sync.nothing')); }
    } catch (e) {
      console.warn('pull-to-sync:', e?.code || e?.message);
      toast(t('toast.sync.error') + (e.message || ''));
    } finally {
      _ptrState.busy = false;
      if (navigator.onLine) { showPullIndicator('Done', 120); setTimeout(hidePullIndicator, 800); }
      else { showPullIndicator('No connection', 120); setTimeout(hidePullIndicator, 1000); }
    }
  };

  const onCancel = () => { _ptrState.pulling = false; _ptrState.armed = false; hidePullIndicator(); };

  document.addEventListener('touchstart', onStart, { passive: true });
  document.addEventListener('touchmove', onMove, { passive: true });
  document.addEventListener('touchend', onEnd, { passive: true });
  document.addEventListener('touchcancel', onCancel, { passive: true });
}

/* ── AUTH STATE OBSERVER ─────────────────────────────────── */
auth.onAuthStateChanged(async user => {
  if (user) {
    try { if (window.__cfFirestoreReady) await window.__cfFirestoreReady; } catch (_) { }
    S.user = user; Store.setUser(user.uid);
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');

    const dashEl = document.getElementById('tab-dashboard');
    if (dashEl && !window._dashboardHTML) window._dashboardHTML = dashEl.innerHTML;

    let txs, budgetsFull, goals, firestoreError = null;
    try {
      [txs, budgetsFull, goals] = await Promise.all([Store.getLatest(2000), Store.getBudgetsFull(), Store.getGoals()]);
    } catch (e) {
      console.warn('Firestore initial load:', e.code || e.message);
      firestoreError = e;
      txs = []; budgetsFull = { amounts: { ...DEF_BUDGETS }, percents: {}, income: 10000000 }; goals = [];
    }

    S.transactions = txs;
    S.budgets = budgetsFull.amounts;
    S.budgetPercents = Object.keys(budgetsFull.percents).length ? budgetsFull.percents : JSON.parse(localStorage.getItem('cf-budget-percents') || '{}');
    S.totalIncome = budgetsFull.income || parseInt(localStorage.getItem('cf-total-income')) || 10000000;
    S.goals = goals;
    S._hasMoreTx = txs.length >= 1;
    S._oldestTxDate = txs.length ? txs[txs.length - 1].date : null;

    if (firestoreError) {
      const code = firestoreError.code || '';
      if (code.includes('permission-denied') || code.includes('PERMISSION_DENIED')) toast(t('toast.firestore.permission') || 'Unable to load data — check permissions');
      else toast(t('toast.firestore.error') || 'Unable to load data — showing empty state');
    }

    // Seed demo data for new users
    const demoKey = `cf-demo-${user.uid}`;
    if (txs.length === 0 && !localStorage.getItem(demoKey)) {
      try {
        const added = await Store.addBatch(DUMMY_TX);
        S.transactions = added.sort(sortTxByInput);
        localStorage.setItem(demoKey, '1');
        toast(t('toast.demo.loaded', { n: added.length }));
      } catch (e) { console.warn('Demo addBatch:', e.code || e.message); }
    }

    // Flush offline queue
    try {
      const { n: synced, syncedFingerprints } = await OQ.flush();
      if (synced > 0) {
        const fresh = await Store.getLatest(2000);
        S.transactions = mergeTransactionsAfterQueueFlush(fresh, S.transactions, syncedFingerprints);
      }
    } catch (e) { console.warn('OQ flush / merge:', e.code || e.message); }

    applyMood(localStorage.getItem('cf-mood') || 'dark');
    const savedLang = localStorage.getItem('cf-lang') || 'en';
    if (typeof I18n !== 'undefined') I18n.setLang(savedLang);

    render();

    // Mark demo flag if real data already contains dummy transactions
    if (txs.length > 0 && !localStorage.getItem(`cf-has-demo-${user.uid}`)) {
      const dummyDescs = new Set(DUMMY_TX.map(tx => tx.description.toLowerCase().trim()));
      if (txs.some(tx => dummyDescs.has((tx.description || '').toLowerCase().trim()))) localStorage.setItem(`cf-has-demo-${user.uid}`, '1');
    }

    setTimeout(() => {
      checkFirestoreRules().catch(err => console.warn('checkFirestoreRules:', err?.message));
      processRecurring().catch(err => console.warn('processRecurring:', err?.message));
      checkExchangeRatesFreshness();
    }, 900);

    setupLiveListeners(user.uid);
    startCloudHealthMonitor();

    // Handle deep-link query params
    const p = new URLSearchParams(window.location.search);
    if (p.get('add') === '1') { openModal('modal-add'); history.replaceState({}, '', '/'); }
    if (p.get('voice') === '1') { setTimeout(() => document.getElementById('btn-voice')?.click(), 500); history.replaceState({}, '', '/'); }
  } else {
    clearLiveListeners();
    stopCloudHealthMonitor();
    setCloudStatus('', t('status.connecting'));
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
    const gl = document.getElementById('btn-google-login');
    if (gl) { gl.disabled = false; const sp = gl.querySelector('span'); if (sp) sp.textContent = t('auth.login.btn'); }
  }
});
