# CASHFLOW.SYS

> Personal Finance Terminal — Track · Control · Grow

A modern, privacy-first personal finance PWA with a sleek terminal-inspired aesthetic.

![Theme](https://img.shields.io/badge/theme-gold%20%26%20black-c8a96e)
![PWA](https://img.shields.io/badge/PWA-ready-success)
![Firebase](https://img.shields.io/badge/backend-Firebase-orange)
![Architecture](https://img.shields.io/badge/architecture-modular-blue)

## 🎉 Recently Reorganized!

This codebase has been **completely reorganized** into a clean, modular architecture for better maintainability and scalability.

### Quick Stats
- ✅ **25 directories** organized by purpose
- ✅ **43 source files** properly categorized
- ✅ **10 focused modules** (split from 1 large file)
- ✅ **~80 lines** average file size (down from 1000+)
- ✅ **Comprehensive documentation** in `docs/`

## 📚 Documentation

| Document | Description |
|----------|-------------|
| **[docs/README.md](docs/README.md)** | Full project documentation |
| **[docs/QUICK-REFERENCE.md](docs/QUICK-REFERENCE.md)** | Where to find things |
| **[docs/REORGANIZATION.md](docs/REORGANIZATION.md)** | Complete reorganization guide |
| **[docs/HTML-UPDATE-CHECKLIST.md](docs/HTML-UPDATE-CHECKLIST.md)** | HTML update instructions |

## 🚀 Quick Start

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd cashflow-sys
   ```

2. **Configure Firebase**
   - Update `src/data/firebase-config.js` with your credentials
   - See [docs/README.md](docs/README.md) for detailed setup

3. **Update HTML files** ⚠️ IMPORTANT
   - Follow [docs/HTML-UPDATE-CHECKLIST.md](docs/HTML-UPDATE-CHECKLIST.md)
   - Update script paths in `public/index.html`

4. **Serve the app**
   ```bash
   npx serve
   # or use any static file server
   ```

5. **Open in browser**
   - Navigate to `http://localhost:3000/public/index.html`

## 🗂️ Project Structure

```
cashflow-sys/
├── src/                    # Source code (organized by feature)
│   ├── core/              # State, constants, helpers
│   ├── data/              # Firebase, store
│   ├── features/          # Business logic
│   ├── ui/                # Rendering & components
│   ├── services/          # External integrations
│   └── i18n/              # Translations
│
├── public/                # Static assets
│   ├── styles/           # CSS files
│   ├── icons/            # PWA icons
│   └── *.html            # HTML files
│
├── tests/                # Test files
├── docs/                 # Documentation
└── Config files          # Firebase, package.json, etc.
```

## ✨ Features

- 💰 **Transaction Tracking** - Income & expenses with categories
- 📊 **Budget Management** - Monthly budgets with rollover
- 🎯 **Savings Goals** - Track progress with milestones
- 📈 **Analytics** - Visual charts and insights
- 💱 **Multi-Currency** - 10 currencies supported
- 🔄 **Recurring Transactions** - Auto-generate subscriptions
- 📱 **PWA** - Offline support, installable
- 🌐 **i18n** - English & Indonesian
- 📥 **Import/Export** - CSV, XLSX, PDF support
- 🎤 **Voice Input** - Hands-free transaction entry

## 🛠️ Tech Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Backend**: Firebase (Auth, Firestore)
- **Charts**: Chart.js
- **PWA**: Service Worker, Web App Manifest
- **Architecture**: Modular, feature-based

## 📖 Development

### Finding Code
See [docs/QUICK-REFERENCE.md](docs/QUICK-REFERENCE.md) for a complete guide to file locations.

**Common locations:**
- Transactions: `src/features/transactions/`
- Budget: `src/features/budget/`
- Goals: `src/features/goals/`
- UI: `src/ui/render/` and `src/ui/components/`
- Styles: `public/styles/`

### Adding Features
1. Create directory in `src/features/your-feature/`
2. Add feature files
3. Document dependencies
4. Update HTML script tags
5. Update documentation

### Running Tests
```bash
npm test
```

## 📝 Recent Changes

### v2.0.0 - Code Reorganization
- ✅ Reorganized into modular architecture
- ✅ Split large files (1000+ lines → 10 focused modules)
- ✅ Improved maintainability and scalability
- ✅ Added comprehensive documentation
- ✅ Clear separation of concerns

See [docs/REORGANIZATION-SUMMARY.md](docs/REORGANIZATION-SUMMARY.md) for full details.

## 🔒 Security

⚠️ **Important:**
- Never commit `src/data/firebase-config.js` with real credentials
- Configure Firestore security rules properly
- See [docs/README.md](docs/README.md) for security setup

## 📄 License

This project is for personal use. Review Firebase's terms of service for deployment.

## 🤝 Contributing

Contributions welcome! Please:
1. Follow existing code patterns
2. Keep files focused (one responsibility)
3. Document dependencies
4. Update documentation
5. Test thoroughly

## 📞 Support

- **Documentation**: See `docs/` folder
- **Issues**: Check browser console for errors
- **Questions**: Review [docs/QUICK-REFERENCE.md](docs/QUICK-REFERENCE.md)

---

**Status**: ✅ Production-ready | 📦 Modular | 📚 Well-documented

Built with ☕ and minimalist design principles.
