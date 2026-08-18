'use client';

/**
 * OnboardingClient — /onboarding first-run flow (PR κ-onboarding).
 *
 * Four steps: (1) welcome, (2) first / last / linkedin url, (3) mic-permission
 * explainer (mock — getUserMedia waits until record in chat), (4) privacy
 * acknowledgement + "get started".
 *
 * Both "get started" and skip `await acknowledge.mutateAsync(...)` then
 * `router.push('/chat')`. Skip still acknowledges on purpose: a skip that left the
 * flag false would re-trigger the home gate forever. Skip may omit the profile;
 * "next" on the you-step requires first + last.
 *
 * Full-viewport, renders no nav of its own — /onboarding is in AppShell's
 * CHROMELESS list (PR λ-shell). Colors via @/app/chat/_components/tokens.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc/client';
import { normalizeLinkedInUrl } from '@/lib/imports';
import { accent, second, third, blue, violet } from '@/app/chat/_components/tokens';

const TOTAL_STEPS = 4;
const PROFILE_STEP = 1;

const STEPS: { eyebrow: string; title: string; titleTwist: string; body: string }[] = [
  {
    eyebrow: '◆ welcome',
    title: 'your social ram,',
    titleTwist: 'on disk.',
    body: 'tap the mic. talk like a human. wingmic builds the graph behind every person you meet.',
  },
  {
    eyebrow: '◆ you',
    title: 'who you are,',
    titleTwist: 'in the graph.',
    body: 'first, last, and an optional linkedin url. skip is fine — this is for you, not a login.',
  },
  {
    eyebrow: '◆ the mic',
    title: 'one mic,',
    titleTwist: 'one surface.',
    body: 'wingmic asks for the mic only when you press record in chat — never in the background. nothing is captured until you tap to talk.',
  },
  {
    eyebrow: '◆ privacy',
    title: 'your graph,',
    titleTwist: 'your data.',
    body: 'transcripts and the graph are scoped to your account. you control how long raw audio is kept in settings. open source, MIT.',
  },
];

const DOT_COLORS = [accent, second, third, blue, violet];

const fieldStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '14px 16px',
  borderRadius: 10,
  background: 'var(--surface-2, rgba(255,255,255,0.04))',
  border: '1px solid var(--border-mid, rgba(255,255,255,0.12))',
  color: 'var(--ink, #fff)',
  fontSize: 15,
  fontFamily: 'inherit',
  outline: 'none',
};

function profilePayload(firstName: string, lastName: string, linkedinUrl: string) {
  return {
    firstName: firstName.trim() || undefined,
    lastName: lastName.trim() || undefined,
    linkedinUrl: linkedinUrl.trim() || undefined,
  };
}

export default function OnboardingClient() {
  const router = useRouter();
  const acknowledge = trpc.onboarding.acknowledge.useMutation();
  const [step, setStep] = React.useState(0);
  const [leaving, setLeaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [linkedinUrl, setLinkedinUrl] = React.useState('');

  const finish = React.useCallback(async (mode: 'profile' | 'skip') => {
    if (leaving) return;
    setLeaving(true);
    setError(null);
    try {
      await acknowledge.mutateAsync(
        mode === 'skip' ? undefined : profilePayload(firstName, lastName, linkedinUrl),
      );
      router.push('/chat');
    } catch {
      setLeaving(false);
      setError("couldn't save — try again");
    }
  }, [acknowledge, router, leaving, firstName, lastName, linkedinUrl]);

  const goNext = React.useCallback(() => {
    if (step === PROFILE_STEP) {
      if (!firstName.trim() || !lastName.trim()) {
        setError('first and last name, please');
        return;
      }
      if (firstName.trim().length > 80 || lastName.trim().length > 80) {
        setError('keep names under 80 characters');
        return;
      }
      if (linkedinUrl.trim().length > 300) {
        setError('linkedin url is too long');
        return;
      }
      if (linkedinUrl.trim() && !normalizeLinkedInUrl(linkedinUrl)) {
        setError('linkedin url must be a linkedin.com profile');
        return;
      }
    }
    setError(null);
    setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1));
  }, [step, firstName, lastName, linkedinUrl]);

  const current = STEPS[step];
  const isLast = step === TOTAL_STEPS - 1;
  const onProfile = step === PROFILE_STEP;

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
        {onProfile && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24, maxWidth: 420 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="mono" style={{ fontSize: 11, letterSpacing: 1, color: 'var(--text-40)' }}>
                first name
              </span>
              <input
                type="text"
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Ada"
                maxLength={80}
                style={fieldStyle}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="mono" style={{ fontSize: 11, letterSpacing: 1, color: 'var(--text-40)' }}>
                last name
              </span>
              <input
                type="text"
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Lovelace"
                maxLength={80}
                style={fieldStyle}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="mono" style={{ fontSize: 11, letterSpacing: 1, color: 'var(--text-40)' }}>
                linkedin url
              </span>
              <input
                type="url"
                autoComplete="url"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="https://www.linkedin.com/in/you"
                maxLength={300}
                style={fieldStyle}
              />
            </label>
          </div>
        )}
      </div>

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
            onClick={() => finish('profile')}
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
            onClick={goNext}
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
        onClick={() => finish('skip')}
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
