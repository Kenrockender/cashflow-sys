/* ══════════════════════════════════════════════════════════
   Cashflow — landing.js
   Scroll-zoom hero (Mercury-style), scroll reveals, EN/ID
   toggle. Self-contained — no app bundle dependencies.
══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── App links (Vercel: /app · local static server: index.html) ── */
  var appUrl = window.CF_APP_URL || '/app';
  document.querySelectorAll('[data-app-link]').forEach(function (a) {
    a.href = appUrl + (appUrl.indexOf('?') === -1 ? '?login=1' : '&login=1');
  });

  /* ── i18n ────────────────────────────────────────────────── */
  var L = {
    en: {
      'nav.open':        'Open app',
      'hero.badge':      'Free · Private · Works offline',
      'hero.title':      'Your money, calm and clear.',
      'hero.sub':        'Track spending, set budgets, and watch your net worth grow — in a fast, private app that syncs to your own account.',
      'hero.cta':        'Continue with Google',
      'mock.networth':   'Net worth',
      'mock.spending':   'Spending',
      'mock.thismonth':  'this month',
      'mock.budget':     'Budget left',
      'mock.goal':       'Goal · Bali trip',
      'mock.forecast':   'Net worth · 6-month forecast',
      'feat.quick.title':    'Quick add',
      'feat.quick.desc':     'Type "fried rice 25rb" and it’s parsed instantly — amount, category, date. Voice input works too.',
      'feat.budget.title':   'Budgets & goals',
      'feat.budget.desc':    'Per-category limits with rollover, plus savings goals with milestones and auto-contributions.',
      'feat.forecast.title': 'Forecast',
      'feat.forecast.desc':  'See your net worth trend and a 6-month projection based on how you actually spend.',
      'feat.import.title':   'Import & export',
      'feat.import.desc':    'Import bank statements (CSV, XLSX, PDF), export clean reports whenever you need them.',
      'trust.private':   'Your data stays in your account',
      'trust.pwa':       'Installs as an app',
      'trust.offline':   'Works offline',
      'trust.lang':      'English & Indonesian',
      'close.title':     'Start tracking in under a minute.',
      'close.note':      'Free · No card required · Sign in with Google',
      'footer.meta':     'Personal finance, minus the noise.',
    },
    id: {
      'nav.open':        'Buka aplikasi',
      'hero.badge':      'Gratis · Privat · Bisa offline',
      'hero.title':      'Uang Anda, tenang dan jelas.',
      'hero.sub':        'Catat pengeluaran, atur budget, dan lihat kekayaan bersih Anda tumbuh — di aplikasi cepat dan privat yang tersinkron ke akun Anda sendiri.',
      'hero.cta':        'Lanjutkan dengan Google',
      'mock.networth':   'Kekayaan bersih',
      'mock.spending':   'Pengeluaran',
      'mock.thismonth':  'bulan ini',
      'mock.budget':     'Sisa budget',
      'mock.goal':       'Target · Liburan Bali',
      'mock.forecast':   'Kekayaan bersih · proyeksi 6 bulan',
      'feat.quick.title':    'Input cepat',
      'feat.quick.desc':     'Ketik "nasi goreng 25rb" dan langsung terbaca — jumlah, kategori, tanggal. Bisa juga lewat suara.',
      'feat.budget.title':   'Budget & target',
      'feat.budget.desc':    'Batas per kategori dengan rollover, plus target tabungan dengan milestone dan kontribusi otomatis.',
      'feat.forecast.title': 'Proyeksi',
      'feat.forecast.desc':  'Lihat tren kekayaan bersih dan proyeksi 6 bulan berdasarkan kebiasaan belanja Anda.',
      'feat.import.title':   'Impor & ekspor',
      'feat.import.desc':    'Impor mutasi bank (CSV, XLSX, PDF), ekspor laporan rapi kapan pun dibutuhkan.',
      'trust.private':   'Data Anda tetap di akun Anda',
      'trust.pwa':       'Bisa dipasang sebagai aplikasi',
      'trust.offline':   'Bisa dipakai offline',
      'trust.lang':      'Inggris & Indonesia',
      'close.title':     'Mulai mencatat dalam satu menit.',
      'close.note':      'Gratis · Tanpa kartu · Masuk dengan Google',
      'footer.meta':     'Keuangan pribadi, tanpa bising.',
    },
  };

  function setLang(lang) {
    if (!L[lang]) lang = 'en';
    document.documentElement.lang = lang;
    try { localStorage.setItem('cf-lang', lang); } catch (e) {}
    document.querySelectorAll('[data-l]').forEach(function (el) {
      var s = L[lang][el.getAttribute('data-l')];
      if (s) el.innerHTML = s;
    });
    document.querySelectorAll('.lp-lang-btn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-setlang') === lang);
    });
  }

  document.querySelectorAll('.lp-lang-btn').forEach(function (b) {
    b.addEventListener('click', function () { setLang(b.getAttribute('data-setlang')); });
  });

  var saved = 'en';
  try { saved = localStorage.getItem('cf-lang') || 'en'; } catch (e) {}
  setLang(saved);

  /* ── Scroll-zoom hero (Mercury-style) ────────────────────── */
  var mock = document.getElementById('lp-mock');
  if (mock && !REDUCED) {
    var TILT = 22, SCALE0 = 0.92, OPACITY0 = 0.8;
    var ticking = false;

    var apply = function () {
      ticking = false;
      var range = window.innerHeight * 0.6;
      var p = Math.min(1, Math.max(0, window.scrollY / range));
      // easeOutQuad for a softer landing
      var e = 1 - (1 - p) * (1 - p);
      mock.style.transform = 'rotateX(' + (TILT * (1 - e)) + 'deg) scale(' + (SCALE0 + (1 - SCALE0) * e) + ')';
      mock.style.opacity = String(OPACITY0 + (1 - OPACITY0) * e);
      if (e > 0.6) mock.classList.add('flat');
    };

    var onScroll = function () {
      if (!ticking) { ticking = true; requestAnimationFrame(apply); }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    apply();
    // Draw the chart line shortly after load even without scrolling
    setTimeout(function () { mock.classList.add('flat'); }, 900);
  } else if (mock) {
    mock.classList.add('flat');
  }

  /* ── Scroll reveals ──────────────────────────────────────── */
  var reveals = document.querySelectorAll('.lp-reveal');
  if (REDUCED || !('IntersectionObserver' in window)) {
    reveals.forEach(function (el) { el.classList.add('visible'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('visible'); io.unobserve(en.target); }
      });
    }, { threshold: 0.15 });
    reveals.forEach(function (el) { io.observe(el); });
  }
})();
