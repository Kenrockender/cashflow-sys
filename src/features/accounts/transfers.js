/* ══════════════════════════════════════════════════════════
   CASHFLOW.SYS — transfers.js
   Transfer between accounts
   Depends on: state.js, helpers.js, store.js
══════════════════════════════════════════════════════════ */

function openTransferModal() {
  fillAccountSelects();
  const d = document.getElementById('transfer-date');
  if (d) { d.max = todayKey(); d.value = todayKey(); }
  const amt = document.getElementById('transfer-amount');
  if (amt) amt.value = '';
  document.getElementById('modal-transfer')?.classList.remove('hidden');
}

async function confirmTransfer() {
  const fromId = document.getElementById('transfer-from-account')?.value;
  const toId   = document.getElementById('transfer-to-account')?.value;
  const amount = parseFloat((document.getElementById('transfer-amount')?.value || '').replace(/[.,]/g, '')) || 0;
  const date   = document.getElementById('transfer-date')?.value;
  if (!fromId || !toId || fromId === toId) { toast(t('transfer.err.accounts')); return; }
  if (!amount || amount <= 0)              { toast(t('toast.err.amount'));        return; }
  if (!date || date > todayKey())          { toast(t('toast.err.date'));          return; }
  const ref = 'tf_' + Date.now().toString(36);
  const txOut = { amount, date, type: 'expense', category: 'other', description: t('transfer.desc.out', { name: accountLabel(toId) }), note: 'transfer:' + ref, recurring: false, accountId: fromId };
  const txIn  = { amount, date, type: 'income',  category: 'income', description: t('transfer.desc.in', { name: accountLabel(fromId) }), note: 'transfer:' + ref, recurring: false, accountId: toId };
  document.getElementById('modal-transfer')?.classList.add('hidden');
  try {
    const pair = await Store.addBatch([txOut, txIn]);
    S.transactions = [...pair, ...S.transactions].sort(sortTxByInput);
    Charts.invalidate(); render();
    toast(t('transfer.done'));
  } catch (e) { toast(t('transfer.err.save') + (e.message || '')); }
}
