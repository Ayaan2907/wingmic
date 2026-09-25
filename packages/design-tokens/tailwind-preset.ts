import type { Config } from 'tailwindcss';
import { colors } from './src/colors';
import { radii } from './src/radii';
import { shadows } from './src/shadows';
import { typography } from './src/typography';
import { motion } from './src/motion';

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
        contact: shadows.contact,
        card: shadows.card,
        raised: shadows.raised,
        overlay: shadows.overlay,
        button: shadows.button,
        'button-hover': shadows.buttonHover,
        phone: shadows.phone,
        'glow-accent': shadows.glowAccent,
      },
      transitionTimingFunction: {
        relaxed: motion.ease.out,
      },
      keyframes: {
        blink: { '0%, 50%': { opacity: '1' }, '51%, 100%': { opacity: '0' } },
        'drift-up': { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
        'pulse-d': { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.4' } },
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        'spin-slow': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'rise-in': { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        breathe: { '0%, 100%': { opacity: '1', transform: 'scale(1)' }, '50%': { opacity: '0.78', transform: 'scale(1.02)' } },
      },
      animation: {
        blink: 'blink 0.7s step-end infinite',
        'drift-up': 'drift-up 5s ease-in-out infinite',
        'pulse-d': 'pulse-d 1.5s ease-in-out infinite',
        marquee: 'marquee 40s linear infinite',
        'spin-slow': 'spin-slow 20s linear infinite',
        'fade-in': `fade-in ${motion.duration.slow} ${motion.ease.out} both`,
        'rise-in': `rise-in ${motion.duration.slow} ${motion.ease.out} both`,
        breathe: `breathe 2.6s ${motion.ease.inOut} infinite`,
      },
    },
  },
  plugins: [],
};
