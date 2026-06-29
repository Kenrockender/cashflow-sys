/**
 * Cashflow — shared type definitions.
 *
 * Declared globally so any checked .js file can reference these shapes in
 * JSDoc (`@param {Transaction} tx`) without an import, matching the app's
 * global-namespace runtime model. As more files are added to tsconfig's
 * `include`, annotate them against these types.
 */

export {};

declare global {
  /** A single income/expense entry. */
  interface Transaction {
    id: string;
    /** ISO date `YYYY-MM-DD`. */
    date: string;
    /** Positive amount in the transaction's stored currency. */
    amount: number;
    /** `'income'` or anything else (treated as an expense). */
    type: string;
    /** Category id (see CATS / custom categories). */
    category?: string;
    description?: string;
    note?: string;
    /** Account id; defaults to `'main'` when absent. */
    accountId?: string;
    recurring?: boolean;
    recurringFrequency?: string;
    reimbursable?: boolean;
    reimbursed?: boolean;
    reimbursedDate?: string;
    reimbursedNote?: string;
    [extra: string]: any;
  }

  /** A savings goal. */
  interface Goal {
    id: string;
    name: string;
    target: number;
    saved: number;
    deadline?: string;
    note?: string;
    autoContribute?: boolean;
    autoContributePct?: number;
    [extra: string]: any;
  }

  /** A money account (wallet/bank). */
  interface Account {
    id: string;
    name: string;
  }

  /** Per-category budget caps keyed by category id. */
  type BudgetMap = Record<string, number>;

  /** The single global application state object (`window.S`). */
  interface AppState {
    user: unknown;
    transactions: Transaction[];
    budgets: BudgetMap;
    goals: Goal[];
    activeTab: string;
    activePeriod: string;
    editingId: string | null;
    editingGoalId: string | null;
    budgetMode: string;
    totalIncome: number;
    budgetPercents: Record<string, number>;
    currency: string;
    exchangeRates: Record<string, number>;
    exchangeRatesUpdated?: string;
    travelMode: boolean;
    rolloverEnabled: boolean;
    rolloverAmount: number;
    lastMilestones: Record<string, unknown>;
    customCategories: Account[] | Array<{ id: string; name: string; icon?: string }>;
    accounts: Account[];
    accountFilter: string;
    [extra: string]: any;
  }

  /* ── Shared runtime globals declared in not-yet-checked files ──
     Declared so checkJs resolves bare cross-module references from the
     files currently in tsconfig `include`. Symbols that ARE declared in
     an included file (e.g. S, fmtCurrency) are intentionally omitted here
     to avoid redeclaration conflicts. Tighten `any` incrementally. */
  /** Translate an i18n key. */
  function t(key: string, vars?: Record<string, unknown>): string;
  function getLang(): string;
  function setLang(lang: string): void;
  /** Built-in category ids/metadata (constants.js). */
  var CATS: any;
  var CAT_ICONS: Record<string, string>;
  var CURRENCIES: any;
  var DEFAULT_EXCHANGE_RATES: Record<string, number>;
  function toast(msg: string): void;
  function showToast(msg: string, opts?: Record<string, unknown>): { close: () => void };

  /* The app uses `window` as a global namespace bus (every module bridges
     its symbols onto it). An index signature keeps `window.foo` checks
     loose so files can be added to `include` without per-property Window
     augmentation each time. */
  interface Window {
    [key: string]: any;
  }
}
