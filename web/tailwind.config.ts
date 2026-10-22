/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Inter', 'system-ui', 'sans-serif'],
        brand: ['Unbounded', 'system-ui', 'sans-serif'], // post previews only — matches the rendered creatives
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        ink: { 950: '#09090B', 900: '#0E0E11', 850: '#131316', 800: '#18181B', 700: '#222226', 600: '#2E2E34' },
        volt: '#A3B1FF', // primary accent (soft periwinkle)
        pulse: '#9D8FE0',
        surge: '#7DBFCF',
        flare: '#E58A98',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(255,255,255,.08), 0 8px 24px -12px rgba(0,0,0,.6)',
        violet: '0 0 0 1px rgba(255,255,255,.08), 0 20px 50px -20px rgba(0,0,0,.8)',
      },
      keyframes: {
        ripple: { '0%': { transform: 'scale(.6)', opacity: '.9' }, '100%': { transform: 'scale(2.4)', opacity: '0' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
      },
      animation: {
        ripple: 'ripple 3s cubic-bezier(.2,.6,.3,1) infinite',
        shimmer: 'shimmer 2.4s linear infinite',
        float: 'float 5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
