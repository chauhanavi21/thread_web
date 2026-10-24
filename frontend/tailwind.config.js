// Palette and type follow the reference site: off-white paper, pure black ink, flat greys, no accent colour.
// `accent` is aliased to the same greys so older class names keep working.
const GREYS = {
  50: '#f4f4f4',
  100: '#eeeeee',
  200: '#e5e5e5',
  300: '#cfcfcf',
  400: '#a8a8a8',
  500: '#737373',
  600: '#525252',
  700: '#333333',
  800: '#1a1a1a',
  900: '#0a0a0a',
  950: '#000000',
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: { brand: GREYS, accent: GREYS },
      fontFamily: {
        sans: ['"Archivo Variable"', 'system-ui', 'sans-serif'],
        display: ['Anton', 'Impact', 'sans-serif'],
      },
      boxShadow: { soft: 'none' },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.9s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in': 'fade-in 1.2s ease-out both',
        marquee: 'marquee 40s linear infinite',
      },
    },
  },
  plugins: [],
};
