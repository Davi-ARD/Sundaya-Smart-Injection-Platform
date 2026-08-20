/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'sans-serif',
        ],
        heading: [
          'Montserrat',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'sans-serif',
        ],
      },
      colors: {
        // Biru enterprise (SSIP). Primary = brand-800.
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        // Hijau layanan (CTA, status on-time/sukses).
        accent: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
        // Latar halaman: ice blue tint, harmonis dengan sidebar gelap dan aksen brand.
        surface: '#F0F4F8',
      },
      boxShadow: {
        // Soft UI Evolution: bayangan lembut, lebih jelas dari neumorphism.
        soft: '0 1px 2px rgba(16, 24, 40, 0.04), 0 4px 12px rgba(16, 24, 40, 0.06)',
        'soft-lg': '0 4px 8px rgba(16, 24, 40, 0.05), 0 12px 28px rgba(16, 24, 40, 0.10)',
      },
    },
  },
  plugins: [],
}
