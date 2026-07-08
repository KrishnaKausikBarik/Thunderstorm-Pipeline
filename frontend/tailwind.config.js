/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkBg: '#09090e',
        cardBg: '#12121a',
        glassBg: 'rgba(23, 23, 36, 0.65)',
        borderBg: '#232336',
        borderGlow: 'rgba(139, 92, 246, 0.3)',
        accentPrimary: '#8b5cf6', // Violet
        accentPrimaryHover: '#7c3aed',
        accentSecondary: '#ec4899', // Pink
        accentRed: '#f43f5e',
        accentRedHover: '#e11d48',
        successGreen: '#10b981',
        successGreenHover: '#059669',
      },
      fontFamily: {
        sans: ['Urbanist', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      animation: {
        'gradient-x': 'gradient-x 15s ease infinite',
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-up': 'slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'blob': 'blob-drift 18s ease-in-out infinite',
      },
      keyframes: {
        'gradient-x': {
          '0%, 100%': {
            'background-size': '200% 200%',
            'background-position': 'left center'
          },
          '50%': {
            'background-size': '200% 200%',
            'background-position': 'right center'
          }
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'blob-drift': {
          '0%, 100%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(150px, -100px) scale(1.1)' },
          '66%': { transform: 'translate(-100px, 150px) scale(0.9)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'neon-primary': '0 0 20px rgba(139, 92, 246, 0.4)',
        'neon-secondary': '0 0 20px rgba(236, 72, 153, 0.4)',
        'neon-success': '0 0 20px rgba(16, 185, 129, 0.4)',
      },
      backdropBlur: {
        'glass': '12px',
      }
    },
  },
  plugins: [],
}
