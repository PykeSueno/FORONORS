import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        coffee: {
          950: '#1a120d',
          900: '#241913',
          800: '#33241d',
          700: '#453126',
          200: '#e9dcc9',
          100: '#f4ede2'
        }
      }
    }
  },
  plugins: []
};

export default config;
