/** Pure amount + shorthand parsing (mirrors parser.js logic for tests). */
const SHORTHANDS = { rb: 1000, ribu: 1000, k: 1000, jt: 1000000, juta: 1000000, m: 1000000 };

export function extractAmountFromText(text) {
  if (!text) return null;
  const pats = [
    /(\d+[.,]?\d*)\s*(rb|ribu|k|jt|juta|m)\b/i,
    /rp\.?\s*(\d[\d.,]*)/i,
    /\b(\d[\d.,]*)\b/,
  ];
  for (const p of pats) {
    const m = text.match(p);
    if (!m) continue;
    let n = parseFloat(m[1].replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
    const s = (m[2] || '').toLowerCase();
    const x = SHORTHANDS[s] || 1;
    if (!isNaN(n) && n > 0) return Math.round(n * x);
  }
  return null;
}
