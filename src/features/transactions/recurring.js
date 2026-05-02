/* ══════════════════════════════════════════════════════════
   CASHFLOW.SYS — recurring.js
   Recurring transaction management
   Depends on: state.js, helpers.js, store.js
══════════════════════════════════════════════════════════ */

function skipRecurringNextMonth(txId) {
  const tx = S.transactions.find(t => t.id === txId);
  if (!tx || !tx.recurring) return;
  const tmon = thisMonth();
  const [y, m] = tmon.split('-').map(Number);
  const nextYm = `${new Date(y, m, 1).getFullYear()}-${String(new Date(y, m, 1).getMonth() + 1).padStart(2, '0')}`;
  const nextLabel = new Date(+nextYm.split('-')[0], +nextYm.split('-')[1] - 1).toLocaleDateString(getLang() === 'id' ? 'id-ID' : 'en-US', { month: 'long', year: 'numeric' });
  const set = getRecurringSkipSet();
  set.add(`${tx.recurringId || `rec_${tx.id}`}|${nextYm}`);
  saveRecurringSkipSet(set);
  toast(t('recurring.skip.next', { month: nextLabel }));
  render();
}

async function processRecurring() {
  if (_recurringProcessed) return; _recurringProcessed = true;
  try {
    const today = todayKey(), tmon = thisMonth(), lmon = prevMonth(tmon);
    const allRecurring = S.transactions.filter(t => t.recurring && t.recurringId);
    if (!allRecurring.length) return;
    const thisMonthTxs    = S.transactions.filter(t => t.date?.startsWith(tmon));
    const thisMonthRecIds = new Set(thisMonthTxs.map(t => t.recurringId).filter(Boolean));
    const skipSet = getRecurringSkipSet();
    const added = [];
    const recurGroups = {};
    for (const tx of allRecurring) { const rid = tx.recurringId; if (!recurGroups[rid]) recurGroups[rid] = []; recurGroups[rid].push(tx); }
    for (const [rid, txs] of Object.entries(recurGroups)) {
      const sorted = txs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      const template = sorted[0];
      const freq = template.recurringFrequency || 'monthly';
      const lastDate = new Date(template.date + 'T00:00:00');
      let shouldGenerate = false, newDate = null;
      if (freq === 'daily') {
        if (template.date < today) { newDate = today; shouldGenerate = true; }
      } else if (freq === 'weekly') {
        const daysSince = Math.floor((new Date(today + 'T00:00:00') - lastDate) / (24*60*60*1000));
        if (daysSince >= 7) { const nextWeek = new Date(lastDate.getTime() + 7*24*60*60*1000); newDate = nextWeek.toISOString().split('T')[0]; shouldGenerate = true; }
      } else if (freq === 'custom' && template.recurringDay !== undefined) {
        const targetDay = template.recurringDay, todayObj = new Date(today + 'T00:00:00');
        let daysDiff = todayObj.getDay() - targetDay;
        if (daysDiff < 0) daysDiff += 7;
        const lastOccurrence = new Date(todayObj.getTime() - daysDiff*24*60*60*1000);
        const lastOccurrenceStr = lastOccurrence.toISOString().split('T')[0];
        if (template.date < lastOccurrenceStr && lastOccurrenceStr <= today) { newDate = lastOccurrenceStr; shouldGenerate = true; }
      } else {
        const lastMonthRec = txs.filter(t => t.date?.startsWith(lmon));
        if (lastMonthRec.length && !thisMonthRecIds.has(rid) && !skipSet.has(`${rid}|${tmon}`)) { newDate = `${tmon}-01`; shouldGenerate = true; }
      }
      if (shouldGenerate && newDate && !skipSet.has(`${rid}|${newDate}`)) {
        const existsForDate = thisMonthTxs.some(t => t.recurringId === rid && t.date === newDate);
        if (!existsForDate) {
          const newTx = { ...template, date: newDate, recurringId: rid, note: (template.note ? template.note + ' · ' : '') + 'auto-recurring' };
          delete newTx.id; delete newTx.createdAt;
          const id = await Store.add(newTx);
          added.push({ id, ...newTx });
        }
      }
    }
    if (added.length) {
      S.transactions = [...added, ...S.transactions].sort(sortTxByInput);
      toast(icon('repeat', '', 14) + ' ' + t('recurring.auto.toast', {n: added.length}));
      Charts.invalidate(); render();
    }
  } catch (e) {
    if (typeof isOfflineFirestoreError === 'function' && isOfflineFirestoreError(e)) _recurringProcessed = false;
    else console.warn('processRecurring:', e);
  }
}
