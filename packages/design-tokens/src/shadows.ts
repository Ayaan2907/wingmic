/**
 * v3 "relaxed premium" elevation — soft, diffused, layered.
 * Every layer is a blur; no hard offsets anywhere (v2's 4px 4px 0 #000 is gone).
 * Layer recipe: contact shadow + ambient + wide lift, all near-black warm.
 */
export const shadows = {
  /** Resting cards. */
  card: '0 1px 2px rgba(6,6,10,0.28), 0 8px 24px rgba(6,6,10,0.30), 0 24px 56px rgba(6,6,10,0.22)',
  /** Cards floating above content: hover states, sticky headers. */
  raised: '0 2px 4px rgba(6,6,10,0.30), 0 12px 32px rgba(6,6,10,0.36), 0 32px 72px rgba(6,6,10,0.26)',
  /** Sheets, overlays, modals. */
  overlay: '0 4px 8px rgba(6,6,10,0.32), 0 20px 48px rgba(6,6,10,0.44), 0 48px 96px rgba(6,6,10,0.32)',
  /** Buttons at rest — quiet contact + short ambient. */
  button: '0 1px 2px rgba(6,6,10,0.32), 0 6px 18px rgba(6,6,10,0.22)',
  /** Buttons on hover — the shadow lifts, never offsets. */
  buttonHover: '0 2px 4px rgba(6,6,10,0.32), 0 10px 28px rgba(6,6,10,0.28)',
  /** Amber candlelight halo for floating graph chrome. */
  glowAccent:
    '0 0 0 1px rgba(255,196,82,0.20), 0 8px 32px rgba(255,196,82,0.10), 0 0 64px rgba(255,196,82,0.08)',
  /** Marketing phone mocks (faint inner amber retained). */
  phone: '0 24px 48px rgba(6,6,10,0.42), 0 64px 120px rgba(6,6,10,0.36), inset 0 0 48px rgba(255,196,82,0.04)',
} as const;
