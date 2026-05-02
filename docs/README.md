# CASHFLOW.SYS

> Personal Finance Terminal — Track · Control · Grow

A modern, privacy-first personal finance PWA (Progressive Web App) with a sleek terminal-inspired aesthetic. Built with vanilla JavaScript and Firebase for real-time sync.

![Theme](https://img.shields.io/badge/theme-gold%20%26%20black-c8a96e)
![PWA](https://img.shields.io/badge/PWA-ready-success)
![Firebase](https://img.shields.io/badge/backend-Firebase-orange)
![Architecture](https://img.shields.io/badge/architecture-modular-blue)

## 🎉 Recently Reorganized!

This codebase has been **completely reorganized** into a clean, modular architecture. See [REORGANIZATION.md](REORGANIZATION.md) for details.

## Features

### Core Functionality
- **Transaction Tracking** — Log income and expenses with categories, notes, and dates
- **Smart Categorization** — Auto-categorize transactions using keyword detection
- **Budget Management** — Set monthly budgets by category (amount or percentage-based)
- **Goals Tracking** — Create and monitor savings goals with milestone celebrations
- **Dashboard Analytics** — Visual charts showing spending patterns and trends

### Multi-Currency Support
- 10 currencies supported: IDR, USD, SGD, EUR, GBP, JPY, MYR, THB, AUD, CNY
- Configurable exchange rates
- Travel mode for quick currency switching

### Smart Features
- **Voice Input** — Add transactions hands-free
- **PDF Import** — Parse bank statements automatically
- **Recurring Transactions** — Track subscriptions and regular expenses
- **Budget Rollover** — Carry unused budget to next month
- **Offline Support** — Full PWA with service worker caching

### Internationalization
- English and Indonesian (Bahasa) language support
- Locale-aware number formatting

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vanilla JavaScript, HTML5, CSS3 |
| Backend | Firebase (Auth, Firestore) |
| Charts | Chart.js |
| PDF Parsing | PDF.js |
| PDF Export | jsPDF |
| PWA | Service Worker, Web App Manifest |

## Project Structure

```
cashflow-sys/
├── src/                          # Source code
│   ├── core/                     # Core application logic
│   │   ├── state.js              # Global state management
│   │   ├── constants.js          # Constants & categories
│   │   └── helpers.js            # Utility functions
│   │
│   ├── data/                     # Data layer
│   │   ├── store.js              # Firestore abstraction
│   │   ├── firebase-init.js      # Firebase initialization
│   │   └── firebase-config.js    # Firebase configuration
│   │
│   ├── features/                 # Feature modules
│   │   ├── transactions/         # Transaction management
│   │   │   ├── transactions.js   # CRUD operations
│   │   │   ├── recurring.js      # Recurring logic
│   │   │   ├── import-export.js  # Import/export (CSV, XLSX, PDF)
│   │   │   └── parser-bca.js     # Bank statement parsers
│   │   │
│   │   ├── budget/               # Budget management
│   │   │   └── budget.js         # Budget & rollover
│   │   │
│   │   ├── goals/                # Savings goals
│   │   │   ├── goals.js          # Goals CRUD
│   │   │   ├── contributions.js  # Contributions
│   │   │   └── milestones.js     # Milestone tracking
│   │   │
│   │   ├── accounts/             # Account management
│   │   │   ├── accounts.js       # Account CRUD
│   │   │   ├── transfers.js      # Transfers
│   │   │   └── categories.js     # Custom categories
│   │   │
│   │   ├── reimbursement/        # Reimbursement tracking
│   │   ├── ai-insights/          # AI-powered insights
│   │   └── notifications/        # Budget notifications
│   │
│   ├── ui/                       # UI layer
│   │   ├── render/               # Rendering logic
│   │   └── components/           # UI components
│   │       ├── charts.js         # Chart rendering
│   │       └── events.js         # Event handlers
│   │
│   ├── services/                 # Services
│   │   ├── auth.js               # Authentication
│   │   ├── exchange-rates.js     # Currency exchange
│   │   └── parser.js             # General parser
│   │
│   ├── i18n/                     # Internationalization
│   │   └── i18n.js               # i18n core (EN/ID)
│   │
│   └── utils/                    # Utilities
│       └── lib/                  # Utility libraries
│
├── public/                       # Static assets
│   ├── index.html                # Main HTML
│   ├── cashflow-sys.html         # Alternative UI
│   ├── rebuild.html              # Rebuild page
│   ├── service-worker.js         # PWA service worker
│   ├── manifest.json             # PWA manifest
│   ├── logo.svg                  # Logo
│   ├── favicon.ico               # Favicon
│   │
│   ├── styles/                   # Stylesheets
│   │   ├── styles.css            # Main styles
│   │   ├── mobile.css            # Mobile responsive
│   │   ├── reimburse.css         # Reimbursement styles
│   │   └── cashflow-override.css # Theme overrides
│   │
│   └── icons/                    # PWA icons
│
├── tests/                        # Tests
│   ├── exchange-math.test.mjs
│   ├── mergeTransactions.test.mjs
│   └── parserAmount.test.mjs
│
├── docs/                         # Documentation
│   ├── README.md                 # This file
│   ├── REORGANIZATION.md         # Reorganization guide
│   ├── REORGANIZATION-SUMMARY.md # Detailed summary
│   ├── QUICK-REFERENCE.md        # Quick lookup guide
│   └── HTML-UPDATE-CHECKLIST.md  # HTML update instructions
│
├── firebase.json                 # Firebase config
├── firestore.indexes.json        # Firestore indexes
├── firestore.rules               # Firestore security rules
└── package.json                  # NPM dependencies
```

### Architecture Highlights

✅ **Modular Design** - Clear separation of concerns  
✅ **Feature-Based** - Business logic organized by domain  
✅ **Scalable** - Easy to add new features  
✅ **Maintainable** - Small, focused files (~80 lines avg)  
✅ **Well-Documented** - Comprehensive guides in `docs/`

See [QUICK-REFERENCE.md](QUICK-REFERENCE.md) for a guide to finding specific code.

## Getting Started

### Prerequisites
- A modern web browser
- Firebase project (for authentication and data storage)

### Setup

1. **Clone or download** this repository

2. **Configure Firebase**
   - Create a project at [Firebase Console](https://console.firebase.google.com)
   - Enable Google Authentication
   - Create a Firestore database
   - Update `src/data/firebase-config.js` with your project credentials

3. **Configure Firestore Security Rules**
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId}/{document=**} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```

4. **Update HTML Script Tags** ⚠️ IMPORTANT
   - Follow the guide in [HTML-UPDATE-CHECKLIST.md](HTML-UPDATE-CHECKLIST.md)
   - Update script paths in `public/index.html` to reference new file locations
   - This step is **required** for the app to run after reorganization

5. **Serve the app**
   - Use any static file server (e.g., VS Code Live Server, `npx serve`, or Python's `http.server`)
   - Serve from the root directory (not `public/`)
   - Open `public/index.html` in browser

### Demo Mode
The app includes demo data for testing. Sign in with any Google account to start fresh or explore with sample transactions.

### Development

**Quick Reference:**
- Find code: See [QUICK-REFERENCE.md](QUICK-REFERENCE.md)
- Add features: Follow patterns in `src/features/`
- Modify UI: Check `src/ui/render/` and `src/ui/components/`
- Update styles: Edit files in `public/styles/`

**Testing:**
```bash
# Run tests
npm test

# Or run specific test
node tests/parserAmount.test.mjs
```

## Categories

| Category | Icon | Color |
|----------|------|-------|
| Food & Drink | [utensils] | Terracotta |
| Transport | [truck] | Blue |
| Shopping | [bag] | Purple |
| Health | [activity] | Green |
| Bills | [zap] | Gold |
| Entertainment | [film] | Pink |
| Education | [book] | Teal |
| Personal | [user] | Lime |
| Housing | [home] | Orange |
| Subscriptions | [smartphone] | Violet |
| Social | [heart] | Red |
| Other | [info] | Gray |

## Keyboard Shortcuts

The app supports quick transaction entry with natural language:
- `"Lunch 50k"` → Food expense, Rp 50,000
- `"Grab 25rb"` → Transport expense, Rp 25,000
- `"Salary 8.5jt"` → Income, Rp 8,500,000

## License

This project is for personal use. Please review Firebase's terms of service for any deployment considerations.

## Documentation

- **[QUICK-REFERENCE.md](QUICK-REFERENCE.md)** - Where to find things
- **[REORGANIZATION.md](REORGANIZATION.md)** - Complete reorganization guide
- **[REORGANIZATION-SUMMARY.md](REORGANIZATION-SUMMARY.md)** - Detailed summary
- **[HTML-UPDATE-CHECKLIST.md](HTML-UPDATE-CHECKLIST.md)** - HTML update instructions

## Contributing

When adding new features:
1. Create a new directory in `src/features/your-feature/`
2. Keep files focused (one responsibility per file)
3. Document dependencies in file headers
4. Update this README and documentation
5. Follow existing code patterns

## Security Note

⚠️ **Important**: 
- Never commit `src/data/firebase-config.js` with real credentials to a public repository
- Configure Firestore rules properly (see setup instructions)
- The app includes a security banner to remind you

## Changelog

### v2.0.0 - Code Reorganization (Latest)
- ✅ Reorganized into modular architecture
- ✅ Split large files into focused modules
- ✅ Improved maintainability and scalability
- ✅ Added comprehensive documentation
- See [REORGANIZATION-SUMMARY.md](REORGANIZATION-SUMMARY.md) for details

### v1.0.0 - Initial Release
- Core transaction tracking
- Budget management
- Goals tracking
- Multi-currency support
- PWA with offline support

---

Built with ☕ and minimalist design principles.

**Status**: ✅ Production-ready | 📦 Modular | 📚 Well-documented
