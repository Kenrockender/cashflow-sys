# Cashflow Polish & Insights Upgrade

**Date:** 2026-06-11
**Status:** Approved (brainstorming complete)
**Scope:** Design polish pass (skeletons, micro-interactions, empty states, toast+undo, command palette) + dashboard net worth & cashflow forecast. Builds on the Graphite Mint design (see 2026-06-10-ui-redesign-design.md).
**Approach:** Incremental, zero new tooling. Vanilla JS global-script modules, registered via `<script>` tags in `public/index.html`, matching the existing architecture. Each piece ships independently.

## Out of scope (deferred by user)

- Global search and light theme
- Landing/marketing page
- Build modernization (Vite, modular Firebase SDK)
- AI insights improvements

## 1. Polish systems

### 1.1 Skeleton loaders

- While Firestore delivers the first snapshot, dashboard cards, the transaction list, and budget rows render shimmer placeholders instead of blank space.
- CSS: `.skeleton` blocks using `--surface-2` with a subtle opacity pulse.
- JS: small helper in `src/ui/components/skeleton.js`; render functions call it until the store signals ready, then render real content.

### 1.2 Micro-interactions

- Dashboard money values count up on first render (~600ms, requestAnimationFrame).
- Tab switches: 150ms fade/slide on the incoming panel.
- Cards brighten border `--rule` → `--rule-strong` on hover.
- Charts use Chart.js built-in entrance animation.
- All motion gated behind `prefers-reduced-motion: reduce` → instant rendering, no count-ups.

### 1.3 Empty states

- Each tab (dashboard, transactions, budget, goals, reports) gets a designed empty state: small mint-tinted inline SVG, one friendly line, CTA button (e.g. "Add your first transaction").
- All strings in `en.js` and `id.js`.

### 1.4 Toast + undo

- Toast stack, bottom corner, replaces `confirm()` dialogs for deletes (transactions, goals, budgets).
- Delete commits to Firestore immediately; the deleted document is kept in memory for 6 seconds while the toast shows "Deleted — Undo". Undo rewrites the document. Closing the tab mid-toast only loses the undo window, never the delete.
- API: `window.showToast(message, { undo: fn, duration })` in `src/ui/components/toast.js`.
- Undo write failure (e.g. offline) shows an error toast; never fails silently.

### 1.5 Command palette

- Ctrl+K / ⌘K opens an overlay (`src/ui/components/command-palette.js`) with fuzzy-matched actions: jump to any tab, add transaction/goal/budget, switch language, log out.
- Keyboard-first: arrow keys + Enter, Esc closes. Desktop-focused; mobile keeps existing navigation.
- Actions whose feature is unavailable are no-ops (palette never throws).

## 2. Net worth & cashflow forecast

### 2.1 Layout

- One full-width "Net worth" card at the top of the dashboard.
- Left: two headline numbers — current net worth with +/-% vs last month, and forecast ("Rp X by <month+6> at current pace").
- Below: combined chart — solid mint line for last 12 months of history, vertical "today" marker, dashed mint line projecting 6 months forward. Rendered with the already-loaded Chart.js.

### 2.2 Net worth history (no new storage)

- Start from current account balances; replay transaction history backwards to reconstruct month-end balances for the past 12 months.
- Multi-currency accounts convert to the display currency via the existing `src/services/exchange-rates.js`.

### 2.3 Forecast

- Monthly projected flow = (net of recurring transactions) + (trailing 3-month average of non-recurring income − expenses).
- Applied month by month for 6 months starting from today's net worth.
- Pure, DOM-free math in `src/features/insights/forecast-math.js` (unit-testable). Rendering/Chart.js wiring in `src/features/insights/insights.js`.

### 2.4 Edge cases

- Less than one month of history → card shows an empty state ("Add transactions to see your trend and forecast"), no misleading flat line.
- Forecast label always reads "at current pace" (an estimate, not a promise).
- Guards: divide-by-zero on averages; missing exchange rate falls back to the exchange-rates service's existing default behavior.

## 3. Files

**New:**

| File | Purpose |
|---|---|
| `src/ui/components/toast.js` | Toast stack + undo API |
| `src/ui/components/skeleton.js` | Skeleton helper |
| `src/ui/components/command-palette.js` | Ctrl+K palette |
| `src/features/insights/forecast-math.js` | Pure net-worth replay + projection math |
| `src/features/insights/insights.js` | Net worth card rendering + chart |
| `public/styles/polish.css` | Skeletons, animations, empty states, toast, palette (Graphite Mint tokens) |
| `tests/forecast-math.test.mjs` | Unit tests for the math module |

**Touched:** `src/ui/render/dashboard-render.js` (insights card + skeletons), `src/features/transactions/transactions.js`, `src/features/goals/goals.js`, `src/features/budget/budget.js` (delete → toast+undo), `public/index.html` (script/style tags), `public/service-worker.js` (cache new assets, bump version), `src/i18n/en.js`, `src/i18n/id.js` (new strings).

## 4. Testing

- Vitest unit tests for `forecast-math.js`: history replay, projection, empty data, single month, negative flows.
- `npm test` must stay green (3 existing test files + new one).
- Manual verification in the browser preview: each polish item, the insights card with real-ish data, reduced-motion behavior, and the undo flow.

## 5. Delivery order

1. `polish.css` + skeletons
2. Micro-interactions
3. Empty states
4. Toast + undo (replacing confirms)
5. Command palette
6. Forecast math module + tests
7. Insights card + chart on dashboard
8. Service worker bump + final verification

Each step lands as its own commit and keeps the app fully working.
