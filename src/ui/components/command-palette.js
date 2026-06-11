/* ══════════════════════════════════════════════════════════
   CASHFLOW.SYS — command-palette.js
   Ctrl+K / ⌘K overlay: fuzzy-matched navigation & quick
   actions. Keyboard-first (arrows + Enter, Esc closes).
   Load order: after ui-render.js (uses switchTab, openModal).
   Depends on: i18n.js, ui-render.js, goals.js, auth (signOut)
══════════════════════════════════════════════════════════ */

const CommandPalette = (() => {
  let _open = false, _selected = 0, _filtered = [];

  /* Actions are built at open time so labels follow the active language. */
  function buildActions() {
    const nav = (tab, labelKey, iconSvg) => ({
      label: t('palette.go', { name: t(labelKey) }),
      hint: 'G',
      icon: iconSvg,
      run: () => switchTab(tab),
    });
    return [
      nav('dashboard',    'nav.dashboard',    '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
      nav('transactions', 'nav.transactions', '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>'),
      nav('budget',       'nav.budget',       '<circle cx="12" cy="12" r="9"/><path d="M12 3v9l6.4 6.4"/>'),
      nav('goals',        'nav.goals',        '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/>'),
      nav('reports',      'nav.reports',      '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>'),
      { label: t('palette.add.tx'),    hint: 'N', icon: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>', run: () => { S.editingId = null; openModal('modal-add'); } },
      { label: t('palette.add.goal'),  icon: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><line x1="12" y1="9" x2="12" y2="15"/><line x1="9" y1="12" x2="15" y2="12"/>', run: () => openGoalModal() },
      { label: t('palette.import'),    icon: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>', run: () => document.getElementById('btn-import')?.click() },
      { label: t('palette.currency'),  icon: '<circle cx="12" cy="12" r="10"/><path d="M12 6v12M9 10h6M9 14h4"/>', run: () => openCurrencySettings() },
      { label: t('palette.trash'),     icon: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>', run: () => openTrashModal() },
      { label: t('palette.lang'),      icon: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 0 20 15.3 15.3 0 0 1 0-20z"/>', run: () => setLang(getLang() === 'en' ? 'id' : 'en') },
      { label: t('palette.logout'),    icon: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>', run: () => { if (confirm(t('confirm.logout'))) auth.signOut(); } },
    ];
  }

  /* Simple subsequence fuzzy match; lower score = better. */
  function fuzzyScore(query, label) {
    const q = query.toLowerCase(), l = label.toLowerCase();
    if (!q) return 0;
    const idx = l.indexOf(q);
    if (idx >= 0) return idx; // contiguous match, earlier is better
    let qi = 0, gap = 0, last = -1;
    for (let li = 0; li < l.length && qi < q.length; li++) {
      if (l[li] === q[qi]) { if (last >= 0) gap += li - last - 1; last = li; qi++; }
    }
    return qi === q.length ? 100 + gap : -1; // -1 = no match
  }

  function ensureDom() {
    let el = document.getElementById('cf-palette');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'cf-palette';
    el.className = 'cf-palette hidden';
    el.innerHTML = `
      <div class="cf-palette-backdrop"></div>
      <div class="cf-palette-box" role="dialog" aria-modal="true" aria-label="Command palette">
        <input id="cf-palette-input" class="cf-palette-input" type="text" autocomplete="off" spellcheck="false"/>
        <div id="cf-palette-list" class="cf-palette-list" role="listbox"></div>
      </div>`;
    document.body.appendChild(el);
    el.querySelector('.cf-palette-backdrop').addEventListener('click', close);
    const input = el.querySelector('#cf-palette-input');
    input.addEventListener('input', () => { _selected = 0; renderList(input.value); });
    input.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); _selected = Math.min(_selected + 1, _filtered.length - 1); paintSelection(); }
      else if (e.key === 'ArrowUp')   { e.preventDefault(); _selected = Math.max(_selected - 1, 0); paintSelection(); }
      else if (e.key === 'Enter')     { e.preventDefault(); runSelected(); }
    });
    return el;
  }

  function renderList(query = '') {
    const list = document.getElementById('cf-palette-list');
    const actions = buildActions();
    _filtered = actions
      .map(a => ({ a, s: fuzzyScore(query, a.label) }))
      .filter(x => x.s >= 0)
      .sort((x, y) => x.s - y.s)
      .map(x => x.a);
    if (!_filtered.length) {
      list.innerHTML = `<div class="cf-palette-empty">${t('palette.empty')}</div>`;
      return;
    }
    list.innerHTML = _filtered.map((a, i) => `
      <button type="button" class="cf-palette-item${i === _selected ? ' selected' : ''}" data-idx="${i}" role="option" aria-selected="${i === _selected}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${a.icon}</svg>
        <span>${a.label}</span>
      </button>`).join('');
    list.querySelectorAll('.cf-palette-item').forEach(b => {
      b.addEventListener('click', () => { _selected = +b.dataset.idx; runSelected(); });
      b.addEventListener('mousemove', () => { const i = +b.dataset.idx; if (i !== _selected) { _selected = i; paintSelection(); } });
    });
  }

  function paintSelection() {
    document.querySelectorAll('.cf-palette-item').forEach((b, i) => {
      b.classList.toggle('selected', i === _selected);
      b.setAttribute('aria-selected', i === _selected);
      if (i === _selected) b.scrollIntoView({ block: 'nearest' });
    });
  }

  function runSelected() {
    const action = _filtered[_selected];
    close();
    if (action) { try { action.run(); } catch (e) { console.warn('palette action:', e?.message); } }
  }

  function open() {
    if (!S.user) return;
    const el = ensureDom();
    el.classList.remove('hidden');
    _open = true; _selected = 0;
    const input = el.querySelector('#cf-palette-input');
    input.placeholder = t('palette.placeholder');
    input.value = '';
    renderList('');
    setTimeout(() => input.focus(), 0);
  }

  function close() {
    const el = document.getElementById('cf-palette');
    if (el) el.classList.add('hidden');
    _open = false;
  }

  function toggle() { _open ? close() : open(); }

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); toggle(); }
  });

  return { open, close, toggle };
})();
