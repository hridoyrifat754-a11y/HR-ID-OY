import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        manifestFilename: 'manifest.json',
        includeAssets: [
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
          'assets/aistudio/Gemini_Generated_Image_dh5p3odh5p3odh5p_10534da2.jpeg',
        ],
        manifest: {
          id: '/',
          name: 'আলম খান',
          short_name: 'আলম খান',
          description: 'আলম খান · কর্তৃপক্ষ: হৃদয় · ২য়–৭ম তলার ৩৫টি রুমের ভাড়া ও ডাইনিং সাব-মিটার বিদ্যুৎ হিসাব',
          lang: 'bn',
          dir: 'ltr',
          theme_color: '#064e3b',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait-primary',
          start_url: '/',
          scope: '/',
          prefer_related_applications: false,
          categories: ['utilities', 'finance', 'productivity'],
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: '/assets/aistudio/Gemini_Generated_Image_dh5p3odh5p3odh5p_10534da2.jpeg',
              sizes: '1024x1024',
              type: 'image/jpeg',
              purpose: 'any',
            },
          ],
        },
        workbox: {
          cleanupOutdatedCaches: true,
          skipWaiting: true,
          clientsClaim: true,
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          navigateFallbackDenylist: [
            /^\/api\//,
            /^\/__\//,
            /^\/manifest\.(json|webmanifest)$/,
            /^\/\.well-known\//,
          ],
          globPatterns: ['**/*.{css,html,ico,png,svg}'],
          globIgnores: ['**/charts-*.js', '**/pdf-export-*.js', '**/html2canvas*.js', '**/purify*.js', '**/index.es-*.js'],
          runtimeCaching: [
            // Strictly NEVER cache API, Firebase Auth, /__/auth, or Cloud Firestore requests in Service Worker
            {
              urlPattern: ({ url }) =>
                url.pathname.startsWith('/api/') || url.pathname.startsWith('/__/'),
              handler: 'NetworkOnly',
            },
            {
              urlPattern: ({ url }) =>
                url.hostname.endsWith('googleapis.com') && !url.hostname.startsWith('fonts.'),
              handler: 'NetworkOnly',
            },
            {
              urlPattern: ({ url }) =>
                url.hostname === 'accounts.google.com' ||
                url.hostname === 'apis.google.com' ||
                url.hostname.endsWith('.firebaseio.com'),
              handler: 'NetworkOnly',
            },
            {
              urlPattern: ({ url }) =>
                url.origin === self.location.origin && url.pathname.startsWith('/assets/'),
              handler: 'CacheFirst',
              options: {
                cacheName: 'app-assets-cache',
                expiration: {
                  maxEntries: 60,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    build: {
      chunkSizeWarningLimit: 900,
      rolldownOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules/firebase')) return 'firebase';
            if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) return 'charts';
            if (id.includes('node_modules/jspdf') || id.includes('node_modules/html2canvas')) return 'pdf-export';
            if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) return 'react-vendor';
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname || __dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
