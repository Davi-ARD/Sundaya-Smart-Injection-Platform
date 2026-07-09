/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef6ff",
          100: "#d9ebff",
          300: "#8ac5ff",
          500: "#2488db",
          600: "#176fbd",
          700: "#155895",
        },
      },
    },
  },
  plugins: [],
}
