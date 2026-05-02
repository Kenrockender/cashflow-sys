/* ══════════════════════════════════════════════════════════
   CASHFLOW.SYS — events.js
   All DOM event listeners and global window events.
   Load order: SIXTH (after auth.js)
   Depends on: ALL other modules
══════════════════════════════════════════════════════════ */

/* ── AUTH BUTTONS ────────────────────────────────────────── */
(function () {
  const loginBtn = document.getElementById('btn-google-login');
  if (loginBtn) {
    loginBtn.onclick = function () {
      const btn = this, label = btn.querySelector('span');
      btn.disabled = true;
      if (label) label.textContent = 'Connecting...';
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      auth.signInWithPopup(provider)
        .catch(err => {
          console.error('[AUTH] Sign-in error:', err);
          let msg = 'Login failed: ' + err.message;
          if (err.code === 'auth/popup-closed-by-user') msg = 'Popup closed. Try again.';
          if (err.code === 'auth/popup-blocked') msg = 'Popup blocked. Allow popups and retry.';
          if (err.code === 'auth/unauthorized-domain') msg = 'Domain not authorized in Firebase Console.';
          alert(msg);
        })
        .finally(() => { btn.disabled = false; if (label) label.textContent = t('auth.login.btn'); });
    };
  }
})();

const _logoutBtn = document.getElementById('btn-logout');
if (_logoutBtn) _logoutBtn.onclick = () => { if (confirm(t('confirm.logout'))) auth.signOut(); };

/* ── TAB NAVIGATION ──────────────────────────────────────── */
document.querySelectorAll('.tab').forEach(b => b.onclick = () => switchTab(b.dataset.tab));
document.querySelectorAll('.bnav-btn').forEach(b => b.onclick = () => switchTab(b.dataset.tab));
document.getElementById('see-all-link').onclick = () => switchTab('transactions');

document.querySelectorAll('.period-btn').forEach(btn => btn.onclick = () => {
  document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active'); S.activePeriod = btn.dataset.period; renderCatList();
});

/* ── THEME / MOOD ────────────────────────────────────────── */
document.querySelectorAll('.mood-pill:not(.lang-pill)').forEach(p => p.onclick = () => applyMood(p.dataset.mood));


// MutationObserver to always bind theme buttons, even if dynamically rendered
function bindMoodPills() {
  document.querySelectorAll('.mood-pill:not(.lang-pill)').forEach(p => {
    if (!p._moodBound) {
      p.onclick = () => applyMood(p.dataset.mood);
      p._moodBound = true;
    }
  });
}
bindMoodPills();
const moodObserver = new MutationObserver(bindMoodPills);
moodObserver.observe(document.body, { childList: true, subtree: true });

/* ── MODALS ──────────────────────────────────────────────── */
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => closeModal(b.dataset.close));
document.querySelectorAll('.modal').forEach(m => m.onclick = e => { if (e.target === m) closeModal(m.id); });

/* ── TRANSACTION FORM ────────────────────────────────────── */
document.getElementById('btn-save-tx').onclick = handleSaveTx;

document.getElementById('form-recurring')?.addEventListener('change', function () {
  this.closest('.recurring-toggle')?.classList.toggle('active', this.checked);
  document.getElementById('recurring-frequency-wrap')?.classList.toggle('hidden', !this.checked);
});
document.getElementById('form-recurring-frequency')?.addEventListener('change', function () {
  const daySelect = document.getElementById('form-recurring-day');
  if (daySelect) daySelect.classList.toggle('hidden', this.value !== 'custom');
});
document.getElementById('goal-autocontrib')?.addEventListener('change', function () {
  document.getElementById('autocontrib-pct-row')?.classList.toggle('hidden', !this.checked);
});

/* ── QUICK ADD ───────────────────────────────────────────── */
const qInput = document.getElementById('quickadd-input');
if (qInput) {
  qInput.addEventListener('input', deb(() => {
    const v = qInput.value.trim();
    const prev = document.getElementById('ai-preview');
    if (v.length < 3) { prev.classList.add('hidden'); return; }
    const p = Parser.parseLocal(v); if (!p.amount) { prev.classList.add('hidden'); return; }
    const isInc = p.type === 'income';
    const cat = isInc ? { id: 'income', label: t('cat.income'), color: 'var(--ok)' } : getCat(p.category);
    prev.innerHTML = `<span class="ai-badge">AI</span><span class="ai-type-badge ${p.type}">${isInc ? t('tx.income.tag') : getCat(p.category).label}</span><span style="display:flex;align-items:center;gap:.4rem">${catSVG(cat.id, 12, cat.color)} ${san(p.description)}</span><span class="ai-amount" style="color:${isInc ? 'var(--ok)' : 'var(--gold)'}">${fmtFull(p.amount)}</span>`;
    prev.classList.remove('hidden');
  }, 80));
  qInput.addEventListener('keydown', e => { if (e.key === 'Enter') doQuickAdd(); });
}
document.getElementById('btn-add')?.addEventListener('click', doQuickAdd);

