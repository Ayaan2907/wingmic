'use client';

/**
 * ImportsClient — LinkedIn CSV / vCard drop zone (v0.2 I3).
 * Parses client-side, then upserts via imports.upsertBatch.
 */

import * as React from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';
import { normalizeContactsFromFile, type ImportContactDraft } from '@/lib/imports';
import { accent } from '@/app/chat/_components/tokens';

type Phase = 'idle' | 'parsing' | 'ready' | 'uploading' | 'done' | 'error';

export function ImportsClient() {
  const [phase, setPhase] = React.useState<Phase>('idle');
  const [error, setError] = React.useState<string | null>(null);
  const [filename, setFilename] = React.useState<string | null>(null);
  const [kind, setKind] = React.useState<'linkedin' | 'vcard' | null>(null);
  const [contacts, setContacts] = React.useState<ImportContactDraft[]>([]);
  const [result, setResult] = React.useState<{
    created: number;
    matched: number;
    total: number;
  } | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const upsert = trpc.imports.upsertBatch.useMutation({
    onSuccess: (res) => {
      setResult({ created: res.created, matched: res.matched, total: res.total });
      setPhase('done');
    },
    onError: () => {
      setError('import failed — try a smaller file or check the format');
      setPhase('error');
    },
  });

  async function handleFile(file: File) {
    setError(null);
    setResult(null);
    setPhase('parsing');
    setFilename(file.name);
    try {
      const text = await file.text();
      const parsed = normalizeContactsFromFile({ filename: file.name, text });
      if (parsed.contacts.length === 0) {
        setError('no contacts found in that file');
        setPhase('error');
        setContacts([]);
        setKind(null);
        return;
      }
      setKind(parsed.kind);
      setContacts(parsed.contacts);
      setPhase('ready');
    } catch {
      setError('could not read that file');
      setPhase('error');
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  function commitImport() {
    if (!kind || contacts.length === 0) return;
    setPhase('uploading');
    upsert.mutate({ kind, contacts });
  }

  return (
    <main
      data-screen="imports"
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-page)',
        color: 'var(--ink)',
      }}
    >
      <header
        style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--border-soft)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          position: 'sticky',
          top: 0,
          background: 'rgba(10,10,10,0.85)',
          backdropFilter: 'blur(20px)',
          zIndex: 30,
        }}
      >
        <span
          className="mono"
          style={{ fontSize: 14, fontWeight: 700, letterSpacing: -0.5 }}
        >
          imports
        </span>
        <Link
          href="/settings"
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: 1,
            textTransform: 'uppercase',
            color: 'var(--text-40)',
            textDecoration: 'none',
          }}
        >
          settings →
        </Link>
      </header>

      <section
        style={{
          padding: '20px 20px 40px',
          maxWidth: 640,
          width: '100%',
          margin: '0 auto',
          boxSizing: 'border-box',
        }}
      >
        <p
          className="mono"
          style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-55)', margin: '0 0 16px' }}
        >
          drop a LinkedIn <em style={{ fontStyle: 'italic', fontFamily: 'serif' }}>Connections.csv</em>{' '}
          or a <em style={{ fontStyle: 'italic', fontFamily: 'serif' }}>.vcf</em> — contacts stay
          private to your account.
        </p>

        <div
          data-testid="imports-dropzone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
          }}
          style={{
            padding: '28px 20px',
            borderRadius: 14,
            border: `1.5px dashed ${accent}66`,
            background: `${accent}0d`,
            textAlign: 'center',
            cursor: 'pointer',
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
            {phase === 'parsing' ? 'reading…' : 'tap or drop a file'}
          </div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-40)' }}>
            .csv · .vcf · up to 1000 contacts
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.vcf,.vcard,text/csv,text/vcard,text/x-vcard"
            hidden
            data-testid="imports-file-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = '';
            }}
          />
        </div>

        {error ? (
          <p
            role="alert"
            data-testid="imports-error"
            className="mono"
            style={{ fontSize: 12, color: '#FF6B6B', marginBottom: 12 }}
          >
            {error}
          </p>
        ) : null}

        {phase === 'ready' || phase === 'uploading' ? (
          <div
            data-testid="imports-preview"
            style={{
              padding: 14,
              borderRadius: 12,
              border: '1px solid var(--border-soft)',
              background: 'var(--surface-1)',
              marginBottom: 12,
            }}
          >
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-40)', marginBottom: 8 }}>
              {filename} · {kind} · {contacts.length} contact
              {contacts.length === 1 ? '' : 's'}
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {contacts.slice(0, 5).map((c) => (
                <li
                  key={`${c.name}-${c.email ?? ''}`}
                  style={{
                    fontSize: 13,
                    padding: '6px 0',
                    borderBottom: '1px solid var(--border-soft)',
                  }}
                >
                  <strong>{c.name}</strong>
                  {c.company ? (
                    <span style={{ color: 'var(--text-55)' }}> · {c.company}</span>
                  ) : null}
                </li>
              ))}
            </ul>
            {contacts.length > 5 ? (
              <div className="mono" style={{ fontSize: 11, color: 'var(--text-40)', marginTop: 8 }}>
                +{contacts.length - 5} more
              </div>
            ) : null}
            <button
              type="button"
              data-testid="imports-commit"
              disabled={phase === 'uploading'}
              onClick={commitImport}
              style={{
                marginTop: 14,
                width: '100%',
                padding: 12,
                borderRadius: 10,
                background: accent,
                color: '#000',
                border: '1.5px solid #000',
                boxShadow: '3px 3px 0 #000',
                font: '700 13px Inter, system-ui, sans-serif',
                cursor: phase === 'uploading' ? 'not-allowed' : 'pointer',
                opacity: phase === 'uploading' ? 0.7 : 1,
              }}
            >
              {phase === 'uploading' ? 'importing…' : `import ${contacts.length} →`}
            </button>
          </div>
        ) : null}

        {phase === 'done' && result ? (
          <div
            data-testid="imports-result"
            style={{
              padding: 16,
              borderRadius: 14,
              border: `1px solid ${accent}4d`,
              background: `${accent}14`,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>import complete</div>
            <p className="mono" style={{ fontSize: 12, color: 'var(--text-85)', margin: 0 }}>
              {result.created} new · {result.matched} matched · {result.total} total
            </p>
            <Link
              href="/"
              className="mono"
              style={{
                display: 'inline-block',
                marginTop: 12,
                fontSize: 11,
                color: accent,
                textDecoration: 'none',
              }}
            >
              back to home →
            </Link>
          </div>
        ) : null}

        {phase === 'idle' ? (
          <div
            data-testid="imports-empty"
            style={{
              padding: 16,
              borderRadius: 14,
              border: '1px dashed var(--border-soft)',
              color: 'var(--text-55)',
              fontSize: 13.5,
              lineHeight: 1.55,
            }}
          >
            tip: LinkedIn → Settings → Data privacy → Get a copy of your data → Connections.
          </div>
        ) : null}
      </section>
    </main>
  );
}
