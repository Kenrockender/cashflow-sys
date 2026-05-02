/* ══════════════════════════════════════════════════════════
   CASHFLOW.SYS — budget-render.js
   DOM rendering, templates, modal helpers, tab routing.
   Load order: THIRD (after state.js + helpers.js)
   Depends on: state.js, helpers.js, constants.js, i18n.js, charts.js
══════════════════════════════════════════════════════════ */

/* ── BUDGET TAB ──────────────────────────────────────────── */
function renderBudgetTab() {
  const isPercent = S.budgetMode === 'percent';

  // Mode buttons
  document.getElementById('bm-amount')?.classList.toggle('active', !isPercent);
  document.getElementById('bm-percent')?.classList.toggle('active', isPercent);

  // Show income row and pct summary in BOTH modes
  document.getElementById('budget-income-row')?.classList.remove('hidden');
  document.getElementById('budget-pct-summary')?.classList.remove('hidden');

  // Sync income input (both modes need it)
  const incInputEl = document.getElementById('total-income-input');
  if (incInputEl) {
    const sepInc = (typeof getLang === 'function' && getLang() === 'id') ? '.' : ',';
    incInputEl.value = S.totalIncome.toString().replace(/\B(?=(\d{3})+(?!\d))/g, sepInc);
    incInputEl.dataset.rawValue = String(S.totalIncome);
  }

  // Rollover button label
  const rolloverBtn = document.getElementById('rollover-toggle');
  if (rolloverBtn) rolloverBtn.textContent = S.rolloverEnabled ? t('budget.rollover.disable') : t('budget.rollover.enable');

  // Current-month spending per category
  const tmon = thisMonth();
  const mExp = getTxView().filter(tx => tx.date?.startsWith(tmon) && isExpenseTx(tx));
  const catSpent = {};
  for (const tx of mExp) catSpent[tx.category] = (catSpent[tx.category] || 0) + (tx.amount || 0);

  const list = document.getElementById('budget-list');
  if (!list) { renderBudgetExtras(); return; }

  const sep = (typeof getLang === 'function' && getLang() === 'id') ? '.' : ',';

  list.innerHTML = getAllCategories().map(cat => {
    const budget = S.budgets[cat.id] || 0;
    const spent  = catSpent[cat.id]  || 0;
    const over   = budget > 0 && spent > budget;
    const warn   = budget > 0 && spent / budget >= 0.8 && !over;

    let inputVal = '', suffix = '', calcHtml = '', fmtAttr = '';

    if (isPercent) {
      const pct = S.budgetPercents[cat.id] || 0;
      inputVal  = pct > 0 ? String(pct) : '';
      suffix    = '%';
      fmtAttr   = 'data-formatted="true"'; // prevent currency MutationObserver
      const calcAmt = Math.round(S.totalIncome * pct / 100);
      calcHtml  = calcAmt > 0 ? `<span class="bud-calc">≈ ${fmtCurrency(calcAmt)}</span>` : '';
    } else {
      inputVal = budget > 0 ? budget.toString().replace(/\B(?=(\d{3})+(?!\d))/g, sep) : '';
      suffix   = 'Rp';
      // Show % of income for each category in amount mode
      const pctOfIncome = S.totalIncome > 0 && budget > 0 ? ((budget / S.totalIncome) * 100).toFixed(0) : 0;
      const spentBadge = over ? ' ' + icon('arrowUp', '', 10) : warn ? ' ' + icon('bolt', '', 10) : '';
      if (spent > 0) {
        calcHtml = `<span class="bud-calc" style="color:${over ? 'var(--danger)' : warn ? '#c4a032' : 'var(--text3)'}">${fmtCurrency(spent)}${spentBadge}</span>`;
      } else if (pctOfIncome > 0) {
        calcHtml = `<span class="bud-calc" style="color:var(--text3)">${pctOfIncome}%</span>`;
      }
    }

    return `<div class="budget-row">
      <div class="bud-cat-icon" style="color:${cat.color}">${catSVG(cat.id, 14, cat.color)}</div>
      <span class="bud-cat-name">${getCat(cat.id).label}</span>
      ${calcHtml}
      <span class="bud-suffix">${suffix}</span>
      <input
        class="form-input bud-input budget-input"
        type="text"
        inputmode="${isPercent ? 'decimal' : 'numeric'}"
        data-cat="${cat.id}"
        ${fmtAttr}
        value="${inputVal}"
        placeholder="0"
        oninput="updatePctSummary()"
      />
    </div>`;
  }).join('');

  // Seed rawValue for amount-mode inputs (MutationObserver will format the display value)
  if (!isPercent) {
    list.querySelectorAll('.budget-input').forEach(input => {
      if (input.dataset.cat && !input.dataset.rawValue) {
        input.dataset.rawValue = String(S.budgets[input.dataset.cat] || 0);
      }
    });
  }

  renderBudgetExtras();
}

