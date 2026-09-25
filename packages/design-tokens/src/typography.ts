/**
 * v3 relaxed premium — same three families, relaxed weights and tracking.
 * Display headings drop from 800–900 to 700; terminal-wide tracking relaxes.
 */
export const typography = {
  family: {
    sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
    serif: ['var(--font-instrument)', 'serif'],
    mono: ['var(--font-jetbrains)', 'monospace'],
  },
  letterSpacing: {
    tighter: '-0.028em',
    tight: '-0.018em',
  },
  weight: {
    display: 700,
    strong: 600,
    body: 400,
  },
  leading: {
    tight: 1.15,
    body: 1.6,
  },
} as const;
