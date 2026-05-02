/* ══════════════════════════════════════════════════════════
   CASHFLOW.SYS — cf-notifications.js
   Optional Web Notifications when monthly spending crosses thresholds.
   Loaded after app.js; uses window.t when available.
══════════════════════════════════════════════════════════ */

(function () {
  const STORAGE_KEY = 'cf-budget-notify-sent';

  function t(k, o) {
    if (typeof window.t === 'function') return window.t(k, o);
    return k;
  }

  window.requestNotifyPermission = async function requestNotifyPermission() {
    if (!('Notification' in window)) {
      alert(t('notify.unsupported'));
      return;
    }
    const r = await Notification.requestPermission();
    if (r === 'granted') {
      if (typeof window.toast === 'function') window.toast(t('notify.enabled'));
    } else {
      if (typeof window.toast === 'function') window.toast(t('notify.denied'));
    }
    return r;
  };

  /**
   * @param {number} pct - 0..100 spent / budget
   * @param {number} spent
   * @param {number} budgetTotal
   */
  window.maybeBudgetNotification = function maybeBudgetNotification(pct, spent, budgetTotal) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (!budgetTotal || budgetTotal <= 0 || pct < 80) return;

    const tmon = typeof window.thisMonth === 'function' ? window.thisMonth() : '';
    const title = t('notify.budget.title');
    try {
      if (pct >= 100) {
        const k = `${STORAGE_KEY}-100-${tmon}`;
        if (localStorage.getItem(k)) return;
        localStorage.setItem(k, '1');
        const body = t('notify.budget.body100', { pct: Math.round(pct) });
        const n = new Notification(title, { body, tag: 'cf-budget-100', silent: false });
        n.onclick = () => { window.focus(); n.close(); };
        return;
      }
      const k = `${STORAGE_KEY}-80-${tmon}`;
      if (localStorage.getItem(k)) return;
      localStorage.setItem(k, '1');
      const body = t('notify.budget.body80', { pct: Math.round(pct) });
      const n = new Notification(title, { body, tag: 'cf-budget-80', silent: false });
      n.onclick = () => { window.focus(); n.close(); };
    } catch (e) {
      console.warn('Notification:', e);
    }
  };
})();
