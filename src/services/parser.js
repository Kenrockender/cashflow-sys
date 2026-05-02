/* ══════════════════════════════════════════════════════════
   CASHFLOW.SYS — parser.js
   NLP transaction parser + bank statement import.
   Depends on: constants.js (CAT_KW, INCOME_KW, SHORTHANDS)
══════════════════════════════════════════════════════════ */

/* ── NLP PARSER ──────────────────────────────────────────── */
const Parser = (() => {
  const extractAmt = text => {
    const pats = [
      /(\d+[.,]?\d*)\s*(rb|ribu|k|jt|juta|m)\b/i,
      /rp\.?\s*(\d[\d.,]*)/i,
      /\b(\d[\d.,]*)\b/,
    ];
    for (const p of pats) {
      const m = text.match(p);
      if (!m) continue;
      let n = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
      const s = (m[2] || '').toLowerCase();
      const x = SHORTHANDS[s] || 1;
      if (!isNaN(n) && n > 0) return Math.round(n * x);
    }
    return null;
  };

  const detectCat = text => {
    const l = text.toLowerCase();
    let best = 'other', sc = 0;
    for (const [c, kws] of Object.entries(CAT_KW))
      for (const kw of kws)
        if (l.includes(kw) && kw.length > sc) { sc = kw.length; best = c; }
    return best;
  };

  const detectType = text => {
    const l = text.toLowerCase();
    for (const kw of INCOME_KW) if (l.includes(kw)) return 'income';
    return 'expense';
  };

  const cleanDesc = text => text
    .replace(/rp\.?\s*\d[\d.,]*/gi, '')
    .replace(/\d+[.,]?\d*\s*(rb|ribu|k|jt|juta)\b/gi, '')
    .replace(/\b\d{4,}\b/g, '')
    .replace(/\s+/g, ' ').trim();

  const parseLocal = text => {
    const type     = detectType(text);
    const category = type === 'income' ? 'income' : detectCat(text);
    return { amount: extractAmt(text), type, category, description: cleanDesc(text) || text, date: todayKey(), note: '' };
  };

  const isSpeechSupported = () => !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const startVoice = (onR, onE) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    const r = new SR();
    r.lang = 'id-ID'; r.interimResults = true; r.continuous = false;
    r.onresult = e => {
      const res = Array.from(e.results);
      onR(res.map(r => r[0].transcript).join(''), res[res.length - 1].isFinal);
    };
    r.onend = onE; r.onerror = onE;
    try { r.start(); } catch (e) { onE(); return null; }
    return r;
  };

  return { parseLocal, detectCat, detectType, startVoice, isSpeechSupported };
})();

