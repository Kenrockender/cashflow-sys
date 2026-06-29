/* ══════════════════════════════════════════════════════════
   CASHFLOW.SYS — ai-insights.js
   Gemini-powered financial analysis for the Reports tab.
   Depends on: state.js, helpers.js, constants.js, i18n.js
══════════════════════════════════════════════════════════ */

const AIInsights = (() => {
  const GEMINI_URL = '/api/gemini';

  const TYPE_COLOR = {
    warning: '#f59e0b',
    tip: '#3b82f6',
    positive: '#22c55e',
    info: '#8b5cf6'
  };

  const TYPE_ICON = {
    warning: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    tip: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    positive: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    info: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
  };

  let _loading = false;

  /* ── build a compact spending summary to send as context ── */
  function buildPrompt() {
    const TV = typeof getTxView === 'function' ? getTxView() : S.transactions;
    const tmon = typeof thisMonth === 'function' ? thisMonth() : new Date().toISOString().slice(0, 7);
    const lmon = typeof prevMonth === 'function' ? prevMonth(tmon) : '';

    const mExp = TV.filter(t => t.date?.startsWith(tmon) && t.type !== 'income');
    const mInc = TV.filter(t => t.date?.startsWith(tmon) && t.type === 'income');
    const lExp = TV.filter(t => t.date?.startsWith(lmon) && t.type !== 'income');

    const totalExp = mExp.reduce((s, t) => s + t.amount, 0);
    const totalInc = mInc.reduce((s, t) => s + t.amount, 0);
    const lastTotalExp = lExp.reduce((s, t) => s + t.amount, 0);
    const net = totalInc - totalExp;

    // Category breakdown
    const cats = {};
    for (const tx of mExp) {
      const label = typeof getCat === 'function' ? getCat(tx.category).label : tx.category;
      cats[label] = (cats[label] || 0) + tx.amount;
    }
    const catLines = Object.entries(cats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([k, v]) => `  - ${k}: ${fmtCurrency(v)}`)
      .join('\n');

    // Budget adherence
    const budgets = S?.budgets || {};
    const budgetLines = Object.entries(budgets)
      .filter(([, b]) => b > 0)
      .map(([catId, budget]) => {
        const spent = mExp.filter(t => t.category === catId).reduce((s, t) => s + t.amount, 0);
        const label = typeof getCat === 'function' ? getCat(catId).label : catId;
        const status = spent > budget ? 'OVER' : spent > budget * 0.8 ? 'NEAR LIMIT' : 'OK';
        return `  - ${label}: spent ${fmtCurrency(spent)} / budget ${fmtCurrency(budget)} [${status}]`;
      }).join('\n');

    // Top 5 transactions
    const top5 = [...mExp].sort((a, b) => b.amount - a.amount).slice(0, 5)
      .map(t => `  - ${t.description}: ${fmtCurrency(t.amount)}`).join('\n');

    const lang = typeof getLang === 'function' ? getLang() : 'en';
    const responseLanguage = lang === 'id' ? 'Bahasa Indonesia' : 'English';

    // FIX: template literal is now properly closed at the end of the return statement
    return `You are a personal finance advisor. Analyze the following monthly spending data and provide 4-5 actionable, specific insights. Be direct, practical, and friendly. Respond in ${responseLanguage}.

FORMAT your response as a JSON array of insight objects:
[
  {
    "type": "warning|tip|positive|info",
    "title": "Short title (max 8 words)",
    "desc": "Detailed explanation with specific numbers and advice (2-3 sentences)"
  }
]

Only output the JSON array, nothing else.

SPENDING DATA (${tmon}):
- Total Income    : ${fmtCurrency(totalInc)}
- Total Expenses  : ${fmtCurrency(totalExp)}
- Net             : ${fmtCurrency(net)}
- Last Month Exp  : ${fmtCurrency(lastTotalExp)}

Top Categories:
${catLines}

Budget Status:
${budgetLines}

Top 5 Transactions:
${top5}`;
  }

  /* ── retry fetch with exponential backoff for 429s ──────────
     FIX: moved out of generate() so it is defined once, at
     module scope, and not duplicated on every call.          */
  async function fetchWithRetry(url, options, retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
      const res = await fetch(url, options);
      if (res.status !== 429) return res;
      await new Promise(r => setTimeout(r, delay * Math.pow(2, i)));
    }
    // Final attempt after all retries exhausted
    return fetch(url, options);
  }

  /* ── escape HTML before injecting AI text into the DOM ───── */
  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── render the insights panel in three states ───────────── */
  function renderPanel(state, payload) {
    const panel = document.getElementById('gemini-insights-panel');
    if (!panel) return;

    if (state === 'loading') {
      panel.innerHTML = `<div class="gai-loading">Analyzing your finances…</div>`;

    } else if (state === 'error') {
      panel.innerHTML = `<div class="gai-error">${escapeHtml(payload)}</div>`;

    } else if (state === 'done') {
      const insights = payload;
      panel.innerHTML = `
        <div class="gai-list">
          ${insights.map(ins => `
            <div class="gai-item gai-${ins.type}">
              <span class="gai-icon" style="color:${TYPE_COLOR[ins.type] || TYPE_COLOR.info}">
                ${TYPE_ICON[ins.type] || TYPE_ICON.info}
              </span>
              <div class="gai-content">
                <div class="gai-item-title">${escapeHtml(ins.title)}</div>
                <div class="gai-item-desc">${escapeHtml(ins.desc)}</div>
              </div>
            </div>`).join('')}
        </div>
        <div class="gai-footer">Powered by Gemini AI · Based on your last data snapshot</div>`;
    }
  }

  /* ── main generate function ──────────────────────────────────
     FIX: single, clean definition — no duplication, no nesting.
     _loading guard is checked once at the very top.          */
  async function generate() {
    if (_loading) return;
    _loading = true;

    // Capture btn before the try block so finally can always reach it
    const btn = document.getElementById('btn-gemini-insights');
    if (btn) btn.disabled = true;
    renderPanel('loading');

    try {
      const prompt = buildPrompt();
      const res = await fetchWithRetry(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
        }),
      });

      if (!res.ok) throw new Error(`Gemini API error ${res.status}`);

      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Strip markdown fences if the model wraps output in them
      const cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

      let insights;
      try {
        insights = JSON.parse(cleaned);
        if (!Array.isArray(insights)) throw new Error('Not an array');
      } catch {
        // Fallback: try to extract a JSON array from anywhere in the raw text
        const match = rawText.match(/\[[\s\S]*\]/);
        if (match) insights = JSON.parse(match[0]);
        else throw new Error('Could not parse Gemini response');
      }

      renderPanel('done', insights);

    } catch (e) {
      console.error('[AIInsights] Error:', e);
      const lang = typeof getLang === 'function' ? getLang() : 'en';
      const msg = lang === 'id'
        ? `Gagal memuat analisis: ${e.message}`
        : `Failed to load analysis: ${e.message}`;
      renderPanel('error', msg);

    } finally {
      _loading = false;
      if (btn) btn.disabled = false;
    }
  }

  /* ── public API ───────────────────────────────────────────── */
  return { generate };
})();

/* ─── ESM window bridge (auto-generated) ─── */
Object.assign(window, { AIInsights });
