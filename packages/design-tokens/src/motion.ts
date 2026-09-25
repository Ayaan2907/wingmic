/**
 * v3 motion — subtle, purposeful, never bouncy.
 * `prefers-reduced-motion: reduce` collapses all of these globally (globals.css).
 */
export const motion = {
  duration: {
    fast: '150ms',
    base: '240ms',
    slow: '420ms',
  },
  ease: {
    /** Gentle deceleration — the default for entrances. */
    out: 'cubic-bezier(0.22, 1, 0.36, 1)',
    /** Symmetric moves: crossfades, position swaps. */
    inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
  },
} as const;
