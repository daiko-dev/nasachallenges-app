/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        obsidian: '#0A0D14',
        instrument: '#121722',
        instrumentBorder: '#334155',
        accentAmber: '#ec9625',
        svdvBlue: '#0f7edf',
        svdvOrange: '#ec9625',
        sciDark: '#070b12',
        sciPanel: '#0c131f',
        sciHeader: '#111927',
        sciBorder: '#1e2c40',
        sciBorderLight: '#2c3e55',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['"IBM Plex Mono"', '"Fira Code"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
