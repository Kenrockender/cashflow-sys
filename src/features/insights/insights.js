/* ══════════════════════════════════════════════════════════
   CASHFLOW.SYS — insights.js
   Net worth & cashflow forecast card on the dashboard:
   headline numbers + combined history→projection chart.
   Depends on: forecast-math.js, helpers.js (fmtCurrency,
   convertToPrimary), Chart.js, i18n.js, skeleton.js
══════════════════════════════════════════════════════════ */

const Insights = (() => {
  let _chart = null;
  let _lastHash = '';

  const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

  const monthLabel = ym => {
    const [y, m] = ym.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(getLang() === 'id' ? 'id-ID' : 'en-US', { month: 'short', year: '2-digit' });
  };
  const monthLabelLong = ym => {
    const [y, m] = ym.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(getLang() === 'id' ? 'id-ID' : 'en-US', { month: 'long', year: 'numeric' });
  };

  /* All accounts, amounts converted to the display currency. */
  function txsForMath() {
    return S.transactions.map(tx => ({
      date: tx.date,
      type: tx.type,
      recurring: !!tx.recurring,
      amount: typeof convertToPrimary === 'function' ? convertToPrimary(tx.amount || 0, tx.currency) : (tx.amount || 0),
    }));
  }

  function invalidate() { _lastHash = ''; }

  function render() {
    const card = document.getElementById('networth-card');
    if (!card || typeof ForecastMath === 'undefined') return;

    const hash = S.transactions.length + '_' + (S.transactions[0]?.id || '') + '_'
      + (S.transactions[S.transactions.length - 1]?.id || '') + '_' + S.currency + '_' + getLang();
    if (hash === _lastHash) return;
    _lastHash = hash;

    const result = ForecastMath.project(txsForMath(), { horizon: 6, months: 12 });

    if (!result) {
      if (_chart) { _chart.destroy(); _chart = null; }
      card.classList.remove('hidden');
      card.innerHTML = emptyStateHTML({
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>',
        title: t('networth.empty.title'),
        sub: t('networth.empty.sub'),
      });
      return;
    }

    const { history, projection } = result;
    const current  = history[history.length - 1].value;
    const prevEnd  = history[history.length - 2].value;
    const forecast = projection[projection.length - 1];
    const pct = prevEnd !== 0 ? ((current - prevEnd) / Math.abs(prevEnd) * 100) : null;
    const pctTxt = pct === null ? '' : `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% ${t('networth.vs.last')}`;

    card.classList.remove('hidden');
    card.innerHTML = `
      <div class="networth-head">
        <div class="networth-col">
          <div class="networth-lbl">${t('networth.title')}</div>
          <div class="networth-val" id="networth-current"></div>
          <div class="networth-sub ${pct !== null && pct < 0 ? 'negative' : 'positive'}">${pctTxt}</div>
        </div>
        <div class="networth-col networth-col--forecast">
          <div class="networth-lbl">${t('networth.forecast', { month: monthLabelLong(forecast.ym) })}</div>
          <div class="networth-val networth-val--forecast" id="networth-forecast"></div>
          <div class="networth-sub">${t('networth.pace')}</div>
        </div>
      </div>
      <div class="networth-chart-wrap"><canvas id="networth-chart"></canvas></div>`;

    setAnimatedValue(document.getElementById('networth-current'), current,
      v => (v < 0 ? '−' : '') + fmtCurrency(Math.abs(v)));
    setAnimatedValue(document.getElementById('networth-forecast'), forecast.value,
      v => (v < 0 ? '−' : '') + fmtCurrency(Math.abs(v)));

    renderChart(history, projection);
  }

  function renderChart(history, projection) {
    const ctx = document.getElementById('networth-chart');
    if (!ctx || typeof Chart === 'undefined') return;
    if (_chart) { _chart.destroy(); _chart = null; }

    const labels      = [...history.map(p => monthLabel(p.ym)), ...projection.map(p => monthLabel(p.ym))];
    const histData    = [...history.map(p => p.value), ...projection.map(() => null)];
    const projData    = [...history.map((p, i) => (i === history.length - 1 ? p.value : null)), ...projection.map(p => p.value)];
    const boundaryIdx = history.length - 1;

    const accent = css('--accent') || '#3ddc97';
    const reduced = typeof prefersReducedMotion === 'function' && prefersReducedMotion();

    const todayLine = {
      id: 'cfTodayLine',
      afterDatasetsDraw(chart) {
        const meta = chart.getDatasetMeta(0);
        const pt = meta.data[boundaryIdx];
        if (!pt) return;
        const { top, bottom } = chart.chartArea;
        const c = chart.ctx;
        c.save();
        c.strokeStyle = css('--rule-strong') || '#33403a';
        c.setLineDash([3, 3]);
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(pt.x, top);
        c.lineTo(pt.x, bottom);
        c.stroke();
        c.restore();
      },
    };

    _chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { data: histData, borderColor: accent, borderWidth: 2, pointRadius: 0, pointHitRadius: 8, tension: 0.35, spanGaps: false },
          { data: projData, borderColor: accent, borderWidth: 2, borderDash: [5, 5], pointRadius: 0, pointHitRadius: 8, tension: 0.35, spanGaps: false },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: reduced ? false : { duration: 500, easing: 'easeOutQuart' },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: css('--surface-3') || '#222b27',
            titleColor: css('--ink') || '#e9efec',
            bodyColor: css('--ink-dim') || 'rgba(233,239,236,0.6)',
            borderColor: css('--rule-strong') || '#33403a',
            borderWidth: 1, padding: 10, cornerRadius: 8, displayColors: false,
            titleFont: { family: "'DM Sans',system-ui,sans-serif", size: 11, weight: '600' },
            bodyFont:  { family: "'DM Sans',system-ui,sans-serif", size: 11 },
            filter: item => item.parsed.y !== null,
            callbacks: { label: c => (c.datasetIndex === 1 && c.dataIndex > boundaryIdx ? '≈ ' : '') + fmtCurrency(c.parsed.y) },
          },
        },
        scales: {
          x: { ticks: { color: css('--ink-faint'), font: { family: "'DM Sans',system-ui,sans-serif", size: 10 }, maxTicksLimit: 9 }, grid: { display: false }, border: { color: 'transparent' } },
          y: { ticks: { color: css('--ink-faint'), font: { family: "'DM Sans',system-ui,sans-serif", size: 10 }, maxTicksLimit: 5, callback: v => Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : Math.abs(v) >= 1000 ? (v / 1000).toFixed(0) + 'K' : v }, grid: { color: css('--rule') }, border: { color: 'transparent' } },
        },
      },
      plugins: [todayLine],
    });
  }

  return { render, invalidate };
})();
