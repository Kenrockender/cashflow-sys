/* ══════════════════════════════════════════════════════════
   CASHFLOW.SYS — contributions.js
   Goal contributions and auto-contribute
   Depends on: state.js, helpers.js, store.js
══════════════════════════════════════════════════════════ */

function openContributeModal(goalId) {
  _contributingGoalId = goalId;
  const g = S.goals.find(x => x.id === goalId);
  document.getElementById('modal-contrib-title').textContent = t('goals.contribute.title', { name: g?.name || 'Goal' });
  document.getElementById('contrib-amount').value = '';
  document.getElementById('contrib-note').value   = '';
  document.getElementById('modal-contribute').classList.remove('hidden');
}

async function handleContribute() {
  const contribInput = document.getElementById('contrib-amount');
  const amount = parseInt(contribInput?.dataset.rawValue || (contribInput?.value || '').replace(/\D/g, '') || '0') || 0;
  const note   = document.getElementById('contrib-note').value.trim();
  if (amount <= 0) { toast(t('toast.err.contrib')); return; }
  const g = S.goals.find(x => x.id === _contributingGoalId); if (!g) return;
  const newSaved = (g.saved || 0) + amount;
  const i = S.goals.findIndex(x => x.id === _contributingGoalId);
  if (i >= 0) S.goals[i].saved = newSaved;
  Store.updateGoal(_contributingGoalId, { saved: newSaved }).catch(e => console.warn('Contribute save error:', e.message));
  const txRef = db.collection('users').doc(S.user.uid).collection('transactions').doc();
  const tx = { amount, description: t('goal.contrib.tx.desc', { name: g.name }), date: todayKey(), category: 'other', type: 'expense', note: note || t('goal.contrib.tx.note', { name: g.name }), recurring: false };
  S.transactions.unshift({ id: txRef.id, ...tx });
  txRef.set({ ...tx, createdAt: firebase.firestore.FieldValue.serverTimestamp() }).catch(e => console.warn('Tx save error:', e.message));
  toast(t('toast.contrib.added', { amount: fmtCurrency(amount), name: g.name }));
  document.getElementById('modal-contribute').classList.add('hidden');
  checkGoalMilestones(g.id);
  Charts.invalidate(); renderGoalsTab(); render();
}

function processAutoContribute(incomeAmount) {
  S.goals.forEach(goal => {
    if (!goal.autoContribute || goal.autoContributePercent <= 0) return;
    if ((goal.saved || 0) >= goal.target) return;
    const contribution = Math.round(incomeAmount * (goal.autoContributePercent / 100));
    if (contribution <= 0) return;
    const newSaved = Math.min((goal.saved || 0) + contribution, goal.target);
    const i = S.goals.findIndex(g => g.id === goal.id);
    if (i >= 0) S.goals[i].saved = newSaved;
    Store.updateGoal(goal.id, { saved: newSaved }).catch(e => console.warn('Auto-contribute error:', e.message));
    toast(t('toast.auto.contrib', { amount: fmtCurrency(contribution), name: goal.name }));
    checkGoalMilestones(goal.id);
  });
}

function toggleAutoContribute(goalId) {
  const goal = S.goals.find(g => g.id === goalId); if (!goal) return;
  goal.autoContribute = !goal.autoContribute;
  goal.autoContributePercent = goal.autoContributePercent || 10;
  const i = S.goals.findIndex(g => g.id === goalId);
  if (i >= 0) S.goals[i] = goal;
  Store.updateGoal(goalId, { autoContribute: goal.autoContribute, autoContributePercent: goal.autoContributePercent }).catch(e => console.warn('Toggle auto-contrib error:', e.message));
  renderGoalsTab();
}

function updateAutoContributePercent(goalId, percent) {
  const goal = S.goals.find(g => g.id === goalId); if (!goal) return;
  goal.autoContributePercent = Math.max(1, Math.min(100, parseInt(percent) || 10));
  const i = S.goals.findIndex(g => g.id === goalId);
  if (i >= 0) S.goals[i] = goal;
  Store.updateGoal(goalId, { autoContributePercent: goal.autoContributePercent }).catch(e => console.warn('Update auto-contrib % error:', e.message));
}
