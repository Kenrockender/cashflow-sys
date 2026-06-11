/* ══════════════════════════════════════════════════════════
   CASHFLOW.SYS — goals-render.js
   DOM rendering, templates, modal helpers, tab routing.
   Load order: THIRD (after state.js + helpers.js)
   Depends on: state.js, helpers.js, constants.js, i18n.js, charts.js
══════════════════════════════════════════════════════════ */

/* ── GOALS TAB ───────────────────────────────────────────── */
function renderGoalsTab() {
  const el = document.getElementById('tab-goals');
  if (!el) return;
  const list = el.querySelector('.goals-list');
  if (!list) return;
  if (!S.goals.length) {
    list.innerHTML = emptyStateHTML({
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>',
      title: t('goals.empty.title'), sub: t('goals.empty.sub'),
      ctaLabel: t('goals.empty.cta'), ctaOnclick: 'openGoalModal()' });
    return;
  }
  list.innerHTML = S.goals.map(g => renderGoalCard(g)).join('');
}

function renderGoalCard(g) {
  const pct  = g.target > 0 ? Math.min(100, (g.saved || 0) / g.target * 100) : 0;
  const done = pct >= 100;
  const remaining = Math.max(0, g.target - (g.saved || 0));
  const proj = renderGoalProjection(g);
  const autoContribHtml = g.autoContribute
    ? `<div class="goal-autocontrib-info">${icon('lightning', '', 12)} ${t('goal.autocontrib.active', { pct: g.autoContributePercent || 10 })}</div>`
    : '';
  return `<div class="goal-card${done ? ' goal-done' : ''}">
    <div class="goal-header">
      <span class="goal-name">${san(g.name)}</span>
      <div class="goal-actions">
        <button class="tx-act-btn" onclick="openContributeModal('${g.id}')">${t('goals.btn.add')}</button>
        <button class="tx-act-btn" onclick="openGoalModal('${g.id}')">${t('goals.btn.edit')}</button>
        <button class="tx-act-btn del" onclick="handleDelGoal('${g.id}')">${t('goals.btn.del')}</button>
      </div>
    </div>
    <div class="goal-amounts">
      <span class="goal-saved">${fmtCurrency(g.saved || 0)}</span>
      <span class="goal-divider">${t('goals.from')}</span>
      <span class="goal-target-val">${fmtCurrency(g.target)}</span>
      ${done ? `<span class="goal-done-badge">${t('goals.done.badge')}</span>` : ''}
    </div>
    <div class="goal-bar-track"><div class="goal-bar-fill" style="width:${pct.toFixed(1)}%"></div></div>
    <div class="goal-bar-labels">
      <span style="font-family:var(--mono);font-size:.52rem;color:var(--gold)">${pct.toFixed(1)}%</span>
      ${!done ? `<span style="font-family:var(--mono);font-size:.52rem;color:var(--text3)">${t('goals.left')} ${fmtCurrency(remaining)}</span>` : ''}
    </div>
    ${proj}${autoContribHtml}
  </div>`;
}

function renderGoalProjection(goal) {
  if (!goal || goal.saved >= goal.target) return '';
  const ninetyDaysAgo = new Date(); ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const cutoff = ninetyDaysAgo.toISOString().split('T')[0];
  const contributions = S.transactions.filter(tx => tx.date >= cutoff && tx.description?.includes(goal.name) && tx.category === 'other');
  if (contributions.length < 2) return '';
  const totalContrib = contributions.reduce((s, tx) => s + tx.amount, 0);
  const daysCovered = Math.max(1, (new Date() - ninetyDaysAgo) / 86400000);
  const dailyRate = totalContrib / daysCovered;
  if (dailyRate <= 0) return '';
  const remaining = goal.target - (goal.saved || 0);
  const monthsToGoal = Math.round(Math.ceil(remaining / dailyRate) / 30);
  return `<div class="goal-projection">${t('goal.projection.text', { months: monthsToGoal })}<span class="projection-rate">(${fmtCurrency(dailyRate * 30)}/${t('goal.per.month')})</span></div>`;
}

function showMilestone(goal, milestone) {
  const modal = document.getElementById('modal-milestone');
  if (!modal) return;
  const milestoneSvg = milestone === 100
    ? '<svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>'
    : milestone >= 75
    ? '<svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>'
    : milestone >= 50
    ? '<svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'
    : '<svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/></svg>';
  document.getElementById('milestone-emoji').innerHTML = milestoneSvg;
  document.getElementById('milestone-percent').textContent = `${milestone}%`;
  document.getElementById('milestone-message').textContent = t(milestone === 100 ? 'milestone.100' : `milestone.${milestone}`, { name: goal.name });
  document.getElementById('milestone-goal-name').textContent = goal.name;
  modal.classList.remove('hidden');
  setTimeout(() => modal.classList.add('hidden'), 5000);
}

function closeMilestone() {
  document.getElementById('modal-milestone')?.classList.add('hidden');
}

