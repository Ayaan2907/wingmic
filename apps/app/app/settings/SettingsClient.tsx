'use client';

/**
 * SettingsClient — /settings (PR η-settings).
 *
 * Reads the caller's prefs via `trpc.settings.get` and persists each change
 * through `trpc.settings.update.mutate({ <field>: value })`. Local optimistic
 * state keeps controls snappy; the server row is the source of truth on reload.
 *
 * Sections: account (email, read-only) · audio retention (radio of the four
 * enum values) · privacy (acknowledgedPrivacy, read-only — onboarding κ owns
 * the write) · capture (mic device id + ASR language) · advanced (linker model
 * override) · about (static version/links).
 *
 * Bottom-nav / desktop rail is owned by the shared AppShell (PR λ-shell);
 * this screen renders no nav of its own. Colors via @/app/chat/_components/tokens.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from '@/lib/auth-client';
import { trpc } from '@/lib/trpc/client';
import { accent } from '@/app/chat/_components/tokens';

type RetentionMode = '24h' | '7d' | 'forever' | 'never';

export type SettingsInitialData = {
  audioRetentionMode: RetentionMode;
  linkerModelOverride: string | null;
  preferredMicDeviceId: string | null;
  asrLanguage: string;
  acknowledgedPrivacy: boolean;
  calendarIcsUrl: string | null;
};

const RETENTION_OPTIONS: { value: RetentionMode; label: string; hint: string }[] = [
  { value: '24h', label: '24 hours', hint: 'audio wiped a day after capture' },
  { value: '7d', label: '7 days', hint: 'a week, then gone' },
  { value: 'forever', label: 'forever', hint: 'keep raw audio until you delete it' },
  { value: 'never', label: 'never store', hint: 'transcribe, then drop the audio' },
];

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: 1,
  textTransform: 'uppercase',
  color: 'var(--text-40)',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 className="mono" style={{ ...labelStyle, margin: '0 0 12px' }}>
        {title}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
    </section>
  );
}

const fieldRow: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

const textInput: React.CSSProperties = {
  background: 'var(--bg-elev, rgba(255,255,255,0.04))',
  border: '1px solid var(--border-soft)',
  borderRadius: 10,
  padding: '10px 12px',
  color: 'var(--ink)',
  fontSize: 13,
  fontFamily: 'inherit',
};

export default function SettingsClient({
  email,
  initialSettings,
}: {
  email: string;
  initialSettings: SettingsInitialData;
}) {
  const { data } = trpc.settings.get.useQuery(undefined, { initialData: initialSettings });
  const update = trpc.settings.update.useMutation();
  const router = useRouter();
  const [signingOut, setSigningOut] = React.useState(false);

  // Optimistic local mirror — seeded from server prefetch + query cache.
  const [local, setLocal] = React.useState<{
    audioRetentionMode: RetentionMode;
    linkerModelOverride: string;
    preferredMicDeviceId: string;
    asrLanguage: string;
    calendarIcsUrl: string;
  }>(() => ({
    audioRetentionMode: initialSettings.audioRetentionMode,
    linkerModelOverride: initialSettings.linkerModelOverride ?? '',
    preferredMicDeviceId: initialSettings.preferredMicDeviceId ?? '',
    asrLanguage: initialSettings.asrLanguage,
    calendarIcsUrl: initialSettings.calendarIcsUrl ?? '',
  }));

  React.useEffect(() => {
    if (data) {
      setLocal({
        audioRetentionMode: data.audioRetentionMode,
        linkerModelOverride: data.linkerModelOverride ?? '',
        preferredMicDeviceId: data.preferredMicDeviceId ?? '',
        asrLanguage: data.asrLanguage,
        calendarIcsUrl: data.calendarIcsUrl ?? '',
      });
    }
  }, [data]);

  React.useEffect(() => {
    if (window.location.hash !== '#calendars') return;
    document.getElementById('calendars')?.scrollIntoView({ block: 'start' });
  }, []);

  if (!data) {
    return (
      <main
        style={{ minHeight: '100dvh', background: 'var(--bg-page)', color: 'var(--ink)', padding: 20 }}
        data-screen="settings"
      >
        <span className="mono" style={labelStyle}>
          loading…
        </span>
      </main>
    );
  }

  const setRetention = (value: RetentionMode) => {
    setLocal((s) => (s ? { ...s, audioRetentionMode: value } : s));
    update.mutate({ audioRetentionMode: value });
  };

  return (
    <main
      style={{
        minHeight: '100dvh',
        background: 'var(--bg-page)',
        color: 'var(--ink)',
      }}
      data-screen="settings"
    >
      <header
        style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--border-soft)',
          position: 'sticky',
          top: 0,
          background: 'rgba(10,10,10,0.85)',
          backdropFilter: 'blur(20px)',
          zIndex: 30,
        }}
      >
        <span
          className="mono"
          style={{ fontSize: 14, fontWeight: 700, letterSpacing: -0.5, color: 'var(--ink)' }}
        >
          settings
        </span>
      </header>

      <div
        style={{
          padding: '24px 20px 64px',
          maxWidth: 640,
          width: '100%',
          margin: '0 auto',
          boxSizing: 'border-box',
        }}
      >
        {/* account ───────────────────────────────────────────── */}
        <Section title="account">
          <div style={fieldRow}>
            <span style={labelStyle}>email</span>
            <span style={{ fontSize: 14, color: 'var(--text-85)' }}>{email}</span>
          </div>
          <button
            type="button"
            data-testid="settings-sign-out"
            disabled={signingOut}
            onClick={async () => {
              setSigningOut(true);
              try {
                await signOut();
                router.push('/signin');
              } finally {
                setSigningOut(false);
              }
            }}
            className="mono"
            style={{
              alignSelf: 'flex-start',
              padding: '8px 14px',
              borderRadius: 10,
              border: '1px solid var(--border-soft)',
              background: 'transparent',
              color: 'var(--ink)',
              fontSize: 12,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              cursor: signingOut ? 'wait' : 'pointer',
            }}
          >
            {signingOut ? 'signing out…' : 'sign out'}
          </button>
        </Section>

        {/* audio retention ───────────────────────────────────── */}
        <Section title="audio retention">
          <div role="radiogroup" aria-label="audio retention" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {RETENTION_OPTIONS.map((opt) => {
              const checked = local.audioRetentionMode === opt.value;
              return (
                <label
                  key={opt.value}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 14px',
                    borderRadius: 12,
                    cursor: 'pointer',
                    border: `1px solid ${checked ? `${accent}66` : 'var(--border-soft)'}`,
                    background: checked ? `${accent}14` : 'transparent',
                  }}
                >
                  <input
                    type="radio"
                    name="audioRetentionMode"
                    value={opt.value}
                    checked={checked}
                    onChange={() => setRetention(opt.value)}
                    aria-label={opt.label}
                    style={{ accentColor: accent }}
                  />
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{opt.label}</span>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--text-40)' }}>
                      {opt.hint}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </Section>

        {/* privacy ───────────────────────────────────────────── */}
        <Section title="privacy">
          <div style={fieldRow}>
            <span style={labelStyle}>acknowledged privacy notice</span>
            <span style={{ fontSize: 14, color: 'var(--text-85)' }}>
              {data.acknowledgedPrivacy ? 'yes' : 'not yet'}
            </span>
          </div>
        </Section>

        {/* capture ───────────────────────────────────────────── */}
        <Section title="capture">
          <label style={fieldRow}>
            <span style={labelStyle}>preferred mic device id</span>
            <input
              style={textInput}
              value={local.preferredMicDeviceId}
              placeholder="default"
              onChange={(e) => setLocal((s) => (s ? { ...s, preferredMicDeviceId: e.target.value } : s))}
              onBlur={(e) => update.mutate({ preferredMicDeviceId: e.target.value || null })}
            />
          </label>
          <label style={fieldRow}>
            <span style={labelStyle}>asr language</span>
            <input
              style={textInput}
              value={local.asrLanguage}
              placeholder="en-US"
              onChange={(e) => setLocal((s) => (s ? { ...s, asrLanguage: e.target.value } : s))}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v.length >= 2) update.mutate({ asrLanguage: v });
              }}
            />
          </label>
        </Section>

        <Section title="calendars">
          <div id="calendars" data-testid="settings-calendars" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {!local.calendarIcsUrl ? (
              <p
                data-testid="settings-calendar-nudge"
                className="mono"
                style={{ fontSize: 11, color: 'var(--text-55)', margin: 0, lineHeight: 1.5 }}
              >
                skipped during setup — paste a public ics url here.
              </p>
            ) : null}
            <p style={{ fontSize: 13, color: 'var(--text-85)', margin: 0, lineHeight: 1.5 }}>
              export a public calendar feed and paste the ics url. we only fetch events that
              calendar already publishes.
            </p>
            <p className="mono" style={{ fontSize: 11, color: 'var(--text-40)', margin: 0, lineHeight: 1.5 }}>
              google calendar: calendar settings → make available to public → integrate calendar →
              copy the public address in ical format.
            </p>
            <div style={fieldRow}>
              <label htmlFor="settings-calendar-ics" style={labelStyle}>
                public ics url
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  id="settings-calendar-ics"
                  style={{ ...textInput, flex: 1, minWidth: 0 }}
                  value={local.calendarIcsUrl}
                  placeholder="https://calendar.google.com/calendar/ical/…/public/basic.ics"
                  autoComplete="off"
                  onChange={(e) => setLocal((s) => (s ? { ...s, calendarIcsUrl: e.target.value } : s))}
                  onBlur={(e) => update.mutate({ calendarIcsUrl: e.target.value.trim() || null })}
                />
                <button
                  type="button"
                  data-testid="settings-calendar-privacy"
                  aria-describedby="settings-calendar-privacy-note"
                  aria-label="private. we only fetch publicly available events from your calendar."
                  className="mono"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    flexShrink: 0,
                    padding: '8px 10px',
                    borderRadius: 10,
                    border: '1px solid var(--border-soft)',
                    background: 'transparent',
                    color: 'var(--text-55)',
                    fontSize: 11,
                    letterSpacing: 0.6,
                    textTransform: 'uppercase',
                  }}
                >
                  <EyeIcon />
                  private
                </button>
              </div>
              <p
                id="settings-calendar-privacy-note"
                className="mono"
                style={{ fontSize: 11, color: 'var(--text-40)', margin: 0, lineHeight: 1.5 }}
              >
                we only fetch publicly available events from your calendar.
              </p>
            </div>
          </div>
        </Section>

        {/* advanced ──────────────────────────────────────────── */}
        <Section title="advanced">
          <label style={fieldRow}>
            <span style={labelStyle}>linker model override</span>
            <input
              style={textInput}
              value={local.linkerModelOverride}
              placeholder="default model"
              onChange={(e) => setLocal((s) => (s ? { ...s, linkerModelOverride: e.target.value } : s))}
              onBlur={(e) => update.mutate({ linkerModelOverride: e.target.value || null })}
            />
          </label>
        </Section>

        {/* imports ───────────────────────────────────────────── */}
        <Section title="imports">
          <Link
            href="/imports"
            data-testid="settings-imports-link"
            style={{
              display: 'block',
              padding: '12px 14px',
              borderRadius: 10,
              border: '1px solid var(--border-soft)',
              background: 'var(--surface-1)',
              color: 'var(--ink)',
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            import contacts →
            <span
              className="mono"
              style={{
                display: 'block',
                marginTop: 4,
                fontSize: 11,
                fontWeight: 400,
                color: 'var(--text-40)',
              }}
            >
              LinkedIn CSV or vCard — private to you
            </span>
          </Link>
        </Section>

        {/* about ─────────────────────────────────────────────── */}
        <Section title="about">
          <span className="mono" style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--text-40)' }}>
            wingmic v0.1.2 · the social RAM you carry
          </span>
          <a
            href="https://github.com/Ayaan2907/wingmic"
            style={{ fontSize: 13, color: accent, textDecoration: 'none' }}
          >
            source on github
          </a>
        </Section>
      </div>
    </main>
  );
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
