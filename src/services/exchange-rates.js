/* ══════════════════════════════════════════════════════════
   CASHFLOW.SYS — exchange-rates.js
   Live rates from public APIs + localStorage cache.
   Depends on: constants.js (CURRENCIES, DEFAULT_EXCHANGE_RATES), i18n (t)
   Expects: global S (state), toast(msg)
══════════════════════════════════════════════════════════ */

/**
 * @param {Record<string, number>} rates - foreign units per 1 base (e.g. IDR base → USD = USD per 1 IDR)
 * @param {string} baseCode
 */
window.cfBuildIdrRatesFromBase = function cfBuildIdrRatesFromBase(rates, baseCode) {
  if (!rates || typeof rates !== 'object') return { IDR: 1 };
  const out = { IDR: 1 };
  for (const code of Object.keys(typeof CURRENCIES !== 'undefined' ? CURRENCIES : {})) {
    if (code === baseCode) continue;
    const r = rates[code];
    if (typeof r === 'number' && r > 0) {
      out[code] = Math.round(1 / r);
    }
  }
  return out;
};

async function cfFetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error('HTTP ' + response.status);
  return response.json();
}

/**
 * Primary: open.er-api (base IDR). Fallback: exchangerate.host (base IDR).
 */
window.fetchExchangeRates = async function fetchExchangeRates() {
  const btn = document.getElementById('btn-refresh-rates');
  const statusEl = document.getElementById('exchange-rate-status');
  const tFn = typeof t === 'function' ? t : (k => k);

  if (btn) btn.disabled = true;
  if (statusEl) statusEl.textContent = tFn('exchange.updating');

  const applyRates = newRates => {
    if (typeof S === 'undefined' || !DEFAULT_EXCHANGE_RATES) return;
    S.exchangeRates = { ...S.exchangeRates, ...newRates };
    S.exchangeRatesUpdated = new Date().toISOString();
    localStorage.setItem('cf-exchange-rates', JSON.stringify(S.exchangeRates));
    localStorage.setItem('cf-exchange-rates-updated', S.exchangeRatesUpdated);

    const ratesList = document.getElementById('exchange-rates-list');
    if (ratesList) {
      document.querySelectorAll('.rate-input').forEach(input => {
        const code = input.dataset.currency;
        if (S.exchangeRates[code]) input.value = S.exchangeRates[code];
      });
    }
    if (statusEl) {
      const date = new Date(S.exchangeRatesUpdated).toLocaleDateString();
      statusEl.textContent = tFn('exchange.last.update', { date });
    }
    if (typeof toast === 'function') toast(tFn('exchange.updated'));
  };

  try {
    let rates = null;
    try {
      const data = await cfFetchJson('https://open.er-api.com/v6/latest/IDR');
      if (data.result === 'success' && data.rates) rates = data.rates;
    } catch (e) {
      console.warn('open.er-api failed:', e && e.message);
    }
    if (!rates) {
      const data = await cfFetchJson('https://api.exchangerate.host/latest?base=IDR');
      if (data && data.rates) rates = data.rates;
    }
    if (!rates) throw new Error('No rates from APIs');

    const newRates = window.cfBuildIdrRatesFromBase(rates, 'IDR');
    applyRates(newRates);
  } catch (e) {
    console.error('Exchange rate fetch error:', e);
    if (statusEl) {
      if (!navigator.onLine) statusEl.textContent = tFn('exchange.offline');
      else statusEl.textContent = tFn('exchange.update.error');
    }
  } finally {
    if (btn) btn.disabled = false;
  }
};

/** Fetch when never updated, or cache older than 24h */
window.checkExchangeRatesFreshness = function checkExchangeRatesFreshness() {
  if (!navigator.onLine) return;
  const lastUpdate = localStorage.getItem('cf-exchange-rates-updated');
  if (!lastUpdate) {
    window.fetchExchangeRates().catch(() => {});
    return;
  }
  const hoursSince = (Date.now() - new Date(lastUpdate).getTime()) / (1000 * 60 * 60);
  if (hoursSince > 24) window.fetchExchangeRates().catch(() => {});
};

/* ─── ESM window bridge (auto-generated) ─── */
Object.assign(window, { cfFetchJson });
