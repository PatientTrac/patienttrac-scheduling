/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#030810',
          900: '#060e1c',
          800: '#0a1628',
          700: '#0f2040',
          600: '#152b55',
          500: '#1d3a6e',
        },
        gold: {
          300: '#e8cc9a',
          400: '#d9b87c',
          500: '#c9a96e',
          600: '#b8924f',
          700: '#9a7535',
        },
        slate: {
          hud: '#1a2744',
        },
      },
      fontFamily: {
        display: ['Rajdhani', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
      backgroundImage: {
        'grid-hud': `linear-gradient(rgba(201,169,110,0.04) 1px, transparent 1px),
                     linear-gradient(90deg, rgba(201,169,110,0.04) 1px, transparent 1px)`,
      },
      backgroundSize: {
        'grid-hud': '40px 40px',
      },
      boxShadow: {
        'gold-sm': '0 0 8px rgba(201,169,110,0.2)',
        'gold-md': '0 0 20px rgba(201,169,110,0.25)',
        'gold-lg': '0 0 40px rgba(201,169,110,0.2)',
        'hud': 'inset 0 1px 0 rgba(201,169,110,0.1), 0 4px 24px rgba(0,0,0,0.4)',
      },
      animation: {
        'pulse-gold': 'pulseGold 2s ease-in-out infinite',
        'scan': 'scan 3s linear infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-in': 'slideIn 0.3s ease-out',
      },
      keyframes: {
        pulseGold: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideIn: {
          from: { opacity: '0', transform: 'translateX(-8px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
}
