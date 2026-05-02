/* ══════════════════════════════════════════════════════════
   CASHFLOW.SYS — charts.js
   Chart.js wrappers with dirty-flag optimization.
   Charts only re-render when data actually changes.
   Depends on: Chart.js (global)
══════════════════════════════════════════════════════════ */

const Charts = (() => {
  let dc = null, mc = null, pc = null, cc = null;

  /* ── dirty-flag: track last render hash ──────────────────── */
  let _lastDaily   = '';
  let _lastMonthly = '';
  let _lastPie     = '';
  let _lastCompare = '';

  const hash = arr => arr.length + '_' + (arr[0]?.id || '') + '_' + (arr[arr.length - 1]?.id || '');

  /* ── theme helpers ───────────────────────────────────────── */
  const css  = v  => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const FONT = () => ({ family: "'DM Mono',monospace", size: 10, weight: '300' });
  const baseOpts = (extra = {}) => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400, easing: 'easeOutQuart' },
    plugins: { legend: { display: false }, tooltip: { backgroundColor: css('--bg3') || '#201d2a', titleColor: css('--gold') || '#d4a843', bodyColor: css('--text2') || 'rgba(240,232,245,0.62)', borderColor: css('--gold4') || 'rgba(212,168,67,0.34)', borderWidth: 1, padding: 10, titleFont: { family: "'DM Mono',monospace", size: 10, weight: '500' }, bodyFont: { family: "'DM Mono',monospace", size: 10 }, cornerRadius: 0, displayColors: false }, ...(extra.plugins || {}) },
    scales: {
      x: { ticks: { color: css('--text3'), font: FONT(), maxTicksLimit: 8 }, grid: { color: css('--line'), drawBorder: false }, border: { color: 'transparent' } },
      y: { ticks: { color: css('--text3'), font: FONT(), callback: v => v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v }, grid: { color: css('--line'), drawBorder: false }, border: { color: 'transparent' } },
      ...(extra.scales || {}),
    }, ...extra,
  });

  /* ── renderDaily ─────────────────────────────────────────── */
  const renderDaily = txs => {
    const ctx = document.getElementById('daily-chart'); if (!ctx) return;
    const h = hash(txs);
    if (dc && _lastDaily === h) return; // nothing changed — skip all work
    const expenses = txs.filter(t => t.type !== 'income');
    const days = [], amounts = [], today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      const key = d.toISOString().split('T')[0];
      days.push(d.toLocaleDateString(getLang() === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'short' }));
      amounts.push(expenses.filter(t => t.date === key).reduce((s, t) => s + (t.amount || 0), 0));
    }
    const g = css('--gold');
    if (dc) {
      dc.data.labels = days; dc.data.datasets[0].data = amounts;
      dc.data.datasets[0].backgroundColor = amounts.map(a => a > 0 ? g + '44' : 'transparent');
      dc.data.datasets[0].borderColor      = amounts.map(a => a > 0 ? g : 'transparent');
      dc.update('none'); _lastDaily = h; return;
    }
    dc = new Chart(ctx, {
      type: 'bar',
      data: { labels: days, datasets: [{ data: amounts, backgroundColor: amounts.map(a => a > 0 ? g + '44' : 'transparent'), borderColor: amounts.map(a => a > 0 ? g : 'transparent'), borderWidth: 1, borderRadius: 3 }] },
      options: baseOpts(),
    });
    _lastDaily = h;
  };

  /* ── renderMonthly ───────────────────────────────────────── */
  const renderMonthly = txs => {
    const ctx = document.getElementById('monthly-chart'); if (!ctx) return;
    const h = hash(txs);
    if (mc && _lastMonthly === h) return;
    const mm = {};
    for (const t of txs.filter(x => x.type !== 'income')) { const ym = t.date?.slice(0, 7); if (ym) mm[ym] = (mm[ym] || 0) + (t.amount || 0); }
    const keys   = Object.keys(mm).sort();
    const labels = keys.map(k => { const [y, m] = k.split('-'); return new Date(+y, +m - 1).toLocaleDateString(getLang() === 'id' ? 'id-ID' : 'en-US', { month: 'short', year: '2-digit' }); });
    const data   = keys.map(k => mm[k]);
    const g = css('--gold');
    if (mc) { mc.data.labels = labels; mc.data.datasets[0].data = data; mc.update('none'); _lastMonthly = h; return; }
    mc = new Chart(ctx, { type: 'bar', data: { labels, datasets: [{ label: 'Expense', data, backgroundColor: g + 'bb', borderColor: g, borderWidth: 1, borderRadius: 5 }] }, options: baseOpts() });
    _lastMonthly = h;
  };

  /* ── renderPie ───────────────────────────────────────────── */
  const renderPie = txs => {
    const ctx = document.getElementById('pie-chart'); if (!ctx) return;
    const h = hash(txs);
    if (pc && _lastPie === h) return;
    const tot  = {};
    for (const t of txs) tot[t.category] = (tot[t.category] || 0) + (t.amount || 0);
    const cats = CATS.filter(c => tot[c.id] > 0);
    if (!cats.length) return;
    if (pc) { pc.destroy(); pc = null; }
    pc = new Chart(ctx, {
      type: 'doughnut',
      data: { labels: cats.map(c => getCat(c.id).label), datasets: [{ data: cats.map(c => tot[c.id]), backgroundColor: cats.map(c => c.color + 'cc'), borderWidth: 2, borderColor: css('--bg1') || '#0d0d0d' }] },
      options: { responsive: true, maintainAspectRatio: false, animation: { duration: 400 }, plugins: { legend: { position: 'right', labels: { color: css('--text3'), font: FONT(), boxWidth: 12, padding: 12, usePointStyle: true } } } },
    });
    _lastPie = h;
  };

  /* ── renderCompare ───────────────────────────────────────── */
  const renderCompare = txs => {
    const ctx = document.getElementById('compare-chart'); if (!ctx) return;
    const h = hash(txs);
    if (cc && _lastCompare === h) return; // nothing changed — skip all work
    const months = []; const today = new Date();
    for (let i = 5; i >= 0; i--) { const d = new Date(today.getFullYear(), today.getMonth() - i, 1); months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); }
    const inc  = months.map(ym => txs.filter(t => t.date?.startsWith(ym) && t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0));
    const exp  = months.map(ym => txs.filter(t => t.date?.startsWith(ym) && t.type !== 'income').reduce((s, t) => s + (t.amount || 0), 0));
    const labels = months.map(k => { const [y, m] = k.split('-'); return new Date(+y, +m - 1).toLocaleDateString(getLang() === 'id' ? 'id-ID' : 'en-US', { month: 'short', year: '2-digit' }); });
    const g = css('--gold'), ok = css('--ok') || '#27ae60';
    if (cc) { cc.data.labels = labels; cc.data.datasets[0].data = inc; cc.data.datasets[1].data = exp; cc.update('none'); _lastCompare = h; return; }
    cc = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [
        { label: 'Income',  data: inc, backgroundColor: ok + '55', borderColor: ok, borderWidth: 1, borderRadius: 3 },
        { label: 'Expense', data: exp, backgroundColor: g  + '44', borderColor: g,  borderWidth: 1, borderRadius: 3 },
      ]},
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 400 },
        plugins: { legend: { display: true, labels: { color: css('--text3'), font: FONT(), boxWidth: 12, usePointStyle: true } } },
        scales: {
          x: { ticks: { color: css('--text3'), font: FONT() }, grid: { color: css('--line') } },
          y: { ticks: { color: css('--text3'), font: FONT(), callback: v => v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v }, grid: { color: css('--line') } },
        },
      },
    });
    _lastCompare = h;
  };

  /* ── updateColors ────────────────────────────────────────── */
  const updateColors = () => {
    _lastDaily = _lastMonthly = _lastPie = _lastCompare = ''; // force re-render on theme change
    if (dc) dc.update();
    if (mc) mc.update();
    if (cc) cc.update();
    if (pc) { pc.data.datasets[0].borderColor = css('--bg1'); pc.update(); }
  };

  /* ── invalidate ──────────────────────────────────────────── */
  const invalidate = () => { _lastDaily = _lastMonthly = _lastPie = _lastCompare = ''; };

  return { renderDaily, renderMonthly, renderPie, renderCompare, updateColors, invalidate };
})();
