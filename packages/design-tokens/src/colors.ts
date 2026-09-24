/**
 * v3 relaxed premium — calm warm-dark surfaces differentiated by tint, not
 * by borders. Borders sit quieter than v2; surfaces carry the separation.
 * Amber stays the single signature — applied as candlelight tints, not alerts.
 */
export const colors = {
  bg: {
    page: '#0a0a0a',
    card: '#08080d',
  },
  ink: {
    DEFAULT: '#f4f1ea',
    pure: '#ffffff',
    muted: 'rgba(244,241,234,0.55)',
    faint: 'rgba(244,241,234,0.38)',
  },
  accent: '#FFC452',
  accentSoft: 'rgba(255,196,82,0.12)',
  accentFaint: 'rgba(255,196,82,0.06)',
  second: '#86efac',
  third: '#FF8FAB',
  alarm: '#FF6B6B',
  info: {
    blue: '#7DD3FC',
    violet: '#A78BFA',
  },
  surface: {
    1: 'rgba(255,255,255,0.04)',
    2: 'rgba(255,255,255,0.06)',
    3: 'rgba(255,255,255,0.09)',
  },
  border: {
    soft: 'rgba(255,255,255,0.05)',
    mid: 'rgba(255,255,255,0.08)',
    hard: 'rgba(255,255,255,0.12)',
  },
} as const;
