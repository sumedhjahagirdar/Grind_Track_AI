/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        ink: {
          50: '#f6f7f9',
          100: '#eceef2',
          200: '#d5d9e2',
          300: '#b0b8c8',
          400: '#8590a8',
          500: '#67738d',
          600: '#525c73',
          700: '#434b5e',
          800: '#3a4050',
          900: '#1f2330',
          950: '#13161f',
        },
        brand: {
          50: '#eefcf5',
          100: '#d6f7e6',
          200: '#aeedcf',
          300: '#75ddb1',
          400: '#3cc590',
          500: '#19a874',
          600: '#0d875d',
          700: '#0c6b4c',
          800: '#0d543e',
          900: '#0c4534',
        },
        accent: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,0.04), 0 4px 12px rgba(15,23,42,0.06)',
        'card-hover': '0 2px 4px rgba(15,23,42,0.06), 0 8px 24px rgba(15,23,42,0.10)',
      },
    },
  },
  plugins: [],
}
