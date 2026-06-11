/* ══════════════════════════════════════════════════════════
   CASHFLOW.SYS — state.js
   Global state object, feature flags, and state helpers.
   Load order: FIRST (before all other app scripts)
   Depends on: constants.js
══════════════════════════════════════════════════════════ */

/* ── MAIN STATE ──────────────────────────────────────────── */
let S = {
  user: null, transactions: [], budgets: {}, goals: [],
  activeTab: 'dashboard', activePeriod: 'month',
  editingId: null, editingGoalId: null,
  budgetMode:     localStorage.getItem('cf-budget-mode') || 'amount',
  totalIncome:    parseInt(localStorage.getItem('cf-total-income')) || 10000000,
  budgetPercents: JSON.parse(localStorage.getItem('cf-budget-percents') || '{}'),
  currency:       localStorage.getItem('cf-currency') || 'IDR',
  exchangeRates:  JSON.parse(localStorage.getItem('cf-exchange-rates') || 'null') || { ...DEFAULT_EXCHANGE_RATES },
  travelMode:     localStorage.getItem('cf-travel-mode') === 'true',
  rolloverEnabled: localStorage.getItem('cf-rollover-enabled') === 'true',
  rolloverAmount:  parseFloat(localStorage.getItem('cf-rollover-amount')) || 0,
  lastMilestones:  JSON.parse(localStorage.getItem('cf-milestones') || '{}'),
  customCategories: JSON.parse(localStorage.getItem('cf-custom-cats') || '[]'),
  accounts: (() => {
    try {
      const a = JSON.parse(localStorage.getItem('cf-accounts') || 'null');
      if (Array.isArray(a) && a.length) return a;
    } catch (_) {}
    return [{ id: 'main', name: 'Main' }];
  })(),
  accountFilter: localStorage.getItem('cf-account-filter') || '',
};

/* ── FEATURE STATE ───────────────────────────────────────── */
let _importPending  = [], _voiceRec = null, _catBuilt = false, _catLang = '', _txType = 'expense';
let _lastBudgetHash  = '';
let _lastTxRenderHash = '';
let _txMonthLimit   = 3;
let _favorites      = new Set(JSON.parse(localStorage.getItem('cf-favorites') || '[]'));
let _savedFilters   = JSON.parse(localStorage.getItem('cf-saved-filters') || '[]');
let _shortcutsOpen  = false;
let _recurringProcessed = false;
let _liveUnsubs     = [];
let _cloudHealthTimer   = null;
let _renderScheduled    = false;
let _contributingGoalId = null;
let _trashItems     = [];
let _ptrState       = { startY: 0, pulling: false, armed: false, busy: false };
let _ptrEl          = null;
let _pendingDelete  = null;

/* ── STATE HELPERS ───────────────────────────────────────── */

/** Returns built-in + custom categories combined. */
function getAllCategories() {
  return [...CATS, ...S.customCategories];
}

function persistAccounts() {
  localStorage.setItem('cf-accounts', JSON.stringify(S.accounts));
}

function accountLabel(accountId) {
  if (!accountId) return '';
  const a = S.accounts.find(x => x.id === accountId);
  return a ? a.name : accountId;
}

function fillAccountSelects() {
  ['form-account', 'transfer-from-account', 'transfer-to-account'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const cur = el.value;
    el.innerHTML = '';
    S.accounts.forEach(a => {
      const o = document.createElement('option');
      o.value = a.id;
      o.textContent = a.name;
      el.appendChild(o);
    });
    if (cur && [...el.options].some(o => o.value === cur)) el.value = cur;
  });
}

/** Transactions for dashboard/reports/charts — respects account filter. */
function getTxView() {
  const f = S.accountFilter;
  if (!f) return S.transactions;
  return S.transactions.filter(tx => (tx.accountId || 'main') === f);
}

function getRecurringSkipSet() {
  try {
    const j = JSON.parse(localStorage.getItem('cf-recurring-skip') || '[]');
    return new Set(Array.isArray(j) ? j : []);
  } catch (_) {
    return new Set();
  }
}

function saveRecurringSkipSet(set) {
  localStorage.setItem('cf-recurring-skip', JSON.stringify([...set]));
}
