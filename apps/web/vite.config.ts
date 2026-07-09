import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // @mold-tracker/shared dibangun sebagai CommonJS; paksa vite pre-bundle (CJS -> ESM)
    // supaya named import runtime seperti enum Role bekerja di dev server.
    include: ['react', 'react-dom', 'react-router-dom', '@mold-tracker/shared'],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
