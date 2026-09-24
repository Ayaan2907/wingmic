/**
 * micPrime — pure logic for the onboarding mic-priming step (spec D4, AC6).
 *
 * Onboarding step 3 used to be an explainer-only mock (handoff OQ-2: "actual
 * mic prompt = later polish"), so the first real orb tap hit a browser
 * permission sheet mid-take. The step now asks for the mic on a tap, so the
 * grant is cached by the browser before the first take.
 *
 * Honesty rules (AC6):
 *   - granted → say ready, and release the stream immediately (priming only —
 *     capture still records through the orb later).
 *   - denied / unavailable / dismissed → surface the outcome with the capture
 *     surface's own error copy (useAudioRecorder). Never fake success; always
 *     leave a retry affordance.
 *   - Skipping the step never blocks onboarding (loop guard preserved in the
 *     client's finish('skip') path — untouched).
 */

export type MicPrimeCode = 'NotAllowedError' | 'mic_unavailable';

export type MicPrimeState =
  | { status: 'idle' }
  | { status: 'asking' }
  | { status: 'granted'; /** browser reports the grant as persisted across loads */ persistent: boolean }
  | { status: 'denied'; code: MicPrimeCode; message: string };

/** The slice of MediaStream the priming flow relies on. */
interface MicStream {
  getTracks(): { stop(): void }[];
}

export type MicRequester = (constraints: { audio: boolean }) => Promise<MicStream>;

/**
 * Maps a getUserMedia failure exactly the way the capture surface does
 * (`useAudioRecorder`): NotAllowedError covers both an explicit denial and a
 * dismissed browser prompt; everything else is treated as "no usable mic".
 *
 * Rejections are DOMExceptions, which some environments do NOT subclass Error
 * (jsdom notably) — so this matches on `name` rather than `instanceof Error`;
 * the name is the only cross-realm-stable signal of "the browser held the mic".
 */
export function describeMicDenial(err: unknown): { code: MicPrimeCode; message: string } {
  const name =
    typeof err === 'object' && err !== null && 'name' in err
      ? String((err as { name: unknown }).name)
      : undefined;
  if (name === 'NotAllowedError') {
    return {
      code: 'NotAllowedError',
      message: 'your browser is holding the mic. unlock it, or type the memo.',
    };
  }
  return {
    code: 'mic_unavailable',
    message: 'mic unavailable. plug one in or type the memo.',
  };
}

/**
 * Whether the browser itself reports the mic grant as persisted. Safari does
 * not reliably keep getUserMedia grants across page loads, and where the
 * permissions query is unsupported or rejects, the honest answer is "unknown"
 * (null) — callers should treat unknown as not persistent and use copy that
 * doesn't promise the sheet will never appear again.
 */
export async function micGrantPersistent(): Promise<boolean | null> {
  const permissions =
    typeof navigator === 'undefined' ? undefined : navigator.permissions;
  if (!permissions?.query) return null;
  try {
    const status = await permissions.query({ name: 'microphone' as PermissionName });
    return status.state === 'granted' ? true : false;
  } catch {
    return null;
  }
}

/**
 * Asks for the mic, then releases it — onboarding only needs the permission
 * grant cached by the browser, never a live stream. Rejects on denial; the
 * caller maps the failure through describeMicDenial.
 */
export async function requestMicAccess(request: MicRequester): Promise<void> {
  const stream = await request({ audio: true });
  stream.getTracks().forEach((t) => t.stop());
}
