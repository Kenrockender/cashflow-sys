/* ══════════════════════════════════════════════════════════
   CASHFLOW.SYS — transactions-render.js
   DOM rendering, templates, modal helpers, tab routing.
   Load order: THIRD (after state.js + helpers.js)
   Depends on: state.js, helpers.js, constants.js, i18n.js, charts.js
══════════════════════════════════════════════════════════ */

/* ── TRANSACTIONS TAB ────────────────────────────────────── */
function renderTxTab(resetPaging = false) {
  if (resetPaging) { _txMonthLimit = 3; _lastTxRenderHash = ''; }
  // Keep Reimburse module in sync so the list modal always has fresh data
  if (typeof Reimburse !== 'undefined') Reimburse.register(S.transactions);
  renderTxFilterChips();
  const search   = document.getElementById('tx-search')?.value.toLowerCase()  || '';
  const catF     = document.getElementById('tx-filter-cat')?.value             || '';
  const typeF    = document.getElementById('tx-filter-type')?.value            || '';
  const dateFrom = document.getElementById('tx-date-from')?.value              || '';
  const dateTo   = document.getElementById('tx-date-to')?.value                || '';
  const amtMin   = document.getElementById('tx-amt-min')?.value                || '';
  const amtMax   = document.getElementById('tx-amt-max')?.value                || '';

  // Cheap signature: tx count + boundary ids + all active filters + page depth
  const txSig = S.transactions.length + '_' + (S.transactions[0]?.id || '') + '_' + (S.transactions[S.transactions.length - 1]?.id || '');
  const renderHash = `${txSig}|${search}|${catF}|${typeF}|${dateFrom}|${dateTo}|${amtMin}|${amtMax}|${_txMonthLimit}`;
  if (renderHash === _lastTxRenderHash) return;
  _lastTxRenderHash = renderHash;

  const amtMinN = parseFloat(amtMin) || 0;
  const amtMaxN = parseFloat(amtMax) || Infinity;
  let txs = getTxView();
  if (search)            txs = txs.filter(t => t.description?.toLowerCase().includes(search) || t.note?.toLowerCase().includes(search));
  if (catF)              txs = txs.filter(t => t.category === catF);
  if (typeF)             txs = txs.filter(t => (t.type || 'expense') === typeF);
  if (dateFrom)          txs = txs.filter(t => t.date >= dateFrom);
  if (dateTo)            txs = txs.filter(t => t.date <= dateTo);
  if (amtMinN > 0)        txs = txs.filter(t => (t.amount || 0) >= amtMinN);
  if (amtMaxN < Infinity) txs = txs.filter(t => (t.amount || 0) <= amtMaxN);

  const groups = {};
  for (const t of txs) { const ym = t.date?.slice(0, 7) || 'unknown'; if (!groups[ym]) groups[ym] = []; groups[ym].push(t); }
  const allMonths = Object.keys(groups).sort().reverse();
  const el = document.getElementById('tx-month-groups');

  if (!txs.length) { el.innerHTML = `<div class="empty">${t('empty.no.results')}</div>`; return; }

  const visMonths   = allMonths.slice(0, _txMonthLimit);
  const hiddenCount = allMonths.length - visMonths.length;

  let html = visMonths.map(ym => {
    const unknown = getLang() === 'id' ? 'Tanggal tidak diketahui' : 'Unknown date';
    const label = ym === 'unknown' ? unknown : new Date(+ym.split('-')[0], +ym.split('-')[1] - 1).toLocaleDateString(getLang() === 'id' ? 'id-ID' : 'en-US', { month: 'long', year: 'numeric' });
    const grpExp = groups[ym].filter(isExpenseTx), grpInc = groups[ym].filter(isIncomeTx);
    const meta = [grpExp.length ? `−${fmtCurrency(sum(grpExp))}` : '', grpInc.length ? `+${fmtCurrency(sum(grpInc))}` : ''].filter(Boolean).join(' · ');
    return `<div class="tx-month-sep"><span>${label.toUpperCase()}</span><span>${meta}</span></div><div class="tx-list" style="padding-bottom:.75rem">${renderTxItems(groups[ym], true)}</div>`;
  }).join('');

  if (hiddenCount > 0) {
    html += `<div style="padding:.75rem 2rem .5rem;text-align:center"><button class="btn-load-more" onclick="_txMonthLimit+=3;renderTxTab()">${t('tx.load.more', { n: Math.min(3, hiddenCount) })}<span style="opacity:.5;font-size:.5rem"> ${t('tx.hidden.months', { n: hiddenCount })}</span></button></div>`;
  }
  if (hiddenCount === 0 && S._hasMoreTx) {
    html += `<div style="padding:.75rem 2rem 1rem;text-align:center"><button class="btn-load-more" id="btn-load-older" onclick="loadOlderTx()"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="margin-right:.3rem"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>${t('tx.load.older')}</button></div>`;
  }
  el.innerHTML = html;
  document.querySelectorAll('.tx-list').forEach(c => initSwipeToDelete(c));
}

