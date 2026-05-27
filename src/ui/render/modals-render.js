/* ══════════════════════════════════════════════════════════
   CASHFLOW.SYS — modals-render.js
   DOM rendering, templates, modal helpers, tab routing.
   Load order: THIRD (after state.js + helpers.js)
   Depends on: state.js, helpers.js, constants.js, i18n.js, charts.js
══════════════════════════════════════════════════════════ */

/* ── MODAL HELPERS ───────────────────────────────────────── */
function openModal(id) {
  if (id === 'modal-add') {
    buildCatGrid();
    fillAccountSelects();
    const d = document.getElementById('form-date');
    d.max = todayKey();
    if (!d.value) d.value = todayKey();
    document.getElementById('modal-add-title').textContent = S.editingId ? t('modal.edit.title') : t('modal.add.title');
    if (!S.editingId) {
      document.getElementById('recurring-series-wrap')?.classList.add('hidden');
      const scb = document.getElementById('form-recurring-series');
      if (scb) scb.checked = false;
    }
  }
  document.getElementById(id).classList.remove('hidden');
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
  if (id === 'modal-add') {
    ['form-amount', 'form-desc', 'form-date', 'form-note'].forEach(i => document.getElementById(i).value = '');
    const recCb = document.getElementById('form-recurring'); if (recCb) recCb.checked = false;
    const reimbCb = document.getElementById('form-reimbursable'); if (reimbCb) reimbCb.checked = false;
    document.getElementById('recurring-series-wrap')?.classList.add('hidden');
    const scb = document.getElementById('form-recurring-series'); if (scb) scb.checked = false;
    document.querySelectorAll('.cat-chip').forEach(b => { b.classList.remove('selected'); b.style.background = b.style.borderColor = ''; });
    S.editingId = null;
    setTxType('expense');
  }
  if (id === 'modal-import') {
    document.getElementById('import-preview').classList.add('hidden');
    document.getElementById('btn-confirm-import').disabled = true;
    _importPending = [];
  }
}

/* ── TRANSACTION FORM HELPERS ────────────────────────────── */
function buildCatGrid() {
  const lang = typeof getLang === 'function' ? getLang() : 'en';
  if (_catBuilt && _catLang === lang) return;
  const g = document.getElementById('cat-grid');
  g.innerHTML = getAllCategories().map(c => `<button class="cat-chip" data-cat="${c.id}" onclick="selCat('${c.id}')" style="color:${c.color}">${catSVG(c.id, 12, c.color)}<span style="color:var(--text2);font-size:.68rem">${getCat(c.id).label}</span></button>`).join('');
  _catBuilt = true;
  _catLang = lang;
}

function selCat(id) {
  buildCatGrid(); const cat = getCat(id);
  document.querySelectorAll('.cat-chip').forEach(b => {
    const a = b.dataset.cat === id;
    b.classList.toggle('selected', a);
    b.style.background  = a ? cat.color + '22' : '';
    b.style.borderColor = a ? cat.color : '';
  });
}

function setTxType(type) {
  _txType = type;
  document.getElementById('type-btn-expense').className = 'type-btn expense' + (type === 'expense' ? ' active' : '');
  document.getElementById('type-btn-income').className  = 'type-btn income'  + (type === 'income'  ? ' active' : '');
  const wrap = document.getElementById('cat-grid-wrap');
  if (wrap) wrap.style.display = type === 'income' ? 'none' : 'block';
}

/* ── AMOUNT INPUT FORMATTING ─────────────────────────────── */
function setupAmountInput(el) {
  if (!el || el.dataset.amountInit || el.dataset.formatted) return;
  el.dataset.amountInit = '1';
  el.setAttribute('inputmode', 'numeric');
  el.setAttribute('autocomplete', 'off');
  const fmt = n => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const raw = v => parseInt(v.replace(/\./g, '') || '0');
  let lastValue = '';
  el.addEventListener('input', () => {
    const n = raw(el.value);
    const newVal = n ? fmt(n) : '';
    if (newVal === lastValue) return;
    lastValue = newVal;
    const pos = el.selectionStart;
    const before = el.value.slice(0, pos).replace(/\./g, '').length;
    el.value = newVal;
    const digits = newVal.replace(/\./g, '');
    if (before >= digits.length) { el.setSelectionRange(newVal.length, newVal.length); return; }
    let count = 0, newPos = 0;
    for (let i = 0; i < newVal.length && count < before; i++) { if (newVal[i] !== '.') count++; newPos = i + 1; }
    el.setSelectionRange(newPos, newPos);
  });
  el.addEventListener('focus', () => { if (el.value === '0') el.value = ''; });
  el._rawValue = () => raw(el.value);
}

