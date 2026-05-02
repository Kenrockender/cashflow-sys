/* ══════════════════════════════════════════════════════════
   CASHFLOW.SYS — app.js  (orchestration only)
   Boots the app after all modules are loaded.

   ┌─ LOAD ORDER ──────────────────────────────────────────┐
   │  1. constants.js        — CATS, CURRENCIES, icons, etc │
   │  2. firebase-init.js    — auth, db                     │
   │  3. i18n.js             — t(), getLang()               │
   │  4. store.js            — Store, OQ                    │
   │  5. parser.js           — Parser, ImportParser         │
   │  6. charts.js           — Charts                       │
   │  ── app modules ────────────────────────────────────── │
   │  7. state.js            — S, feature flags             │
   │  8. helpers.js          — fmtCurrency, san, deb, etc.  │
   │  9. ui-render.js        — render*, modal*, tab*        │
   │  10. transactions.js    — CRUD, goals, import/export   │
   │  11. auth.js            — onAuthStateChanged, sync     │
   │  12. events.js          — DOM event listeners          │
   │  13. app.js             — (this file) boot             │
   └───────────────────────────────────────────────────────┘
══════════════════════════════════════════════════════════ */

/* ── BOOT ────────────────────────────────────────────────── */
initPullToRefresh();
initKeyboardShortcuts();
initCurrencyInputFormatting();

/* ── LIVE CURRENCY INPUT FORMATTING ─────────────────────── */
function initCurrencyInputFormatting() {
  const isId  = () => typeof getLang === 'function' && getLang() === 'id';
  const sep   = () => isId() ? '.' : ',';

  const formatWithSeparators = value => {
    const num = value.replace(/\D/g, '');
    if (!num) return '';
    return num.replace(/\B(?=(\d{3})+(?!\d))/g, sep());
  };

  const getRawValue = formatted => formatted.replace(/\D/g, '');

  const applyFormatting = input => {
    if (!input) return;
    if (input.type === 'number') { input.type = 'text'; input.inputMode = 'numeric'; input.pattern = '[0-9]*'; }
    if (input.value) input.value = formatWithSeparators(input.value);
    input.dataset.rawValue = getRawValue(input.value);

    input.addEventListener('input', function (e) {
      const cursorPos = this.selectionStart;
      const oldValue  = this.value, oldLength = oldValue.length;
      const sepsBefore = (oldValue.slice(0, cursorPos).match(/\D/g) || []).length;
      const raw = getRawValue(this.value);
      this.dataset.rawValue = raw;
      this.value = formatWithSeparators(this.value);
      const newLength = this.value.length;
      const sepsAfter = (this.value.slice(0, cursorPos + (newLength - oldLength)).match(/\D/g) || []).length;
      const newPos = cursorPos + (sepsAfter - sepsBefore) + (newLength - oldLength);
      this.setSelectionRange(Math.max(0, newPos), Math.max(0, newPos));
    });

    input.addEventListener('keypress', function (e) {
      if (!/\d/.test(e.key) && e.key !== 'Backspace' && e.key !== 'Delete' && e.key !== 'Tab' && !e.ctrlKey && !e.metaKey) e.preventDefault();
    });
  };

  const amountInputIds = ['form-amount','goal-target','goal-saved','contrib-amount','total-income-input','tx-amt-min','tx-amt-max'];
  amountInputIds.forEach(id => { const input = document.getElementById(id); if (input) applyFormatting(input); });

  // Dynamically created budget inputs
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === 1) {
          const budgetInputs = node.querySelectorAll ? node.querySelectorAll('.budget-input:not([data-formatted])') : [];
          budgetInputs.forEach(input => { input.dataset.formatted = 'true'; applyFormatting(input); });
        }
      });
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Global helper — used by budget-save handler
  window.getInputRawValue = inputId => {
    const input = document.getElementById(inputId);
    return input ? (input.dataset.rawValue || getRawValue(input.value) || '0') : '0';
  };
}
