/* ══════════════════════════════════════════════════════════
   CASHFLOW.SYS — accounts.js
   Account management
   Depends on: state.js, helpers.js
══════════════════════════════════════════════════════════ */

function addAccount() {
  const rawName = document.getElementById('new-account-name')?.value?.trim();
  if (!rawName) { toast(t('accounts.err.name')); return; }
  const name = rawName.replace(/[<>"'&]/g, '').slice(0, 50);
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

/* ─── ESM window bridge (auto-generated) ─── */
Object.assign(window, { addAccount, removeAccount });
