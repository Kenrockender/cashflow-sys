/* ══════════════════════════════════════════════════════════
   CASHFLOW.SYS — goals.js
   Savings goals management
   Depends on: state.js, helpers.js, store.js
══════════════════════════════════════════════════════════ */

function openGoalModal(id = null) {
  S.editingGoalId = id;
  document.getElementById('modal-goal-title').textContent = id ? t('modal.goal.edit') : t('modal.goal.add');
  if (id) {
    const g = S.goals.find(g => g.id === id); if (!g) return;
    document.getElementById('goal-name').value     = g.name || '';
    document.getElementById('goal-target').value   = g.target || '';
    document.getElementById('goal-saved').value    = g.saved || 0;
    document.getElementById('goal-deadline').value = g.deadline || '';
    document.getElementById('goal-note').value     = g.note || '';
    const acCb = document.getElementById('goal-autocontrib');
    if (acCb) { acCb.checked = !!g.autoContribute; document.getElementById('autocontrib-pct-row')?.classList.toggle('hidden', !g.autoContribute); }
    const acPct = document.getElementById('goal-autocontrib-pct');
    if (acPct) acPct.value = g.autoContributePercent || 10;
  } else {
    ['goal-name', 'goal-target', 'goal-deadline', 'goal-note'].forEach(i => document.getElementById(i).value = '');
    document.getElementById('goal-saved').value = '0';
    const acCb = document.getElementById('goal-autocontrib');
    if (acCb) { acCb.checked = false; document.getElementById('autocontrib-pct-row')?.classList.add('hidden'); }
    const acPct = document.getElementById('goal-autocontrib-pct'); if (acPct) acPct.value = 10;
  }
  document.getElementById('modal-goal').classList.remove('hidden');
  setTimeout(initAmountInputs, 0);
}

async function handleSaveGoal() {
  const name     = document.getElementById('goal-name').value.trim();
  const targetInput = document.getElementById('goal-target');
  const savedInput  = document.getElementById('goal-saved');
  const target   = parseInt(targetInput?.dataset.rawValue || (targetInput?.value || '').replace(/\D/g, '') || '0') || 0;
  const saved    = parseInt(savedInput?.dataset.rawValue  || (savedInput?.value  || '').replace(/\D/g, '') || '0') || 0;
  const deadline = document.getElementById('goal-deadline').value || '';
  const note     = document.getElementById('goal-note').value.trim();
  const autoContribute        = document.getElementById('goal-autocontrib')?.checked || false;
  const autoContributePercent = parseInt(document.getElementById('goal-autocontrib-pct')?.value) || 10;
  if (!name)       { toast(t('toast.err.goal.name')); return; }
  if (target <= 0) { toast(t('toast.err.goal.amt'));  return; }
  if (deadline && deadline < todayKey()) {
    if (!confirm(t('confirm.goal.past.deadline') || 'The deadline is in the past. Save anyway?')) return;
  }
  const g   = { name, target, saved, deadline, note, autoContribute, autoContributePercent };
  const btn = document.getElementById('btn-save-goal'); btn.disabled = true;
  if (S.editingGoalId) {
    const i = S.goals.findIndex(x => x.id === S.editingGoalId);
    if (i >= 0) S.goals[i] = { ...S.goals[i], ...g };
    Store.updateGoal(S.editingGoalId, g).catch(e => console.warn('Goal update error:', e.message));
    toast(t('toast.goal.updated'));
  } else {
    const ref = db.collection('users').doc(S.user.uid).collection('goals').doc();
    S.goals.push({ id: ref.id, ...g });
    ref.set({ ...g, createdAt: firebase.firestore.FieldValue.serverTimestamp() }).catch(e => console.warn('Goal save error:', e.message));
    toast(t('toast.goal.added'));
  }
  document.getElementById('modal-goal').classList.add('hidden');
  renderGoalsTab();
  btn.disabled = false;
}

async function handleDelGoal(id) {
  const g = S.goals.find(x => x.id === id); if (!g) return;
  S.goals = S.goals.filter(x => x.id !== id);
  renderGoalsTab(); render();
  Store.delGoal(id).catch(e => console.warn('Del goal error:', e.message));
  showToast(t('toast.goal.deleted'), {
    undo: async () => {
      S.goals.push(g);
      renderGoalsTab(); render();
      const { id: _gid, ...data } = g;
      await db.collection('users').doc(S.user.uid).collection('goals').doc(id)
        .set({ ...data, createdAt: g.createdAt || firebase.firestore.FieldValue.serverTimestamp() });
    }
  });
}

/* ─── ESM window bridge (auto-generated) ─── */
Object.assign(window, { openGoalModal, handleSaveGoal, handleDelGoal });
