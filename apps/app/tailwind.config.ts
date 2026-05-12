import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Same theme as apps/web; replaced by @wingmic/design-tokens preset in Task 5.
      colors: {
        ink: { page: '#0a0a0a', card: '#08080d', DEFAULT: '#f4f1ea', pure: '#ffffff' },
        accent: '#FFC452',
        second: '#86efac',
        third: '#FF8FAB',
        alarm: '#FF6B6B',
        info: { blue: '#7DD3FC', violet: '#A78BFA' },
      },
    },
  },
  plugins: [],
};

export default config;
