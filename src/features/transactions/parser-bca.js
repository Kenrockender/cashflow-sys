/**
 * CASHFLOW.SYS — BCA Tahapan Xpresi Parser
 * Handles: PDF e-Statement (Rekening Koran / Laporan Mutasi) from BCA
 *
 * Real format observed from actual statements (Jan 2025 – Feb 2026):
 *   - Date:   DD/MM  (year inferred from PERIODE header)
 *   - Type:   TRANSAKSI DEBIT | TRSF E-BANKING DB/CR | FLAZZ BCA | etc.
 *   - Amount: 1,234,567.89 DB  (DB suffix = debit; no suffix = credit)
 *   - QRIS merchant: embedded after "00000.00" prefix in description
 *
 * Usage:
 *   import { parseBCAStatement, parseBCAStatements, toAppTransactions } from './parser-bca.js';
 *
 *   // Single file
 *   const { transactions, meta } = await parseBCAStatement(file);
 *
 *   // Multiple files (full year)
 *   const { transactions } = await parseBCAStatements(fileList);
 *
 *   // Convert to CASHFLOW.SYS format
 *   const appTxs = toAppTransactions(transactions);
 */

// ─── Transaction Type Constants ───────────────────────────────────────────────

const TX = {
  TRANSAKSI_DEBIT:      'TRANSAKSI DEBIT',
  TRSF_DB:              'TRSF E-BANKING DB',
  TRSF_CR:              'TRSF E-BANKING CR',
  FLAZZ:                'FLAZZ BCA',
  BIAYA_ADM:            'BIAYA ADM',
  BUNGA:                'BUNGA',
  BUNGA_POKET:          'BUNGA POKET',
  PAJAK_BUNGA:          'PAJAK BUNGA',
  BI_FAST_DB:           'BI-FAST DB',
  BI_FAST_CR:           'BI-FAST CR',
  TARIKAN_ATM:          'TARIKAN ATM',
  TARIKAN_TUNAI:        'TARIKAN TUNAI',
  TARIKAN_PEMINDAHAN:   'TARIKAN PEMINDAHAN',
  SETORAN_CDM:          'SETORAN VIA CDM',
  SETORAN_TUNAI:        'SETORAN TUNAI',
  KR_OTOMATIS:          'KR OTOMATIS',
  BYR_EBANKING:         'BYR VIA E-BANKING',
  SWITCHING_CR:         'SWITCHING CR',
  SWITCHING_DB:         'SWITCHING DB',
  KARTU_DEBIT:          'KARTU DEBIT',
};

// Ordered by length descending so longer prefixes match first
const TX_TYPES_ORDERED = Object.values(TX).sort((a, b) => b.length - a.length);

// ─── Amount Helpers ───────────────────────────────────────────────────────────

/** "1,234,567.89" → 1234567.89 */
function parseAmount(str) {
  if (!str) return 0;
  return parseFloat(String(str).replace(/\s*DB\s*$/, '').replace(/,/g, '')) || 0;
}

/** True if the amount string ends with " DB" */
function isDebit(str) {
  return /\bDB\s*$/.test(String(str).trim());
}

// ─── Date Helpers ─────────────────────────────────────────────────────────────

