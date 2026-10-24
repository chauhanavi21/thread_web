// Warm cream paper, near-black ink and one soft terracotta accent, like the Dribbble fashion references.
// `brand` is the neutral scale (cream → ink); `accent` is the single highlight colour.
const BRAND = {
  50: '#faf6f1',
  100: '#f4ede4',
  200: '#e9dfd2',
  300: '#d8cab8',
  400: '#b3a38f',
  500: '#857867',
  600: '#625748',
  700: '#443b30',
  800: '#2a231c',
  900: '#17120e',
  950: '#0c0906',
};
const ACCENT = {
  50: '#fdf3ee',
  100: '#fbe3d8',
  200: '#f5c4ad',
  300: '#ee9e7c',
  400: '#e57a52',
  500: '#d95f35',
  600: '#c0481f',
  700: '#9f3a19',
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: { brand: BRAND, accent: ACCENT },
      fontFamily: {
        sans: ['"Instrument Sans Variable"', 'system-ui', 'sans-serif'],
        display: ['"Instrument Serif"', 'Georgia', 'serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgb(23 18 14 / 0.04), 0 10px 30px -12px rgb(23 18 14 / 0.18)',
        lift: '0 2px 4px rgb(23 18 14 / 0.05), 0 22px 44px -16px rgb(23 18 14 / 0.28)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(22px)' },
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
        'fade-in': 'fade-in 1.1s ease-out both',
        marquee: 'marquee 40s linear infinite',
      },
    },
  },
  plugins: [],
};

