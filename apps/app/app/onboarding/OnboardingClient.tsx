'use client';

/**
 * OnboardingClient — /onboarding first-run flow (PR κ-onboarding).
 *
 * Four steps: (1) welcome, (2) first / last / linkedin url / optional public
 * calendar ics, (3) mic priming — requests real getUserMedia on a tap so the
 * browser caches the grant before the first take (spec D4, AC6; was an
 * explainer-only mock), (4) privacy acknowledgement + "get started".
 *
 * Both "get started" and skip `await acknowledge.mutateAsync(...)` then
 * `router.push('/chat')`. Skip still acknowledges on purpose: a skip that left the
 * flag false would re-trigger the home gate forever. Skip may omit the profile;
 * "next" on the you-step requires first + last. An empty calendar is a skip —
 * AppShell then prompts to add it in settings until one is saved.
 *
 * Full-viewport, renders no nav of its own — /onboarding is in AppShell's
 * CHROMELESS list (PR λ-shell). Colors via @/app/chat/_components/tokens.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc/client';
import { normalizeLinkedInUrl } from '@/lib/imports';
import { parseCalendarIcsUrl } from '@/lib/enrich/parseIcs';
import { accent, second, third, blue, violet, coral } from '@/app/chat/_components/tokens';
import {
  describeMicDenial,
  micGrantPersistent,
  requestMicAccess,
  type MicPrimeState,
} from './micPrime';

const TOTAL_STEPS = 4;
const PROFILE_STEP = 1;
const MIC_STEP = 2;

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
    body: 'first, last, optional linkedin, optional public calendar. skip the calendar and we will ask again in settings.',
  },
  {
    eyebrow: '◆ the mic',
    title: 'one mic,',
    titleTwist: 'one surface.',
    body: 'one thing before your first take: we ask for the mic now, so recording never stops to ask. wingmic never listens in the background — nothing is captured until you tap to talk.',
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

function profilePayload(
  firstName: string,
  lastName: string,
  linkedinUrl: string,
  calendarIcsUrl: string,
) {
  const calendar = calendarIcsUrl.trim();
  return {
    firstName: firstName.trim() || undefined,
    lastName: lastName.trim() || undefined,
    linkedinUrl: linkedinUrl.trim() || undefined,
    ...(calendar ? { calendarIcsUrl: calendar } : {}),
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
  const [calendarIcsUrl, setCalendarIcsUrl] = React.useState('');
  const [mic, setMic] = React.useState<MicPrimeState>({ status: 'idle' });

  const primeMic = React.useCallback(async () => {
    const media = navigator.mediaDevices;
    if (!media?.getUserMedia) {
      setMic({ status: 'denied', ...describeMicDenial(new Error('mediaDevices unavailable')) });
      return;
    }
    setMic({ status: 'asking' });
    try {
      await requestMicAccess((constraints) => media.getUserMedia(constraints));
      // Safari doesn't reliably persist the grant; "unknown" (null) must not
      // promise the sheet won't reappear — AC6 honesty cuts both ways.
      setMic({ status: 'granted', persistent: (await micGrantPersistent()) === true });
    } catch (err) {
      setMic({ status: 'denied', ...describeMicDenial(err) });
    }
  }, []);

  const finish = React.useCallback(async (mode: 'profile' | 'skip') => {
    if (leaving) return;
    setLeaving(true);
    setError(null);
    try {
      await acknowledge.mutateAsync(
        mode === 'skip'
          ? undefined
          : profilePayload(firstName, lastName, linkedinUrl, calendarIcsUrl),
      );
      router.push('/chat');
    } catch {
      setLeaving(false);
      setError("couldn't save — try again");
    }
  }, [acknowledge, router, leaving, firstName, lastName, linkedinUrl, calendarIcsUrl]);

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
      if (calendarIcsUrl.trim() && !parseCalendarIcsUrl(calendarIcsUrl)) {
        setError('paste a public google calendar ics url');
        return;
      }
    }
    setError(null);
    setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1));
  }, [step, firstName, lastName, linkedinUrl, calendarIcsUrl]);

  const current = STEPS[step];
  const isLast = step === TOTAL_STEPS - 1;
  const onProfile = step === PROFILE_STEP;
  const onMic = step === MIC_STEP;

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
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="mono" style={{ fontSize: 11, letterSpacing: 1, color: 'var(--text-40)' }}>
                public ics url
              </span>
              <input
                type="url"
                autoComplete="off"
                value={calendarIcsUrl}
                onChange={(e) => setCalendarIcsUrl(e.target.value)}
                placeholder="https://calendar.google.com/calendar/ical/…/public/basic.ics"
                maxLength={500}
                style={fieldStyle}
              />
            </label>
          </div>
        )}
        {onMic && (
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24, maxWidth: 420 }}
            data-testid="mic-prime"
          >
            {mic.status === 'granted' ? (
              <p
                role="status"
                className="mono"
                style={{
                  font: '500 13px/1.5 var(--font-mono)',
                  color: second,
                  letterSpacing: 0.5,
                  margin: 0,
                }}
              >
                ✓ mic ready —{' '}
                {mic.persistent
                  ? "your first take won't stop to ask."
                  : 'your browser may ask again next time.'}
              </p>
            ) : mic.status === 'denied' ? (
              <>
                <p
                  role="alert"
                  className="mono"
                  style={{
                    font: '500 13px/1.5 var(--font-mono)',
                    color: coral,
                    letterSpacing: 0.5,
                    margin: 0,
                  }}
                >
                  {/* cause-specific prefix: nothing "blocked" a missing device */}
                  {mic.code === 'NotAllowedError' ? '✗ mic blocked — ' : '✗ '}
                  {mic.message}
                </p>
                <button
                  type="button"
                  onClick={primeMic}
                  style={{
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
                  try again
                </button>
                <p className="mono" style={{ font: '400 12px var(--font-mono)', color: 'var(--text-40)', margin: 0 }}>
                  you can continue — typed memos work too.
                </p>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={primeMic}
                  disabled={mic.status === 'asking'}
                  style={{
                    padding: 15,
                    borderRadius: 12,
                    background: accent,
                    color: '#000',
                    font: '700 15px var(--font-sans)',
                    border: '1.5px solid #000',
                    boxShadow: '4px 4px 0 #000',
                    cursor: mic.status === 'asking' ? 'default' : 'pointer',
                  }}
                >
                  {mic.status === 'asking' ? 'asking…' : 'enable the mic'}
                </button>
                {mic.status === 'idle' && (
                  <p className="mono" style={{ font: '400 12px var(--font-mono)', color: 'var(--text-40)', margin: 0 }}>
                    your browser shows the prompt — that&apos;s us, asking.
                  </p>
                )}
              </>
            )}
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
