// @ts-nocheck
/* eslint-disable react-hooks/exhaustive-deps, @next/next/no-img-element */
'use client';

import { useEffect, useState } from 'react';

// Public read-only GitHub REST API — no auth, no secret. Runs in the visitor's
// browser (rate limits are per-visitor). The /issues endpoint returns issues
// AND prs, which is exactly the merged stream we want to preview.
const REPO = 'Ayaan2907/wingmic';
const ACCENT = '#FFC452';

// github blocks iframing its pages (x-frame-options: deny), so we embed its
// own opengraph preview image for each item instead — a github-native card.
function ogUrl(item) {
  const type = item.pull_request ? 'pull' : 'issues';
  return `https://opengraph.githubassets.com/${item.id}/${REPO}/${type}/${item.number}`;
}

function Preview({ item }) {
  const [broken, setBroken] = useState(false);
  const isPr = !!item.pull_request;
  return (
    <a
      href={item.html_url}
      target="_blank"
      rel="noreferrer"
      style={{
        display: 'block', borderRadius: 12, overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.1)', background: '#0d0d12',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${ACCENT}55`; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
    >
      {broken ? (
        <div style={{ padding: 16 }}>
          <span className="mono" style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>#{item.number} · {isPr ? 'pr' : 'issue'}</span>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginTop: 6, lineHeight: 1.35 }}>{item.title}</div>
        </div>
      ) : (
        <img
          src={ogUrl(item)}
          alt={`#${item.number} ${item.title}`}
          loading="lazy"
          onError={() => setBroken(true)}
          style={{ display: 'block', width: '100%', height: 'auto' }}
        />
      )}
    </a>
  );
}

export default function GitHubActivity() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`https://api.github.com/repos/${REPO}/issues?state=open&per_page=8&sort=updated`, {
      headers: { Accept: 'application/vnd.github+json' },
    })
      .then((r) => { if (!r.ok) throw new Error('github api'); return r.json(); })
      .then((data) => { if (!cancelled) setItems(data.slice(0, 6)); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, []);

  const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 };

  if (error) {
    return (
      <a href={`https://github.com/${REPO}/issues`} target="_blank" rel="noreferrer" style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '12px 20px', borderRadius: 10, background: ACCENT, color: '#000',
        fontSize: 14, fontWeight: 700,
      }}>
        view issues on github
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M1 7h12m0 0L8 2m5 5l-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      </a>
    );
  }

  if (items === null) {
    return (
      <div style={gridStyle}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{
            aspectRatio: '2 / 1', borderRadius: 12,
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
            animation: 'pulse-d 1.4s ease-in-out infinite',
          }} />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div style={{
        padding: 24, borderRadius: 12, textAlign: 'center',
        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
        fontSize: 14, color: 'rgba(255,255,255,0.55)',
      }}>
        nothing open right now — <a href={`https://github.com/${REPO}/issues/new`} target="_blank" rel="noreferrer" style={{ color: ACCENT }}>file the first issue →</a>
      </div>
    );
  }

  return (
    <div style={gridStyle}>
      {items.map((item) => <Preview key={item.id} item={item} />)}
    </div>
  );
}
