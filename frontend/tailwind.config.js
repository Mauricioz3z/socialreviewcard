/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        ui: ['"Schibsted Grotesk"', 'system-ui', 'sans-serif'],
        serif: ['Newsreader', 'serif'],
        jakarta: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      colors: {
        accent: { DEFAULT: '#6d5efc', hover: '#5b4cf0', soft: '#efedff' },
      },
      keyframes: {
        toastIn: {
          from: { opacity: '0', transform: 'translateY(12px) scale(.97)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        toastIn: 'toastIn .4s cubic-bezier(.2,.9,.3,1.2) both',
        fadeUp: 'fadeUp .35s ease both',
      },
    },
  },
  plugins: [],
};
