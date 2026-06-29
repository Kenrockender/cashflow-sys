/* ══════════════════════════════════════════════════════════
   CASHFLOW.SYS — ui-render.js
   DOM rendering, templates, modal helpers, tab routing.
   Load order: THIRD (after state.js + helpers.js)
   Depends on: state.js, helpers.js, constants.js, i18n.js, charts.js
══════════════════════════════════════════════════════════ */

/* ── RENDER DISPATCHER ───────────────────────────────────── */
function render(force = false) {
  if (_renderScheduled && !force) return;
  _renderScheduled = true;
  requestAnimationFrame(() => {
    _renderScheduled = false;
    _doRender();
  });
}

function _doRender() {
  refreshCatFilterOptions();
  updateResetDemoBtn();
  renderSavedFilters();
  if (S.activeTab === 'dashboard')     { renderDashboard(); renderFavoritesBar(); }
  if (S.activeTab === 'transactions')  renderTxTab();
  if (S.activeTab === 'budget') {
    const bh = JSON.stringify(S.budgets) + '|' + S.totalIncome + '|' + S.budgetMode;
    if (bh !== _lastBudgetHash) { _lastBudgetHash = bh; renderBudgetTab(); }
    else renderBudgetExtras();
  }
  if (S.activeTab === 'goals')         renderGoalsTab();
  if (S.activeTab === 'reports')       renderReports();
}

function updateResetDemoBtn() {
  const btn = document.getElementById('btn-reset-demo');
  if (!btn || !S.user) return;
  const has = localStorage.getItem(`cf-has-demo-${S.user.uid}`) || localStorage.getItem(`cf-demo-${S.user.uid}`);
  btn.classList.toggle('hidden', !has);
}

/* ── NAVIGATION ──────────────────────────────────────────── */
function syncBottomNav(tab) {
  document.querySelectorAll('.bnav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('visible');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('visible');
}

function switchTab(tab) {
  S.activeTab = tab;
  if (tab === 'budget') _lastBudgetHash = ''; // force re-render on next _doRender
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach(el => {
    el.classList.toggle('active', el.id === `tab-${tab}`);
    el.classList.toggle('hidden',  el.id !== `tab-${tab}`);
  });
  syncBottomNav(tab);
  closeSidebar();
  render();
}

/* ── THEME ───────────────────────────────────────────────── */
function applyMood(m) {
  const mood = ['dark', 'light', 'oled', 'sepia'].includes(m) ? m : 'dark';
  document.documentElement.setAttribute('data-mood', mood);
  document.querySelectorAll('.mood-pill:not(.lang-pill)').forEach(p => p.classList.toggle('active', p.dataset.mood === mood));
  localStorage.setItem('cf-mood', mood);
  setTimeout(() => Charts.updateColors(), 80);
}

/* ── PULL TO REFRESH ─────────────────────────────────────── */
function ensurePullIndicator() {
  if (_ptrEl) return _ptrEl;
  _ptrEl = document.createElement('div');
  _ptrEl.id = 'pull-sync-indicator';
  Object.assign(_ptrEl.style, {
    position: 'fixed', top: '0', left: '0', right: '0', height: '0',
    overflow: 'hidden', display: 'flex', alignItems: 'flex-end',
    justifyContent: 'center', paddingBottom: '0',
    background: 'rgba(6,6,6,.97)', color: 'var(--gold)',
    fontFamily: 'var(--mono)', fontSize: '.58rem', fontWeight: '700',
    letterSpacing: '.12em', textTransform: 'uppercase',
    pointerEvents: 'none', borderBottom: '2px solid var(--gold3)',
    boxSizing: 'border-box', zIndex: '99998',
  });
  document.body.appendChild(_ptrEl);
  return _ptrEl;
}

function showPullIndicator(text, pulledPx) {
  const el = ensurePullIndicator();
  const safeTop = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sat') || '0', 10) || 0;
  const minH = Math.max(safeTop + 48, 56);
  let h = Math.min(safeTop + 72, Math.max(0, Math.round(safeTop + (pulledPx || 0) * 0.55)));
  if (h > 0 && h < minH) h = minH;
  el.textContent = text;
  el.style.height = `${h}px`;
  el.style.paddingBottom = h > 0 ? '10px' : '0';
  el.style.paddingTop = safeTop > 0 ? `${safeTop}px` : '0';
}

function hidePullIndicator() {
  if (!_ptrEl) return;
  _ptrEl.style.height = '0';
  _ptrEl.style.paddingBottom = '0';
  _ptrEl.style.paddingTop = '0';
}

/* ─── ESM window bridge (auto-generated) ─── */
Object.assign(window, { render, _doRender, updateResetDemoBtn, syncBottomNav, toggleSidebar, closeSidebar, switchTab, applyMood, ensurePullIndicator, showPullIndicator, hidePullIndicator });
