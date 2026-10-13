/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Playfair Display', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Space Mono', 'monospace'],
      },
      colors: {
        bg: '#0d0d0a',
        'bg-warm': '#111008',
        surface: '#1a1812',
        'surface-2': '#252218',
        cream: '#f0e8d6',
        'cream-dim': '#b8aa90',
        terracotta: '#c8604a',
        'terracotta-light': '#e07a62',
        forest: '#3d5a3e',
        'forest-light': '#4e7250',
        amber: '#c8962a',
        'amber-light': '#e0aa38',
        sand: '#9e8a62',
        dust: '#6b5e48',
      },
      borderColor: {
        DEFAULT: 'rgba(255,255,255,0.08)',
        warm: 'rgba(198,164,102,0.18)',
      },
    },
  },
  plugins: [],
};
