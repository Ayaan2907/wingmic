// @ts-nocheck
/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useEffect, useState } from 'react';

// Public read-only GitHub REST API — no auth, no secret. The fetch runs in the
// visitor's browser, so rate limits (60/hr) apply per-visitor, not to us.
const REPO = 'Ayaan2907/wingmic';
const ACCENT = '#FFC452';

function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  const units = [['y', 31536000], ['mo', 2592000], ['w', 604800], ['d', 86400], ['h', 3600], ['m', 60]];
  for (const [label, secs] of units) {
    const v = Math.floor(s / secs);
    if (v >= 1) return `${v}${label} ago`;
  }
  return 'just now';
}

function ItemRow({ item, kind }) {
  const isPr = kind === 'pr';
  const stateColor = isPr ? (item.draft ? 'rgba(255,255,255,0.4)' : '#86efac') : ACCENT;
  const stateLabel = isPr ? (item.draft ? 'draft' : 'open') : 'open';
  return (
    <a
      href={item.html_url}
      target="_blank"
      rel="noreferrer"
      style={{
        display: 'block', padding: '14px 16px', borderRadius: 12,
        background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)',
        transition: 'border-color 0.15s, background 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${ACCENT}50`; e.currentTarget.style.background = `${ACCENT}08`; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.background = 'rgba(255,255,255,0.025)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span className="mono" style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>#{item.number}</span>
        <span style={{ fontSize: 14.5, fontWeight: 600, color: '#fff', lineHeight: 1.35 }}>{item.title}</span>
      </div>
      {item.labels?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {item.labels.slice(0, 5).map((l) => (
            <span key={l.name} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '2px 8px', borderRadius: 999, fontSize: 11,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.8)',
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: `#${l.color || '888888'}` }} />
              {l.name}
            </span>
          ))}
        </div>
      )}
      <div className="mono" style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: stateColor }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: stateColor }} />
          {stateLabel}
        </span>
        <span>@{item.user?.login}</span>
        <span>· {timeAgo(item.created_at)}</span>
        {!isPr && item.comments > 0 && <span>· {item.comments} 💬</span>}
      </div>
    </a>
  );
}

export default function GitHubActivity() {
  const [issues, setIssues] = useState(null);
  const [prs, setPrs] = useState(null);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState('issues');

  useEffect(() => {
    let cancelled = false;
    const opts = { headers: { Accept: 'application/vnd.github+json' } };
    Promise.all([
      fetch(`https://api.github.com/repos/${REPO}/issues?state=open&per_page=30&sort=updated`, opts),
      fetch(`https://api.github.com/repos/${REPO}/pulls?state=open&per_page=30&sort=updated&direction=desc`, opts),
    ])
      .then(async ([iRes, pRes]) => {
        if (!iRes.ok || !pRes.ok) throw new Error('github api');
        const [iData, pData] = await Promise.all([iRes.json(), pRes.json()]);
        if (cancelled) return;
        // The /issues endpoint returns PRs too — filter them out.
        setIssues(iData.filter((x) => !x.pull_request));
        setPrs(pData);
      })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, []);

  if (error) {
    return (
      <div style={{
        padding: 24, borderRadius: 14,
        background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.75)', marginBottom: 6 }}>
          couldn&apos;t reach the github api right now
        </div>
        <div className="mono" style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>
          it rate-limits anonymous requests — try again in a bit
        </div>
        <a href={`https://github.com/${REPO}/issues`} target="_blank" rel="noreferrer" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '10px 18px', borderRadius: 10, background: ACCENT, color: '#000',
          fontSize: 13.5, fontWeight: 700,
        }}>
          browse issues on github
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M1 7h12m0 0L8 2m5 5l-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </a>
      </div>
    );
  }

  const loading = issues === null || prs === null;
  const active = tab === 'issues' ? issues : prs;

  const tabBtn = (key, label, count) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      style={{
        padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
        fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit',
        background: tab === key ? ACCENT : 'transparent',
        color: tab === key ? '#000' : 'rgba(255,255,255,0.6)',
        border: `1px solid ${tab === key ? ACCENT : 'rgba(255,255,255,0.12)'}`,
        display: 'inline-flex', alignItems: 'center', gap: 8,
      }}
    >
      {label}
      <span className="mono" style={{
        fontSize: 11, padding: '1px 6px', borderRadius: 999,
        background: tab === key ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.08)',
        color: tab === key ? '#000' : 'rgba(255,255,255,0.6)',
      }}>{count === null ? '·' : count}</span>
    </button>
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {tabBtn('issues', 'Open issues', issues?.length ?? null)}
        {tabBtn('prs', 'Open PRs', prs?.length ?? null)}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{
              height: 74, borderRadius: 12,
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
              animation: 'pulse-d 1.4s ease-in-out infinite',
            }} />
          ))}
          <div className="mono" style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginTop: 4 }}>
            reading live from github…
          </div>
        </div>
      ) : active.length === 0 ? (
        <div style={{
          padding: 24, borderRadius: 12, textAlign: 'center',
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
          fontSize: 14, color: 'rgba(255,255,255,0.5)',
        }}>
          nothing open here right now — {tab === 'issues' ? 'a clean slate to file the first one' : 'no PRs in flight'}.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {active.map((item) => <ItemRow key={item.id} item={item} kind={tab === 'issues' ? 'issue' : 'pr'} />)}
        </div>
      )}

      <a href={`https://github.com/${REPO}/${tab === 'issues' ? 'issues' : 'pulls'}`} target="_blank" rel="noreferrer"
        className="mono"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 16, fontSize: 12.5, color: ACCENT }}>
        all {tab === 'issues' ? 'issues' : 'pull requests'} on github →
      </a>
    </div>
  );
}