/** "15/05" + "2025" → "2025-05-15" */
function buildDate(ddmm, year) {
  const parts = ddmm.split('/');
  if (parts.length !== 2) return null;
  const [dd, mm] = parts;
  return `${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

const MONTH_ID = {
  JANUARI: '01', FEBRUARI: '02', MARET: '03', APRIL: '04',
  MEI: '05', JUNI: '06', JULI: '07', AGUSTUS: '08',
  SEPTEMBER: '09', OKTOBER: '10', NOVEMBER: '11', DESEMBER: '12',
};

/** "MEI 2025" → "2025" */
function yearFromPeriod(periodStr) {
  const m = periodStr && periodStr.match(/(\d{4})/);
  return m ? m[1] : String(new Date().getFullYear());
}

// ─── Category Detection ───────────────────────────────────────────────────────

const CATEGORY_RULES = [
  // Food & Drink (based on real merchants in the statements)
  {
    cat: 'food',
    re: /depot\s*jeng|esb\s*restau|esb\.co|hhb\s*\d+|goy\s*coffee|nasi\s*(goren|kunin|uduk)|ayam\s*(kepra|sobbb|goren|goreng)|bakmi|bakpao|roti\s*keban|mcd\s|mcdonalds|warteg|warung|soto|kwetiau|pagi\s*sore|ck\s*binus|binus\s*kant|foodhall|runchise|putri\s*kali|bubur\s*ayam|suki\s*suki|ang\s*patiss|doner\s*keba|kebun\s*buah|daily\s*spm|mademan|persada\s*me|gorengan|kantin|warsun|dapur|logs\s*and|rm\s*anggrek|terra\s*char|michelle\s*b|bagoyam|ropangyuk|ong\s*lai\s*ju|waroeng\s*bs|asinan|kopi\s*sayap|kedai\s*kuwa|rm\s*ramayan|live\s*house|hotpot|resto|restoran|restaurant|cafe|bakery|sate|mie|mi\s+/i,
  },
  // Transport
  {
    cat: 'transport',
    re: /grab\s*trans|grab\s*food|goride|gocar|maxim|bensin|spbu|pertamina|parkir|tol\s|gojek|flazz/i,
  },
  // Shopping (e-commerce + retail)
  {
    cat: 'shopping',
    re: /tokopedia|shopee(?!pay)|lazada|blibli|cotton\s*on|aeon\s*store|hypermart|alfamart|indomaret|idm\s*indoma|circle\s*k|qios|remboelan|hexa\s*mitra|hairpotter|et\s*cetera|shop\s*and\s*d|tumbler|cosmic\s*bil|supermarket|fashion|clothing|apparel/i,
  },
  // Health & Medical
  {
    cat: 'health',
    re: /halodoc|lp\s*medica|apotik|apotek|klinik|rumah\s*sakit|rs\s|dokter|obat|bpjs|kimia\s*farma|guardian|century|farmasi/i,
  },
  // Bills & Utilities
  {
    cat: 'bills',
    re: /pln\s*iconpay|listrik|pdam|telkom(?!sel)|xl\s+|telkomsel|indosat|tri\s+|ipl\s|kpr|biaya\s*adm|hsbc|cimb\s*niaga|pajak\s*bunga/i,
  },
  // Entertainment & Lifestyle
  {
    cat: 'entertainment',
    re: /netflix|spotify|disney|bioskop|cgv|bowling|hubbit|vfs\s*servic|ssb\s*cab|cosmic\s*bil|live\s*music|konser|ropangyuk/i,
  },
  // Education
  {
    cat: 'education',
    re: /binus|spp\s|ukt\s|kuliah|sekolah|kursus|udemy|coursera/i,
  },
  // Savings & Investments (Pluang, Pintu crypto, Indo Premier stocks, Bibit)
  {
    cat: 'savings',
    re: /pluang\s*emas|kki.?pintu|\/pintu|bibit\.id|indo\s*premier|indopremier|ipot|sinar\s*digital|pluang/i,
  },
  // Donations & Social
  {
    cat: 'social',
    re: /yayasan|donasi|panti\s*asuhan/i,
  },
  // Housing & Property
  {
    cat: 'housing',
    re: /pgdp|hps\s*atsb|atsb\s*18|dewi\s*oktasari|sewa|kontrakan/i,
  },
  // Grooming / Personal Care
  {
    cat: 'personal',
    re: /hairpotter|salon|barbershop|spa\s/i,
  },
  // Subscriptions
  {
    cat: 'subscriptions',
    re: /shopeepay|gopay|ovo|dana\s+|netflix|spotify/i,
  },
];

function detectCategory(description, txType, debitTx) {
  // Fixed categories by transaction type
  if (txType === TX.BIAYA_ADM)         return 'bills';
  if (txType === TX.PAJAK_BUNGA)       return 'bills';
  if (txType === TX.BUNGA)             return 'income';
  if (txType === TX.BUNGA_POKET)       return 'income';
  if (txType === TX.FLAZZ)             return 'transport';
  if (txType === TX.TARIKAN_ATM)       return 'other';
  if (txType === TX.TARIKAN_TUNAI)     return 'other';
  if (txType === TX.TARIKAN_PEMINDAHAN)return 'other';
  if (txType === TX.SETORAN_CDM)       return 'income';
  if (txType === TX.SETORAN_TUNAI)     return 'income';
  if (txType === TX.KR_OTOMATIS)       return 'income';
  if (txType === TX.SWITCHING_CR)      return 'income';

  // Match against description patterns
  const combined = description.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.re.test(combined)) return rule.cat;
  }

  // GoPay/ShopeePay/OVO top-ups are outgoing wallet loads (treat as subscriptions/other)
  if (/gopay\s*transf|shopeepay|ovo$/i.test(combined) && debitTx) return 'other';

  return debitTx ? 'other' : 'income';
}

// ─── Description Builder ──────────────────────────────────────────────────────

function isNoiseLine(line) {
  return (
    /^\d{4}\/FT[A-Z]+\/WS\d+$/.test(line) ||
    /^\d+\.\d{2}$/.test(line) ||
    /^-+$/.test(line) ||
    /^\d{10,}$/.test(line) ||
    /^Q\d{3,}[A-Z0-9]*$/.test(line) ||
    /^@/.test(line) ||
    /^BIF\s/.test(line) ||
    /^NTRF@/.test(line) ||
    /^RTGS-/.test(line) ||
    /^\d{2}\/\d{2}\s+WSID/.test(line) ||
    /^TGL:\s*\d{2}\/\d{2}$/.test(line) ||
    /^QR\s+\d{3}$/.test(line) ||
    /^QRC?\d{3}$/.test(line) ||
    /^TANGGAL\s*:/.test(line)
  );
}

function buildDescription(descLines, txType) {
  // For QRIS/TRANSAKSI DEBIT: extract merchant name after "00000.00"
  const qrisLine = descLines.find(l => /00000\.00/.test(l));
  if (qrisLine) {
    const merchant = qrisLine.replace(/.*00000\.00/, '').replace(/_/g, ' ').trim();
    if (merchant) return merchant;
  }

  // Filter noise, keep meaningful lines
  const clean = descLines.filter(l => !isNoiseLine(l));

  // For transfers, last clean line is usually the counterparty name
  if (clean.length > 0) {
    // If there's a memo (shorter line before the name), include it
    const last = clean[clean.length - 1];
    const memo = clean.length > 1 ? clean[clean.length - 2] : '';
    // Memo is usually lowercase/mixed (user typed it), name is UPPERCASE
    if (memo && memo !== last && !/^[A-Z\s]+$/.test(memo)) {
      return `${last} (${memo})`;
    }
    return last;
  }

  // Fallbacks by type
  const fallbacks = {
    [TX.BIAYA_ADM]:          'Biaya Administrasi',
    [TX.BUNGA]:               'Bunga Tabungan',
    [TX.BUNGA_POKET]:         'Bunga Poket',
    [TX.PAJAK_BUNGA]:         'Pajak Bunga',
    [TX.FLAZZ]:               'Flazz BCA Top Up',
    [TX.TARIKAN_ATM]:         'Tarik Tunai ATM',
    [TX.TARIKAN_TUNAI]:       'Tarik Tunai',
    [TX.TARIKAN_PEMINDAHAN]:  'Pemindahan Dana',
    [TX.SETORAN_CDM]:         'Setoran Tunai (CDM)',
    [TX.SETORAN_TUNAI]:       'Setoran Tunai',
    [TX.KR_OTOMATIS]:         'Kredit Otomatis',
    [TX.SWITCHING_CR]:        'Transfer Masuk (Switch)',
    [TX.SWITCHING_DB]:        'Transfer Keluar (Switch)',
    [TX.BYR_EBANKING]:        'Pembayaran via E-Banking',
  };

  return fallbacks[txType] || txType;
}

// ─── Page Text Parser ─────────────────────────────────────────────────────────

const DATE_LINE_RE = /^(\d{2}\/\d{2})\s+(.+)$/;
const AMOUNT_RE    = /^([\d,]+\.\d{2})\s*(DB)?\s*$/;

function parsePageText(pageText, year) {
  const transactions = [];
  const lines = pageText
    .split(/\n/)
    .map(l => l.replace(/\s{2,}/g, ' ').trim())
    .filter(Boolean);

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const dateMatch = line.match(DATE_LINE_RE);

    if (!dateMatch) { i++; continue; }

    const [, datePart, rest] = dateMatch;

    // Skip non-transaction date rows
    if (/^SALDO\s+(AWAL|AKHIR)|^MUTASI\s+(CR|DB)|^HALAMAN|^TANGGAL\s|^PERIODE|^NO\.?\s*REK/i.test(rest)) {
      i++; continue;
    }

    // Match transaction type
    let txType = null;
    for (const t of TX_TYPES_ORDERED) {
      if (rest.startsWith(t)) { txType = t; break; }
    }
    if (!txType) { i++; continue; }

    // Everything after the type on the same line is the first desc line
    const firstDescLine = rest.slice(txType.length).trim();
    const descLines = firstDescLine ? [firstDescLine] : [];

    // Look ahead for description lines and then the amount
    let amountStr = '';
    let j = i + 1;

    while (j < lines.length && j - i < 12) {
      const next = lines[j];

      // Stop if we hit a new date+type line (not a date-only line)
      if (DATE_LINE_RE.test(next)) {
        const [, , nextRest] = next.match(DATE_LINE_RE);
        if (TX_TYPES_ORDERED.some(t => nextRest.startsWith(t)) ||
            /^SALDO\s+AWAL/i.test(nextRest)) {
          break;
        }
      }

      // Check for amount line
      const amtMatch = next.match(AMOUNT_RE);
      if (amtMatch) {
        amountStr = amtMatch[1] + (amtMatch[2] ? ' DB' : '');
        j++;
        // Consume the balance line that often follows immediately
        if (j < lines.length && /^[\d,]+\.\d{2}$/.test(lines[j])) j++;
        break;
      }

      descLines.push(next);
      j++;
    }

    if (!amountStr) { i++; continue; }

    const amount = parseAmount(amountStr);
    if (amount === 0) { i = j; continue; }

    const debitTx = isDebit(amountStr);
    const date    = buildDate(datePart, year);
    const desc    = buildDescription(descLines, txType);
    const cat     = detectCategory(desc, txType, debitTx);

    transactions.push({
      date,
      type:        debitTx ? 'expense' : 'income',
      amount,
      description: desc,
      category:    cat,
      txType,
    });

    i = j;
  }

  return transactions;
}

// ─── Metadata Extractor ───────────────────────────────────────────────────────

function extractMeta(fullText) {
  const meta = {
    accountNo:       '',
    period:          '',
    year:            String(new Date().getFullYear()),
    openingBalance:  0,
    closingBalance:  0,
    accountType:     'main', // 'main' | 'poket'
    poketLabel:      '',
  };

  const acctMatch   = fullText.match(/NO\.?\s*REKENING\s*[:\s]+([\d]+)/);
  if (acctMatch) meta.accountNo = acctMatch[1].trim();

  const periodMatch = fullText.match(/PERIODE\s*[:\s]+([A-Z]+\s+\d{4})/);
  if (periodMatch) {
    meta.period = periodMatch[1].trim();
    meta.year   = yearFromPeriod(meta.period);
  }

  const openMatch = fullText.match(/SALDO\s+AWAL\s*[:\s]+([\d,]+\.\d{2})/);
  if (openMatch) meta.openingBalance = parseAmount(openMatch[1]);

  const closeMatch = fullText.match(/SALDO\s+AKHIR\s*[:\s]+([\d,]+\.\d{2})/);
  if (closeMatch) meta.closingBalance = parseAmount(closeMatch[1]);

  if (/POKET\s+RUPIAH|FASILITAS\s*[:\s]+POKET/i.test(fullText)) {
    meta.accountType = 'poket';
    const ketMatch = fullText.match(/KETERANGAN\s*[:\s]+([^\n]+)/);
    if (ketMatch) meta.poketLabel = ketMatch[1].trim();
  }

  return meta;
}

// ─── PDF Text Extraction ──────────────────────────────────────────────────────

/**
 * Extract text from a PDF using PDF.js (pdfjsLib must be loaded globally).
 * Preserves line structure by detecting vertical position breaks.
 */
async function extractPDFText(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items = content.items;

    // Sort by Y descending (top of page first), then X ascending
    const sorted = [...items].sort((a, b) => {
      const dy = b.transform[5] - a.transform[5];
      return Math.abs(dy) > 3 ? dy : a.transform[4] - b.transform[4];
    });

    let pageText = '';
    let lastY = null;
    for (const item of sorted) {
      const y = item.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 3) pageText += '\n';
      pageText += item.str + ' ';
      lastY = y;
    }

    pages.push(pageText.trim());
  }

  return { pages, fullText: pages.join('\n') };
}

// ─── Deduplication ────────────────────────────────────────────────────────────

function deduplicate(transactions) {
  const seen = new Set();
  return transactions.filter(tx => {
    const key = `${tx.date}|${tx.amount}|${tx.txType}|${tx.description}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Detect if a text blob is from a BCA statement.
 */
function isBCAStatement(text) {
  return /REKENING\s+TAHAPAN|BANK\s+CENTRAL\s+ASIA|KCP\s+.*BCA|LAPORAN\s+MUTASI/i.test(text);
}

/**
 * Parse a single BCA PDF e-Statement file.
 *
 * @param {File} file
 * @returns {Promise<{transactions, meta, summary, warnings, skipped?}>}
 */
async function parseBCAStatement(file) {
  const warnings = [];

  let extracted;
  try {
    extracted = await extractPDFText(file);
  } catch (err) {
    throw new Error(`Gagal membaca PDF "${file.name}": ${err.message}`);
  }

  const { fullText, pages } = extracted;

  if (!isBCAStatement(fullText)) {
    throw new Error(
      `"${file.name}" bukan laporan mutasi BCA. ` +
      'Pastikan file yang diupload adalah e-Statement BCA (Rekening Koran).'
    );
  }

  const meta = extractMeta(fullText);

  if (!meta.year) {
    warnings.push('Tahun tidak ditemukan di header, menggunakan tahun berjalan.');
    meta.year = String(new Date().getFullYear());
  }

  // Skip Poket sub-accounts — they are internal savings buckets
  if (meta.accountType === 'poket') {
    return {
      transactions: [],
      meta,
      summary: { totalIn: 0, totalOut: 0, count: 0 },
      warnings: [`Rekening Poket "${meta.poketLabel || ''}" dilewati.`],
      skipped: true,
    };
  }

  // Parse each page
  const raw = pages.flatMap(p => parsePageText(p, meta.year));
  const transactions = deduplicate(raw).sort((a, b) => a.date.localeCompare(b.date));

  if (transactions.length === 0) {
    warnings.push(`Tidak ada transaksi yang berhasil diparsing dari "${file.name}".`);
  }

  return {
    transactions,
    meta,
    summary: {
      totalIn:  transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
      totalOut: transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
      count: transactions.length,
    },
    warnings,
  };
}

/**
 * Parse multiple BCA statement PDFs at once (e.g. a full year).
 * Automatically merges and deduplicates across files.
 *
 * @param {FileList|File[]} files
 * @returns {Promise<{transactions, metas, summary, warnings}>}
 */
async function parseBCAStatements(files) {
  const results = await Promise.all(Array.from(files).map(f => parseBCAStatement(f).catch(err => ({
    transactions: [],
    meta: { accountNo: '', period: f.name },
    summary: { totalIn: 0, totalOut: 0, count: 0 },
    warnings: [err.message],
    skipped: true,
  }))));

  const warnings  = results.flatMap(r => r.warnings || []);
  const metas     = results.filter(r => !r.skipped).map(r => r.meta);
  const merged    = results.flatMap(r => r.transactions);
  const transactions = deduplicate(merged).sort((a, b) => a.date.localeCompare(b.date));

  return {
    transactions,
    metas,
    summary: {
      totalIn:  transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
      totalOut: transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
      count:    transactions.length,
      months:   [...new Set(transactions.map(t => t.date.slice(0, 7)))].sort(),
    },
    warnings,
  };
}

/**
 * Convert parsed BCA transactions to CASHFLOW.SYS internal format.
 * Adjust field names here if your app.js uses different keys.
 *
 * @param {Array} bcaTransactions - output of parseBCAStatement / parseBCAStatements
 * @returns {Array} app-ready transaction objects
 */
function toAppTransactions(bcaTransactions) {
  return bcaTransactions.map((tx, i) => ({
    id:          `bca_${tx.date}_${i}_${tx.amount}`,
    date:        tx.date,           // "YYYY-MM-DD"
    type:        tx.type,           // "income" | "expense"
    amount:      tx.amount,         // number (IDR)
    category:    tx.category,       // matches CASHFLOW.SYS categories
    description: tx.description,    // cleaned merchant / counterparty name
    note:        tx.txType,         // raw BCA transaction type
    currency:    'IDR',
    source:      'BCA Import',
  }));
}

// ─── Category Reference ───────────────────────────────────────────────────────
// Categories used (must match your constants.js):
//   'food', 'transport', 'shopping', 'health', 'bills',
//   'entertainment', 'education', 'personal', 'housing',
//   'subscriptions', 'social', 'savings', 'income', 'other'
