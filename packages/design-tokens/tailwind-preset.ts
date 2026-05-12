import type { Config } from 'tailwindcss';
import { colors } from './src/colors';
import { radii } from './src/radii';
import { shadows } from './src/shadows';
import { typography } from './src/typography';

export const wingmicPreset: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        ink: { page: colors.bg.page, card: colors.bg.card, DEFAULT: colors.ink.DEFAULT, pure: colors.ink.pure },
        accent: colors.accent,
        second: colors.second,
        third: colors.third,
        alarm: colors.alarm,
        info: { blue: colors.info.blue, violet: colors.info.violet },
        surface: colors.surface,
        border: colors.border,
      },
      fontFamily: {
        sans: [...typography.family.sans],
        serif: [...typography.family.serif],
        mono: [...typography.family.mono],
      },
      letterSpacing: { ...typography.letterSpacing },
      borderRadius: {
        sm: `${radii.sm}px`,
        md: `${radii.md}px`,
        lg: `${radii.lg}px`,
        xl: `${radii.xl}px`,
        '2xl': `${radii['2xl']}px`,
      },
      boxShadow: {
        sticker: shadows.sticker,
        button: shadows.button,
        'button-hover': shadows.buttonHover,
        card: shadows.card,
        phone: shadows.phone,
        'glow-accent': shadows.glowAccent,
      },
      keyframes: {
        blink: { '0%, 50%': { opacity: '1' }, '51%, 100%': { opacity: '0' } },
        'drift-up': { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
        'pulse-d': { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.4' } },
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        'spin-slow': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
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
