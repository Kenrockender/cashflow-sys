/* ══════════════════════════════════════════════════════════
   CASHFLOW.SYS — budget.js
   Budget management and rollover
   Depends on: state.js, helpers.js, store.js
══════════════════════════════════════════════════════════ */

function toggleRollover() {
  S.rolloverEnabled = !S.rolloverEnabled;
  localStorage.setItem('cf-rollover-enabled', S.rolloverEnabled);
  const btn = document.getElementById('rollover-toggle');
  if (btn) btn.textContent = S.rolloverEnabled ? t('budget.rollover.disable') : t('budget.rollover.enable');
  if (S.rolloverEnabled) calculateRollover();
  renderRolloverPanel();
  toast(S.rolloverEnabled ? t('toast.rollover.enabled') : t('toast.rollover.disabled'));
}

function calculateRollover() {
  const lastMonth = prevMonth(thisMonth());
  const lastMonthTx = getTxView().filter(tx => tx.date?.startsWith(lastMonth) && isExpenseTx(tx));
  let totalBudget = 0, totalSpent = 0;
  getAllCategories().forEach(cat => {
    const budget = S.budgets[cat.id] || 0;
    const spent  = lastMonthTx.filter(tx => tx.category === cat.id).reduce((s, tx) => s + tx.amount, 0);
    totalBudget += budget; totalSpent += spent;
  });
  S.rolloverAmount = Math.max(0, totalBudget - totalSpent);
  localStorage.setItem('cf-rollover-amount', S.rolloverAmount);
  return S.rolloverAmount;
}

function resetRollover() {
  if (!confirm(t('confirm.reset.rollover'))) return;
  S.rolloverAmount = 0;
  localStorage.setItem('cf-rollover-amount', '0');
  renderRolloverPanel();
  toast(t('toast.rollover.reset'));
}

/* ─── ESM window bridge (auto-generated) ─── */
Object.assign(window, { toggleRollover, calculateRollover, resetRollover });
