import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    // Phase 22: offline support + installability. registerType: 'prompt'
    // (not 'autoUpdate') deliberately leaves reloading in the user's
    // hands -- PwaUpdateBanner.jsx surfaces "update available" and only
    // calls updateServiceWorker() when they click it, since an automatic
    // reload could otherwise land mid pomodoro/quiz.
    VitePWA({
      registerType: 'prompt',
      // The app registers the service worker itself via the
      // virtual:pwa-register/react hook in PwaUpdateBanner.jsx, so the
      // plugin's own auto-injected registration script would just register
      // a second, redundant controller for the same worker.
      injectRegister: false,
      includeAssets: ['favicon-32.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'HTET Study Desk',
        short_name: 'HTET Study Desk',
        description: 'Haryana TET exam prep: syllabus tracker, spaced-repetition flashcards, mock tests, and study planner.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f3f2f2',
        theme_color: '#b68235',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // Default globPatterns already cover the built JS/CSS/HTML; add the
        // icon PNGs explicitly since they live in public/ untouched by hashing.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}']
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        // Phase 26: React/ReactDOM change far less often than the app's own
        // code, so splitting them into their own chunk lets browsers reuse
        // a cached copy across deploys that only touch app code. Supabase
        // isn't listed here -- it's now loaded via a dynamic import() (see
        // supabaseClient.js), which Rollup already splits into its own
        // chunk automatically, fetched only when actually needed.
        manualChunks: {
          react: ['react', 'react-dom']
        }
      }
    }
  },
  server: {
    host: true
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    css: false
  }
});
