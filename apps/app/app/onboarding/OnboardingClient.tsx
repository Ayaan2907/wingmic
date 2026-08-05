'use client';

/**
 * OnboardingClient — /onboarding first-run flow (PR κ-onboarding).
 *
 * Three steps: (1) welcome / what wingmic does, (2) mic-permission EXPLAINER
 * (a mock panel — we do NOT call getUserMedia here; the mic is requested only
 * when the user actually records, in chat), (3) privacy acknowledgement +
 * "get started". Dot progress, next/back, and a skip link.
 *
 * Both "get started" (step 3) and skip `await acknowledge.mutateAsync()` then
 * `router.push('/')`. Skip still acknowledges on purpose: a skip that left the
 * flag false would re-trigger the home gate forever. So skip == finish for the
 * privacy flag; it only differs in not walking the steps.
 *
 * Full-viewport, renders no nav of its own — /onboarding is in AppShell's
 * CHROMELESS list (PR λ-shell). Colors via @/app/chat/_components/tokens.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc/client';
import { accent, second, third, blue, violet } from '@/app/chat/_components/tokens';

const TOTAL_STEPS = 3;

const STEPS: { eyebrow: string; title: string; titleTwist: string; body: string }[] = [
  {
    eyebrow: '◆ welcome',
    title: 'your social ram,',
    titleTwist: 'on disk.',
    body: 'tap the mic. talk like a human. wingmic builds the graph behind every person you meet.',
  },
  {
    eyebrow: '◆ the mic',
    title: 'one mic,',
    titleTwist: 'one surface.',
    body: "wingmic asks for the mic only when you press record in chat — never in the background. nothing is captured until you tap to talk.",
  },
  {
    eyebrow: '◆ privacy',
    title: 'your graph,',
    titleTwist: 'your data.',
    body: 'transcripts and the graph are scoped to your account. you control how long raw audio is kept in settings. open source, MIT.',
  },
];

const DOT_COLORS = [accent, second, third, blue, violet];

export default function OnboardingClient() {
  const router = useRouter();
  const acknowledge = trpc.onboarding.acknowledge.useMutation();
  const [step, setStep] = React.useState(0);
  const [leaving, setLeaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const finish = React.useCallback(async () => {
    if (leaving) return;
    setLeaving(true);
    setError(null);
    try {
      await acknowledge.mutateAsync();
      router.push('/');
    } catch {
      // network/server failure — don't strand the user on the entry gate.
      // re-enable the buttons so they can retry.
      setLeaving(false);
      setError("couldn't save — try again");
    }
  }, [acknowledge, router, leaving]);

  const current = STEPS[step];
  const isLast = step === TOTAL_STEPS - 1;

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        padding: '40px 24px 36px',
        color: 'var(--text-100, #fff)',
        background: 'var(--bg-base, #0a0a0a)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div
        className="mono"
        style={{
          fontSize: 11,
          color: accent,
          letterSpacing: 2,
          textTransform: 'uppercase',
          marginBottom: 16,
        }}
      >
        {current.eyebrow}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <h1 style={{ font: '900 44px/0.95 var(--font-sans)', letterSpacing: '-0.035em', margin: 0 }}>
          {current.title}
          <br />
          <i style={{ fontStyle: 'italic', fontFamily: 'var(--font-serif)', fontWeight: 400, color: accent }}>
            {current.titleTwist}
          </i>
        </h1>
        <p style={{ font: '400 15px/1.5 var(--font-sans)', color: 'var(--text-55)', margin: '16px 0 0' }}>
          {current.body}
        </p>
      </div>

      {/* dot / bar progress */}
      <div
        aria-label={`step ${step + 1} of ${TOTAL_STEPS}`}
        style={{ display: 'flex', gap: 6, margin: '28px 0 20px' }}
      >
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 22,
              height: 4,
              borderRadius: 2,
              background: i <= step ? DOT_COLORS[i % DOT_COLORS.length] : 'rgba(255,255,255,0.15)',
            }}
          />
        ))}
      </div>
      <span className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        step {step + 1} of {TOTAL_STEPS}
      </span>

      <div style={{ display: 'flex', gap: 10 }}>
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            style={{
              padding: '15px 18px',
              borderRadius: 12,
              background: 'transparent',
              color: 'var(--text-70)',
              font: '700 15px var(--font-sans)',
              border: '1.5px solid var(--border-soft, rgba(255,255,255,0.15))',
              cursor: 'pointer',
            }}
          >
            back
          </button>
        )}
        {isLast ? (
          <button
            type="button"
            onClick={finish}
            disabled={leaving}
            style={{
              flex: 1,
              padding: 15,
              borderRadius: 12,
              background: accent,
              color: '#000',
              font: '700 15px var(--font-sans)',
              border: '1.5px solid #000',
              boxShadow: '4px 4px 0 #000',
              cursor: leaving ? 'default' : 'pointer',
            }}
          >
            get started →
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1))}
            style={{
              flex: 1,
              padding: 15,
              borderRadius: 12,
              background: accent,
              color: '#000',
              font: '700 15px var(--font-sans)',
              border: '1.5px solid #000',
              boxShadow: '4px 4px 0 #000',
              cursor: 'pointer',
            }}
          >
            next →
          </button>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="mono"
          style={{
            font: '500 12px var(--font-mono)',
            color: accent,
            letterSpacing: 1,
            margin: '12px 0 0',
            textAlign: 'center',
          }}
        >
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={finish}
        disabled={leaving}
        style={{
          width: '100%',
          padding: 12,
          marginTop: 10,
          background: 'transparent',
          color: 'var(--text-55)',
          font: '500 13px var(--font-mono)',
          border: 'none',
          cursor: leaving ? 'default' : 'pointer',
        }}
      >
        skip · I&apos;ll explore first
      </button>
    </main>
  );
}
