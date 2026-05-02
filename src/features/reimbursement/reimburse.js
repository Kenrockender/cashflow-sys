/* ══════════════════════════════════════════════════════════
   CASHFLOW.SYS — reimburse.js
   Reimbursement tracking: mark expenses as reimbursable,
   track pending / received status, show a summary list.

   Data fields added to transactions:
     reimbursable   : boolean  — "I paid this, will get money back"
     reimbursed     : boolean  — "Money received"
     reimbursedDate : string   — ISO date money was received
     reimbursedNote : string   — optional note
══════════════════════════════════════════════════════════ */

const Reimburse = (() => {

  /* ── INTERNAL CACHE ──────────────────────────────────────
     Map txId → tx for all reimbursable transactions.
     Kept in sync via Reimburse.register() called in renderTxTab. */
  const _txMap = new Map();

  function register(transactions) {
    _txMap.clear();
    for (const tx of (transactions || [])) {
      if (tx.reimbursable) _txMap.set(tx.id, tx);
    }
    updateBadge();
    if (!document.getElementById('modal-reimburse')?.classList.contains('hidden')) {
      _renderList();
    }
  }

  /* ── TOGGLE ──────────────────────────────────────────────
     Called by inline pill onclick in renderTxItems AND by
     the action buttons inside the list modal.             */
  async function toggle(txId) {
    const tx = _txMap.get(txId);
    if (!tx) return;
    if (!tx.reimbursed) {
      _openMarkModal(txId, tx);
    } else {
      await _commitToggle(txId,
        { reimbursed: firebase.firestore.FieldValue.delete(),
          reimbursedDate: firebase.firestore.FieldValue.delete(),
          reimbursedNote: firebase.firestore.FieldValue.delete(),
          reimbursedAmount: firebase.firestore.FieldValue.delete() },
        { reimbursed: false, reimbursedDate: null, reimbursedNote: null, reimbursedAmount: null }
      );
    }
  }

  async function _commitToggle(txId, firestorePatch, localPatch) {
    try {
      await Store.update(txId, firestorePatch);
      // Update S.transactions so next render() shows updated pill colour
      if (typeof S !== 'undefined') {
        const idx = S.transactions.findIndex(t => t.id === txId);
        if (idx >= 0) S.transactions[idx] = { ...S.transactions[idx], ...localPatch };
      }
      // Update cache
      const updated = { ..._txMap.get(txId), ...localPatch };
      if (updated.reimbursable) _txMap.set(txId, updated);
      else _txMap.delete(txId);

      updateBadge();
      if (typeof render === 'function') render();
      if (!document.getElementById('modal-reimburse')?.classList.contains('hidden')) _renderList();
    } catch (e) {
      console.error('[REIMBURSE] Save failed:', e);
      if (typeof toast === 'function') toast('Could not save. Check your connection.');
    }
  }

  /* ── MARK AS RECEIVED MINI-MODAL ─────────────────────── */
  function _openMarkModal(txId, tx) {
    const dateEl   = document.getElementById('reimb-mark-date');
    const noteEl   = document.getElementById('reimb-mark-note');
    const descEl   = document.getElementById('reimb-mark-desc');
    const origEl   = document.getElementById('reimb-mark-amount');
    const amtInput = document.getElementById('reimb-mark-amt-input');
    const signBtn  = document.getElementById('reimb-mark-sign-btn');
    const amtDisp  = document.getElementById('reimb-mark-amt-display');
    if (!dateEl) return;

    const txAmt = Math.abs(Number(tx.amount) || 0);

    // Reset fields
    dateEl.value    = new Date().toISOString().split('T')[0];
    noteEl.value    = '';
    if (descEl) descEl.textContent = tx.description || '—';
    if (origEl) origEl.textContent = _fmtAmt(tx.amount);

    // Amount input: pre-fill with tx amount, positive sign
    let _sign = 1;
    if (amtInput) amtInput.value = txAmt;
    if (signBtn)  signBtn.textContent = '+';
    if (amtDisp)  amtDisp.textContent = _fmtAmt(txAmt);

    // Sign toggle
    if (signBtn) {
      signBtn.onclick = () => {
        _sign *= -1;
        signBtn.textContent = _sign > 0 ? '+' : '−';
        signBtn.classList.toggle('reimb-sign-neg', _sign < 0);
        if (amtDisp) amtDisp.textContent = _fmtAmt(_sign * Math.abs(Number(amtInput.value) || 0));
      };
    }

    // Live-update display as user types
    if (amtInput) {
      amtInput.oninput = () => {
        const val = Math.abs(Number(amtInput.value.replace(/[^0-9.]/g, '')) || 0);
        if (amtDisp) amtDisp.textContent = _fmtAmt(_sign * val);
      };
    }

    document.getElementById('reimb-mark-confirm').onclick = async () => {
      const date          = dateEl.value || null;
      const note          = noteEl.value.trim() || null;
      const rawAmt        = Math.abs(Number((amtInput ? amtInput.value : '') || txAmt) || txAmt);
      const reimbursedAmt = _sign * rawAmt;
      closeModal('modal-reimb-mark');
      await _commitToggle(txId,
        { reimbursed: true,
          reimbursedAmount: reimbursedAmt,
          ...(date ? { reimbursedDate: date } : {}),
          ...(note ? { reimbursedNote: note } : {}) },
        { reimbursed: true, reimbursedAmount: reimbursedAmt, reimbursedDate: date, reimbursedNote: note }
      );
    };
    openModal('modal-reimb-mark');
  }

  /* ── REIMBURSEMENT LIST MODAL ─────────────────────────── */
  let _listFilter = 'pending';

  function openReimburseModal() { _listFilter = 'pending'; _renderList(); openModal('modal-reimburse'); }
  function setFilter(f) { _listFilter = f; _renderList(); }

  function _renderList() {
    const allTxs  = Array.from(_txMap.values());
    const pending = allTxs.filter(t => !t.reimbursed);
    const done    = allTxs.filter(t =>  t.reimbursed);

    // Pending: show absolute value (expenses are stored negative, but "owed" is always positive)
    _setText('reimb-summary-pending', _fmtAmt(pending.reduce((s, t) => s + Math.abs(Number(t.amount || 0)), 0)));
    // Received: use actual reimbursedAmount entered by user, fall back to original amount for older entries
    _setText('reimb-summary-done',    _fmtAmt(done.reduce((s, t)    => s + Number(t.reimbursedAmount ?? t.amount ?? 0), 0)));

    _setText('reimb-pending-count', pending.length);
    _setText('reimb-done-count',    done.length);
    document.querySelectorAll('.reimb-filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === _listFilter));

    const listEl = document.getElementById('reimb-list-items');
    if (!listEl) return;
    let filtered = _listFilter === 'pending' ? pending : _listFilter === 'done' ? done : allTxs;
    filtered = filtered.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    if (!filtered.length) {
      const labels = { pending: 'pending reimbursements', done: 'received reimbursements', all: 'reimbursable transactions' };
      listEl.innerHTML = `<div class="reimb-empty"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" style="opacity:.2;display:block;margin:0 auto .7rem"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><div>No ${labels[_listFilter]}</div></div>`;
      return;
    }
    listEl.innerHTML = filtered.map(tx => {
      const cat = _catMeta(tx.category);
      return `<div class="reimb-item ${tx.reimbursed ? 'reimb-item--done' : 'reimb-item--pending'}">
  <div class="reimb-item-cat" style="background:${cat.bg};color:${cat.color};border:1px solid ${cat.color}22">${cat.icon}</div>
  <div class="reimb-item-info">
    <div class="reimb-item-desc">${_esc(tx.description || 'No description')}</div>
    <div class="reimb-item-meta">
      <span>${tx.date || '—'}</span><span class="reimb-dot">·</span><span>${tx.category || 'Other'}</span>
      ${tx.reimbursed && tx.reimbursedDate ? `<span class="reimb-dot">·</span><span class="reimb-rcvd">Rcvd ${tx.reimbursedDate}</span>` : ''}
      ${tx.reimbursedNote ? `<span class="reimb-dot">·</span><span class="reimb-note-lbl">${_esc(tx.reimbursedNote)}</span>` : ''}
      ${tx.reimbursed && tx.reimbursedAmount != null && Math.abs(tx.reimbursedAmount) !== Math.abs(Number(tx.amount))
          ? `<span class="reimb-dot">·</span><span class="reimb-amt-diff ${Number(tx.reimbursedAmount) < 0 ? 'reimb-amt-neg' : 'reimb-amt-pos'}">Rcvd ${_fmtAmt(tx.reimbursedAmount)}</span>`
          : ''}
    </div>
  </div>
  <div class="reimb-item-right">
    <div class="reimb-item-amount">${_fmtAmt(tx.amount)}</div>
    <button class="reimb-toggle-btn ${tx.reimbursed ? 'reimb-toggle-btn--undo' : 'reimb-toggle-btn--mark'}" onclick="Reimburse.toggle('${tx.id}')">
      ${tx.reimbursed
        ? `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>Undo`
        : `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Mark Received`}
    </button>
  </div>
</div>`;
    }).join('');
  }

  /* ── PENDING BADGE ON TOOLBAR BUTTON ─────────────────── */
  function updateBadge() {
    const count = Array.from(_txMap.values()).filter(t => !t.reimbursed).length;
    const badge = document.getElementById('reimb-nav-badge');
    if (!badge) return;
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline-flex' : 'none';
  }

  /* ── HELPERS ─────────────────────────────────────────── */
  function _fmtAmt(amt) {
    const n = Number(amt);
    return isNaN(n) ? '—' : 'Rp\u00a0' + n.toLocaleString('id-ID');
  }
  function _esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function _setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
  function _catMeta(cat) {
    const svg = (path, extra='') => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra}>${path}</svg>`;
    const map = {
      'Food & Drink':  { icon: svg('<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>'), bg:'rgba(192,90,68,.18)',  color:'#e07055' },
      'Transport':     { icon: svg('<rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>'), bg:'rgba(52,120,200,.18)', color:'#5090e0' },
      'Shopping':      { icon: svg('<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>'), bg:'rgba(130,80,200,.18)', color:'#a070e0' },
      'Health':        { icon: svg('<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>'), bg:'rgba(40,170,100,.18)', color:'#40c070' },
      'Bills':         { icon: svg('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>'), bg:'rgba(212,168,67,.18)', color:'#d4a843' },
      'Entertainment': { icon: svg('<rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/>'), bg:'rgba(200,80,140,.18)', color:'#e06090' },
      'Education':     { icon: svg('<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>'), bg:'rgba(40,170,170,.18)', color:'#30c0c0' },
      'Personal':      { icon: svg('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'), bg:'rgba(140,200,50,.18)', color:'#80c020' },
      'Housing':       { icon: svg('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>'), bg:'rgba(210,100,40,.18)', color:'#d06030' },
      'Subscriptions': { icon: svg('<rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>'), bg:'rgba(100,60,200,.18)', color:'#7050d0' },
      'Social':        { icon: svg('<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>'), bg:'rgba(200,50,80,.18)',  color:'#d04060' },
    };
    return map[cat] || { icon: svg('<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'), bg:'rgba(120,120,120,.18)', color:'#888' };
  }

  return { register, toggle, openModal: openReimburseModal, setFilter, updateBadge };
})();