/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'dark-bg': '#0f1117',
        'dark-card': '#1a1d29',
        'dark-border': '#2a2e3a',
        'profit': '#22c55e',
        'loss': '#ef4444',
        'primary': '#3b82f6',
        'secondary': '#8b5cf6',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}