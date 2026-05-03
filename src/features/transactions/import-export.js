/* ══════════════════════════════════════════════════════════
   CASHFLOW.SYS — import-export.js
   Import/Export functionality (CSV, XLSX, PDF)
   Depends on: state.js, helpers.js, store.js
══════════════════════════════════════════════════════════ */

/* ── IMPORT ──────────────────────────────────────────────── */
async function handleImportFile(file) {
  const prev = document.getElementById('import-preview');
  prev.classList.remove('hidden');
  prev.innerHTML = '<div class="import-loading">Processing file…</div>';
  try {
    const r = await ImportParser.importFile(file); _importPending = r.transactions;
    if (!_importPending.length) { prev.innerHTML = '<div class="import-error">No transactions found in file.</div>'; return; }
    prev.innerHTML = `<div class="import-summary"><span class="import-badge">${r.bank.toUpperCase()}</span>Found <strong>${_importPending.length}</strong> transactions</div><div class="import-rows">${_importPending.slice(0, 5).map(tx => `<div class="import-row"><span class="import-date">${tx.date || '-'}</span><span class="import-desc">${san((tx.description || '').slice(0, 40))}</span><span class="import-amt">${fmtCurrency(tx.amount)}</span></div>`).join('')}${_importPending.length > 5 ? `<div class="import-more">…and ${_importPending.length - 5} more</div>` : ''}</div>`;
    document.getElementById('btn-confirm-import').disabled = false;
  } catch (e) { prev.innerHTML = `<div class="import-error">Error: ${san(e.message)}</div>`; }
}

async function handleConfirmImport() {
  if (!_importPending.length) return;
  const existing = new Set(S.transactions.map(t => `${t.date}|${t.amount}|${(t.description || '').toLowerCase().trim()}`));
  const toImport = _importPending.filter(tx => !existing.has(`${tx.date}|${tx.amount}|${(tx.description || '').toLowerCase().trim()}`));
  const skipped  = _importPending.length - toImport.length;
  if (!toImport.length) { toast(t('toast.import.all.dupe', {n: _importPending.length})); _importPending = []; closeModal('modal-import'); return; }
  const tempTxs = toImport.map((tx, i) => ({ id: 'import_' + Date.now() + '_' + i, ...tx }));
  S.transactions = [...tempTxs, ...S.transactions].sort(sortTxByInput);
  toast(skipped > 0 ? t('toast.import.partial', {imported: toImport.length, skipped}) : t('toast.import.success', {n: toImport.length}));
  _importPending = []; closeModal('modal-import');
  Charts.invalidate(); render();
  (async () => {
    try {
      const results = await Store.addBatch(toImport);
      S.transactions = S.transactions.map(tx => {
        if (tx.id.startsWith('import_')) {
          const realId = results.find(r => r.description === tx.description && r.date === tx.date && r.amount === tx.amount)?.id;
          if (realId) return { ...tx, id: realId };
        }
        return tx;
      });
    } catch (e) {
      console.warn('Import batch error, queuing:', e.message);
      for (const tx of toImport) { try { await OQ.enqueue(tx); } catch (_) {} }
    }
  })();
}

