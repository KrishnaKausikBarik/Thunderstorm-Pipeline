/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkBg: '#0f1117',
        cardBg: '#1a1d27',
        borderBg: '#2d3748',
        accentRed: '#e53e3e',
        accentRedHover: '#c53030',
        successGreen: '#38a169',
        successGreenHover: '#2f855a',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
