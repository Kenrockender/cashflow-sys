/* ══════════════════════════════════════════════════════════
   CASHFLOW.SYS — transactions.js
   Transaction CRUD operations
   Depends on: state.js, helpers.js, store.js
══════════════════════════════════════════════════════════ */

/* ── FIRESTORE DEADLINE HELPERS ──────────────────────────── */
function isTransientFirestoreError(e) {
  if (!e) return false;
  let c = e.code;
  if (c != null) {
    c = String(c);
    if (c.includes('/')) c = c.split('/').pop();
    if (['unavailable','deadline-exceeded','resource-exhausted','aborted','cancelled','canceled','cf-firestore-timeout'].includes(c)) return true;
  }
  if (/client is offline|failed to get document/i.test(String(e.message || ''))) return true;
  return false;
}

function withFirestoreDeadline(promise, ms = 5000) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => { const err = new Error('Firestore timeout'); err.code = 'cf-firestore-timeout'; reject(err); }, ms);
  });
  return Promise.race([promise.finally(() => { clearTimeout(timer); }), timeout]);
}

/** Drop offline_* rows for txs the queue actually synced. */
function mergeTransactionsAfterQueueFlush(fresh, prev, syncedFingerprints) {
  const impl = window.mergeTxFlushImpl;
  if (typeof impl === 'function') return impl(fresh, prev, syncedFingerprints, window.txSyncFingerprint);
  const pruned = prev.filter(t => {
    if (!String(t.id || '').startsWith('offline_')) return true;
    if (syncedFingerprints?.length) { const ok = new Set(syncedFingerprints); return !ok.has(window.txSyncFingerprint(t)); }
    const fpSeen = new Set(fresh.map(window.txSyncFingerprint));
    return !fpSeen.has(window.txSyncFingerprint(t));
  });
  const ids = new Set(fresh.map(t => t.id));
  return [...fresh, ...pruned.filter(t => !ids.has(t.id))];
}

