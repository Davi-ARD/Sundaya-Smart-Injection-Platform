import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// @mold-tracker/shared dibangun sebagai CommonJS untuk apps/api. Di web kita
// arahkan langsung ke sumber TypeScript-nya: vite mengompilasinya apa adanya,
// jadi tidak ada cache pre-bundle CJS->ESM yang bisa basi setiap shared di-build
// ulang. Gejala cache basi: export baru (mis. MOLD_TRACKING_FLOW) jadi undefined
// saat runtime dan halaman yang memakainya render kosong (layar putih).
const sharedSrc = fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@mold-tracker/shared': sharedSrc },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
