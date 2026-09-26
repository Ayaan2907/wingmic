'use client';

// apps/app/app/bay/Cards.tsx — the score flow, ported from ayaan-site
// assets/bay/score.js: pick an event dot → paste a profile (or use the
// browser-held one) → a score card with attend/skip and the why → claim keeps
// it. The client profile rides only as inputs (locked decision 3); errors map
// to the old route's honest taxonomy; a fit weight is never shown as a
// probability.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';
import type { BayPick } from './BayMap';
import { COPY } from './copy';
import type { ClientProfile } from '@/lib/bay/clientProfile';
import { profileFromText } from './clientProfile';

// ---------- score card ----------

type ScoreView =
  | { state: 'idle' }
  | { state: 'needs-profile' }
  | { state: 'running' }
  | { state: 'done'; data: ScoreOk }
  | { state: 'error'; message: string };

/** The score query's ok payload — typed from the router's outcome shape. */
type ScoreOk = {
  ok: true;
  event: {
    id: string;
    title: string;
    startsAt?: string;
    endsAt?: string;
    venue?: string;
    url?: string;
  };
  score: {
    go: number;
    verdict: 'go' | 'maybe' | 'skip';
    confidence: number;
    outcome: string;
    reasons: string[];
    meet: Array<{ who: string; why: string; starter?: string | null }>;
    scorer: 'typed' | 'llm';
  };
  fit: { rank: number; of: number; fit: number } | null;
  profile: { kind: string; quality: string };
  ai: boolean;
};

