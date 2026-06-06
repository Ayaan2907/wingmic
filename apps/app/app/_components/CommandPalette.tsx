'use client';

// CommandPalette — ⌘K quick search (PR λ-shell, eng-review D2=A). Opens a
// centered modal, routes the query to the search surface. Wired to the
// existing recall surface; PR θ builds /search as the rich destination.

import * as React from 'react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  React.useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) return null;

  function submit() {
    const term = q.trim();
    if (!term) return;
    setOpen(false);
    setQ('');
    // /search ships in PR θ; typedRoutes can't know it yet, so cast the
    // dynamic href (matches the plain-<a> typedRoutes dodge used elsewhere).
    router.push(`/search?q=${encodeURIComponent(term)}` as Route);
  }

  return (
    <div
      role="dialog"
      aria-label="command palette"
      onClick={() => setOpen(false)}
      style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '18vh', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(560px, 92vw)', background: '#0e0e12', border: '1px solid var(--border-mid, rgba(255,255,255,0.1))', borderRadius: 18, boxShadow: '0 20px 50px rgba(0,0,0,0.6)', padding: 14 }}>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          placeholder="search your graph…  e.g. who at acme works on rust?"
          aria-label="search your graph"
          style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: 'var(--ink)', fontFamily: 'JetBrains Mono, monospace', fontSize: 14 }}
        />
      </div>
    </div>
  );
}

export default CommandPalette;
