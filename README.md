# CASHFLOW.SYS

A privacy-first personal-finance PWA for tracking income, expenses, budgets, savings goals, and recurring transactions.

Built by Kenneth Flynn Gunawan as a modular frontend project focused on a practical everyday workflow: record a transaction, understand spending, and stay on track with a budget.

## Highlights

- **Transaction tracking** — income and expenses with categories
- **Budget management** — monthly budgets with rollover support
- **Savings goals** — progress tracking with milestones
- **Analytics** — charts and spending insights
- **Multi-currency** — support for 10 currencies
- **Recurring transactions** — repeat subscriptions and regular income
- **Import/export** — CSV, XLSX, and PDF workflows
- **Voice input** — hands-free transaction entry
- **PWA** — responsive, installable, and available offline
- **Bilingual UI** — English and Bahasa Indonesia

## Engineering focus

- Split a large frontend into small, feature-focused modules.
- Keep data, business logic, UI rendering, and translations separate.
- Use TypeScript checks and Vitest to make changes safer.
- Design the app as a responsive PWA rather than a desktop-only dashboard.

## Tech stack

| Area | Tools |
|---|---|
| Frontend | Vanilla JavaScript, HTML, CSS |
| Tooling | Vite, TypeScript |
| Testing | Vitest |
| Backend services | Firebase Authentication and Firestore |
| Data visualisation | Chart.js |
| PWA | Service Worker and Web App Manifest |

## Run locally

### Prerequisites

- Node.js 20+
- A Firebase project if you want cloud sign-in and data sync

### Setup

```bash
git clone https://github.com/Kenrockender/cashflow-sys.git
cd cashflow-sys
npm install
npm run dev
```

Vite prints the local URL to open in your browser.

To use Firebase, add your own project configuration in `src/data/firebase-config.js` and configure Firestore rules so each authenticated user can access only their own records.

## Quality checks

```bash
npm run typecheck
npm test
npm run build
```

## Project structure

```text
src/
├── core/       # state, constants, and helpers
├── data/       # Firebase and data access
├── features/   # transactions, budgets, goals, and related logic
├── ui/         # rendering and reusable interface components
├── services/   # external integrations
└── i18n/       # translations

public/         # static assets, styles, PWA files
tests/          # automated tests
docs/           # deeper project documentation
```

## Notes

This is a portfolio project. Set up Firebase security rules and review the configuration before using it with real financial data.