/* ── IMPORT PARSER ───────────────────────────────────────── */
const ImportParser = (() => {
  /* ── BCA-specific amount parser ────────────────────────────
     BCA uses period as thousands separator, comma as decimal.
     e.g. "1,167,800.00" or "17,000.00 DB" — wait, actually
     looking at the statements: "3,000,000.00" (commas = thousands, dot = decimal)
     BUT some lines show "1.167.800,00" style — need to handle both.
     From the actual PDFs: amounts are like "3,000,000.00" format.
  ──────────────────────────────────────────────────────────── */
  const parseIDR = s => {
    if (!s) return 0;
    let c = String(s).trim().replace(/\s*DB\s*$/i, '').trim();
    // Remove currency symbol if present
    c = c.replace(/^Rp\.?\s*/i, '');
    // BCA format: 1,234,567.89 (comma thousands, dot decimal)
    // Also handle: 1.234.567,89 (dot thousands, comma decimal)
    if (/^\d{1,3}(\.\d{3})+(,\d{2})?$/.test(c)) {
      // European format: 1.234.567,89
      c = c.replace(/\./g, '').replace(',', '.');
    } else {
      // US/BCA format: 1,234,567.89
      c = c.replace(/,/g, '');
    }
    return Math.round(parseFloat(c) || 0);
  };

  const normDate = (raw, year) => {
    if (!raw) return null;
    // DD/MM format (BCA statement uses DD/MM without year)
    const m2 = raw.match(/^(\d{1,2})\/(\d{1,2})$/);
    if (m2 && year) {
      return `${year}-${m2[2].padStart(2, '0')}-${m2[1].padStart(2, '0')}`;
    }
    // DD/MM/YYYY
    const m3 = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m3) return `${m3[3]}-${m3[2].padStart(2, '0')}-${m3[1].padStart(2, '0')}`;
    // YYYY-MM-DD already
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    return null;
  };

  const detectBank = text => {
    const l = text.toLowerCase();
    if (l.includes('bank central asia') || l.includes('klikbca') || /\bbca\b/.test(l) ||
    l.includes('rekening tahapan') || l.includes('tahapan xpresi') || l.includes('laporan mutasi')) return 'bca';
    if (l.includes('bank mandiri') || /\bmandiri\b/.test(l)) return 'mandiri';
    if (l.includes('bank negara indonesia') || /\bbni\b/.test(l)) return 'bni';
    if (l.includes('bank rakyat indonesia') || /\bbri\b/.test(l)) return 'bri';
    if (l.includes('gopay') || l.includes('gojek')) return 'gopay';
    if (l.includes('ovo')) return 'ovo';
    if (l.includes('dana')) return 'dana';
    return 'generic';
  };

  /* ══════════════════════════════════════════════════════════
     BCA PARSER — Handles Rekening Tahapan Xpresi format
     
     The BCA PDF when extracted produces text like:
     
     01/12 SALDO AWAL 653,839.24
     01/12 TRSF E-BANKING CR 0112/FTSCY/WS95271
     3000000.00
     KENNETH FLYNN GUNA
     3,000,000.00 3,653,839.24
     03/12 TRANSAKSI DEBIT TGL: 03/12
     QR 200
     00000.00WARTEG GRA
     17,000.00 DB
     
     Strategy: group lines into transaction blocks by DD/MM date prefix,
     then parse each block for description, amount, and CR/DB direction.
  ══════════════════════════════════════════════════════════ */
  const parseBCA = (text, year) => {
    const txs = [];
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    // Extract year from document if not provided
    if (!year) {
      const yearMatch = text.match(/PERIODE\s*:\s*(\w+)\s+(\d{4})/i);
      if (yearMatch) year = yearMatch[2];
      else year = new Date().getFullYear().toString();
    }

    // Month map for periode detection
    const MONTHS = {
      januari:1, februari:2, maret:3, april:4, mei:5, juni:6,
      juli:7, agustus:8, september:9, oktober:10, november:11, desember:12,
      january:1, february:2, march:3, april:4, may:5, june:6,
      july:7, august:8, september:9, october:10, november:11, december:12,
    };

    // Lines to skip (metadata, headers, footers)
    const SKIP_PATTERNS = [
      /^SALDO AWAL/i,
      /^SALDO AKHIR/i,
      /^MUTASI (CR|DB)/i,
      /^HALAMAN\s*:/i,
      /^PERIODE\s*:/i,
      /^MATA UANG\s*:/i,
      /^NO\. REKENING\s*:/i,
      /^TANGGAL\s+KETERANGAN/i,
      /^Bersambung ke halaman/i,
      /^REKENING TAHAPAN/i,
      /^KCP /i,
      /^KENNETH FLYNN/i,
      /^KELAPA DUA/i,
      /^CURUG SANGERENG/i,
      /^AMETHYST BARAT/i,
      /^TANGERANG/i,
      /^INDONESIA/i,
      /^Apabila nasabah/i,
      /^Rekening ini/i,
      /^telah menyetujui/i,
      /^BCA berhak/i,
      /^Laporan Mutasi/i,
      /^CATATAN:/i,
      /^FASILITAS\s*:/i,
      /^KETERANGAN\s*:/i,
      /^\s*•\s*/,
      /^\d+\s*\/\s*\d+\s*$/, // page numbers like "1 /4"
    ];

    const shouldSkip = l => SKIP_PATTERNS.some(p => p.test(l));

    // Split into transaction blocks
    // Each block starts with a line beginning with DD/MM date
    const DATE_RE = /^(\d{2}\/\d{2})\s+(.+)$/;
    const blocks = [];
    let currentBlock = null;

    for (const line of lines) {
      if (shouldSkip(line)) continue;
      const dm = line.match(DATE_RE);
      if (dm) {
        if (currentBlock) blocks.push(currentBlock);
        currentBlock = { date: dm[1], lines: [dm[2]] };
      } else if (currentBlock) {
        currentBlock.lines.push(line);
      }
    }
    if (currentBlock) blocks.push(currentBlock);

    // Process each block
    for (const block of blocks) {
      const fullText = block.lines.join(' ').trim();

      // Skip metadata blocks
      if (/^SALDO AWAL/i.test(fullText)) continue;
      if (/^SALDO AKHIR/i.test(fullText)) continue;
      if (/^MUTASI (CR|DB)/i.test(fullText)) continue;
      if (/^BUNGA\b/i.test(fullText) && !/^BUNGA POKET/i.test(fullText)) {
        // Interest — skip unless it's significant
        const interestAmt = extractAmountFromBlock(fullText);
        if (!interestAmt || interestAmt < 1000) continue;
      }
      if (/^PAJAK BUNGA/i.test(fullText)) continue;
      if (/^BIAYA ADM/i.test(fullText)) {
        // Bank admin fee — record as expense
        const date = normDate(block.date, year);
        if (date) {
          txs.push({
            date,
            description: 'Biaya Administrasi BCA',
            amount: 10000,
            type: 'expense',
            category: 'bills',
            note: 'Import BCA',
          });
        }
        continue;
      }

      const date = normDate(block.date, year);
      if (!date) continue;

      // Determine if credit or debit
      const isDebit = determineDebit(fullText);

      // Extract amount
      const amount = extractAmountFromBlock(fullText);
      if (!amount || amount <= 0) continue;

      // Build clean description
      const desc = buildDescription(block.lines, fullText);
      if (!desc || desc.length < 2) continue;

      // Determine transaction type & category
      const type = isDebit ? 'expense' : 'income';
      const category = type === 'income' ? 'income' : categorize(desc, fullText);

      txs.push({ date, description: desc, amount, type, category, note: 'Import BCA' });
    }

    return txs;
  };

  /* ── Determine if a block is debit (expense) ──────────────
     Rules:
     1. Explicit "DB" suffix on amount → debit
     2. Transaction type contains "TRANSAKSI DEBIT" → debit
     3. "TRSF E-BANKING DB" → debit
     4. "TARIKAN ATM" / "TARIKAN TUNAI" / "KARTU DEBIT" → debit
     5. "BI-FAST DB" → debit
     6. "FLAZZ BCA TOPUP" → debit
     7. "BYR VIA E-BANKING" → debit
     8. "TRSF E-BANKING CR" / "BI-FAST CR" / "KR OTOMATIS" / "SWITCHING CR" / "SETORAN" → credit
     9. "BI-FAST CR" → credit
  ────────────────────────────────────────────────────────── */
  const determineDebit = text => {
    const t = text.toUpperCase();

    // Explicit credit signals
    if (/TRSF E-BANKING CR\b/.test(t)) return false;
    if (/BI-FAST CR\b/.test(t)) return false;
    if (/KR OTOMATIS/.test(t)) return false;
    if (/SWITCHING CR\b/.test(t)) return false;
    if (/SETORAN VIA CDM/.test(t)) return false;
    if (/SETORAN TUNAI/.test(t)) return false;
    if (/BUNGA POKET/.test(t)) return false;
    if (/^BUNGA\b/.test(t)) return false;

    // Explicit debit signals
    if (/TRANSAKSI DEBIT/.test(t)) return true;
    if (/TRSF E-BANKING DB\b/.test(t)) return true;
    if (/BI-FAST DB\b/.test(t)) return true;
    if (/TARIKAN ATM/.test(t)) return true;
    if (/TARIKAN TUNAI/.test(t)) return true;
    if (/TARIKAN PEMINDAHAN/.test(t)) return true;
    if (/KARTU DEBIT/.test(t)) return true;
    if (/FLAZZ BCA TOPUP/.test(t)) return true;
    if (/BYR VIA E-BANKING/.test(t)) return true;
    if (/BIAYA ADM/.test(t)) return true;
    if (/BIAYA TXN/.test(t)) return true;

    // Amount ends with " DB"
    if (/\d[\d,.]+\s+DB\b/.test(t)) return true;

    // Default: if there's any DB tag, it's debit
    return /\bDB\b/.test(t);
  };

  /* ── Extract the transaction amount from block text ────────
     Strategy: find the LAST amount that's followed by "DB" or
     a saldo (balance), or the second-to-last standalone amount.
     
     BCA format has amounts in the pattern:
     "17,000.00 DB" (debit)
     "3,000,000.00 3,653,839.24" (credit: tx amount + new balance)
     
     The transaction amount is always BEFORE the final balance figure.
  ────────────────────────────────────────────────────────── */
  const extractAmountFromBlock = text => {
    // Match all IDR amounts in the text (comma thousands, dot decimal)
    const AMT_RE = /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(DB)?/g;
    const amounts = [];
    let m;
    while ((m = AMT_RE.exec(text)) !== null) {
      const val = parseIDR(m[1]);
      if (val >= 100) { // ignore tiny amounts that might be junk
        amounts.push({ val, isDB: !!m[2], pos: m.index });
      }
    }
    if (!amounts.length) return 0;

    // If there's a DB-tagged amount, use the largest one tagged DB
    // (sometimes there's a tiny biaya/fee line too)
    const dbAmts = amounts.filter(a => a.isDB);
    if (dbAmts.length) {
      return dbAmts.reduce((max, a) => a.val > max ? a.val : max, 0);
    }

    // For credit transactions: "amount balance" — take the FIRST of the last two
    // Or if only one amount, use it
    if (amounts.length === 1) return amounts[0].val;

    // Multiple amounts: the tx amount is usually the second-to-last
    // (last is the running saldo), but filter out unrealistically large saldos
    // by taking the smaller of the last two
    const last = amounts[amounts.length - 1].val;
    const prev = amounts[amounts.length - 2].val;

    // If last is much bigger than prev, last is likely the saldo
    if (last > prev * 2) return prev;
    // If they're similar, take the first one (earlier in text = transaction)
    return amounts[0].val;
  };

  /* ── Build a human-readable description from block lines ───
     Removes: dates, QR codes, amounts, technical codes (WS95271, etc.)
     Keeps: merchant names, transfer notes, reference info
  ────────────────────────────────────────────────────────── */
  const buildDescription = (lines, fullText) => {
    const upper = fullText.toUpperCase();

    // TRANSAKSI DEBIT — extract merchant name from QR description
    // Format: "TGL: 03/12 QR 200 00000.00WARTEG GRA" → "WARTEG GRA"
    const qrMerchant = fullText.match(/\d{5,}\.?\d*([A-Z][A-Za-z0-9 ,&'.!-]{2,})/);
    if (/TRANSAKSI DEBIT/.test(upper) && qrMerchant) {
      return titleCase(qrMerchant[1].trim());
    }
    if (/KARTU DEBIT/.test(upper) && qrMerchant) {
      return titleCase(qrMerchant[1].trim());
    }

    // TRSF E-BANKING CR/DB — extract note + recipient/sender name
    // Format: "0112/FTSCY/WS95271 3000000.00 KENNETH FLYNN GUNA" or with a memo
    const trsfMatch = fullText.match(/(?:TRSF E-BANKING (?:CR|DB)|BI-FAST (?:CR|DB))\s+([\s\S]+)/i);
    if (trsfMatch) {
      const rest = trsfMatch[1];
      // Lines: code / amount / memo / name
      const parts = rest.split(/\s+/);
      const textParts = parts.filter(p =>
        !/^\d/.test(p) &&               // not starting with digit
        p.length > 1 &&
        !/^(WS\d+|FTSCY|FTFVA|FTQRS|FTSAI|ACSCY|FTSAI)$/i.test(p) && // not transfer codes
        !/^-$/.test(p)
      );
      // The last few text parts are usually the name; earlier ones are memos
      // Prefer memo (note from sender) over name
      const nameParts = textParts.filter(p =>
        /^[A-Z]/.test(p) && p.length > 2
      );
      if (nameParts.length) {
        // Check if there's a meaningful memo (not just the sender name)
        const memo = extractTransferMemo(lines);
        if (memo && memo.toLowerCase() !== nameParts.join(' ').toLowerCase()) {
          const senderName = nameParts.slice(-2).join(' ');
          const txType = /CR\b/.test(upper) ? 'Transfer dari' : 'Transfer ke';
          return `${txType} ${titleCase(senderName)}${memo ? ` (${memo})` : ''}`;
        }
        const senderName = nameParts.join(' ');
        const txType = /TRSF E-BANKING CR|BI-FAST CR/.test(upper) ? 'Transfer dari' : 'Transfer ke';
        return `${txType} ${titleCase(senderName)}`;
      }
    }

    // KR OTOMATIS (auto credit - investment returns)
    if (/KR OTOMATIS/.test(upper)) return 'Kredit Otomatis (AFR/Investasi)';

    // SWITCHING CR (investment platform)
    if (/SWITCHING CR/.test(upper)) {
      const nameM = fullText.match(/INDOPREMIER|IPOT|IpotPay/i);
      return nameM ? `Withdrawal ${nameM[0]}` : 'Switching Credit';
    }

    // TARIKAN ATM
    if (/TARIKAN ATM/.test(upper)) return 'Tarikan ATM';
    if (/TARIKAN TUNAI/.test(upper)) return 'Tarikan Tunai';
    if (/TARIKAN PEMINDAHAN/.test(upper)) return 'Pemindahan Dana';

    // FLAZZ BCA TOPUP
    if (/FLAZZ BCA TOPUP/.test(upper)) return 'Top Up Flazz BCA';

    // SETORAN VIA CDM
    if (/SETORAN VIA CDM/.test(upper)) return 'Setoran Tunai CDM';
    if (/SETORAN TUNAI/.test(upper)) return 'Setoran Tunai';

    // BYR VIA E-BANKING (bill payment)
    if (/BYR VIA E-BANKING/.test(upper)) {
      const bankM = fullText.match(/\b(HSBC|CIMB|BNI|BRI|MANDIRI|OCBC|NISP)\b/i);
      return bankM ? `Pembayaran Kartu Kredit ${bankM[0].toUpperCase()}` : 'Pembayaran via E-Banking';
    }

    // BIAYA ADM
    if (/BIAYA ADM/.test(upper)) return 'Biaya Administrasi BCA';

    // BIAYA TXN (BI-FAST fee)
    if (/BIAYA TXN/.test(upper)) return 'Biaya Transaksi BI-FAST';

    // BI-FAST
    if (/BI-FAST/.test(upper)) {
      const nameLines = lines.filter(l =>
        /^[A-Z][A-Z\s]+$/.test(l) &&
        !/(BI-FAST|TRANSFER|BIF|MyBCA)/i.test(l) &&
        l.length > 3
      );
      if (nameLines.length) {
        const txType = /BI-FAST CR/.test(upper) ? 'Transfer dari' : 'Transfer ke';
        return `${txType} ${titleCase(nameLines[nameLines.length - 1])}`;
      }
      return /BI-FAST CR/.test(upper) ? 'Penerimaan BI-FAST' : 'Transfer BI-FAST';
    }

    // BUNGA POKET
    if (/BUNGA POKET/.test(upper)) return 'Bunga Poket BCA';
    if (/^BUNGA\b/.test(upper)) return 'Bunga Tabungan';

    // Generic fallback: take the first meaningful phrase
    const firstLine = lines[0] || fullText;
    return titleCase(firstLine.replace(/\d{2}\/\d{2}\/\d{4}/, '').trim().slice(0, 60)) || 'BCA Transaction';
  };

  /* ── Extract memo/note from transfer block lines ─────────── */
  const extractTransferMemo = lines => {
    for (const line of lines) {
      // Skip: amounts, codes, all-caps names, short strings
      if (/^\d/.test(line)) continue;
      if (/^(WS\d+|FTSCY|FTFVA|FTQRS|FTSAI|ACSCY)/.test(line)) continue;
      if (/^-$/.test(line)) continue;
      if (line.length < 3) continue;
      // Mixed case or Indonesian-looking memo lines
      if (/[a-z]/.test(line) || /\b(pinjam|bensin|koper|makan|hadiah|bayar|tuker|blj|obat|sisa)\b/i.test(line)) {
        return line.trim().slice(0, 50);
      }
    }
    return null;
  };

  /* ── Map description to expense category ─────────────────── */
  const categorize = (desc, fullText) => {
    const l = (desc + ' ' + fullText).toLowerCase();

    // Food & drink
    if (/warteg|nasi|ayam|bakso|mie|soto|bubur|depot|esb|restau|warung|gorengan|bakpao|doner|kwetiau|hokben|ramen|sushi|cafe|coffee|kopi|boba|martabak|roti|snack|makanan|makan|warsun|pagi sore|ropangyuk|mademan|foodhall|bagoyam/.test(l)) return 'food';
    if (/grab food|gofood|shopeefood/.test(l)) return 'food';

    // Transport
    if (/grab trans|gojek|ojek|taxi|taksi|bensin|hexa mitra|pertamax|pertalite|spbu|parkir|tol|transjakarta|mrt|commuter|kereta|pesawat|tiket|goride/.test(l)) return 'transport';

    // Shopping
    if (/tokopedia|shopee|lazada|beli|alfamart|indomaret|supermarket|hypermart|carrefour|ikea|fashion|cotton on|aeon|remboelan|persada/.test(l)) return 'shopping';
    if (/toko|belanja|baju|sepatu|celana/.test(l)) return 'shopping';

    // Health
    if (/dokter|obat|apotek|klinik|rumah sakit|lab|vitamin|halodoc|lp medica/.test(l)) return 'health';

    // Bills
    if (/listrik|pln|air|pdam|internet|wifi|indihome|telkom|gas|iuran|bpjs|pulsa|tagihan|iconpay/.test(l)) return 'bills';
    if (/pembayaran kartu kredit/.test(l)) return 'bills';

    // Entertainment
    if (/bioskop|netflix|spotify|youtube|steam|game|konser|nonton|disney|cgv|cosmic bil|live house|bowling|qios/.test(l)) return 'entertainment';

    // Education
    if (/binus|kursus|buku|seminar|sekolah|kampus|les|udemy|gramedia/.test(l)) return 'education';

    // Personal
    if (/salon|potong|barber|hairpotter|spa|gym|fitness|laundry|skincare|temptation/.test(l)) return 'personal';

    // Home
    if (/sewa|kos|kontrakan|renovasi|cleaning|pgdp|hexa/.test(l)) return 'home';

    // Social
    if (/donasi|yayasan|sedekah|sumbangan|panti asuhan/.test(l)) return 'social';

    // Subscriptions
    if (/premium|membership|langganan|icloud|google one|canva/.test(l)) return 'subscription';

    // Transfer/other
    if (/transfer ke|transfer dari/.test(l)) return 'other';
    if (/flazz|top up/.test(l)) return 'transport';

    return 'other';
  };

  const titleCase = s => s.toLowerCase().replace(/(?:^|\s)\S/g, c => c.toUpperCase()).trim();

  /* ── Other bank parsers (kept from original) ─────────────── */
  const parseMandiri = text => {
    const txs = [];
    for (const line of text.split('\n')) {
      const dm = line.match(/(\d{2}[\/\-]\d{2}[\/\-]\d{4})/); if (!dm) continue;
      const parts = dm[1].includes('/') ? dm[1].split('/') : dm[1].split('-');
      const date = `${parts[2]}-${parts[1]}-${parts[0]}`;
      const cols = line.split(/\t|  {2,}/); if (cols.length < 4) continue;
      const desc = cols[1]?.trim() || cols[2]?.trim() || '';
      let amount = 0;
      for (let i = 2; i < Math.min(cols.length - 1, 5); i++) { const v = parseIDR(cols[i]); if (v > 0) { amount = v; break; } }
      if (amount <= 0) continue;
      txs.push({ date, description: desc, amount, type: 'expense', category: Parser.detectCat(desc), note: 'Import Mandiri' });
    }
    return txs;
  };

  const parseBNI = text => {
    const txs = [];
    for (const line of text.split('\n')) {
      const dm = line.match(/(\d{2}\/\d{2}\/\d{4})/); if (!dm) continue;
      const [d, mo, y] = dm[1].split('/'); const date = `${y}-${mo}-${d}`;
      const cols = line.split(/\t|  {2,}/); if (cols.length < 3) continue;
      const desc = cols[1]?.trim() || '';
      const amounts = line.match(/[\d.,]+/g) || [];
      const amount = amounts.map(parseIDR).find(n => n > 10000) || 0;
      if (amount <= 0) continue;
      txs.push({ date, description: desc, amount, type: 'expense', category: Parser.detectCat(desc), note: 'Import BNI' });
    }
    return txs;
  };

  const parseGoPay = text => {
    const txs = [];
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    const sep = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
    const h = lines[0].split(sep).map(x => x.trim().toLowerCase().replace(/"/g, ''));
    const di  = h.findIndex(x => x.includes('date') || x.includes('tanggal'));
    const ai  = h.findIndex(x => x.includes('amount') || x.includes('jumlah') || x.includes('nominal'));
    const dsi = h.findIndex(x => x.includes('desc') || x.includes('keterangan') || x.includes('narasi'));
    const ti  = h.findIndex(x => x.includes('type') || x.includes('tipe') || x.includes('jenis'));
    if (di < 0 || ai < 0) return [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(sep).map(c => c.trim().replace(/^"|"$/g, ''));
      if (cols.length <= Math.max(di, ai)) continue;
      const amount = parseIDR(cols[ai] || '0'); if (amount <= 0) continue;
      const rawDate = cols[di] || '';
      // normDate without year context — try to parse DD/MM/YYYY
      const date = normDate(rawDate, null) || normDate(rawDate, new Date().getFullYear().toString());
      if (!date) continue;
      const desc = dsi >= 0 ? cols[dsi] : 'GoPay Transaction';
      const typeHint = ti >= 0 ? cols[ti].toLowerCase() : '';
      const txType = (typeHint.includes('masuk') || typeHint.includes('kredit') || typeHint.includes('topup') || typeHint.includes('in')) ? 'income' : 'expense';
      txs.push({ date, description: desc, amount, type: txType, category: txType === 'income' ? 'income' : Parser.detectCat(desc), note: 'Import GoPay/OVO' });
    }
    return txs;
  };

  const parseCSV = text => {
    const txs = [];
    const lines = text.split('\n').filter(l => l.trim()); if (lines.length < 2) return [];
    const sep = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
    const h = lines[0].split(sep).map(x => x.trim().toLowerCase().replace(/"/g, ''));
    const di  = h.findIndex(x => x.includes('date') || x.includes('tanggal'));
    const dsi = h.findIndex(x => x.includes('desc') || x.includes('keterangan') || x.includes('narasi'));
    const ai  = h.findIndex(x => x.includes('debit') || x.includes('amount') || x.includes('jumlah') || x.includes('nominal'));
    const cri = h.findIndex(x => x.includes('kredit') || x.includes('credit'));
    if (di < 0) return [];
    if (ai < 0 && cri < 0) return [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(sep).map(c => c.trim().replace(/^"|"$/g, ''));
      const amount = parseIDR(cols[ai >= 0 ? ai : cri] || '0'); if (amount <= 0) continue;
      const date = normDate(cols[di] || '', new Date().getFullYear().toString()); if (!date) continue;
      const desc = dsi >= 0 ? cols[dsi] : '';
      const txType = (ai < 0 && cri >= 0) ? 'income' : 'expense';
      txs.push({ date, description: desc || 'CSV Import', amount, type: txType, category: txType === 'income' ? 'income' : Parser.detectCat(desc), note: 'Import CSV' });
    }
    return txs;
  };

  const extractPDF = async file => {
    const lib = window['pdfjs-dist/build/pdf'] || window.pdfjsLib;
    if (!lib) throw new Error('PDF.js not loaded');
    lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const buf = await file.arrayBuffer();
    const pdf = await lib.getDocument({ data: buf }).promise;
    let txt = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const c = await page.getTextContent();
      // Group items by Y position so same visual row → same text line.
      // BCA PDFs emit date, transaction type, and amount as separate items
      // on the same row. Without grouping, DATE_LINE_RE /^\d{2}\/\d{2}\s+TYPE/
      // never matches because date and type end up on different lines.
      const Y_THRESHOLD = 3;
      const rows = [];
      for (const item of c.items) {
        if (!item.str) continue;
        const y = item.transform[5];
        const existing = rows.find(r => Math.abs(r.y - y) <= Y_THRESHOLD);
        if (existing) {
          existing.items.push({ x: item.transform[4], str: item.str });
        } else {
          rows.push({ y, items: [{ x: item.transform[4], str: item.str }] });
        }
      }
      // Sort rows top-to-bottom (PDF Y increases upward, so descending = top first)
      rows.sort((a, b) => b.y - a.y);
      // Within each row sort left-to-right, then join with space
      txt += rows
        .map(r => r.items.sort((a, b) => a.x - b.x).map(i => i.str).join(' ').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join('\n') + '\n';
    }
    return txt;
  };

  const importFile = async file => {
    let text = file.name.endsWith('.pdf') ? await extractPDF(file) : await file.text();
    const bank = detectBank(text);
    let txs = [];
    if      (bank === 'bca')                           txs = parseBCA(text);
    else if (bank === 'mandiri')                       txs = parseMandiri(text);
    else if (bank === 'bni')                           txs = parseBNI(text);
    else if (bank === 'bri')                           txs = parseBCA(text);  // BRI uses similar format
    else if (bank === 'gopay' || bank === 'ovo' || bank === 'dana') txs = parseGoPay(text);
    else if (file.name.endsWith('.csv') || text.includes(',')) txs = parseCSV(text);
    else txs = parseBCA(text);  // fallback to BCA parser for unknown bank PDFs
    return { bank, transactions: txs };
  };

  return { importFile, parseBCA, parseIDR, normDate };
})();