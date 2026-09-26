// Local color + layout tokens for the chat surface (PR β₁-A split).
//
// v3 (PR7b): colors now re-export from packages/design-tokens — the styling
// source of truth — instead of hardcoding hex values. Same export names,
// so every chat component picks up the relaxed-premium palette.

import { colors } from '@wingmic/design-tokens';

import { TAB_BAR_HEIGHT_PX as SHARED_TAB_BAR_HEIGHT_PX } from '@/app/_components/BottomTabBar';

export const accent = colors.accent;
export const second = colors.second;
export const third = colors.third;
export const violet = colors.info.violet;
export const blue = colors.info.blue;
export const coral = colors.alarm;

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
