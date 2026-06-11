# Cashflow Landing Page

**Date:** 2026-06-11
**Status:** Approved (brainstorming complete; user pre-approved implementation)
**Scope:** Standalone marketing landing page at `/`, app moves to `/app`. Public-product tone, EN/ID bilingual, Mercury-style scroll-zoom hero. No app-code changes beyond a returning-user flag and a `login=1` deep link.

## Decisions (from brainstorming)

- **Tone:** public product. No fake testimonials, no invented user counts — trust claims limited to true facts (free, private, offline-capable, bilingual, installable).
- **Entry flow:** smart skip. Landing is the front door at `/`; returning users (have signed in before on this device) redirect instantly to `/app`. `/?stay=1` overrides the skip.
- **Hero visual:** CSS-built dashboard mockup using Graphite Mint tokens (net worth chart, summary cards). No image assets.
- **Architecture:** standalone `public/landing.html` + `landing.css` + `landing.js`. Visitors never download the app bundle, Firebase, or Chart.js.
- **Hero motion:** Mercury-style scroll zoom — mockup starts in perspective (`rotateX ≈ 22°`, `scale 0.92`, dimmed) and flattens/zooms to full as the user scrolls the first ~60vh. rAF-throttled scroll handler (~20 lines); static flat render under `prefers-reduced-motion`.

## Page structure

1. **Nav (sticky):** wordmark "Cashflow", EN·ID toggle pill, mint "Open app" button → `/app?login=1`.
2. **Hero:** trust badge ("Free · Private · Works offline"), headline "Your money, calm and clear." (reuses app tagline), one-sentence subhead, primary CTA "Continue with Google" → `/app?login=1`, then the scroll-zoom dashboard mockup (summary cards + history→projection mint chart).
3. **Feature cards (4):** Quick add (NL parsing + voice), Budgets & goals (limits, rollover, targets), Forecast (net worth trend + 6-month projection), Import & export (bank statements in, CSV/PDF out).
4. **Trust strip:** data stays in your account · installs as an app (PWA) · works offline · EN/ID.
5. **Closing CTA:** "Start tracking in under a minute." + Google CTA + footnote "Free · No card required".

Subtle scroll-in reveals on sections (IntersectionObserver), gated by reduced motion. OG/Twitter meta tags + description on the page for link previews.

## Routing & smart skip

- `vercel.json`: `/` → `/public/landing.html`; add `/app` → `/public/index.html`; existing asset rewrites unchanged.
- `src/services/auth.js`: on successful sign-in set `localStorage['cf-returning'] = '1'`; handle `?login=1` (signed out → trigger Google popup, same handler as the login button).
- `landing.html` head, inline before paint: if `localStorage['cf-returning']` and no `stay=1` param → `location.replace('/app')`.
- Local dev: page served at `/public/landing.html`; app links fall back to `index.html` relative path when not running under the Vercel rewrites (detect via `location.pathname`).
- `public/service-worker.js`: add `/public/landing.html`, `/public/styles/landing.css`, `/public/landing.js` to precache; bump cache to v6.

## i18n

`landing.js` carries its own small EN/ID dictionary (`data-l` attributes on elements). Toggle persists to `localStorage['cf-lang']` so the app opens in the same language. Initial language honors saved `cf-lang`.

## Files

| File | Purpose |
|---|---|
| `public/landing.html` (new) | Markup, OG meta, inline smart-skip script |
| `public/styles/landing.css` (new) | Self-contained styles; copies Graphite Mint token block |
| `public/landing.js` (new) | Scroll-zoom hero, scroll reveals, EN/ID toggle |
| `vercel.json` | `/` → landing, `/app` → app |
| `src/services/auth.js` | `cf-returning` flag, `login=1` deep link |
| `public/service-worker.js` | Precache landing assets, bump to v6 |

## Testing

Presentational feature — no unit-testable logic. Verify in browser preview: page renders, scroll-zoom transform progresses with scroll, EN/ID toggle swaps copy and persists, smart-skip redirects when `cf-returning` is set and `stay=1` overrides it, reduced-motion renders static. `npm test` stays green.
