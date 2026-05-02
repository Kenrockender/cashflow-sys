/* ══════════════════════════════════════════════════════════
   CASHFLOW.SYS — dashboard-render.js
   DOM rendering, templates, modal helpers, tab routing.
   Load order: THIRD (after state.js + helpers.js)
   Depends on: state.js, helpers.js, constants.js, i18n.js, charts.js
══════════════════════════════════════════════════════════ */

/* ── FAVORITES BAR ───────────────────────────────────────── */
function toggleFavorite(id) {
  if (_favorites.has(id)) _favorites.delete(id);
  else _favorites.add(id);
  localStorage.setItem('cf-favorites', JSON.stringify([..._favorites]));
  render();
}

function renderFavoritesBar() {
  const el = document.getElementById('favorites-bar');
  if (!el) return;
  const favTxs = getTxView().filter(tx => _favorites.has(tx.id));
  if (!favTxs.length) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  el.innerHTML = `
    <div class="fav-bar-hdr">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      <span>Pinned — tap to quick-add</span>
    </div>
    <div class="fav-bar-chips">
      ${favTxs.map(tx => {
        const cat = tx.type === 'income' ? { id:'income', color:'var(--ok)' } : getCat(tx.category);
        return `<button class="fav-chip" onclick="quickDuplicateTx('${tx.id}')" title="${san(tx.description)}">
          ${catSVG(cat.id, 10, cat.color)}
          <span class="fav-chip-label">${san(tx.description.slice(0, 18))}${tx.description.length > 18 ? '…' : ''}</span>
          <span class="fav-chip-amt">${fmtCurrency(tx.amount)}</span>
          <button class="fav-chip-unpin" onclick="event.stopPropagation();toggleFavorite('${tx.id}')" title="Unpin">${icon('close', '', 12)}</button>
        </button>`;
      }).join('')}
    </div>`;
}

/* ── DASHBOARD ───────────────────────────────────────────── */
function renderDashboard() {
  const el = document.getElementById('tab-dashboard');
  if (el && el.querySelector('.onboarding-wrap')) el.innerHTML = window._dashboardHTML || '';

  const TV = getTxView();
  const tmon = thisMonth(), lmon = prevMonth(tmon);
  const mExp = TV.filter(tx => tx.date?.startsWith(tmon) && isExpenseTx(tx));
  const mInc = TV.filter(tx => tx.date?.startsWith(tmon) && isIncomeTx(tx));
  const lExp = TV.filter(tx => tx.date?.startsWith(lmon) && isExpenseTx(tx));
  const mT = sum(mExp), mI = sum(mInc), lT = sum(lExp);
  const mNet = mI - mT;
  const totB = Object.values(S.budgets).reduce((a, b) => a + b, 0);

  document.getElementById('month-amount').textContent = fmtCurrency(mT);
  const diff  = lT > 0 ? ((mT - lT) / lT * 100).toFixed(0) : 0;
  const vsEl  = document.getElementById('month-vs-last');
  vsEl.textContent  = +diff > 0 ? t('dash.up', {n: diff}) : +diff < 0 ? t('dash.down', {n: Math.abs(diff)}) : t('dash.same');
  vsEl.className    = 'card-sub' + (+diff > 10 ? ' negative' : +diff < 0 ? ' positive' : '');

  document.getElementById('income-amount').textContent  = fmtCurrency(mI);
  document.getElementById('income-count').textContent   = `${mInc.length} ${t('dash.tx.count')}`;

  const netEl = document.getElementById('net-balance');
  netEl.textContent = (mNet >= 0 ? '+' : '') + fmtCurrency(Math.abs(mNet));
  netEl.className   = 'card-val ' + (mNet >= 0 ? 'net-positive' : 'net-negative');
  const netLbl = document.getElementById('net-label');
  netLbl.textContent = mNet >= 0 ? t('dash.net.surplus') : t('dash.net.deficit');
  netLbl.className   = 'card-sub ' + (mNet >= 0 ? 'positive' : 'negative');

  const effectiveBudget = totB + (S.rolloverEnabled ? (S.rolloverAmount || 0) : 0);
  document.getElementById('budget-remaining').textContent = fmtCurrency(Math.max(0, effectiveBudget - mT));
  const pct  = effectiveBudget > 0 ? Math.min(100, mT / effectiveBudget * 100) : 0;
  const fill = document.getElementById('budget-progress-fill');
  fill.style.width      = pct + '%';
  fill.style.background = pct > 90 ? 'var(--danger)' : pct > 70 ? '#c4a032' : 'var(--ok)';

  renderForecastStrip();
  renderRecurringPanel();
  renderSmartInsights();
  renderFavoritesBar();
  renderCatList();
  Charts.renderDaily(TV);
  renderDashGoalsPreview();

  const recentEl = document.getElementById('recent-list');
  if (recentEl) recentEl.innerHTML = renderTxItems(TV.slice(0, 10), false);

  const pctN = effectiveBudget > 0 ? (mT / effectiveBudget) * 100 : 0;
  if (typeof window.maybeBudgetNotification === 'function') {
    requestAnimationFrame(() => window.maybeBudgetNotification(pctN, mT, effectiveBudget));
  }
}

