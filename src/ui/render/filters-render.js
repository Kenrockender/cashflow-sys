/* ══════════════════════════════════════════════════════════
   CASHFLOW.SYS — filters-render.js
   DOM rendering, templates, modal helpers, tab routing.
   Load order: THIRD (after state.js + helpers.js)
   Depends on: state.js, helpers.js, constants.js, i18n.js, charts.js
══════════════════════════════════════════════════════════ */

/* ── FILTER HELPERS ──────────────────────────────────────── */
function refreshCatFilterOptions() {
  const sel = document.getElementById('tx-filter-cat');
  if (!sel) return;
  const prev = sel.value;
  sel.querySelectorAll('option:not([value=""])').forEach(o => o.remove());
  getAllCategories().forEach(c => {
    const o = document.createElement('option');
    o.value = c.id;
    o.textContent = getCat(c.id).label;
    sel.appendChild(o);
  });
  if (prev && [...sel.options].some(o => o.value === prev)) sel.value = prev;
}

function filterByCat(id) {
  switchTab('transactions');
  const sel = document.getElementById('tx-filter-cat');
  if (sel) { sel.value = id; renderTxTab(); }
}

function toggleTxFilters() {
  const panel  = document.getElementById('tx-filters-panel');
  const toggle = document.getElementById('tx-filter-toggle');
  const open   = panel.classList.toggle('open');
  toggle.classList.toggle('active', open);
}

/* ── SAVED FILTERS ───────────────────────────────────────── */
function saveCurrentFilter() {
  const vals = {
    search:   document.getElementById('tx-search')?.value     || '',
    catF:     document.getElementById('tx-filter-cat')?.value || '',
    typeF:    document.getElementById('tx-filter-type')?.value|| '',
    dateFrom: document.getElementById('tx-date-from')?.value  || '',
    dateTo:   document.getElementById('tx-date-to')?.value    || '',
    amtMin:   document.getElementById('tx-amt-min')?.value    || '',
    amtMax:   document.getElementById('tx-amt-max')?.value    || '',
  };
  if (Object.values(vals).every(v => !v)) { toast('Set at least one filter first'); return; }
  const name = prompt('Name this filter (e.g. "Food this month"):');
  if (!name || !name.trim()) return;
  _savedFilters.push({ name: name.trim(), ...vals });
  localStorage.setItem('cf-saved-filters', JSON.stringify(_savedFilters));
  renderSavedFilters();
  toast('Filter saved ' + icon('check', '', 14));
}

function loadSavedFilter(index) {
  const f = _savedFilters[index]; if (!f) return;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
  set('tx-search',      f.search);
  set('tx-filter-cat',  f.catF);
  set('tx-filter-type', f.typeF);
  set('tx-date-from',   f.dateFrom);
  set('tx-date-to',     f.dateTo);
  set('tx-amt-min',     f.amtMin);
  set('tx-amt-max',     f.amtMax);
  const panel = document.getElementById('tx-filters-panel');
  if (panel && !panel.classList.contains('open')) toggleTxFilters();
  _txMonthLimit = 3;
  renderTxTab();
}

function deleteSavedFilter(index) {
  _savedFilters.splice(index, 1);
  localStorage.setItem('cf-saved-filters', JSON.stringify(_savedFilters));
  renderSavedFilters();
}

function clearAllFilters() {
  ['tx-search','tx-filter-cat','tx-filter-type','tx-date-from','tx-date-to','tx-amt-min','tx-amt-max']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  _txMonthLimit = 3;
  renderTxTab();
}

function renderSavedFilters() {
  const el = document.getElementById('saved-filters-bar'); if (!el) return;
  if (!_savedFilters.length) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  el.innerHTML = `
    <span class="saved-filters-lbl">Saved:</span>
    <div class="saved-filters-list">
      ${_savedFilters.map((f, i) => `
        <span class="saved-filter-pill">
          <button class="sfp-load" onclick="loadSavedFilter(${i})" title="${san(f.search||'')} ${f.catF} ${f.typeF}">${san(f.name)}</button>
          <button class="sfp-del" onclick="deleteSavedFilter(${i})">${icon('close', '', 12)}</button>
        </span>`).join('')}
    </div>`;
}

/* ── KEYBOARD SHORTCUTS ──────────────────────────────────── */

/* ── FILTER CHIPS ────────────────────────────────────────── */
var _activeChip = 'all';
var _activeChipCat = '';

