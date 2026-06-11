/* ══════════════════════════════════════════════════════════
   CASHFLOW.SYS — forecast-math.js
   Pure, DOM-free net-worth history + cashflow projection math.
   Works as a plain browser script (window.ForecastMath) and as
   an ESM side-effect import in vitest (globalThis.ForecastMath).

   Input transactions: { date: 'YYYY-MM-DD', type: 'income'|other,
   amount: Number } — amounts already converted to the display
   currency by the caller.
══════════════════════════════════════════════════════════ */

(function (global) {
  const pad2 = n => String(n).padStart(2, '0');
  const monthKeyOf = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;

  function addMonths(ym, n) {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(y, m - 1 + n, 1);
    return monthKeyOf(d);
  }

  const txNet = tx => (tx.type === 'income' ? 1 : -1) * (tx.amount || 0);

  /** Net flow (income − expense) per month, keyed 'YYYY-MM'. */
  function netByMonth(txs) {
    const nets = {};
    for (const tx of txs) {
      const ym = tx.date && tx.date.slice(0, 7);
      if (!ym || ym.length !== 7) continue;
      nets[ym] = (nets[ym] || 0) + txNet(tx);
    }
    return nets;
  }

  /**
   * Month-end net worth for the trailing `months` window (default 12),
   * reconstructed as the cumulative net flow since the earliest
   * transaction. Months without transactions carry the previous value.
   * Returns [{ ym, value }], oldest first. Empty array when no data.
   */
  function buildHistory(txs, { months = 12, now = new Date() } = {}) {
    const nets = netByMonth(txs);
    const keys = Object.keys(nets).sort();
    if (!keys.length) return [];
    const curYm   = monthKeyOf(now);
    const startYm = addMonths(curYm, -(months - 1));
    const firstYm = keys[0] < curYm ? keys[0] : curYm;
    let cum = 0;
    const points = [];
    for (let ym = firstYm; ; ym = addMonths(ym, 1)) {
      cum += nets[ym] || 0;
      if (ym >= startYm) points.push({ ym, value: cum });
      if (ym >= curYm) break;
    }
    return points;
  }

  /**
   * Projected monthly net flow = net of current-month recurring txs
   * + average net of non-recurring txs over the last 3 full months
   * (or fewer when history is shorter, minimum 1 month).
   */
  function monthlyFlow(txs, { now = new Date() } = {}) {
    const curYm = monthKeyOf(now);
    let recurringNet = 0;
    for (const tx of txs) {
      if (tx.recurring && tx.date && tx.date.startsWith(curYm)) recurringNet += txNet(tx);
    }
    const nonRec = txs.filter(tx => !tx.recurring);
    const nets = netByMonth(nonRec);
    const past = Object.keys(nets).filter(ym => ym < curYm).sort();
    let avgNonRecurring = 0;
    if (past.length) {
      const window = [];
      for (let i = 1; i <= 3; i++) {
        const ym = addMonths(curYm, -i);
        if (ym >= past[0]) window.push(nets[ym] || 0);
      }
      if (window.length) avgNonRecurring = window.reduce((a, b) => a + b, 0) / window.length;
    }
    return recurringNet + avgNonRecurring;
  }

  /**
   * History + forward projection. Returns null when there is less
   * than one full month of history (no meaningful trend to show).
   * { history: [{ym,value}], projection: [{ym,value}], monthlyFlow }
   */
  function project(txs, { horizon = 6, months = 12, now = new Date() } = {}) {
    const history = buildHistory(txs, { months, now });
    if (history.length < 2) return null;
    const flow = monthlyFlow(txs, { now });
    const projection = [];
    let ym = history[history.length - 1].ym;
    let v  = history[history.length - 1].value;
    for (let i = 0; i < horizon; i++) {
      ym = addMonths(ym, 1);
      v += flow;
      projection.push({ ym, value: v });
    }
    return { history, projection, monthlyFlow: flow };
  }

  global.ForecastMath = { addMonths, netByMonth, buildHistory, monthlyFlow, project };
})(typeof window !== 'undefined' ? window : globalThis);
