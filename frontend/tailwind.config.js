/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        space: {
          950: '#030712',
          900: '#0B0F19',
          800: '#111827',
          700: '#1F2937'
        },
        infrared: {
          500: '#EF4444',
          600: '#DC2626',
          glow: '#F87171'
        }
      }
    },
  },
  plugins: [],
}