export function ScorePanel({
  pick,
  clientProfile,
  personaId,
  signedIn,
  onEmphasis,
  onClosed,
  onCleared,
  onProfileSaved,
}: {
  pick: BayPick | null;
  clientProfile: ClientProfile | null;
  personaId: string | null;
  signedIn: boolean;
  /** the card's own emphasis — the map repaints from the score's typed go */
  onEmphasis: (fits: Map<string, number> | null) => void;
  onClosed: () => void;
  /** the visitor cleared the stored profile (unlink became sign-out/clear) */
  onCleared: () => void;
  /** a paste that parsed — kept in the browser so later picks auto-score */
  onProfileSaved?: (profile: ClientProfile) => void;
}) {
  const [profileText, setProfileText] = useState('');
  const [view, setView] = useState<ScoreView>({ state: 'idle' });
  const scoreMut = trpc.bay.score.useMutation();
  const autoRanRef = useRef(false);
  const lastScoredRef = useRef<string | null>(null);

  const eventId = pick?.kind === 'event' ? pick.props.id : null;

  const run = async (id: string, paste?: string) => {
    // the id this card is now scoring for — the auto-run effect compares it
    // so picking a different event resets instead of reusing the old verdict
    lastScoredRef.current = id;
    setView({ state: 'running' });
    // paste → validate locally (bad pastes are bad_source, the ported taxonomy);
    // no paste → the browser-held profile, if the visitor has one
    const fromPaste = paste != null ? profileFromText(paste) : undefined;
    if (paste != null && !fromPaste) {
      setView({ state: 'error', message: COPY.scoreBadSource });
      return;
    }
    const profileInput = fromPaste ?? clientProfile ?? undefined;
    try {
      const data = (await scoreMut.mutateAsync({
        eventId: id,
        personaId: personaId ?? undefined,
        clientProfile: profileInput,
      })) as ScoreOk;
      // a stale completion — the visitor picked another event (or closed the
      // card) while this request was in flight — owns nothing: no verdict,
      // no reasons, no emphasis repaint for a pick that is no longer shown
      if (lastScoredRef.current !== id) return;
      setView({ state: 'done', data });
      onEmphasis(new Map([[id, data.score.go]]));
      // a parsed paste is a real profile — keep it (ported auto-score rule)
      if (fromPaste) onProfileSaved?.(fromPaste);
    } catch (err) {
      // same staleness rule: the newer run owns the view, including its errors
      if (lastScoredRef.current !== id) return;
      setView({ state: 'error', message: scoreErrorMessage(err) });
    }
  };

  // an event pick with a stored profile scores immediately (ported behavior:
  // a saved profile auto-scores on card open); without one, the paste asks.
  useEffect(() => {
    if (!eventId) {
      lastScoredRef.current = null;
      autoRanRef.current = false;
      if (view.state !== 'idle') setView({ state: 'idle' });
      return;
    }
    // picking event B directly after scoring event A (no close in between)
    // must not render A's verdict, reasons, and emphasis under B's name —
    // reset and re-run for the new id
    if (lastScoredRef.current !== eventId) {
      autoRanRef.current = false;
      lastScoredRef.current = eventId;
      if (view.state !== 'idle') setView({ state: 'idle' });
    }
    if (clientProfile && !autoRanRef.current) {
      autoRanRef.current = true;
      void run(eventId);
    } else if (!clientProfile) {
      setView({ state: 'needs-profile' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run reads latest refs via utils
  }, [eventId, clientProfile]);

  if (!pick) return null;

  return (
    <section
      className={`bay-card bay-card--${pick.kind}`}
      data-testid="bay-card"
      aria-label={pick.props.name}
    >
      <div className="bay-card-head">
        <span className="bay-card-kind">{pick.kind === 'event' ? 'event' : 'place'}</span>
        <button
          type="button"
          className="bay-card-close"
          aria-label="close"
          onClick={() => {
            onClosed();
            onEmphasis(null);
            setView({ state: 'idle' });
          }}
          data-testid="bay-card-close"
        >
          close
        </button>
      </div>
      <h2 className="bay-card-name">{pick.props.name}</h2>
      {pick.props.note && <p className="bay-card-note">{pick.props.note}</p>}
      {pick.kind === 'place' ? (
        <div className="bay-card-actions">
          <Link
            href={`/bay/places/${encodeURIComponent(pick.props.id.replace(/^place:/, ''))}`}
            className="bay-card-link"
            data-testid="bay-place-link"
          >
            about this place
          </Link>
        </div>
      ) : (
        <div className="bay-card-body" data-testid="bay-score-body">
          {view.state === 'needs-profile' && (
            <div className="bay-profile" data-testid="bay-profile">
              <p>{COPY.scoreNeeded}</p>
              <textarea
                className="bay-profile-input"
                aria-label="paste your profile"
                placeholder="paste your linkedin profile or a few lines about you"
                value={profileText}
                onChange={(e) => setProfileText(e.target.value)}
                data-testid="bay-profile-input"
              />
              <button
                type="button"
                className="bay-profile-go"
                disabled={!profileText.trim()}
                onClick={() => {
                  const parsed = profileFromText(profileText);
                  if (!parsed) {
                    setView({ state: 'error', message: COPY.scoreBadSource });
                    return;
                  }
                  onProfileSaved?.(parsed);
                  void run(pick.props.id, profileText);
                }}
                data-testid="bay-profile-go"
              >
                score this for me
              </button>
              {signedIn && <p className="bay-profile-signedin">{COPY.signedInNote}</p>}
            </div>
          )}
          {view.state === 'running' && <p className="bay-card-loading">scoring…</p>}
          {view.state === 'done' && <ScoreCard ok={view.data} />}
          {view.state === 'error' && (
            <p className="bay-card-error" role="alert" data-testid="bay-score-error">
              {view.message}
            </p>
          )}
          {view.state === 'done' && (
            <ClaimPane clientProfile={clientProfile} signedIn={signedIn} onCleared={onCleared} />
          )}
        </div>
      )}
    </section>
  );
}

/** The old route's error taxonomy, as copy. Expired rides NOT_FOUND with a
 * bayHttpStatus 410 extension — match either shape honestly. */
export function scoreErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : '';
  if (/expired/i.test(message)) return COPY.scoreExpired;
  if (/rate limit/i.test(message)) return COPY.scoreRateLimited;
  if (/profile or a linkedin/i.test(message)) return COPY.scoreProfileNeeded;
  if (/linkedin/i.test(message)) return COPY.scoreBadSource;
  if (/unknown persona/i.test(message)) return COPY.scoreBadPersona;
  if (/no such event/i.test(message)) return COPY.scoreMissing;
  return COPY.scoreFailed;
}

function ScoreCard({ ok }: { ok: ScoreOk }) {
  const { score, fit } = ok;
  return (
    <div className="bay-score" data-testid="bay-score" data-scored-event={ok.event.id}>
      <div className="bay-score-verdict" data-testid="bay-score-verdict">
        <span className={`bay-score-verdict-tag bay-score-verdict--${score.verdict}`}>
          {score.verdict}
        </span>
        {/* a fit weight is not a probability — the number renders only as rank
        context ("#2 of 14"), never as a percent */}
        {fit && (
          <span className="bay-score-rank">
            #{fit.rank} of {fit.of} on the board
          </span>
        )}
      </div>
      <p className="bay-score-outcome">{score.outcome}</p>
      {score.reasons.length > 0 && (
        <ul className="bay-score-reasons" data-testid="bay-score-reasons">
          {score.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      {score.meet.length > 0 && (
        <div className="bay-score-meet" data-testid="bay-score-meet">
          <p className="bay-score-meet-title">you may know people there</p>
          <ul>
            {score.meet.map((m) => (
              <li key={m.who}>
                <strong>{m.who}</strong> — {m.why}
                {m.starter ? ` — open with: ${m.starter}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="bay-score-meta">
        {score.scorer === 'llm' ? 'explained, clamped to the typed score' : 'typed scorer'}
      </p>
    </div>
  );
}

// ---------- claim ----------

function ClaimPane({
  clientProfile,
  signedIn,
  onCleared,
}: {
  clientProfile: ClientProfile | null;
  signedIn: boolean;
  onCleared: () => void;
}) {
  const [email, setEmail] = useState('');
  const [claimed, setClaimed] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const claim = trpc.bay.claim.useMutation();

  if (claimed) {
    return (
      <p className="bay-claim-sent" data-testid="bay-claim-sent">
        {note ?? COPY.claimDone}
      </p>
    );
  }
  return (
    <div className="bay-claim" data-testid="bay-claim">
      <p className="bay-claim-title">{COPY.claimTitle}</p>
      <p className="bay-claim-body">{COPY.claimBody}</p>
      <div className="bay-claim-row">
        {/* signed in, the claim binds to the session user — no email to ask for */}
        {!signedIn && (
          <input
            type="email"
            className="bay-claim-email"
            aria-label="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            data-testid="bay-claim-email"
          />
        )}
        <button
          type="button"
          className="bay-claim-cta"
          disabled={(!signedIn && !email.includes('@')) || claim.isPending}
          onClick={() => {
            if (!clientProfile) return;
            if (!signedIn) {
              // locked decision 3: claim is a magic link — the sign-in page
              // prefills this email and `next` returns to /bay, where the
              // stored profile is still in the browser and claim completes
              window.location.assign(
                `/signin?next=${encodeURIComponent('/bay')}&email=${encodeURIComponent(email)}`,
              );
              return;
            }
            // captureId omitted — the router derives the stable sha256 key from
            // the profile text, so a double-click cannot capture twice
            claim.mutate(
              { clientProfile },
              {
                onSuccess: (res) => {
                  if (res.captured) {
                    setClaimed(true);
                    if (res.next !== '/bay') window.location.assign(res.next);
                    return;
                  }
                  // honest failure: nothing was written — say so, invite a retry
                  setNote(res.note ?? COPY.claimRetry);
                },
              },
            );
          }}
          data-testid="bay-claim-cta"
        >
          {claim.isPending ? COPY.claimSaving : COPY.claimCta}
        </button>
      </div>
      {(claim.isError || note) && (
        <p className="bay-claim-error" role="alert" data-testid="bay-claim-error">
          {claim.isError ? claim.error.message : note}
        </p>
      )}
      {clientProfile != null && (
        <button
          type="button"
          className="bay-claim-clear"
          onClick={onCleared}
          data-testid="bay-profile-clear"
        >
          forget my profile on this device
        </button>
      )}
    </div>
  );
}