function renderTxItems(txs, actions) {
  if (!txs.length) return `<div class="empty">${t('empty.transactions')}</div>`;
  return txs.map(tx => {
    const isInc = isIncomeTx(tx);
    const cat   = isInc ? { id: 'income', label: t('cat.income'), color: 'var(--ok)' } : getCat(tx.category);
    const ds    = tx.date ? new Date(tx.date + 'T00:00:00').toLocaleDateString(getLang() === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'short' }) : '';
    const isOff = tx.id?.startsWith('offline_');
    const isFav = _favorites.has(tx.id);
    return `<div class="tx-item${isOff ? ' tx-offline' : ''}${isInc ? ' tx-income' : ''}${isFav ? ' tx-pinned' : ''}" ${actions ? `data-id="${tx.id}"` : ''} style="position:relative;overflow:hidden">
      ${actions ? `<div class="swipe-del"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></div>` : ''}
      <div class="tx-cat-icon" style="color:${cat.color}">${catSVG(cat.id, 14, cat.color)}</div>
      <div class="tx-info">
        <span class="tx-desc">${san(tx.description) || '-'}${isOff ? `<span class="offline-badge">${t('tx.offline.badge')}</span>` : ''}${isInc ? `<span class="tx-type-tag income" style="margin-left:.4rem">${t('tx.income.tag')}</span>` : ''}${tx.recurring ? '<span class="tx-recurring-badge">' + icon('repeat', '', 14) + '</span>' : ''}</span>
        <span class="tx-meta">${ds}${isInc ? '' : ' · ' + cat.label}${tx.accountId ? ' · ' + san(accountLabel(tx.accountId)) : ''}${tx.note ? ' · ' + san(tx.note) : ''}${tx.reimbursable ? `<span class="reimb-pill ${tx.reimbursed ? 'reimb-pill--done' : 'reimb-pill--pending'}" onclick="event.stopPropagation();Reimburse.toggle('${tx.id}')" title="${tx.reimbursed ? 'Reimbursed ✓' : 'Pending reimbursement — click to mark received'}">${tx.reimbursed ? '<svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : '<svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/><circle cx="12" cy="12" r="9"/></svg>'}REIMB</span>` : ''}</span>
      </div>
      <div class="tx-right">
        <span class="tx-amount${isInc ? ' income' : ''}">${isInc ? '+' : ''}${fmtCurrency(tx.amount)}</span>
        ${actions ? `<div class="tx-actions">
          <button class="tx-act-btn fav-btn${isFav ? ' fav-active' : ''}" onclick="toggleFavorite('${tx.id}')" title="${isFav ? 'Unpin' : 'Pin for quick-add'}">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </button>
          <button class="tx-act-btn dup-btn" onclick="duplicateTx('${tx.id}')" title="Duplicate">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
          <button class="tx-act-btn" onclick="handleEdit('${tx.id}')">${t('goals.btn.edit')}</button>
          <button class="tx-act-btn del" onclick="handleDelete('${tx.id}')">${t('goals.btn.del')}</button>
        </div>` : ''}
      </div>
    </div>`;
  }).join('');
}

/* ── SWIPE TO DELETE ─────────────────────────────────────── */
function initSwipeToDelete(container) {
  if (!container) return;
  container.querySelectorAll('.tx-item[data-id]').forEach(item => {
    if (item.dataset.swipeInit) return;
    item.dataset.swipeInit = '1';
    let startX = 0, startY = 0, dx = 0, dragging = false, locked = false;
    const THRESHOLD = 80;
    item.addEventListener('touchstart', e => { startX = e.touches[0].clientX; startY = e.touches[0].clientY; dx = 0; dragging = true; locked = false; item.style.transition = 'none'; }, { passive: true });
    item.addEventListener('touchmove', e => {
      if (!dragging) return;
      const cx = e.touches[0].clientX, cy = e.touches[0].clientY;
      const adx = Math.abs(cx - startX), ady = Math.abs(cy - startY);
      if (!locked) { if (ady > adx) { dragging = false; return; } locked = true; }
      dx = Math.min(0, cx - startX);
      item.style.transform = `translateX(${dx}px)`;
      item.style.opacity   = String(1 + dx / 200);
      const del = item.querySelector('.swipe-del');
      if (del) del.style.opacity = String(Math.min(1, -dx / THRESHOLD));
    }, { passive: true });
    item.addEventListener('touchend', () => {
      if (!dragging) return; dragging = false;
      if (-dx >= THRESHOLD) { item.style.transition = 'all .2s ease'; item.style.transform = 'translateX(-105%)'; item.style.opacity = '0'; setTimeout(() => handleDelete(item.dataset.id), 200); }
      else { item.style.transition = 'transform .25s ease, opacity .25s ease'; item.style.transform = ''; item.style.opacity = ''; }
    }, { passive: true });
  });
}

/* ── TRASH MODAL ─────────────────────────────────────────── */
async function openTrashModal() {
  const modal = document.getElementById('modal-trash');
  if (!modal) return;
  modal.classList.remove('hidden');
  await loadTrash();
}
function closeTrashModal() {
  const modal = document.getElementById('modal-trash');
  if (modal) modal.classList.add('hidden');
}
async function loadTrash() {
  const list = document.getElementById('trash-list');
  if (!list) return;
  list.innerHTML = `<div class="trash-loading">${t('trash.loading')}</div>`;
  try { _trashItems = await Store.getDeleted(); renderTrashList(); }
  catch (e) { list.innerHTML = `<div class="empty">${t('trash.error')}</div>`; }
}
function renderTrashList() {
  const list = document.getElementById('trash-list');
  const countEl = document.getElementById('trash-count');
  if (!list) return;
  if (countEl) countEl.textContent = `(${_trashItems.length})`;
  if (!_trashItems.length) { list.innerHTML = `<div class="trash-empty"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="opacity:.3;margin-bottom:.5rem"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg><div>${t('trash.empty')}</div></div>`; return; }
  list.innerHTML = _trashItems.map(tx => {
    const cat = getCat(tx.category);
    const ds = tx.date ? new Date(tx.date + 'T00:00:00').toLocaleDateString(getLang() === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'short' }) : '';
    const deletedAt = tx.deletedAt?.toDate ? tx.deletedAt.toDate().toLocaleDateString() : '';
    return `<div class="trash-item" data-id="${tx.id}">
      <div class="tx-cat-icon" style="color:${cat.color}">${catSVG(cat.id, 14, cat.color)}</div>
      <div class="tx-info"><span class="tx-desc">${san(tx.description) || '-'}</span><span class="tx-meta">${ds} · ${cat.label}${deletedAt ? ` · ${t('trash.deleted.on')} ${deletedAt}` : ''}</span></div>
      <div class="tx-right"><span class="tx-amount">${fmtCurrency(tx.amount)}</span>
        <div class="trash-actions">
          <button class="btn-trash-restore" onclick="restoreFromTrash('${tx.id}')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg></button>
          <button class="btn-trash-delete" onclick="permDeleteFromTrash('${tx.id}')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
      </div>
    </div>`;
  }).join('');
}

