/**
 * micOrbState — pure mapping from recorder status to MicOrb visual state.
 *
 * v0.1.2 PR α v15 — visual-layer-only task (plan §18 v15).
 *
 * Source of truth: design/v2/library/lib-voice.jsx `VoiceMicStates` + `MicOrb`.
 * The MicOrb has 7 named visual states; the underlying `useAudioRecorder`
 * hook has 9 internal recorder states. This file collapses the 9 → 7 without
 * touching the recorder.
 *
 * The 7 MicOrb states and what each one signals:
 *   - idle:      resting · invitation                (surface-1 fill, t70 glyph)
 *   - hover:     cursor / press-in                   (brighter border)
 *   - recording: live · pulse-s + rings              (accent fill, glow, rings)
 *   - locked:    hands-free · lock glyph             (accent fill, lock glyph)
 *   - sending:   arrow-up · spinner halo             (accent fill, t70 glyph)
 *   - thinking:  after release · 3-dot               (3-dot wm-pulse-d cluster)
 *   - done:      check · 600ms then fade             (accent fill, check glyph)
 *
 * Mapping rationale (see plan §18 v15):
 *   - 'idle' / 'error' / 'ready' before consumer-reset → idle (or hover)
 *     · 'error' is surfaced via the failed-bubble in the thread, not the orb.
 *     · 'ready' is a transient frame between stop() and consumer reset().
 *   - 'arming' → recording. Visually indistinguishable for the user — the mic
 *     is "armed and listening" the moment they press. Avoids a strobe between
 *     idle and the recording chrome.
 *   - 'recording' | 'cancel_armed' | 'lock_armed' → recording. The dock chrome
 *     conveys the arming-direction (slide hints); the orb glyph stays steady.
 *   - 'locked' → locked.
 *   - 'encoding' → sending. The blob is finalizing for upload — the closest
 *     visual to lib-voice `sending` (upload-in-progress, arrow-up halo).
 *
 * Reserved (not currently produced):
 *   - thinking: lib-voice's "agent thinking" 3-dot state. The recorder hook
 *     stops at 'ready' once the blob is in hand; downstream upload + LLM
 *     extraction happen in CaptureClient's pipeline and live on the message
 *     bubble, not the orb. Reserved here so a future recorder rewrite can wire
 *     it in without breaking callers.
 *   - done: lib-voice's brief check-flash on commit success. Same reasoning —
 *     the commit success surface today is the GraphCard, not the orb. Reserved
 *     so a future "orb flashes ✓ on commit" beat is a one-line change.
 *
 * Hover is purely a CSS / pointer concern, not a recorder concern. Callers
 * pass `isHovered` based on their own :hover / :focus-visible bookkeeping.
 */

import type { RecorderStatus } from './_components/useAudioRecorder';

export type MicOrbState =
  | 'idle'
  | 'hover'
  | 'recording'
  | 'locked'
  | 'sending'
  | 'thinking'
  | 'done';

export function micOrbStateFor(
  recorderStatus: RecorderStatus,
  isHovered: boolean,
): MicOrbState {
  switch (recorderStatus) {
    case 'arming':
    case 'recording':
    case 'cancel_armed':
    case 'lock_armed':
      return 'recording';
    case 'locked':
      return 'locked';
    case 'encoding':
      return 'sending';
    case 'ready':
    case 'idle':
    case 'error':
      return isHovered ? 'hover' : 'idle';
    default: {
      const _exhaustive: never = recorderStatus;
      return isHovered ? 'hover' : 'idle';
    }
  }
}
