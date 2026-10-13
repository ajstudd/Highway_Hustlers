/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
        sans: ['"Inter Tight"', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: 'rgb(var(--ink) / <alpha-value>)',
        night: 'rgb(var(--night) / <alpha-value>)',
        paper: 'rgb(var(--paper) / <alpha-value>)',
        marigold: 'rgb(var(--marigold) / <alpha-value>)',
        dusk: 'rgb(var(--dusk) / <alpha-value>)',
      },
    },
  },
  plugins: [],
};
