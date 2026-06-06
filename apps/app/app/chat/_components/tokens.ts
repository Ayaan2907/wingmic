// Local color tokens for the chat surface (PR β₁-A split).
//
// Lifted from CaptureClient verbatim — same hex values. v2 design-tokens
// will absorb these in PR γ; for now we keep parity with the capture
// surface, since chat IS the capture surface.

export const accent = '#FFC452';
export const second = '#86efac';
export const third = '#FF8FAB';
export const violet = '#A78BFA';
export const blue = '#7DD3FC';
export const coral = '#FF6B6B';

// Shared layout constants used by header / dock / privacy line.
import { TAB_BAR_HEIGHT_PX as SHARED_TAB_BAR_HEIGHT_PX } from '@/app/_components/BottomTabBar';

/** Pixel thresholds for the hold-to-talk slide gestures. */
export const HOLD_THRESHOLDS = {
  /** Pixels finger must travel from origin to ARM lock / discard (visual hint only). */
  armPx: 40,
  /** Pixels finger must travel from origin to COMMIT lock / discard. */
  commitPx: 80,
} as const;

/** Soft-delete grace window before the memo is permanently dropped. */
export const UNDO_WINDOW_MS = 30_000;
/** Vertical offset the dock button floats above the tab bar. */
export const BUTTON_FLOAT_ABOVE_PX = 24;
/** Bottom-nav height — re-exported from the shared BottomTabBar module. */
export const TAB_BAR_HEIGHT_PX = SHARED_TAB_BAR_HEIGHT_PX;
/** PrivacyAmbientLine sits above the dock button (88 = button height + breathing). */
export const PRIVACY_LINE_BOTTOM_PX = TAB_BAR_HEIGHT_PX + BUTTON_FLOAT_ABOVE_PX + 88;
/** Watchdog: force-stop the recorder if no pointerup event arrives within 60s. */
export const POINTER_WATCHDOG_MS = 60_000;