function renderBudgetExtras() {
  renderWeeklyBudget();
  renderRolloverPanel();
  updatePctSummary();
}

/* ── BUDGET MODE + PCT SUMMARY ───────────────────────────── */
function setBudgetMode(mode) {
  S.budgetMode = mode;
  localStorage.setItem('cf-budget-mode', mode);
  renderBudgetTab();
}

function updatePctSummary() {
  const isPercent = S.budgetMode === 'percent';
  const inputs = document.querySelectorAll('.budget-input');
  let total = 0;

  if (isPercent) {
    inputs.forEach(i => { total += parseFloat(i.value) || 0; });
  } else {
    const incEl = document.getElementById('total-income-input');
    // Always parse directly from .value (strip non-digits) so we never
    // read a stale dataset.rawValue — oninput fires BEFORE the
    // applyFormatting 'input' addEventListener updates rawValue.
    const income = parseInt((incEl?.value || '').replace(/\D/g, '')) || S.totalIncome || 0;
    if (income > 0) {
      let totalBudget = 0;
      inputs.forEach(i => {
        // Prefer dataset.rawValue (set synchronously during render/seed),
        // fall back to stripping separators from the displayed value.
        const raw = parseInt(i.dataset.rawValue) ||
                    parseInt((i.value || '').replace(/[.,]/g, '')) || 0;
        totalBudget += raw;
      });
      total = (totalBudget / income) * 100;
    }
  }

  const fill    = document.getElementById('bpct-fill');
  const totalEl = document.getElementById('bpct-total');
  const noteEl  = document.getElementById('bpct-note');
  if (fill)    { fill.style.width = Math.min(total, 100) + '%'; fill.classList.toggle('over', total > 100); }
  if (totalEl) { totalEl.textContent = total.toFixed(0) + '%'; }
  if (noteEl)  {
    const over = total > 100;
    noteEl.textContent = over
      ? `${(total - 100).toFixed(0)}% over`
      : total < 100 ? `${(100 - total).toFixed(0)}% unallocated`
      : 'fully allocated';
    noteEl.classList.toggle('over', over);
  }
}

function renderWeeklyBudget() {
  const el = document.getElementById('weekly-budget-content');
  if (!el) return;
  const now = new Date(), startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  const weekStartStr = startOfWeek.toISOString().split('T')[0];
  const weekEndStr   = endOfWeek.toISOString().split('T')[0];
  const weekTx = getTxView().filter(tx => tx.date >= weekStartStr && tx.date <= weekEndStr && isExpenseTx(tx));
  const byCategory = {};
  weekTx.forEach(tx => { byCategory[tx.category] = (byCategory[tx.category] || 0) + tx.amount; });
  const weeklyMultiplier = 7 / 30;
  let html = '';
  getAllCategories().forEach(cat => {
    const monthlyBudget = S.budgets[cat.id] || 0;
    if (monthlyBudget <= 0) return;
    const weeklyBudget = Math.round(monthlyBudget * weeklyMultiplier);
    const spent = byCategory[cat.id] || 0;
    const pct = weeklyBudget > 0 ? Math.min((spent / weeklyBudget) * 100, 100) : 0;
    const status = pct >= 100 ? 'over' : pct >= 80 ? 'warn' : 'ok';
    html += `<div class="weekly-cat-row">
      <div class="weekly-cat-icon" style="color:${cat.color}">${catSVG(cat.id, 12, cat.color)}</div>
      <div class="weekly-cat-info"><span class="weekly-cat-name">${getCat(cat.id).label}</span><span class="weekly-cat-amounts">${fmtCurrency(spent)} / ${fmtCurrency(weeklyBudget)}</span></div>
      <div class="weekly-bar-track"><div class="weekly-bar-fill ${status}" style="width:${pct}%"></div></div>
    </div>`;
  });
  el.innerHTML = html || `<div class="empty-state">${t('budget.weekly.empty')}</div>`;
}

function renderRolloverPanel() {
  const el = document.getElementById('rollover-content');
  if (!el) return;
  if (!S.rolloverEnabled) { el.innerHTML = `<div class="rollover-disabled">${t('budget.rollover.desc')}</div>`; return; }
  const rollover = S.rolloverAmount || 0;
  el.innerHTML = `
    <div class="rollover-amount">
      <span class="rollover-label">${t('budget.rollover.from.last')}</span>
      <span class="rollover-value">${fmtCurrency(rollover)}</span>
    </div>
    <button class="btn-small btn-secondary" onclick="resetRollover()">${t('budget.rollover.reset')}</button>`;
}

