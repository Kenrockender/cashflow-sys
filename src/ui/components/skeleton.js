/* ══════════════════════════════════════════════════════════
   CASHFLOW.SYS — skeleton.js
   Polish utilities: loading skeletons, animated count-up
   values, rich empty-state markup.
   Load order: after helpers.js, before render modules.
   Depends on: helpers.js (fmtCurrency), i18n.js (t)
══════════════════════════════════════════════════════════ */

/* ── LOADING SKELETONS ───────────────────────────────────── */
const Skeleton = (() => {
  const start = () => document.body.classList.add('cf-loading');
  const end   = () => document.body.classList.remove('cf-loading');
  return { start, end };
})();

/* ── REDUCED MOTION ──────────────────────────────────────── */
function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* ── ANIMATED COUNT-UP ───────────────────────────────────── */
/**
 * Sets el.textContent to fmt(value), animating from the element's
 * previous value (or 0 on first render). Skips animation entirely
 * when the value is unchanged or reduced motion is preferred.
 */
const _countUpRafs = new WeakMap();
function setAnimatedValue(el, value, fmt) {
  if (!el) return;
  fmt = fmt || (v => fmtCurrency(v));
  const target = +value || 0;
  const prev   = el.dataset.cfVal !== undefined ? +el.dataset.cfVal : null;
  el.dataset.cfVal = String(target);
  if (prefersReducedMotion() || prev === target) { el.textContent = fmt(target); return; }
  const from = prev === null ? 0 : prev;
  if (_countUpRafs.has(el)) cancelAnimationFrame(_countUpRafs.get(el));
  const t0 = performance.now(), dur = 550;
  const step = now => {
    const p = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - p, 3); // easeOutCubic
    el.textContent = fmt(from + (target - from) * e);
    if (p < 1) _countUpRafs.set(el, requestAnimationFrame(step));
    else _countUpRafs.delete(el);
  };
  _countUpRafs.set(el, requestAnimationFrame(step));
}

/* ── RICH EMPTY STATES ───────────────────────────────────── */
/**
 * @param {{icon:string, title:string, sub?:string, ctaLabel?:string, ctaOnclick?:string}} o
 * icon: inline SVG string. title/sub already translated. ctaOnclick: inline JS string.
 */
function emptyStateHTML(o) {
  return `<div class="empty-rich">
    <div class="empty-rich-icon">${o.icon || ''}</div>
    <div class="empty-rich-title">${o.title}</div>
    ${o.sub ? `<div class="empty-rich-sub">${o.sub}</div>` : ''}
    ${o.ctaLabel ? `<button type="button" class="empty-rich-cta" onclick="${o.ctaOnclick || ''}">${o.ctaLabel}</button>` : ''}
  </div>`;
}

/* ─── ESM window bridge (auto-generated) ─── */
Object.assign(window, { Skeleton, prefersReducedMotion, _countUpRafs, setAnimatedValue, emptyStateHTML });
