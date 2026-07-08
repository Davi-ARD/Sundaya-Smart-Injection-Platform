import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // @mold-tracker/shared dikompilasi ke CommonJS dan berada di luar
    // node_modules, jadi harus ikut diproses plugin commonjs saat build.
    commonjsOptions: {
      include: [/node_modules/, /packages[\\/]shared/],
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