/* ── SAVE / EDIT TRANSACTION ─────────────────────────────── */
async function handleSaveTx() {
  const amtInput    = document.getElementById('form-amount');
  const amount      = parseInt(amtInput?.dataset.rawValue || (amtInput?.value || '').replace(/\D/g, '') || '0');
  const description = document.getElementById('form-desc').value.trim();
  const date        = document.getElementById('form-date').value;
  const note        = document.getElementById('form-note').value.trim();
  const recurring   = document.getElementById('form-recurring')?.checked || false;
  const type        = _txType;
  const category    = type === 'income' ? 'income' : (document.querySelector('.cat-chip.selected')?.dataset.cat || 'other');

  if (!amount || amount <= 0)   { toast(t('toast.err.amount')); return; }
  if (!description)             { toast(t('toast.err.desc'));   return; }
  if (!date)                    { toast(t('toast.err.date'));   return; }
  if (date > todayKey())        { toast(t('toast.err.future.date')); return; }

  const accountEl    = document.getElementById('form-account');
  const accountId    = accountEl?.value || S.accounts[0]?.id || 'main';
  const seriesUpdate = !!(S.editingId && document.getElementById('form-recurring-series')?.checked);
  const orig         = S.editingId ? S.transactions.find(t => t.id === S.editingId) : null;
  const reimbursable = document.getElementById('form-reimbursable')?.checked || false;
  const tx           = { amount, description, date, category, type, note, recurring, accountId, ...(reimbursable ? { reimbursable: true } : {}) };

  const recurFreq = document.getElementById('form-recurring-frequency')?.value || 'monthly';
  const recurDay  = document.getElementById('form-recurring-day')?.value || null;
  if (recurring && !S.editingId) tx.recurringId = `rec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  if (recurring) {
    tx.recurringFrequency = recurFreq;
    if (recurFreq === 'custom' && recurDay !== null) tx.recurringDay = parseInt(recurDay);
  }

  // Optimistic UI
  const editingId = S.editingId;
  const tempId    = 'temp_' + Date.now();

  if (editingId && seriesUpdate && orig?.recurringId) {
    const rid = orig.recurringId;
    const sibs = S.transactions.filter(t => t.recurringId === rid);
    const basePatch = { amount, description, category, type, note, recurring, accountId };
    sibs.forEach(t => {
      const idx = S.transactions.findIndex(x => x.id === t.id);
      if (idx >= 0) S.transactions[idx] = { ...S.transactions[idx], ...basePatch, date: t.id === editingId ? date : t.date };
    });
  } else if (editingId) {
    const i = S.transactions.findIndex(t => t.id === editingId);
    if (i >= 0) S.transactions[i] = { ...S.transactions[i], ...tx };
  } else {
    S.transactions.unshift({ id: tempId, _localTs: Date.now(), ...tx });
    S.transactions.sort(sortTxByInput);
  }

  closeModal('modal-add');
  Charts.invalidate();
  render();
  toast(editingId ? t('toast.tx.updated') : t('toast.tx.saved'));

  if (!editingId && type === 'income' && amount > 0) processAutoContribute(amount);

  // Background Firestore sync
  (async () => {
    try {
      if (editingId && seriesUpdate && orig?.recurringId) {
        const sibs = S.transactions.filter(t => t.recurringId === orig.recurringId);
        const basePatch = { amount, description, category, type, note, recurring, accountId };
        for (const t of sibs) { await withFirestoreDeadline(Store.update(t.id, t.id === editingId ? { ...basePatch, date } : basePatch)); }
      } else if (editingId) {
        await withFirestoreDeadline(Store.update(editingId, tx));
      } else {
        try {
          const id = await withFirestoreDeadline(Store.add(tx));
          const idx = S.transactions.findIndex(t => t.id === tempId);
          if (idx >= 0) S.transactions[idx].id = id;
        } catch (e) {
          if (isTransientFirestoreError(e)) {
            await OQ.enqueue(tx);
            const idx = S.transactions.findIndex(t => t.id === tempId);
            if (idx >= 0) S.transactions[idx].id = 'offline_' + Date.now();
          } else {
            S.transactions = S.transactions.filter(t => t.id !== tempId);
            Charts.invalidate(); render();
            toast(t('toast.err.generic') + e.message);
          }
        }
      }
    } catch (e) { console.warn('Background save error:', e.message); }
  })();
}

function handleEdit(id) {
  if (id.startsWith('offline_')) { toast(t('toast.offline.tx')); return; }
  const tx = S.transactions.find(t => t.id === id); if (!tx) return;
  S.editingId = id;
  document.getElementById('form-amount').value = (tx.amount || '').toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  document.getElementById('form-desc').value   = tx.description;
  document.getElementById('form-date').value   = tx.date;
  document.getElementById('form-note').value   = tx.note || '';
  openModal('modal-add');
  setTimeout(() => {
    const txType = tx.type || 'expense';
    setTxType(txType);
    if (txType === 'expense') selCat(tx.category);
    const recCb = document.getElementById('form-recurring'); if (recCb) recCb.checked = !!tx.recurring;
    const reimbCb = document.getElementById('form-reimbursable'); if (reimbCb) reimbCb.checked = !!tx.reimbursable;
    const acc = document.getElementById('form-account');
    if (acc) acc.value = tx.accountId || S.accounts[0]?.id || 'main';
    const seriesWrap = document.getElementById('recurring-series-wrap');
    const seriesCb   = document.getElementById('form-recurring-series');
    if (seriesWrap && seriesCb) { const show = !!(tx.recurring || tx.recurringId); seriesWrap.classList.toggle('hidden', !show); seriesCb.checked = false; }
  }, 0);
}

/* ── DELETE TRANSACTION ──────────────────────────────────── */
async function flushPendingSoftDelete() {
  if (!_pendingDelete) return;
  clearTimeout(_pendingDelete.timer);
  const { id } = _pendingDelete;
  _pendingDelete = null;
  if (String(id).startsWith('offline_')) return;
  if (!S.transactions.some(t => t.id === id)) {
    try { await Store.softDelete(id); } catch (e) { console.warn('flushPendingSoftDelete:', e?.message); }
  }
}

function clearPendingDeleteTimer() {
  if (_pendingDelete) { clearTimeout(_pendingDelete.timer); _pendingDelete = null; }
}

async function handleDelete(id) {
  await flushPendingSoftDelete();
  const tx = S.transactions.find(t => t.id === id); if (!tx) return;
  const hadSoftDeleted = !!tx._softDeleted;
  S.transactions = S.transactions.filter(t => t.id !== id);
  Charts.invalidate(); render();
  toastUndo(t('toast.tx.deleted'), async () => {
    clearPendingDeleteTimer();
    tx._softDeleted = false;
    S.transactions = [tx, ...S.transactions];
    S.transactions.sort(sortTxByInput);
    Charts.invalidate(); render();
    if (!id.startsWith('offline_') && hadSoftDeleted) await Store.restore(id);
  });
  if (!id.startsWith('offline_')) {
    _pendingDelete = {
      id,
      timer: setTimeout(async () => {
        _pendingDelete = null;
        if (S.transactions.some(t => t.id === id)) return;
        try { await Store.softDelete(id); tx._softDeleted = true; }
        catch (e) { console.warn('softDelete:', e?.message); }
      }, 4600)
    };
  }
}

/* ── TRASH ───────────────────────────────────────────────── */
async function restoreFromTrash(id) {
  try { await Store.restore(id); _trashItems = _trashItems.filter(t => t.id !== id); renderTrashList(); toast(t('trash.restored')); }
  catch (e) { toast(t('trash.restore.error')); }
}
async function permDeleteFromTrash(id) {
  if (!confirm(t('trash.confirm.delete'))) return;
  try { await Store.permDelete(id); _trashItems = _trashItems.filter(t => t.id !== id); renderTrashList(); toast(t('trash.deleted.perm')); }
  catch (e) { toast(t('trash.delete.error')); }
}
async function emptyAllTrash() {
  if (!confirm(t('trash.confirm.empty'))) return;
  try { const count = await Store.emptyTrash(); _trashItems = []; renderTrashList(); toast(t('trash.emptied', { n: count })); }
  catch (e) { toast(t('trash.empty.error')); }
}

/* ── DUPLICATE ───────────────────────────────────────────── */
function quickDuplicateTx(id) {
  const tx = S.transactions.find(t => t.id === id); if (!tx) return;
  document.getElementById('form-amount').value = tx.amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  document.getElementById('form-desc').value   = tx.description;
  document.getElementById('form-date').value   = todayKey();
  document.getElementById('form-note').value   = tx.note || '';
  S.editingId = null;
  openModal('modal-add');
  setTimeout(() => { setTxType(tx.type || 'expense'); if (tx.type !== 'income') selCat(tx.category || 'other'); }, 0);
}
function duplicateTx(id) { quickDuplicateTx(id); }

/* ── LOAD MORE TRANSACTIONS ──────────────────────────────── */
async function loadOlderTx() {
  const btn = document.getElementById('btn-load-older');
  if (!S._oldestTxDate) return;
  if (btn) { btn.disabled = true; btn.textContent = t('toast.demo.loading'); }
  try {
    const older = await Store.getPage(S._oldestTxDate, 200);
    if (!older.length) { S._hasMoreTx = false; if (btn) btn.remove(); return; }
    const existing = new Set(S.transactions.map(t => t.id));
    const newTxs   = older.filter(t => !existing.has(t.id));
    S.transactions = [...S.transactions, ...newTxs];
    S._oldestTxDate = S.transactions[S.transactions.length - 1]?.date || null;
    S._hasMoreTx = older.length >= 200;
    toast(t('toast.older.loaded', {n: newTxs.length}));
    Charts.invalidate(); renderTxTab();
  } catch (e) { toast(t('toast.err.load') + e.message); }
  if (btn) { btn.disabled = false; btn.textContent = t('tx.load.older'); }
}

/* ── CLEAR ALL DATA ──────────────────────────────────────── */
async function clearAllData() {
  const code = prompt(t('confirm.clear.all'));
  if (code !== t('confirm.clear.check')) return;
  S.transactions = []; S.budgets = { ...DEF_BUDGETS }; S.goals = []; S.budgetPercents = {}; S._hasMoreTx = false;
  ['cf-demo-', 'cf-has-demo-', 'cf-insights-'].forEach(p => Object.keys(localStorage).filter(k => k.startsWith(p)).forEach(k => localStorage.removeItem(k)));
  S._skipOnboarding = true; Charts.invalidate(); render(); S._skipOnboarding = false;
  toast(t('toast.cleared'));
  const uid = S.user.uid;
  const batchDel = async colName => {
    const q = db.collection('users').doc(uid).collection(colName);
    const snap = typeof firestoreQueryGet === 'function' ? await firestoreQueryGet(q) : await q.get();
    if (snap.empty) return;
    const chunks = []; for (let i = 0; i < snap.docs.length; i += 400) chunks.push(snap.docs.slice(i, i + 400));
    await Promise.all(chunks.map(ch => { const b = db.batch(); ch.forEach(d => b.delete(d.ref)); return b.commit(); }));
  };
  Promise.all([batchDel('transactions'), batchDel('goals'), db.collection('users').doc(uid).collection('settings').doc('budgets').delete().catch(() => {})]).catch(e => console.warn('Background delete error:', e.message));
}

/* ── DEMO DATA ───────────────────────────────────────────── */
async function loadDemoData() {
  const btn = document.getElementById('btn-load-demo-modal');
  if (btn) { btn.disabled = true; btn.textContent = t('toast.demo.loading'); }
  try {
    const col = db.collection('users').doc(S.user.uid).collection('transactions');
    const withIds = DUMMY_TX.map(tx => ({ ...tx, id: col.doc().id }));
    S.transactions = withIds.sort(sortTxByInput);
    localStorage.setItem(`cf-demo-${S.user.uid}`, '1');
    localStorage.setItem(`cf-has-demo-${S.user.uid}`, '1');
    closeModal('modal-onboarding'); Charts.invalidate(); render();
    toast(t('toast.demo.loaded', { n: withIds.length }));
    const chunks = []; for (let i = 0; i < withIds.length; i += 400) chunks.push(withIds.slice(i, i + 400));
    Promise.all(chunks.map(chunk => {
      const batch = db.batch();
      chunk.forEach(tx => { const { id, ...data } = tx; batch.set(col.doc(id), { ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp() }); });
      return batch.commit();
    })).catch(e => console.warn('Background save error:', e.message));
  } catch (e) { toast(t('toast.demo.fail') + e.message); if (btn) { btn.disabled = false; btn.textContent = t('ob.04.cta'); } }
}

async function resetDemoData() {
  if (!confirm(t('confirm.reset.demo'))) return;
  const dummyDescs = new Set(DUMMY_TX.map(t => t.description.toLowerCase().trim()));
  const toDelete   = S.transactions.filter(t => dummyDescs.has((t.description || '').toLowerCase().trim()) || (t.note || '').includes('auto-recurring'));
  S.transactions = S.transactions.filter(t => !toDelete.some(d => d.id === t.id));
  localStorage.removeItem(`cf-demo-${S.user.uid}`);
  localStorage.removeItem(`cf-has-demo-${S.user.uid}`);
  toast(t('toast.demo.reset', { n: toDelete.length }));
  Charts.invalidate(); render();
  const realIds = toDelete.filter(t => !t.id?.startsWith('offline_')).map(t => t.id);
  const chunks  = []; for (let i = 0; i < realIds.length; i += 400) chunks.push(realIds.slice(i, i + 400));
  Promise.all(chunks.map(ch => {
    const b = db.batch();
    ch.forEach(id => b.delete(db.collection('users').doc(S.user.uid).collection('transactions').doc(id)));
    return b.commit();
  })).catch(e => console.warn('Background reset error:', e.message));
}
