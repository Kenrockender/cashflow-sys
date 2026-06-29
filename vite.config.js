import { defineConfig } from 'vite';

/**
 * Cashflow build:
 *  - Multi-page: landing.html (/) and index.html (the app, served at /app).
 *  - publicDir `public/` (styles, icons, manifest, logo, favicon,
 *    service-worker.js, landing.js) is copied verbatim to dist/ root.
 *  - The app's ~40 former <script> tags are now one ES-module graph
 *    entered via /src/main.js and bundled by Rollup.
 */
export default defineConfig({
  root: '.',
  publicDir: 'public',
  appType: 'mpa',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    cssMinify: true,
    // Terser tends to beat esbuild on final size; the slower build is a
    // one-time cost. Keep console.* (the app uses warn/error for runtime
    // diagnostics) but strip debugger statements.
    minify: 'terser',
    terserOptions: {
      compress: { passes: 2, drop_debugger: true },
      format: { comments: false },
    },
    rollupOptions: {
      input: {
        landing: 'landing.html',
        app: 'index.html',
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.{test,spec}.{js,mjs,ts}'],
  },
});
