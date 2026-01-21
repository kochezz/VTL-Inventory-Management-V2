/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Vilagio Brand Colors
        primary: {
          50: '#E8EEF7',
          100: '#D1DDEF',
          200: '#A3BBDF',
          300: '#7599CF',
          400: '#4777BF',
          500: '#4267B3', // Main Vilagio Blue
          600: '#35529F',
          700: '#283E8B',
          800: '#1B2977',
          900: '#0E1463',
        },
        dark: {
          50: '#F5F6F7',
          100: '#E9EBEE',
          200: '#D3D7DD',
          300: '#BDC3CC',
          400: '#A7AFBB',
          500: '#90949C', // Medium Gray
          600: '#616771', // Dark Charcoal
          700: '#4A4E56',
          800: '#32353B',
          900: '#1A1C20',
          950: '#0D0E10',
        },
        background: {
          light: '#E9EBEE', // Light Background
        },
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}