/* ── FORECAST STRIP ──────────────────────────────────────── */
function renderForecastStrip() {
  const strip = document.getElementById('forecast-strip');
  if (!strip) return;
  const tmon = thisMonth();
  const mExp = getTxView().filter(tx => tx.date?.startsWith(tmon) && isExpenseTx(tx));
  const spent = sum(mExp);
  const today = new Date(), daysElapsed = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysLeft    = daysInMonth - daysElapsed;
  if (daysElapsed < 3) { strip.classList.add('hidden'); return; }
  const dailyAvg = spent / daysElapsed;
  const projected = Math.round(dailyAvg * daysInMonth);
  const totB      = Object.values(S.budgets).reduce((a, b) => a + b, 0);
  const overBudget = totB > 0 && projected > totB;
  const pct  = totB > 0 ? (projected / totB * 100).toFixed(0) : 0;
  const diff = totB > 0 ? Math.abs(projected - totB) : 0;
  let statusText = '', statusClass = '';
  if (!totB)        { statusText = t('forecast.neutral', { projected: `<strong>${fmtCurrency(projected)}</strong>`, daily: fmtCurrency(Math.round(dailyAvg)) }); statusClass = 'neutral'; }
  else if (overBudget) { statusText = t('forecast.over',   { projected: `<strong>${fmtCurrency(projected)}</strong>`, diff: fmtCurrency(diff), pct }); statusClass = 'over'; }
  else                 { statusText = t('forecast.ok',     { projected: `<strong>${fmtCurrency(projected)}</strong>`, diff: fmtCurrency(diff), pct }); statusClass = 'ok'; }
  strip.className = `forecast-strip ${statusClass}`;
  strip.classList.remove('hidden');
  strip.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg><span>${statusText}</span><span class="forecast-days">${t('forecast.days.left', { n: daysLeft })}</span>`;
}

/* ── RECURRING PANEL ─────────────────────────────────────── */
function renderRecurringPanel() {
  const panel = document.getElementById('recurring-panel');
  if (!panel) return;
  const tmon  = thisMonth();
  const TV = getTxView();
  const recurring = TV.filter(t => t.recurring && t.date?.startsWith(tmon));
  if (!recurring.length) { panel.classList.add('hidden'); return; }

  const nextMonth = (() => { const [y, m] = tmon.split('-').map(Number); const d = new Date(y, m, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; })();
  const nextMonthLabel = new Date(+nextMonth.split('-')[0], +nextMonth.split('-')[1] - 1)
    .toLocaleDateString(getLang() === 'id' ? 'id-ID' : 'en-US', { month: 'long' });
  const skipSet = getRecurringSkipSet();

  panel.classList.remove('hidden');
  panel.innerHTML = `
    <div class="recurring-hdr">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
      <span>${t('recurring.title')} — ${t('recurring.next')} ${nextMonthLabel}</span>
      <span class="recurring-total">${fmtCurrency(sum(recurring))}/mo</span>
    </div>
    <div class="recurring-rows">
      ${recurring.map(tx => {
        const cat = getCat(tx.category);
        const rid = tx.recurringId || `rec_${tx.id}`;
        const skipped = skipSet.has(`${rid}|${nextMonth}`);
        return `<div class="recurring-row">
          <div class="recurring-icon" style="color:${cat.color}">${catSVG(cat.id, 12, cat.color)}</div>
          <span class="recurring-desc">${san(tx.description)}</span>
          <span class="recurring-amt">${fmtCurrency(tx.amount)}</span>
          ${skipped ? `<span class="recurring-skip-badge">${t('recurring.skipped.badge')}</span>` : `<button type="button" class="btn-recurring-skip" onclick="skipRecurringNextMonth('${tx.id}')">${t('recurring.skip.btn')}</button>`}
        </div>`;
      }).join('')}
    </div>`;
}

/* ── SMART INSIGHTS ──────────────────────────────────────── */
function getSmartInsights() {
  const insights = [];
  const tmon = thisMonth();
  const today = new Date();
  const TV = getTxView();

  const months = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const mExp = TV.filter(tx => tx.date?.startsWith(tmon) && isExpenseTx(tx));
  const curTotals = {};
  for (const tx of mExp) curTotals[tx.category] = (curTotals[tx.category] || 0) + (tx.amount || 0);

  const catAvgs = {};
  for (const cat of getAllCategories()) {
    const totals = months.map(ym =>
      TV.filter(tx => tx.date?.startsWith(ym) && isExpenseTx(tx) && tx.category === cat.id)
        .reduce((s, tx) => s + (tx.amount || 0), 0)
    );
    const nonZero = totals.filter(t => t > 0);
    catAvgs[cat.id] = nonZero.length > 0 ? nonZero.reduce((a, b) => a + b, 0) / nonZero.length : 0;
  }

  // 1. Anomaly detection
  for (const cat of getAllCategories()) {
    const cur = curTotals[cat.id] || 0;
    const avg = catAvgs[cat.id];
    if (avg > 0 && cur > avg * 2) {
      insights.push({ type: 'anomaly', icon: icon('warning', '', 18), title: t('insight.anomaly.title', { cat: getCat(cat.id).label }), desc: t('insight.anomaly.desc', { cur: fmtCurrency(cur), avg: fmtCurrency(Math.round(avg)), pct: Math.round((cur / avg - 1) * 100) }), priority: 1 });
    }
  }

  // 2. Budget suggestions
  for (const cat of getAllCategories()) {
    const avg = catAvgs[cat.id];
    const curBudget = S.budgets[cat.id] || 0;
    if (avg > 100000 && (!curBudget || Math.abs(curBudget - avg) / avg > 0.3)) {
      const suggested = Math.round(avg * 1.1 / 10000) * 10000;
      insights.push({ type: 'budget-suggest', icon: icon('lightbulb', '', 18), title: t('insight.budget.title', { cat: getCat(cat.id).label }), desc: t('insight.budget.desc', { amount: fmtCurrency(suggested), avg: fmtCurrency(Math.round(avg)) }), action: { type: 'set-budget', cat: cat.id, amount: suggested }, priority: 3 });
    }
  }

  // 3. Recurring detection
  const descGroups = {};
  const last90Days = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const recent = TV.filter(tx => tx.date >= last90Days && isExpenseTx(tx) && !tx.recurring);
  for (const tx of recent) {
    const key = tx.description?.toLowerCase().trim().slice(0, 30) || '';
    if (key.length < 3) continue;
    if (!descGroups[key]) descGroups[key] = [];
    descGroups[key].push(tx);
  }
  for (const [, txs] of Object.entries(descGroups)) {
    if (txs.length >= 2) {
      const amounts  = txs.map(tx => tx.amount);
      const avgAmt   = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const similar  = amounts.every(a => Math.abs(a - avgAmt) / avgAmt < 0.2);
      const dates    = txs.map(tx => new Date(tx.date + 'T00:00:00')).sort((a, b) => a - b);
      let monthlyPattern = true;
      for (let i = 1; i < dates.length && monthlyPattern; i++) {
        const daysDiff = (dates[i] - dates[i-1]) / (24 * 60 * 60 * 1000);
        if (daysDiff < 20 || daysDiff > 40) monthlyPattern = false;
      }
      if (similar && monthlyPattern) {
        insights.push({ type: 'recurring-detect', icon: icon('refresh', '', 18), title: t('insight.recurring.title'), desc: t('insight.recurring.desc', { desc: txs[0].description?.slice(0, 25) || 'Transaction', amount: fmtCurrency(Math.round(avgAmt)), count: txs.length }), priority: 2 });
      }
    }
  }

  // 4. Spending trend
  const lmon = prevMonth(tmon);
  const lastMonthExp = S.transactions.filter(tx => tx.date?.startsWith(lmon) && isExpenseTx(tx));
  const lastTotal = sum(lastMonthExp), curTotal = sum(mExp);
  const dayOfMonth = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const projectedTotal = dayOfMonth > 0 ? Math.round(curTotal / dayOfMonth * daysInMonth) : curTotal;
  if (lastTotal > 0 && projectedTotal > lastTotal * 1.2) {
    insights.push({ type: 'trend', icon: icon('trendUp', '', 18), title: t('insight.trend.over.title'), desc: t('insight.trend.over.desc', { projected: fmtCurrency(projectedTotal), last: fmtCurrency(lastTotal) }), priority: 1 });
  } else if (lastTotal > 0 && projectedTotal < lastTotal * 0.8) {
    insights.push({ type: 'trend-good', icon: icon('trendDown', '', 18), title: t('insight.trend.under.title'), desc: t('insight.trend.under.desc', { projected: fmtCurrency(projectedTotal), last: fmtCurrency(lastTotal) }), priority: 4 });
  }

  // 5. Savings potential
  const discretionary = ['entertainment', 'shopping', 'social', 'subscription'];
  let discretionaryTotal = 0;
  for (const catId of discretionary) discretionaryTotal += curTotals[catId] || 0;
  const totalExpense = sum(mExp);
  if (totalExpense > 0 && discretionaryTotal / totalExpense > 0.35) {
    insights.push({ type: 'savings', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M9 10h6M9 14h4"/></svg>', title: t('insight.savings.title'), desc: t('insight.savings.desc', { amount: fmtCurrency(discretionaryTotal), pct: Math.round(discretionaryTotal / totalExpense * 100) }), priority: 3 });
  }

  insights.sort((a, b) => a.priority - b.priority);
  return insights.slice(0, 5);
}

function renderSmartInsights() {
  const panel = document.getElementById('smart-insights-panel');
  if (!panel) return;
  if (S.transactions.length < 5) { panel.classList.add('hidden'); return; }
  const insights = getSmartInsights();
  if (!insights.length) { panel.classList.add('hidden'); return; }
  panel.classList.remove('hidden');
  panel.innerHTML = `
    <div class="smart-insights-hdr">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      <span>${t('insight.panel.title')}</span>
      <button class="insight-dismiss" onclick="document.getElementById('smart-insights-panel').classList.add('hidden')">${icon('close', '', 14)}</button>
    </div>
    <div class="smart-insights-list">
      ${insights.map(ins => `
        <div class="smart-insight-item ${ins.type}">
          <span class="insight-icon">${ins.icon}</span>
          <div class="insight-content">
            <div class="insight-title">${san(ins.title)}</div>
            <div class="insight-desc">${san(ins.desc)}</div>
          </div>
          ${ins.action ? `<button class="insight-action-btn" onclick="applyInsightAction('${ins.action.type}', '${ins.action.cat || ''}', ${ins.action.amount || 0})">${t('insight.apply')}</button>` : ''}
        </div>`).join('')}
    </div>`;
}

function applyInsightAction(type, cat, amount) {
  if (type === 'set-budget' && cat && amount > 0) {
    S.budgets[cat] = amount;
    Store.saveBudgets(S.budgets).catch(e => console.warn('Budget save error:', e.message));
    toast(t('toast.budget.updated', { cat: getCat(cat).label, amount: fmtCurrency(amount) }));
    render();
  }
}

/* ── CATEGORY LIST ───────────────────────────────────────── */
function renderCatList() {
  const tmon = thisMonth(), wStart = weekStart();
  const fil = getTxView().filter(tx => isExpenseTx(tx) && (S.activePeriod === 'month' ? tx.date?.startsWith(tmon) : tx.date >= wStart));
  const totals = {}; for (const t of fil) totals[t.category] = (totals[t.category] || 0) + (t.amount || 0);
  const totSpent = Object.values(totals).reduce((a, b) => a + b, 0);
  const sorted   = getAllCategories().filter(c => totals[c.id] > 0).sort((a, b) => (totals[b.id] || 0) - (totals[a.id] || 0));
  const el = document.getElementById('category-list');
  if (!sorted.length) { el.innerHTML = `<div class="empty">${t('empty.transactions')}</div>`; return; }
  el.innerHTML = sorted.map(cat => {
    const spent     = totals[cat.id] || 0;
    const budget    = S.activePeriod === 'month' ? (S.budgets[cat.id] || 0) : 0;
    const pct       = totSpent > 0 ? (spent / totSpent * 100).toFixed(0) : 0;
    const budgetPct = budget > 0 ? spent / budget * 100 : 0;
    const over = budget > 0 && spent > budget, warn = budget > 0 && budgetPct >= 80 && !over;
    const statusClass = over ? 'over' : warn ? 'warn' : '';
    const statusIcon  = over ? icon('warning', '', 12) + ' '  : warn ? icon('bolt', '', 12) + ' '  : '';
    return `<div class="cat-item" onclick="filterByCat('${cat.id}')">
      <div class="cat-icon-wrap" style="color:${cat.color}">${catSVG(cat.id, 14, cat.color)}</div>
      <div class="cat-info"><div class="cat-name">${getCat(cat.id).label}</div>${budget > 0 ? `<div class="cat-budget-info ${statusClass}">${statusIcon}${fmtCurrency(spent)} / ${fmtCurrency(budget)}</div>` : ''}</div>
      <div class="cat-right"><div class="cat-val">${fmtCurrency(spent)}</div><span class="cat-pct">${pct}%</span></div>
      <div class="cat-bar-row"><div class="cat-bar-fill" style="width:${pct}%;background:${cat.color}"></div></div>
    </div>`;
  }).join('');
}

/* ── DASHBOARD GOALS PREVIEW ─────────────────────────────── */
function renderDashGoalsPreview() {
  const el = document.getElementById('dash-goals-preview');
  if (!el) return;
  if (!S.goals || !S.goals.length) {
    el.innerHTML = `<div class="empty" style="padding:1.5rem">${t('goals.empty')}</div>`;
    return;
  }
  el.innerHTML = S.goals.slice(0, 4).map(g => {
    const pct = g.target > 0 ? Math.min(100, (g.saved || 0) / g.target * 100) : 0;
    return `<div class="dash-goal-mini">
      <div class="dash-goal-mini-name">${san(g.name)}</div>
      <div class="dash-goal-mini-bar"><div class="dash-goal-mini-fill" style="width:${pct.toFixed(1)}%"></div></div>
      <div class="dash-goal-mini-meta">
        <span class="dash-goal-mini-pct">${pct.toFixed(0)}%</span>
        <span>${fmtCurrency(g.saved || 0)} / ${fmtCurrency(g.target)}</span>
      </div>
    </div>`;
  }).join('');
}

/* ── ONBOARDING ──────────────────────────────────────────── */
function renderOnboarding() {
  const el = document.getElementById('tab-dashboard');
  if (!el) return;
  el.innerHTML = `
    <div class="onboarding-wrap"><div class="onboarding-box">
      <div class="onboarding-logo">Cash<span>flow</span></div>
      <div class="onboarding-tagline">${t('ob.inline.tagline')}</div>
      <div class="onboarding-divider"></div>
      <div class="onboarding-steps">
        <div class="ob-step"><div class="ob-step-num">01</div><div class="ob-step-body"><div class="ob-step-title">${t('ob.inline.01.title')}</div><div class="ob-step-desc">${t('ob.inline.01.desc')}</div><button class="btn-ob-action" onclick="document.getElementById('quickadd-input').focus()">${t('ob.inline.01.cta')}</button></div></div>
        <div class="ob-step"><div class="ob-step-num">02</div><div class="ob-step-body"><div class="ob-step-title">${t('ob.inline.02.title')}</div><div class="ob-step-desc">${t('ob.inline.02.desc')}</div><button class="btn-ob-action" onclick="switchTab('budget')">${t('ob.inline.02.cta')}</button></div></div>
        <div class="ob-step"><div class="ob-step-num">03</div><div class="ob-step-body"><div class="ob-step-title">${t('ob.inline.03.title')}</div><div class="ob-step-desc">${t('ob.inline.03.desc')}</div><button class="btn-ob-action" onclick="openModal('modal-import')">${t('ob.inline.03.cta')}</button></div></div>
        <div class="ob-step"><div class="ob-step-num">04</div><div class="ob-step-body"><div class="ob-step-title">${t('ob.inline.04.title')}</div><div class="ob-step-desc">${t('ob.inline.04.desc')}</div><button class="btn-ob-action secondary" onclick="loadDemoData()">${t('ob.inline.04.cta')}</button></div></div>
      </div>
    </div></div>`;
}

