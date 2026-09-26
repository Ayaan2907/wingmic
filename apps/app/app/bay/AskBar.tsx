'use client';

// apps/app/app/bay/AskBar.tsx — the ask: one question bar, an answer card
// with reasons, and the emphasis payload the map repaints with. Ported from
// the spec's "the ask, state by state": idle → parsing → retrieving →
// explaining → answered, plus honest-empty. Never a filter panel first.

import { useRef, useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import type { AskResult } from '@/lib/bay/ask';
import { COPY } from './copy';
import type { ClientProfile } from '@/lib/bay/clientProfile';

export interface AskState {
  running: boolean;
  result: AskResult | null;
  error: string | null;
}

export function useAsk(clientProfile: ClientProfile | null, personaId: string | null) {
  const [state, setState] = useState<AskState>({
    running: false,
    result: null,
    error: null,
  });
  const utils = trpc.useUtils();
  const profileRef = useRef(clientProfile);
  profileRef.current = clientProfile;
  const personaRef = useRef(personaId);
  personaRef.current = personaId;

  const run = async (q: string): Promise<void> => {
    setState({ running: true, result: null, error: null });
    try {
      const result = await utils.bay.ask.fetch({
        q,
        personaId: personaRef.current ?? undefined,
        clientProfile: profileRef.current ?? undefined,
      });
      setState({ running: false, result, error: null });
    } catch (err) {
      // the ask degrades server-side; a failure here is transport-level —
      // say so honestly, never a silent blank
      const message =
        err instanceof Error && err.message.includes('rate limit')
          ? COPY.scoreRateLimited
          : 'the ask did not come back — try again';
      setState({ running: false, result: null, error: message });
    }
  };

  const clear = () => setState({ running: false, result: null, error: null });
  return { ...state, run, clear };
}

export function AskBar({
  ask,
  onAsk,
  signedIn,
}: {
  ask: AskState;
  onAsk: (q: string) => void;
  signedIn: boolean;
}) {
  const [q, setQ] = useState('');
  const submit = () => {
    const question = q.trim();
    if (!question || ask.running) return;
    onAsk(question);
  };
  return (
    <div className="bay-ask">
      <form
        className="bay-ask-form"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          type="search"
          className="bay-ask-input"
          placeholder={COPY.askPlaceholder}
          aria-label="ask the bay"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          data-testid="bay-ask-input"
        />
        <button
          type="submit"
          className="bay-ask-submit"
          disabled={ask.running || !q.trim()}
          data-testid="bay-ask-submit"
        >
          {ask.running ? COPY.askWorking : COPY.askSubmit}
        </button>
      </form>
      {ask.error && (
        <p className="bay-ask-error" role="alert" data-testid="bay-ask-error">
          {ask.error}
        </p>
      )}
      {ask.result && (
        <AnswerCard result={ask.result} signedIn={signedIn} onPickNote={undefined} />
      )}
    </div>
  );
}

export function AnswerCard({
  result,
  signedIn,
  onPickNote,
}: {
  result: AskResult;
  signedIn: boolean;
  onPickNote?: string | undefined;
}) {
  return (
    <article className="bay-answer" data-testid="bay-answer">
      <p className="bay-answer-text">{result.answer}</p>
      {onPickNote && <p className="bay-answer-note">{onPickNote}</p>}
      {result.picks.length > 0 ? (
        <ul className="bay-answer-picks">
          {result.picks.map((p) => (
            <li key={`${p.kind}:${p.id}`} className="bay-answer-pick" data-testid="bay-answer-pick">
              <span className={`bay-answer-verdict bay-answer-verdict--${p.verdict}`}>
                {p.verdict}
              </span>
              <span className="bay-answer-title">{p.title}</span>
              <span className="bay-answer-outcome">{p.outcome}</span>
              {p.reasons.length > 0 && (
                <span className="bay-answer-reasons">{p.reasons.join(' · ')}</span>
              )}
              {signedIn && p.meet.length > 0 && (
                <span className="bay-answer-meet">
                  {p.meet.map((m) => `${m.who} — ${m.why}`).join('; ')}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="bay-answer-empty" data-testid="bay-answer-empty">
          {COPY.noReadOnRoom}
        </p>
      )}
      <p className="bay-answer-meta">
        {result.explain === 'llm' ? 'explained' : 'templated'} ·{' '}
        {result.retrieval === 'embeddings' ? 'semantic pool' : 'text pool'}
        {result.profile.quality === 'none' && ` · ${COPY.answerNeedsProfile.toLowerCase()}`}
      </p>
    </article>
  );
}
