/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        // Neutral scale — true near-white / near-black, not blue-tinted.
        // Every existing ink-* usage across the app inherits this automatically.
        ink: {
          50: '#FCFCFC',
          100: '#F2F2F2',
          200: '#E5E5E5',
          300: '#D4D4D4',
          400: '#A3A3A3',
          500: '#737373',
          600: '#525252',
          700: '#3F3F3F',
          800: '#262626',
          900: '#141414',
          950: '#0A0A0A',
        },
        // Primary accent, used sparingly for interactive/focus/active states —
        // replaces the earlier green brand color.
        brand: {
          50: '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
          800: '#3730A3',
          900: '#312E81',
        },
        accent: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
        // Secondary accent (purple) — paired with brand for AI-specific
        // gradient elements only, used sparingly per the design system.
        glow: {
          400: '#C084FC',
          500: '#A855F7',
          600: '#9333EA',
        },
      },
      boxShadow: {
        card: '0 2px 8px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 16px rgba(0,0,0,0.06)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s ease-out both',
      },
    },
  },
  plugins: [],
}
