/** @type {import('tailwindcss').Config} */
module.exports = {
  // Add to your tailwind.config.js content array:
  //   './node_modules/@patienttrac/clinical-viewer/src/**/*.{ts,tsx}'
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
      },
      fontFamily: {
        display: ['Rajdhani', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
    },
  },
}
