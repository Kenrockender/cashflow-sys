/* ══════════════════════════════════════════════════════════
   CASHFLOW.SYS — toast.js
   Stacked toast notifications with per-toast undo.
   Replaces the legacy single #toast element (helpers.js).
   Load order: after helpers.js (overrides toast/toastUndo).
   Depends on: i18n.js (t)
══════════════════════════════════════════════════════════ */

(function () {
  const MAX_STACK = 4;

  function container() {
    let c = document.getElementById('cf-toast-stack');
    if (!c) {
      c = document.createElement('div');
      c.id = 'cf-toast-stack';
      c.setAttribute('role', 'status');
      c.setAttribute('aria-live', 'polite');
      document.body.appendChild(c);
    }
    return c;
  }

  /**
   * showToast('Deleted', { undo: async () => {...}, duration: 6000, type: 'error' })
   * Returns { close }.
   */
  window.showToast = function (msg, opts = {}) {
    const { undo, undoLabel, type = '', duration = undo ? 6000 : 4000 } = opts;
    const el = document.createElement('div');
    el.className = 'cf-toast' + (type ? ` cf-toast--${type}` : '');

    const span = document.createElement('span');
    span.className = 'cf-toast-msg';
    span.textContent = msg;
    el.appendChild(span);

    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      el.classList.add('cf-toast--out');
      setTimeout(() => el.remove(), 240);
    };

    if (typeof undo === 'function') {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cf-toast-undo';
      b.textContent = undoLabel || t('toast.tx.undo');
      b.onclick = async () => {
        close();
        try { await undo(); }
        catch (e) {
          window.showToast((t('toast.undo.failed')) + (e?.message ? ': ' + e.message : ''), { type: 'error' });
        }
      };
      el.appendChild(b);
    }

    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'cf-toast-close';
    x.setAttribute('aria-label', 'Dismiss');
    x.innerHTML = '&times;';
    x.onclick = close;
    el.appendChild(x);

    const c = container();
    c.appendChild(el);
    const kids = [...c.children];
    if (kids.length > MAX_STACK) kids.slice(0, kids.length - MAX_STACK).forEach(k => k.remove());

    setTimeout(close, duration);
    return { close };
  };

  /* Back-compat API — every existing caller keeps working. */
  window.toast     = msg => { window.showToast(msg); };
  window.toastUndo = (msg, undoFn) => { window.showToast(msg, { undo: undoFn }); };
})();