function applyChipFilter(chip) {
  _activeChip = chip;
  _activeChipCat = '';
  // Sync the hidden advanced filter selects
  const typeEl = document.getElementById('tx-filter-type');
  const catEl  = document.getElementById('tx-filter-cat');
  if (typeEl) typeEl.value = (chip === 'income' || chip === 'expense') ? chip : '';
  if (catEl) catEl.value = '';
  updateChipActiveState();
  _txMonthLimit = 3;
  renderTxTab();
}

function applyChipCatFilter(catId) {
  _activeChipCat = _activeChipCat === catId ? '' : catId;
  _activeChip = _activeChipCat ? '' : 'all';
  const typeEl = document.getElementById('tx-filter-type');
  const catEl  = document.getElementById('tx-filter-cat');
  if (typeEl) typeEl.value = '';
  if (catEl) catEl.value = _activeChipCat;
  updateChipActiveState();
  _txMonthLimit = 3;
  renderTxTab();
}

function updateChipActiveState() {
  document.querySelectorAll('.tx-chip').forEach(b => {
    b.classList.toggle('active', b.dataset.chip === _activeChip);
  });
  document.querySelectorAll('.tx-chip-cat').forEach(b => {
    b.classList.toggle('active', b.dataset.cat === _activeChipCat);
  });
}

function renderTxFilterChips() {
  const el = document.getElementById('tx-chip-cats');
  if (!el) return;
  // Get categories that actually have transactions
  const TV = getTxView();
  const catCounts = {};
  for (const tx of TV) {
    if (isExpenseTx(tx) && tx.category) {
      catCounts[tx.category] = (catCounts[tx.category] || 0) + 1;
    }
  }
  const cats = getAllCategories().filter(c => catCounts[c.id] > 0)
    .sort((a, b) => (catCounts[b.id] || 0) - (catCounts[a.id] || 0))
    .slice(0, 6);
  el.innerHTML = cats.map(c => {
    const cat = getCat(c.id);
    return `<button class="tx-chip-cat${_activeChipCat === c.id ? ' active' : ''}" data-cat="${c.id}" onclick="applyChipCatFilter('${c.id}')" style="--chip-color:${c.color}">${cat.label}</button>`;
  }).join('');
}

function toggleShortcutsPanel() {
  const el = document.getElementById('modal-shortcuts');
  if (!el) return;
  el.classList.toggle('hidden');
  _shortcutsOpen = !el.classList.contains('hidden');
}

function initKeyboardShortcuts() {
  const SHORTCUTS = [
    { key: 'Q',   desc: 'Focus quick-add bar' },
    { key: 'N',   desc: 'New transaction (modal)' },
    { key: '/',   desc: 'Search transactions' },
    { key: '1',   desc: 'Go to Dashboard' },
    { key: '2',   desc: 'Go to Transactions' },
    { key: '3',   desc: 'Go to Budget' },
    { key: '4',   desc: 'Go to Savings' },
    { key: '5',   desc: 'Go to Reports' },
    { key: '?',   desc: 'Show this shortcuts panel' },
    { key: 'Esc', desc: 'Close modals / panel' },
  ];
  const listEl = document.getElementById('shortcuts-list');
  if (listEl) {
    listEl.innerHTML = SHORTCUTS.map(s => `
      <div class="shortcut-item">
        <kbd class="kbd">${s.key}</kbd>
        <span>${s.desc}</span>
      </div>`).join('');
  }
  document.addEventListener('keydown', e => {
    const tag = e.target.tagName;
    const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable;
    if (e.key === 'Escape') {
      if (_shortcutsOpen) { toggleShortcutsPanel(); return; }
      document.querySelectorAll('.modal:not(.hidden)').forEach(m => closeModal(m.id));
      return;
    }
    if (inInput) return;
    const anyModal = [...document.querySelectorAll('.modal:not(.hidden)')].filter(m => m.id !== 'modal-shortcuts');
    if (anyModal.length) return;
    switch (e.key) {
      case 'q': case 'Q': e.preventDefault(); document.getElementById('quickadd-input')?.focus(); break;
      case 'n': case 'N': e.preventDefault(); S.editingId = null; openModal('modal-add'); break;
      case '/': e.preventDefault(); switchTab('transactions'); setTimeout(() => document.getElementById('tx-search')?.focus(), 120); break;
      case '1': e.preventDefault(); switchTab('dashboard');     break;
      case '2': e.preventDefault(); switchTab('transactions');  break;
      case '3': e.preventDefault(); switchTab('budget');        break;
      case '4': e.preventDefault(); switchTab('goals');         break;
      case '5': e.preventDefault(); switchTab('reports');       break;
      case '?': e.preventDefault(); toggleShortcutsPanel();    break;
    }
  });
}