function doQuickAdd() {
  const qInput = document.getElementById('quickadd-input'); if (!qInput) return;
  const text = qInput.value.trim(); if (!text) return;
  const p = Parser.parseLocal(text);
  document.getElementById('form-amount').value = p.amount ? p.amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
  document.getElementById('form-desc').value = p.description || text;
  document.getElementById('form-date').value = p.date || todayKey();
  document.getElementById('form-note').value = '';
  S.editingId = null;
  openModal('modal-add');
  setTimeout(() => { setTxType(p.type || 'expense'); if (p.type !== 'income') selCat(p.category || 'other'); }, 0);
  qInput.value = '';
  const aiPreview = document.getElementById('ai-preview');
  aiPreview.classList.add('hidden'); aiPreview.innerHTML = '';
}

/* ── VOICE INPUT ─────────────────────────────────────────── */
const voiceBtn = document.getElementById('btn-voice');
if (voiceBtn) {
  if (!Parser.isSpeechSupported()) {
    voiceBtn.title = 'Voice input not available in this browser (use Chrome/Edge)';
    voiceBtn.style.opacity = '0.35'; voiceBtn.style.cursor = 'not-allowed';
    voiceBtn.onclick = () => toast(t('toast.voice.unavail'));
  } else {
    voiceBtn.onclick = () => {
      const qa = document.getElementById('quickadd-input');
      if (_voiceRec) { _voiceRec.stop(); _voiceRec = null; voiceBtn.classList.remove('recording'); return; }
      voiceBtn.classList.add('recording');
      _voiceRec = Parser.startVoice(
        (txt, isFinal) => { if (qa) qa.value = txt; if (isFinal) { voiceBtn.classList.remove('recording'); _voiceRec = null; } },
        () => { voiceBtn.classList.remove('recording'); _voiceRec = null; }
      );
      if (!_voiceRec) voiceBtn.classList.remove('recording');
    };
  }
}

/* ── TRANSACTION FILTERS ─────────────────────────────────── */
document.getElementById('tx-search').addEventListener('input', deb(() => { _txMonthLimit = 3; renderTxTab(); }, 100));
document.getElementById('tx-filter-cat').addEventListener('change', () => { _txMonthLimit = 3; renderTxTab(); });
document.getElementById('tx-filter-type').addEventListener('change', () => { _txMonthLimit = 3; renderTxTab(); });
document.getElementById('tx-date-from').addEventListener('change', () => { _txMonthLimit = 3; renderTxTab(); });
document.getElementById('tx-date-to').addEventListener('change', () => { _txMonthLimit = 3; renderTxTab(); });
document.getElementById('tx-amt-min')?.addEventListener('input', deb(() => { _txMonthLimit = 3; renderTxTab(); }, 300));
document.getElementById('tx-amt-max')?.addEventListener('input', deb(() => { _txMonthLimit = 3; renderTxTab(); }, 300));

/* ── BUDGET SAVE ─────────────────────────────────────────── */
document.getElementById('btn-save-budget').onclick = async () => {
  const inputs = document.querySelectorAll('.budget-input');
  const isPercent = S.budgetMode === 'percent';
  const incomeInput = document.getElementById('total-income-input');
  const income = parseInt((incomeInput?.dataset.rawValue || incomeInput?.value || '').replace(/\D/g, '')) || S.totalIncome;
  const b = {}, percents = {};
  if (isPercent) {
    inputs.forEach(i => { const pct = parseFloat(i.value) || 0; percents[i.dataset.cat] = pct; b[i.dataset.cat] = Math.round(income * pct / 100); });
    S.totalIncome = income; S.budgetPercents = percents;
    localStorage.setItem('cf-budget-percents', JSON.stringify(percents));
    localStorage.setItem('cf-total-income', income);
    await Store.saveBudgetsFull(b, percents, income);
  } else {
    inputs.forEach(i => b[i.dataset.cat] = parseInt(i.dataset.rawValue || (i.value || '').replace(/[.,]/g, '')) || 0);
    S.totalIncome = income;
    localStorage.setItem('cf-total-income', String(income));
    await Store.saveBudgetsFull(b, {}, income);
  }
  S.budgets = b; toast(t('toast.budget.saved')); render();
};

/* ── IMPORT ──────────────────────────────────────────────── */
document.getElementById('btn-import').onclick = () => openModal('modal-import');
const drop = document.getElementById('import-drop'), fi = document.getElementById('import-file');
drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', async e => { e.preventDefault(); drop.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) await handleImportFile(f); });
fi.addEventListener('change', async () => { if (fi.files[0]) await handleImportFile(fi.files[0]); });
document.getElementById('btn-confirm-import').onclick = handleConfirmImport;

/* ── ONLINE / OFFLINE / VISIBILITY ──────────────────────── */
window.addEventListener('online', () => { void syncQueuedTransactionsIfAny(); void checkCloudHealth(); });
window.addEventListener('offline', () => { void checkCloudHealth(); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { void syncQueuedTransactionsIfAny(); void checkCloudHealth(); }
});

/* ── PERIODIC SYNC ───────────────────────────────────────── */
setInterval(() => {
  if (auth.currentUser && document.visibilityState === 'visible') void syncQueuedTransactionsIfAny({ silent: true });
}, 90000);
