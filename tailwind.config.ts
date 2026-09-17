import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#EAF6F1',
          100: '#D2ECE1',
          200: '#A7D9C6',
          300: '#78C2A9',
          400: '#469C82',
          500: '#1F7A61',
          600: '#146650',
          700: '#0F5240',
          800: '#0B3F32',
          900: '#083128',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,.04), 0 8px 24px rgba(16,24,40,.06)',
        'card-hover': '0 2px 4px rgba(16,24,40,.05), 0 16px 32px rgba(16,24,40,.09)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
};
export default config;
