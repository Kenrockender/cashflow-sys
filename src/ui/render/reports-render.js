/* ══════════════════════════════════════════════════════════
   CASHFLOW.SYS — reports-render.js
   DOM rendering, templates, modal helpers, tab routing.
   Load order: THIRD (after state.js + helpers.js)
   Depends on: state.js, helpers.js, constants.js, i18n.js, charts.js
══════════════════════════════════════════════════════════ */

/* ── REPORTS ─────────────────────────────────────────────── */
function renderReports() {
  renderYoY();
  const TV = getTxView();
  Charts.renderCompare(TV);
  Charts.renderMonthly(TV);
  const mExpenses = TV.filter(t => t.date?.startsWith(thisMonth()) && isExpenseTx(t));
  Charts.renderPie(mExpenses);
  document.getElementById('top-expenses').innerHTML = renderTxItems([...mExpenses].sort((a, b) => b.amount - a.amount).slice(0, 10), false);
}

function renderYoY() {
  const el = document.getElementById('reports-yoy');
  if (!el) return;
  const TV = getTxView();
  const tmon = thisMonth();
  const [y, m] = tmon.split('-').map(Number);
  const prevYm = `${y - 1}-${String(m).padStart(2, '0')}`;
  const labelPrev = new Date(y - 1, m - 1, 1).toLocaleDateString(getLang() === 'id' ? 'id-ID' : 'en-US', { month: 'long', year: 'numeric' });
  const ce = sum(TV.filter(tx => tx.date?.startsWith(tmon) && isExpenseTx(tx)));
  const pe = sum(TV.filter(tx => tx.date?.startsWith(prevYm) && isExpenseTx(tx)));
  const ci = sum(TV.filter(tx => tx.date?.startsWith(tmon) && isIncomeTx(tx)));
  const pi = sum(TV.filter(tx => tx.date?.startsWith(prevYm) && isIncomeTx(tx)));
  const deltaHtml = (a, b) => {
    if (!b) return `<span class="yoy-delta">${t('reports.yoy.na')}</span>`;
    const pct = Math.round((a - b) / b * 100);
    const cls = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
    return `<span class="yoy-delta ${cls}">${pct > 0 ? icon('arrowUp', '', 12) : pct < 0 ? icon('arrowDown', '', 12) : icon('arrowRight', '', 12)} ${Math.abs(pct)}%</span>`;
  };
  el.innerHTML = `
    <div class="yoy-hdr"><span class="sec-title">${t('reports.yoy.title')}</span><span class="yoy-sub">${t('reports.yoy.sub', { month: labelPrev })}</span></div>
    <div class="yoy-grid">
      <div class="yoy-cell"><span class="yoy-lbl">${t('reports.yoy.exp')}</span><span class="yoy-val">${fmtCurrency(ce)}</span><span class="yoy-prev">${t('reports.yoy.prev')} ${fmtCurrency(pe)}</span>${deltaHtml(ce, pe)}</div>
      <div class="yoy-cell"><span class="yoy-lbl">${t('reports.yoy.inc')}</span><span class="yoy-val">${fmtCurrency(ci)}</span><span class="yoy-prev">${t('reports.yoy.prev')} ${fmtCurrency(pi)}</span>${deltaHtml(ci, pi)}</div>
    </div>`;
}

