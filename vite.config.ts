import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Aphasia Aid',
        short_name: 'Aphasia Aid',
        description: 'Communication board, speech practice and AI companion for people with aphasia',
        theme_color: '#0d6a72',
        background_color: '#faf7f2',
        display: 'standalone',
        orientation: 'any',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        // Vision models + wasm are large; cache them on first use instead of precaching.
        runtimeCaching: [
          { urlPattern: /\/(models|wasm)\//, handler: 'CacheFirst', options: { cacheName: 'vision-assets', expiration: { maxEntries: 12 } } },
        ],
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  server: { proxy: { '/api': 'http://localhost:8787' } },
  preview: { proxy: { '/api': 'http://localhost:8787' } },
})
