/* ══════════════════════════════════════════════════════════
   CASHFLOW.SYS — boot.js
   Former inline <script> tail of index.html. Runs LAST, after
   every app module, as the final import in main.js. As a deferred
   module it executes once the DOM is parsed, so all getElementById
   lookups below are safe.
══════════════════════════════════════════════════════════ */

/* ── SETTINGS PANEL TOGGLE ─────────────────────────────── */
function toggleSettingsPanel() {
  document.getElementById('settings-panel').classList.toggle('open');
}
// Close settings panel when clicking outside
document.addEventListener('click', function(e) {
  const panel = document.getElementById('settings-panel');
  if (!panel.classList.contains('open')) return;
  if (!panel.contains(e.target) && !e.target.closest('.sidebar-footer')) {
    panel.classList.remove('open');
  }
});

/* ── TOPBAR PAGE TITLE SYNC ────────────────────────────── */
const _origSwitchTab = window.switchTab;
window.switchTab = function(tab) {
  if (typeof _origSwitchTab === 'function') _origSwitchTab(tab);
  const el = document.getElementById('topbar-page');
  if (el) el.textContent = tab;
};

/* ── TOPBAR CLOUD STATUS SYNC ──────────────────────────── */
const _cloudDot  = document.getElementById('topbar-cloud-dot');
const _cloudLbl  = document.getElementById('topbar-cloud-label');
const _origCloudPill = document.getElementById('cloud-status-pill');
// Mirror cloud status to topbar
const cloudObserver = new MutationObserver(() => {
  const dot  = _origCloudPill?.querySelector('.cloud-dot');
  const txt  = document.getElementById('cloud-status-text');
  if (dot && _cloudDot)  _cloudDot.className  = dot.className;
  if (txt && _cloudLbl)  _cloudLbl.textContent = txt.textContent;
});
if (_origCloudPill) cloudObserver.observe(_origCloudPill, { childList: true, subtree: true, attributes: true, characterData: true });

/* ── NEW THEME SUPPORT (minimalist, frost) ─────────────── */
(function patchMood() {
  const NEW_MOODS = ['minimalist', 'frost'];
  const _orig = window.applyMood;
  window.applyMood = function(mood) {
    if (!NEW_MOODS.includes(mood)) return _orig && _orig(mood);
    document.documentElement.setAttribute('data-mood', mood);
    localStorage.setItem('cf-mood', mood);
    document.querySelectorAll('.mood-pill:not(.lang-pill)').forEach(p =>
      p.classList.toggle('active', p.dataset.mood === mood));
    if (typeof Charts !== 'undefined' && Charts.updateColors) Charts.updateColors();
  };
  const saved = localStorage.getItem('cf-mood');
  if (NEW_MOODS.includes(saved)) window.applyMood(saved);
})();

/* ── MOBILE UX ─────────────────────────────────────────── */
document.querySelectorAll('input, select, textarea').forEach(el => {
  el.addEventListener('focus', () => {
    setTimeout(() => { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 300);
  });
});

/* Swipe-down to close modal */
document.querySelectorAll('.modal-box').forEach(box => {
  let startY = 0, isDragging = false;
  box.addEventListener('touchstart', e => {
    if (e.touches[0].clientY - box.getBoundingClientRect().top < 48) { startY = e.touches[0].clientY; isDragging = true; }
  }, { passive: true });
  box.addEventListener('touchmove', e => {
    if (!isDragging) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 0) box.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  box.addEventListener('touchend', e => {
    if (!isDragging) return;
    isDragging = false;
    const dy = e.changedTouches[0].clientY - startY;
    if (dy > 80) { const modal = box.closest('.modal'); if (modal) { box.style.transform = ''; modal.classList.add('hidden'); } }
    else { box.style.transform = ''; }
  });
});

/* ── PWA ────────────────────────────────────────────────── */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js').catch(e => console.warn('SW:', e));
}
let _deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); _deferredInstall = e;
  document.getElementById('pwa-install-bar').classList.remove('hidden');
});
document.getElementById('btn-pwa-install').onclick = () => {
  if (!_deferredInstall) return;
  _deferredInstall.prompt();
  _deferredInstall.userChoice.then(() => { _deferredInstall = null; document.getElementById('pwa-install-bar').classList.add('hidden'); });
};
document.getElementById('btn-pwa-dismiss').onclick = () => {
  document.getElementById('pwa-install-bar').classList.add('hidden');
  localStorage.setItem('pwa-install-dismissed', Date.now());
};

/* ── DEV BYPASS: add ?dev to URL to skip auth and see dashboard ── */
if (location.search.includes('dev')) {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').classList.remove('hidden');
}

/* ══ LIVE TICKER ═════════════════════════════════════════════════
   Updates every 1s. Pulls real numbers from S (app state) when
   available; falls back gracefully when state isn't loaded yet.
   ─────────────────────────────────────────────────────────────── */
(function liveTicker() {
  const $mtd  = document.getElementById('tk-mtd');
  const $txn  = document.getElementById('tk-txn');
  const $fx   = document.getElementById('tk-fx');
  const $time = document.getElementById('tk-time');
  if (!$mtd || !$txn || !$fx || !$time) return;

  const pad = n => String(n).padStart(2, '0');

  // Compact rupiah formatting: 4.235k / 1.23M / 12.5M
  const fmtRp = (n) => {
    if (!n || !isFinite(n)) return 'Rp 0';
    const abs = Math.abs(n);
    if (abs >= 1e9)  return 'Rp ' + (n / 1e9).toFixed(2) + 'B';
    if (abs >= 1e6)  return 'Rp ' + (n / 1e6).toFixed(2) + 'M';
    if (abs >= 1e3)  return 'Rp ' + (n / 1e3).toFixed(1) + 'k';
    return 'Rp ' + Math.round(n);
  };
  // FX: integer with thousands separator, like "16,200"
  const fmtFx = (n) => {
    if (!n || !isFinite(n)) return '—';
    return Math.round(n).toLocaleString('en-US');
  };

  const tick = () => {
    // Time — Jakarta timezone (GMT+7), HH:MM:SS
    const now = new Date();
    const ymdLocal = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }); // YYYY-MM-DD
    const hms = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Jakarta', hour12: false });
    $time.textContent = hms + ' GMT+7';

    // Pull live state if available
    const S = window.S;
    if (S && Array.isArray(S.transactions)) {
      const monthKey = ymdLocal.slice(0, 7); // YYYY-MM
      let mtdExpense = 0;
      let todayCount = 0;
      for (const t of S.transactions) {
        if (!t || !t.date) continue;
        if (t.type !== 'income' && t.date.startsWith(monthKey)) {
          mtdExpense += (t.amount || 0);
        }
        if (t.date === ymdLocal) todayCount++;
      }
      $mtd.textContent = fmtRp(mtdExpense);
      $txn.textContent = pad(todayCount) + ' TDY';

      // USD/IDR rate from S.exchangeRates.USD
      const usd = S.exchangeRates && S.exchangeRates.USD;
      $fx.textContent = fmtFx(usd);
    } else {
      // Fallback — show dashes while state initializes
      if ($mtd.textContent === 'Rp —') {
        $mtd.textContent = 'Rp —';
        $txn.textContent = '—';
        $fx.textContent  = '—';
      }
    }
  };

  tick();
  setInterval(tick, 1000);
})();

/* Inline-handler API: onclick="toggleSettingsPanel()" in the static HTML. */
window.toggleSettingsPanel = toggleSettingsPanel;
