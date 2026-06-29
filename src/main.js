/* ══════════════════════════════════════════════════════════
   CASHFLOW.SYS — main.js  (ESM bundle entry)
   Replaces the ~40 hand-ordered <script> tags. Each module is
   imported for its side effects, in the original load order, so
   the global namespace (exposed on `window` by each module's
   bridge) is populated exactly as before. Bundled by Vite.

   External globals expected before this runs (classic <script>
   tags in index.html head, with SRI): window.firebase, window.Chart.
══════════════════════════════════════════════════════════ */

/* ── i18n (translations register on window.TRANSLATIONS) ─── */
import './i18n/en.js';
import './i18n/id.js';
import './i18n/i18n.js';

/* ── data + core constants ───────────────────────────────── */
import './data/firebase-config.js';
import './core/constants.js';
import './services/exchange-rates.js';
import './data/firebase-init.js';
import './data/store.js';

/* ── parsers + charts ────────────────────────────────────── */
import './features/transactions/parser-bca.js';
import './services/parser.js';
import './ui/components/charts.js';

/* ── app state + helpers ─────────────────────────────────── */
import './core/state.js';
import './core/helpers.js';
import './ui/components/skeleton.js';
import './ui/components/toast.js';

/* ── render layer ────────────────────────────────────────── */
import './ui/render/dashboard-render.js';
import './ui/render/transactions-render.js';
import './ui/render/budget-render.js';
import './ui/render/goals-render.js';
import './ui/render/reports-render.js';
import './ui/render/filters-render.js';
import './ui/render/modals-render.js';
import './ui/render/ui-render.js';
import './ui/components/command-palette.js';

/* ── services: auth (before events) ──────────────────────── */
import './services/auth.js';

/* ── features (all before events.js) ─────────────────────── */
import './features/transactions/transactions.js';
import './features/transactions/recurring.js';
import './features/transactions/import-export.js';
import './features/goals/goals.js';
import './features/goals/contributions.js';
import './features/goals/milestones.js';
import './features/budget/budget.js';
import './features/insights/forecast-math.js';
import './features/insights/insights.js';
import './features/accounts/accounts.js';
import './features/accounts/transfers.js';
import './features/accounts/categories.js';
import './features/reimbursement/reimburse.js';
import './features/ai-insights/ai-insights.js';
import './features/notifications/cf-notifications.js';

/* ── DOM event bindings (after all handlers exist) ───────── */
import './ui/components/events.js';

/* ── boot: app init + the former inline <script> tail ────── */
import './app.js';
import './boot.js';
