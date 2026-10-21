/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./*.html', './*.js'],
  theme: {
    extend: {
      colors: {
        // Sampled from the WR+ logo
        ink: {
          DEFAULT: '#171E2D',
          800: '#1F2738',
          700: '#2B3448',
        },
        brand: {
          DEFAULT: '#0055F8',
          dark: '#0045CC',
          light: '#EAF1FF',
          sky: '#6FA3FF',
        },
        mist: '#F4F6F9',
        line: '#E3E7ED',
        muted: '#566074',
        subtle: '#8A93A4',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