function initAmountInputs() {
  ['form-amount', 'contrib-amount', 'goal-target', 'goal-saved', 'total-income-input'].forEach(id => {
    const el = document.getElementById(id);
    if (el) setupAmountInput(el);
  });
}

/* ── CURRENCY SETTINGS ───────────────────────────────────── */
function openCurrencySettings() {
  const sel = document.getElementById('currency-select');
  if (sel) sel.value = S.currency || 'IDR';
  const travelToggle = document.getElementById('travel-mode-toggle');
  if (travelToggle) travelToggle.checked = !!S.travelMode;
  renderExchangeRatesList();
  const statusEl = document.getElementById('exchange-rate-status');
  if (statusEl) {
    const lastUpdate = localStorage.getItem('cf-exchange-rates-updated');
    statusEl.textContent = lastUpdate
      ? t('exchange.last.update', { date: new Date(lastUpdate).toLocaleDateString() })
      : '';
  }
  openModal('modal-currency');
}

function renderExchangeRatesList() {
  const el = document.getElementById('exchange-rates-list');
  if (!el) return;
  el.innerHTML = Object.entries(CURRENCIES)
    .filter(([code]) => code !== 'IDR')
    .map(([code, cur]) => {
      const rate = S.exchangeRates[code] || DEFAULT_EXCHANGE_RATES[code] || 1;
      return `<div class="currency-rate-row">
        <span class="currency-rate-code">${code}</span>
        <span style="font-size:.62rem;color:var(--text3);flex:1">${cur.name}</span>
        <input class="currency-rate-input" type="number" data-currency="${code}" value="${rate}" min="1" step="1"/>
      </div>`;
    }).join('');
}

function saveCurrencySettings() {
  const sel = document.getElementById('currency-select');
  if (sel) S.currency = sel.value;
  document.querySelectorAll('.currency-rate-input').forEach(input => {
    const code = input.dataset.currency;
    const val  = parseFloat(input.value);
    if (code && val > 0) S.exchangeRates[code] = val;
  });
  const travelToggle = document.getElementById('travel-mode-toggle');
  if (travelToggle) S.travelMode = travelToggle.checked;
  localStorage.setItem('cf-currency',       S.currency);
  localStorage.setItem('cf-exchange-rates',  JSON.stringify(S.exchangeRates));
  localStorage.setItem('cf-travel-mode',     String(S.travelMode));
  closeModal('modal-currency');
  Charts.invalidate();
  render();
  toast(t('toast.currency.saved'));
}/* ── CUSTOM CATEGORIES UI ────────────────────────────────── */
function openCustomCategoriesModal() {
  renderCustomCategoriesList();
  document.getElementById('modal-custom-cats')?.classList.remove('hidden');
}
function renderCustomCategoriesList() {
  const el = document.getElementById('custom-cats-list');
  if (!el) return;
  if (!S.customCategories.length) { el.innerHTML = `<div class="empty">${t('cat.custom.empty')}</div>`; return; }
  el.innerHTML = S.customCategories.map(c => `
    <div class="custom-cat-row">
      <span class="custom-cat-icon" style="color:${c.color}">${catSVG(c.id, 14, c.color)}</span>
      <span class="custom-cat-name">${san(c.label)}</span>
      <button type="button" class="tx-act-btn del" onclick="removeCustomCategory('${c.id}')">${t('cat.custom.remove')}</button>
    </div>`).join('');
}

/* ── ACCOUNTS UI ─────────────────────────────────────────── */
function openAccountsModal() {
  renderAccountsList();
  document.getElementById('modal-accounts')?.classList.remove('hidden');
}
function renderAccountsList() {
  const el = document.getElementById('accounts-list');
  if (!el) return;
  el.innerHTML = S.accounts.map(a => `
    <div class="account-row">
      <span>${san(a.name)}</span>
      ${a.id === 'main' ? '' : `<button type="button" class="tx-act-btn del" onclick="removeAccount('${a.id}')">${t('accounts.remove')}</button>`}
    </div>`).join('');
}