/* ── EXPORT CSV ──────────────────────────────────────────── */
function exportCSV() {
  let txs = getTxView();
  if (S.activeTab === 'transactions') {
    const search   = document.getElementById('tx-search')?.value.toLowerCase()  || '';
    const catF     = document.getElementById('tx-filter-cat')?.value             || '';
    const typeF    = document.getElementById('tx-filter-type')?.value            || '';
    const dateFrom = document.getElementById('tx-date-from')?.value              || '';
    const dateTo   = document.getElementById('tx-date-to')?.value                || '';
    const amtMin   = parseFloat(document.getElementById('tx-amt-min')?.value)    || 0;
    const amtMax   = parseFloat(document.getElementById('tx-amt-max')?.value)    || Infinity;
    if (search)            txs = txs.filter(t => t.description?.toLowerCase().includes(search) || t.note?.toLowerCase().includes(search));
    if (catF)              txs = txs.filter(t => t.category === catF);
    if (typeF)             txs = txs.filter(t => (t.type || 'expense') === typeF);
    if (dateFrom)          txs = txs.filter(t => t.date >= dateFrom);
    if (dateTo)            txs = txs.filter(t => t.date <= dateTo);
    if (amtMin > 0)        txs = txs.filter(t => (t.amount || 0) >= amtMin);
    if (amtMax < Infinity) txs = txs.filter(t => (t.amount || 0) <= amtMax);
  }
  if (!txs.length) { toast(t('toast.no.data.export')); return; }
  const headers = ['Date','Description','Type','Category','Amount (Rp)','Account','TransferRef','Note','Recurring'];
  const rows    = txs.map(t2 => {
    const xfer = (t2.note || '').match(/^transfer:(\S+)/)?.[1] || '';
    return [t2.date || '', `"${(t2.description || '').replace(/"/g, '""')}"`, t2.type === 'income' ? 'Income' : 'Expense', t2.type === 'income' ? 'Income' : getCat(t2.category).label, t2.amount || 0, `"${(t2.accountId ? accountLabel(t2.accountId) : '').replace(/"/g, '""')}"`, xfer, `"${(t2.note || '').replace(/"/g, '""')}"`, t2.recurring ? 'Yes' : 'No'];
  });
  const csv  = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a'); a.href = url; a.download = `cashflow-${todayKey()}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  toast(t('toast.csv.exported'));
}

/** Export all transactions to Excel (.xlsx) using SheetJS, loaded on demand. */
async function exportXLSX() {
  toast(t('toast.export.preparing'));
  if (!window.XLSX) {
    try {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
        s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
      });
    } catch (_) { toast(t('toast.export.error')); return; }
  }
  const txs = getTxView();
  if (!txs.length) { toast(t('toast.no.data.export')); return; }
  const rows = txs.map(tx => ({
    Date:        tx.date || '',
    Description: tx.description || '',
    Type:        tx.type === 'income' ? t('pdf.income') : t('pdf.expense'),
    Category:    tx.type === 'income' ? t('cat.income') : getCat(tx.category).label,
    Amount:      tx.amount || 0,
    Account:     tx.accountId ? accountLabel(tx.accountId) : '',
    Note:        tx.note || '',
    Recurring:   tx.recurring ? 'Yes' : 'No',
  }));
  const ws = window.XLSX.utils.json_to_sheet(rows);
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
  window.XLSX.writeFile(wb, `cashflow-${todayKey()}.xlsx`);
  toast(t('toast.xlsx.exported'));
}

/** Full PDF financial report using jsPDF (already bundled in index.html). */
function getReportPeriodSelection() {
  const [curYear, curMonth] = thisMonth().split('-');
  const monthRaw = document.getElementById('report-month-select')?.value || curMonth;
  const yearRaw  = document.getElementById('report-year-select')?.value  || curYear;

  const monthNum = Number(monthRaw);
  const month = monthNum >= 1 && monthNum <= 12 ? String(monthNum).padStart(2, '0') : curMonth;
  const year = /^\d{4}$/.test(yearRaw) ? yearRaw : curYear;

  const locale = getLang() === 'id' ? 'id-ID' : 'en-US';
  const label = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  return { ym: `${year}-${month}`, label };
}

