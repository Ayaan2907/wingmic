import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Core
        ink: {
          page: '#0a0a0a',
          card: '#08080d',
          DEFAULT: '#f4f1ea',
          pure: '#ffffff',
        },
        accent: '#FFC452',
        second: '#86efac',
        third: '#FF8FAB',
        alarm: '#FF6B6B',
        info: {
          blue: '#7DD3FC',
          violet: '#A78BFA',
        },
        // Surfaces (translucent on bg)
        surface: {
          1: 'rgba(255,255,255,0.025)',
          2: 'rgba(255,255,255,0.04)',
          3: 'rgba(255,255,255,0.06)',
        },
        border: {
          soft: 'rgba(255,255,255,0.06)',
          mid: 'rgba(255,255,255,0.10)',
          hard: 'rgba(255,255,255,0.15)',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-instrument)', 'serif'],
        mono: ['var(--font-jetbrains)', 'monospace'],
      },
      letterSpacing: {
        tighter: '-0.045em',
        tight: '-0.035em',
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '22px',
        '2xl': '36px',
      },
      boxShadow: {
        sticker: '3px 3px 0 rgba(0,0,0,0.2)',
        button: '4px 4px 0 #000',
        'button-hover': '5px 5px 0 #000',
        card: '0 20px 50px rgba(0,0,0,0.4)',
        phone:
          '0 30px 60px rgba(0,0,0,0.5), inset 0 0 40px rgba(255,196,82,0.05)',
        'glow-accent': '0 0 80px rgba(255,196,82,0.15)',
      },
      keyframes: {
        blink: {
          '0%, 50%': { opacity: '1' },
          '51%, 100%': { opacity: '0' },
        },
        'drift-up': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        'pulse-d': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
        'spin-slow': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        blink: 'blink 0.7s step-end infinite',
        'drift-up': 'drift-up 5s ease-in-out infinite',
        'pulse-d': 'pulse-d 1.5s ease-in-out infinite',
        marquee: 'marquee 40s linear infinite',
        'spin-slow': 'spin-slow 20s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
