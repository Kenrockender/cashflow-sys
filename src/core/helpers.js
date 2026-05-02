/* ══════════════════════════════════════════════════════════
   CASHFLOW.SYS — helpers.js
   Pure utility functions: formatting, date helpers, DOM utils.
   Load order: SECOND (after state.js)
   Depends on: state.js, constants.js, i18n.js
══════════════════════════════════════════════════════════ */

/* ── CATEGORY HELPERS ────────────────────────────────────── */
const getCat = id => {
  const allCats = typeof getAllCategories === 'function' ? getAllCategories() : CATS;
  const c = allCats.find(x => x.id === id) || CATS[CATS.length - 1];
  const isCustom = S.customCategories?.some(cat => cat.id === id);
  return { ...c, label: isCustom ? c.label : (typeof t === 'function' ? t('cat.' + c.id) : c.label) };
};

const isIncomeTx  = tx => tx.type === 'income';
const isExpenseTx = tx => !isIncomeTx(tx);

/* ── TRANSACTION SORT (date desc, then createdAt desc) ────── */
const sortTxByInput = (a, b) => {
  const dateCompare = (b.date || '').localeCompare(a.date || '');
  if (dateCompare !== 0) return dateCompare;
  const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a._localTs || (typeof a.createdAt === 'number' ? a.createdAt : 0));
  const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b._localTs || (typeof b.createdAt === 'number' ? b.createdAt : 0));
  return bTime - aTime;
};

/* ── SVG ICON HELPER ─────────────────────────────────────── */
function catSVG(id, size = 14, color = 'currentColor') {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${CAT_ICONS[id] || CAT_ICONS.other}</svg>`;
}

/* ── NUMBER FORMAT (locale-aware, multi-currency) ─────────── */
const fmtCurrency = (n, currency = null) => {
  currency = currency || S.currency || 'IDR';
  const cur = CURRENCIES[currency] || CURRENCIES.IDR;
  if (!n && n !== 0) return `${cur.symbol} 0`;

  const abs = Math.abs(n);
  const isId = typeof getLang === 'function' && getLang() === 'id';

  if (cur.decimals === 0) {
    const sep  = isId ? '.' : ',';
    const sfxM = isId ? 'jt' : 'M';
    if (abs >= 1_000_000) return `${cur.symbol} ${(n / 1_000_000).toFixed(1).replace('.0', '')}${sfxM}`;
    if (abs >= 1_000)     return `${cur.symbol} ${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, sep)}`;
    return `${cur.symbol} ${Math.round(n)}`;
  } else {
    if (abs >= 1_000_000) return `${cur.symbol}${(n / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000)     return `${cur.symbol}${n.toLocaleString(cur.locale, { minimumFractionDigits: cur.decimals, maximumFractionDigits: cur.decimals })}`;
    return `${cur.symbol}${n.toFixed(cur.decimals)}`;
  }
};

/** Full IDR format — used for amount previews where compact abbreviation is undesirable. */
const fmtFull = n => {
  const isId = typeof getLang === 'function' && getLang() === 'id';
  const sep  = isId ? '.' : ',';
  return 'Rp ' + Math.round(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, sep);
};

/** Convert amount from one currency to the user's primary currency. */
const convertToPrimary = (amount, fromCurrency) => {
  if (!fromCurrency || fromCurrency === S.currency) return amount;
  const fromRate = S.exchangeRates[fromCurrency] || 1;
  const toRate   = S.exchangeRates[S.currency] || 1;
  return (amount * fromRate) / toRate;
};

/* ── DATE HELPERS ────────────────────────────────────────── */
const todayKey  = ()  => new Date().toISOString().split('T')[0];
const thisMonth = ()  => todayKey().slice(0, 7);
window.thisMonth = thisMonth;

const prevMonth = ym  => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const weekStart = ()  => {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().split('T')[0];
};

/* ── FUNCTIONAL HELPERS ──────────────────────────────────── */
const sum = txs => txs.reduce((a, t) => a + (t.amount || 0), 0);
const san = s   => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Basic debounce. */
const deb = (fn, ms) => {
  let timer;
  return (...a) => { clearTimeout(timer); timer = setTimeout(() => fn(...a), ms); };
};

/** Debounce that also fires on the leading edge. */
const debImmediate = (fn, ms) => {
  let timer, first = true;
  return (...a) => {
    clearTimeout(timer);
    if (first) { first = false; fn(...a); }
    timer = setTimeout(() => { first = true; fn(...a); }, ms);
  };
};

/** rAF-gated callback — skips if a frame is already pending. */
const raf = fn => {
  let pending = false;
  return (...a) => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; fn(...a); });
  };
};

/* ── TOAST ───────────────────────────────────────────────── */
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  el.classList.add('show');
  setTimeout(() => { el.classList.remove('show'); el.classList.add('hidden'); }, 4000);
}

function toastUndo(msg, undoFn) {
  if (_undoTimer2) { clearTimeout(_undoTimer2); _undoTimer2 = null; }
  const el = document.getElementById('toast');
  el.innerHTML = `${san(msg)} <button class="toast-undo-btn" onclick="execUndo()">${t('toast.tx.undo')}</button>`;
  el.classList.remove('hidden'); el.classList.add('show');
  _undoStack2 = undoFn;
  _undoTimer2 = setTimeout(() => { el.classList.remove('show'); el.classList.add('hidden'); _undoStack2 = null; }, 4500);
}

async function execUndo() {
  if (!_undoStack2) return;
  const fn = _undoStack2; _undoStack2 = null;
  clearTimeout(_undoTimer2);
  document.getElementById('toast').classList.add('hidden');
  await fn();
}
