/* ══════════════════════════════════════════════════════════
   CASHFLOW.SYS — i18n.js
   Language: English (base) / Bahasa Indonesia
   Usage:
     t('key')            → translated string
     t('key', {n: 5})    → with variable substitution
     setLang('id')       → switch language + re-render page
══════════════════════════════════════════════════════════ */

window.TRANSLATIONS = window.TRANSLATIONS || {};

/* ── ENGINE ──────────────────────────────────────────────── */
const I18n = (() => {
  let _lang = localStorage.getItem('cf-lang') || 'en';

  /* t('key') or t('key', {n:5, name:'test'}) */
  function t(key, vars = {}) {
    const dict = TRANSLATIONS[_lang] || TRANSLATIONS.en;
    let str = dict[key] ?? TRANSLATIONS.en[key] ?? key;
    for (const [k, v] of Object.entries(vars)) {
      str = str.replaceAll(`{${k}}`, v);
    }
    return str;
  }

  function getLang() { return _lang; }

  function setLang(lang) {
    if (!TRANSLATIONS[lang]) return;
    _lang = lang;
    localStorage.setItem('cf-lang', lang);
    applyToDOM();
    updateLangPills();
    // Re-render app if it's already loaded
    if (typeof render === 'function') render();
  }

  /* Apply translations to all data-i18n elements in the DOM */
  function applyToDOM() {
    // Text content
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      el.textContent = t(key);
    });
    // Placeholder
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
      el.placeholder = t(el.dataset.i18nPh);
    });
    // Title attribute
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.title = t(el.dataset.i18nTitle);
    });
    // Aria-label
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
      el.setAttribute('aria-label', t(el.dataset.i18nAria));
    });
    // Update html lang attr
    document.documentElement.lang = _lang;
  }

  function updateLangPills() {
    document.querySelectorAll('.lang-pill').forEach(p => {
      p.classList.toggle('active', p.dataset.lang === _lang);
    });
  }

  /* Run on DOMContentLoaded */
  function init() {
    applyToDOM();
    updateLangPills();
  }

  return { t, getLang, setLang, init, applyToDOM };
})();

/* Expose globally so app.js can use t() directly */
window.t = I18n.t.bind(I18n);
window.setLang = I18n.setLang.bind(I18n);
window.getLang = I18n.getLang.bind(I18n);

document.addEventListener('DOMContentLoaded', I18n.init);

/* ─── ESM window bridge (auto-generated) ─── */
Object.assign(window, { I18n });
