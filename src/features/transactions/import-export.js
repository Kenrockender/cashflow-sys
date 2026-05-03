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
async function exportPDFWithCharts() {
  if (!window.jspdf) { toast(t('toast.export.error')); return; }
  const { jsPDF } = window.jspdf;
  toast(t('toast.pdf.generating'));

  const doc  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, M = 15;
  let y = M;
  const addY = (n = 5) => { y += n; if (y > 274) { doc.addPage(); y = M; } };

  // ── Header ──────────────────────────────────────────────
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(200, 169, 110);
  doc.text('CASHFLOW.SYS', M, y); addY(6);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(130, 130, 130);
  doc.text(`${t('pdf.generated')} ${new Date().toLocaleDateString()}  ·  ${thisMonth()}`, M, y); addY(10);

  // ── Month summary ────────────────────────────────────────
  const tmon = thisMonth();
  const TV   = getTxView();
  const mExp = TV.filter(tx => tx.date?.startsWith(tmon) && isExpenseTx(tx));
  const mInc = TV.filter(tx => tx.date?.startsWith(tmon) && isIncomeTx(tx));
  const totE = sum(mExp), totI = sum(mInc), net = totI - totE;
  const totB = Object.values(S.budgets).reduce((a, b) => a + b, 0);

  doc.setDrawColor(200, 169, 110); doc.setLineWidth(0.2); doc.line(M, y, W - M, y); addY(4);
  for (const [lbl, val, r, g2, b2] of [
    [t('pdf.income'),  fmtFull(totI), 39,  174, 96],
    [t('pdf.expense'), fmtFull(totE), 200, 169, 110],
    [t('pdf.net'),     (net >= 0 ? '+' : '') + fmtFull(net), ...(net >= 0 ? [39, 174, 96] : [192, 57, 43])],
    ['Budget',         fmtFull(totB), 150, 150, 150],
  ]) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(80, 80, 80);
    doc.text(lbl, M, y);
    doc.setFont('helvetica', 'bold'); doc.setTextColor(r, g2, b2);
    doc.text(val, W - M, y, { align: 'right' });
    addY(5);
  }
  doc.line(M, y, W - M, y); addY(8);

  // ── Budget breakdown ─────────────────────────────────────
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(200, 169, 110);
  doc.text(t('pdf.budget.breakdown'), M, y); addY(6);

  const catTotals = {};
  for (const tx of mExp) catTotals[tx.category] = (catTotals[tx.category] || 0) + tx.amount;
  const colW = (W - 2 * M) / 3;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(120, 120, 120);
  doc.text(t('pdf.col.category'), M, y);
  doc.text(t('pdf.col.spent'),    M + colW, y, { align: 'right' });
  doc.text(t('pdf.col.budget'),   W - M, y, { align: 'right' });
  addY(4);

  for (const cat of getAllCategories()) {
    const spent  = catTotals[cat.id] || 0;
    const budget = S.budgets[cat.id] || 0;
    if (!spent && !budget) continue;
    const over = budget > 0 && spent > budget;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.setTextColor(over ? 192 : 50, over ? 57 : 50, over ? 43 : 50);
    doc.text(getCat(cat.id).label.slice(0, 22), M, y);
    doc.text(fmtFull(spent), M + colW, y, { align: 'right' });
    if (budget > 0) doc.text(fmtFull(budget), W - M, y, { align: 'right' });
    addY(5);
  }
  addY(5);

  // ── Top expenses ─────────────────────────────────────────
  if (y > 240) { doc.addPage(); y = M; }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(200, 169, 110);
  doc.text(t('pdf.top.expenses'), M, y); addY(6);

  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(120, 120, 120);
  doc.text(t('pdf.col.date'),        M, y);
  doc.text(t('pdf.col.description'), M + 22, y);
  doc.text(t('pdf.col.amount'),      W - M, y, { align: 'right' });
  addY(4);

  const topExp = [...mExp].sort((a, b) => b.amount - a.amount).slice(0, 10);
  for (const tx of topExp) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(50, 50, 50);
    doc.text(tx.date || '',                       M, y);
    doc.text((tx.description || '').slice(0, 38), M + 22, y);
    doc.text(fmtFull(tx.amount),                  W - M, y, { align: 'right' });
    addY(5);
  }

  // ── Page numbers ─────────────────────────────────────────
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(150, 150, 150);
    doc.text(`${t('pdf.col.page')} ${i} ${t('pdf.col.of')} ${totalPages}`, W / 2, 291, { align: 'center' });
  }

  doc.save(`cashflow-report-${todayKey()}.pdf`);
  toast(t('toast.export.pdf'));
}

/** Alias that routes to the full PDF export with charts. */
function generatePDF() {
  exportPDFWithCharts();
}
