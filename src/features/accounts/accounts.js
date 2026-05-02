/* ══════════════════════════════════════════════════════════
   CASHFLOW.SYS — accounts.js
   Account management
   Depends on: state.js, helpers.js
══════════════════════════════════════════════════════════ */

function addAccount() {
  const name = document.getElementById('new-account-name')?.value?.trim();
  if (!name) { toast(t('accounts.err.name')); return; }
  const id = 'acc_' + Date.now().toString(36);
  S.accounts.push({ id, name });
  persistAccounts(); fillAccountSelects(); renderAccountsList();
  const inp = document.getElementById('new-account-name'); if (inp) inp.value = '';
  toast(t('accounts.added'));
}

function removeAccount(id) {
  if (id === 'main') return;
  S.accounts = S.accounts.filter(a => a.id !== id);
  persistAccounts(); fillAccountSelects(); renderAccountsList();
}