async function exportPDFWithCharts() {
  if (!window.jspdf) { toast(t('toast.export.error')); return; }
  const { jsPDF } = window.jspdf;
  toast(t('toast.pdf.generating'));
  const { ym: reportYm, label: reportLabel } = getReportPeriodSelection();

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, H = 297, M = 14;
  let y = M;

  // ── Color palette ─────────────────────────────────────────
  const C = {
    gold:      [200, 169, 110],
    goldLight: [252, 246, 233],
    green:     [39,  174, 96],
    greenBg:   [235, 250, 241],
    red:       [192, 57,  43],
    redBg:     [252, 237, 235],
    orange:    [230, 140, 50],
    dark:      [30,  30,  30],
    mid:       [70,  70,  70],
    gray:      [140, 140, 140],
    stripe:    [247, 247, 247],
    rule:      [220, 220, 220],
    white:     [255, 255, 255],
  };

  // ── Drawing helpers ───────────────────────────────────────
  const fill = (x, ry, w, h, col) => {
    doc.setFillColor(...col);
    doc.rect(x, ry, w, h, 'F');
  };
  const fillR = (x, ry, w, h, r, col) => {
    doc.setFillColor(...col);
    doc.roundedRect(x, ry, w, h, r, r, 'F');
  };

  // Repeating page header for pages 2+
  const pageHeader = () => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...C.gold);
    doc.text('CASHFLOW.SYS', M, y);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.gray);
    doc.text(reportLabel, W - M, y, { align: 'right' });
    y += 2;
    doc.setDrawColor(...C.gold); doc.setLineWidth(0.25); doc.line(M, y, W - M, y);
    y += 5;
  };

  // Advance y with auto page break
  const addY = (n = 5) => {
    y += n;
    if (y > 278) { doc.addPage(); y = M; pageHeader(); }
  };

  // Section title bar (gold-tinted background + bold label)
  const section = (title) => {
    if (y > 260) { doc.addPage(); y = M; pageHeader(); }
    fill(M, y - 1, W - 2 * M, 7.5, C.goldLight);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...C.gold);
    doc.text(title, M + 2.5, y + 4.5);
    addY(11);
  };

  // ─────────────────────────────────────────────────────────
  // PAGE 1 — COVER HEADER
  // ─────────────────────────────────────────────────────────
  fill(0, 0, W, 3.5, C.gold);   // Top accent bar
  fill(0, H - 3.5, W, 3.5, C.gold); // Bottom accent bar (pre-draw for page 1)

  y = 12;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(...C.gold);
  doc.text('CASHFLOW', M, y);
  const cashW = doc.getTextWidth('CASHFLOW');
  doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.dark);
  doc.text('.SYS', M + cashW, y);

  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.gray);
  doc.text('Personal Finance Report', M, y + 5);

  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.gray);
  doc.text(`${t('pdf.generated')}: ${new Date().toLocaleDateString()}`, W - M, y, { align: 'right' });
  doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.dark);
  doc.text(reportLabel, W - M, y + 5, { align: 'right' });

  y += 12;
  doc.setDrawColor(...C.gold); doc.setLineWidth(0.4); doc.line(M, y, W - M, y);
  y += 9;

  // ── KPI SUMMARY CARDS (2 × 2 grid) ───────────────────────
  const TV   = getTxView();
  const mExp = TV.filter(tx => tx.date?.startsWith(reportYm) && isExpenseTx(tx));
  const mInc = TV.filter(tx => tx.date?.startsWith(reportYm) && isIncomeTx(tx));
  const totE = sum(mExp), totI = sum(mInc), net = totI - totE;
  const totB = Object.values(S.budgets).reduce((a, b) => a + b, 0);

  const cardW = (W - 2 * M - 5) / 2;
  const cardH = 20;
  const cards = [
    { label: t('pdf.income'),  value: fmtFull(totI), color: C.green,              bg: C.greenBg },
    { label: t('pdf.expense'), value: fmtFull(totE), color: [210, 80, 50],         bg: C.redBg   },
    { label: t('pdf.net'),     value: (net >= 0 ? '+' : '') + fmtFull(net),
      color: net >= 0 ? C.green : C.red,                                           bg: net >= 0 ? C.greenBg : C.redBg },
    { label: 'Budget',         value: fmtFull(totB), color: C.gold,               bg: C.goldLight },
  ];

  const startCardsY = y;
  cards.forEach((card, i) => {
    const cx = M + (i % 2) * (cardW + 5);
    const cy = startCardsY + Math.floor(i / 2) * (cardH + 4);
    fillR(cx, cy, cardW, cardH, 2, card.bg);
    // Accent left bar
    fillR(cx, cy, 2.5, cardH, 1, card.color);
    // Label
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...C.gray);
    doc.text(card.label.toUpperCase(), cx + 6, cy + 6.5);
    // Value
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...card.color);
    doc.text(card.value, cx + 6, cy + 15);
  });

  y = startCardsY + 2 * (cardH + 4) + 6;

  // ── SAVINGS RATE BADGE ────────────────────────────────────
  if (totI > 0) {
    const rate = Math.round((net / totI) * 100);
    const rateColor = rate >= 20 ? C.green : rate >= 0 ? C.gold : C.red;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...rateColor);
    doc.text(`Savings Rate: ${rate}%`, M, y);
    const budgetUsed = totB > 0 ? Math.round((totE / totB) * 100) : null;
    if (budgetUsed !== null) {
      const buColor = budgetUsed > 100 ? C.red : budgetUsed > 80 ? C.orange : C.green;
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...buColor);
      doc.text(`Budget Used: ${budgetUsed}%`, W - M, y, { align: 'right' });
    }
    addY(8);
  }

  // ─────────────────────────────────────────────────────────
  // CHARTS — capture live Chart.js canvases from the DOM
  // ─────────────────────────────────────────────────────────

  // Safely extract a canvas as a PNG data URL.
  // Returns null if the canvas doesn't exist, is empty, or is tainted.
  const canvasImg = (id) => {
    try {
      const el = document.getElementById(id);
      if (!el || !el.getContext) return null;
      const dataUrl = el.toDataURL('image/png');
      // An empty/blank canvas returns the minimal PNG stub
      if (!dataUrl || dataUrl === 'data:,' || dataUrl.length < 200) return null;
      return { dataUrl, aspect: el.width / Math.max(el.height, 1) };
    } catch (_) { return null; }
  };

  const imgCompare = canvasImg('compare-chart'); // Income vs Expense 6-month bar
  const imgPie     = canvasImg('pie-chart');     // Category doughnut
  const imgMonthly = canvasImg('monthly-chart'); // Monthly spending bar

  if (imgCompare || imgPie || imgMonthly) {
    // Start charts on a fresh page so tables don't crowd them
    if (y > 180) { doc.addPage(); y = M; pageHeader(); }
    section('Visual Overview');

    // ── Income vs Expense — full width ───────────────────────
    if (imgCompare) {
      const imgW = W - 2 * M;
      const imgH = Math.min(imgW / imgCompare.aspect, 58);
      if (y + imgH + 8 > 278) { doc.addPage(); y = M; pageHeader(); }

      // Subtle white card background
      fillR(M - 2, y - 2, imgW + 4, imgH + 8, 1.5, [252, 252, 252]);
      doc.setDrawColor(...C.rule); doc.setLineWidth(0.2);
      doc.roundedRect(M - 2, y - 2, imgW + 4, imgH + 8, 1.5, 1.5, 'S');

      doc.addImage(imgCompare.dataUrl, 'PNG', M, y, imgW, imgH);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...C.gray);
      doc.text('Income vs Expense — Last 6 Months', M, y + imgH + 4.5);
      addY(imgH + 10);
    }

    // ── Pie + Monthly — side by side ─────────────────────────
    if (imgPie || imgMonthly) {
      const halfW  = (W - 2 * M - 6) / 2;
      const pieH   = imgPie     ? Math.min(halfW / imgPie.aspect,     55) : 0;
      const monthH = imgMonthly ? Math.min(halfW / imgMonthly.aspect, 55) : 0;
      const rowH   = Math.max(pieH, monthH);

      if (y + rowH + 12 > 278) { doc.addPage(); y = M; pageHeader(); }

      if (imgPie) {
        fillR(M - 2, y - 2, halfW + 4, pieH + 8, 1.5, [252, 252, 252]);
        doc.setDrawColor(...C.rule); doc.setLineWidth(0.2);
        doc.roundedRect(M - 2, y - 2, halfW + 4, pieH + 8, 1.5, 1.5, 'S');
        doc.addImage(imgPie.dataUrl, 'PNG', M, y, halfW, pieH);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...C.gray);
        doc.text('Category Distribution', M, y + pieH + 4.5);
      }

      if (imgMonthly) {
        const cx = M + halfW + 6;
        fillR(cx - 2, y - 2, halfW + 4, monthH + 8, 1.5, [252, 252, 252]);
        doc.setDrawColor(...C.rule); doc.setLineWidth(0.2);
        doc.roundedRect(cx - 2, y - 2, halfW + 4, monthH + 8, 1.5, 1.5, 'S');
        doc.addImage(imgMonthly.dataUrl, 'PNG', cx, y, halfW, monthH);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...C.gray);
        doc.text('Monthly Spending', cx, y + monthH + 4.5);
      }

      addY(rowH + 12);
    }
  }

  // ─────────────────────────────────────────────────────────
  // BUDGET BREAKDOWN WITH PROGRESS BARS
  // ─────────────────────────────────────────────────────────
  section(t('pdf.budget.breakdown'));

  const catTotals = {};
  for (const tx of mExp) catTotals[tx.category] = (catTotals[tx.category] || 0) + tx.amount;
  const activeCats = getAllCategories().filter(c => catTotals[c.id] || S.budgets[c.id]);

  // Column positions: Category | Spent | Budget | [progress bar]
  const bc1 = M, bc2 = M + 60, bc3 = M + 105, bc4 = M + 130;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...C.gray);
  doc.text(t('pdf.col.category'), bc1, y);
  doc.text(t('pdf.col.spent'),    bc2, y, { align: 'right' });
  doc.text(t('pdf.col.budget'),   bc3, y, { align: 'right' });
  doc.text('% Used', W - M, y, { align: 'right' });
  y += 2;
  doc.setDrawColor(...C.rule); doc.setLineWidth(0.15); doc.line(M, y, W - M, y);
  addY(3.5);

  activeCats.forEach((cat, idx) => {
    if (y > 265) { doc.addPage(); y = M; pageHeader(); }
    const spent  = catTotals[cat.id] || 0;
    const budget = S.budgets[cat.id] || 0;
    const over   = budget > 0 && spent > budget;
    const pct    = budget > 0 ? Math.min(spent / budget, 1) : 0;
    const rowH   = 7;

    // Alternate row stripe
    if (idx % 2 === 0) fill(M, y - 1.5, W - 2 * M, rowH, C.stripe);

    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    doc.setTextColor(over ? 192 : 50, over ? 57 : 50, over ? 43 : 50);
    doc.text(getCat(cat.id).label.slice(0, 28), bc1, y + 2.5);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
    doc.text(fmtFull(spent), bc2, y + 2.5, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.gray);
    if (budget > 0) doc.text(fmtFull(budget), bc3, y + 2.5, { align: 'right' });

    // Mini progress bar
    const barX = bc4, barY = y + 1, barW = W - M - bc4, barH = 2.5;
    fillR(barX, barY, barW, barH, 0.8, C.rule);
    if (pct > 0) {
      const barColor = over ? C.red : pct > 0.8 ? C.orange : C.green;
      fillR(barX, barY, barW * pct, barH, 0.8, barColor);
    }
    if (budget > 0) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...(over ? C.red : C.gray));
      doc.text(`${Math.round(pct * 100)}%`, W - M, y + 4.5, { align: 'right' });
    }
    addY(rowH);
  });

  if (!activeCats.length) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...C.gray);
    doc.text('No budget or spending data for this period.', M, y); addY(8);
  }
  addY(6);

  // ─────────────────────────────────────────────────────────
  // TOP EXPENSES TABLE
  // ─────────────────────────────────────────────────────────
  if (y > 230) { doc.addPage(); y = M; pageHeader(); }
  section(t('pdf.top.expenses'));

  const tc1 = M, tc2 = M + 25, tc3 = M + 120, tc4 = W - M;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...C.gray);
  doc.text(t('pdf.col.date'),        tc1, y);
  doc.text(t('pdf.col.description'), tc2, y);
  doc.text('Category',               tc3, y);
  doc.text(t('pdf.col.amount'),      tc4, y, { align: 'right' });
  y += 2;
  doc.setDrawColor(...C.rule); doc.setLineWidth(0.15); doc.line(M, y, W - M, y);
  addY(3.5);

  const topExp = [...mExp].sort((a, b) => b.amount - a.amount).slice(0, 10);
  topExp.forEach((tx, idx) => {
    if (y > 270) { doc.addPage(); y = M; pageHeader(); }
    if (idx % 2 === 0) fill(M, y - 1.5, W - 2 * M, 7, C.stripe);

    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.mid);
    doc.text(tx.date || '', tc1, y + 2.5);
    doc.text((tx.description || '').slice(0, 44), tc2, y + 2.5);
    doc.setTextColor(...C.gray);
    doc.text(getCat(tx.category).label.slice(0, 18), tc3, y + 2.5);
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.red);
    doc.text(fmtFull(tx.amount), tc4, y + 2.5, { align: 'right' });
    addY(7);
  });

  if (!topExp.length) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...C.gray);
    doc.text('No expense transactions for this period.', M, y); addY(8);
  }
  addY(6);

  // ─────────────────────────────────────────────────────────
  // INCOME SOURCES
  // ─────────────────────────────────────────────────────────
  if (mInc.length) {
    if (y > 220) { doc.addPage(); y = M; pageHeader(); }
    section('Income This Month');

    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...C.gray);
    doc.text(t('pdf.col.date'),        tc1, y);
    doc.text(t('pdf.col.description'), tc2, y);
    doc.text(t('pdf.col.amount'),      tc4, y, { align: 'right' });
    y += 2;
    doc.setDrawColor(...C.rule); doc.setLineWidth(0.15); doc.line(M, y, W - M, y);
    addY(3.5);

    [...mInc].sort((a, b) => b.amount - a.amount).slice(0, 10).forEach((tx, idx) => {
      if (y > 270) { doc.addPage(); y = M; pageHeader(); }
      if (idx % 2 === 0) fill(M, y - 1.5, W - 2 * M, 7, C.stripe);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.mid);
      doc.text(tx.date || '', tc1, y + 2.5);
      doc.text((tx.description || '').slice(0, 58), tc2, y + 2.5);
      doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.green);
      doc.text(fmtFull(tx.amount), tc4, y + 2.5, { align: 'right' });
      addY(7);
    });
    addY(6);
  }

  // ─────────────────────────────────────────────────────────
  // SAVINGS GOALS
  // ─────────────────────────────────────────────────────────
  if (S.goals && S.goals.length) {
    if (y > 230) { doc.addPage(); y = M; pageHeader(); }
    section('Savings Goals');

    S.goals.forEach((goal, idx) => {
      if (y > 262) { doc.addPage(); y = M; pageHeader(); }
      const saved  = goal.saved  || 0;
      const target = goal.target || 1;
      const pct    = Math.min(saved / target, 1);
      const done   = pct >= 1;
      const gColor = done ? C.green : C.gold;

      if (idx % 2 === 0) fill(M, y - 1.5, W - 2 * M, 13, C.stripe);

      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...C.dark);
      doc.text((goal.name || 'Goal').slice(0, 34), M + 3, y + 2.5);

      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...C.gray);
      doc.text(`${fmtFull(saved)} / ${fmtFull(target)}`, W - M - 20, y + 2.5, { align: 'right' });
      doc.setFont('helvetica', 'bold'); doc.setTextColor(...gColor);
      doc.text(`${Math.round(pct * 100)}%`, W - M, y + 2.5, { align: 'right' });

      if (goal.deadline) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...C.gray);
        doc.text(`Deadline: ${goal.deadline}`, M + 3, y + 6.5);
      }

      // Progress bar
      const barX = M + 3, barY = y + 8.5, barW = W - 2 * M - 6, barH = 2.5;
      fillR(barX, barY, barW, barH, 1, C.rule);
      if (pct > 0) fillR(barX, barY, barW * pct, barH, 1, gColor);
      addY(14);
    });
    addY(4);
  }

  // ─────────────────────────────────────────────────────────
  // FOOTER ON EVERY PAGE
  // ─────────────────────────────────────────────────────────
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    // Bottom bar
    fill(0, H - 8, W, 8, C.dark);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...C.gold);
    doc.text('CASHFLOW.SYS', M, H - 3.5);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.gray);
    doc.text('Personal Finance Terminal', M + doc.getTextWidth('CASHFLOW.SYS') + 3, H - 3.5);
    doc.text(`${t('pdf.col.page')} ${i} / ${totalPages}`, W - M, H - 3.5, { align: 'right' });
    // Top gold bar on pages 2+
    if (i > 1) fill(0, 0, W, 3.5, C.gold);
  }

  doc.save(`cashflow-report-${reportYm}.pdf`);
  toast(t('toast.export.pdf'));
}

/** Alias that routes to the full PDF export with charts. */
function generatePDF() {
  exportPDFWithCharts();
}
