'use client';

/**
 * ImportsClient — LinkedIn CSV / vCard drop zone (v0.2 I3).
 * Parses client-side, previews matches (with ambiguous pickers), then upserts.
 */

import * as React from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';
import {
  IMPORT_MAX_BATCH,
  IMPORT_MAX_BYTES,
  normalizeContactsFromFile,
  deviceContactsSupported,
  pickDeviceContacts,
  type ImportContactDraft,
  type ImportSourceKind,
} from '@/lib/imports';
import { accent } from '@/app/chat/_components/tokens';

type Phase = 'idle' | 'parsing' | 'ready' | 'uploading' | 'done' | 'error' | 'undone';

/** `null` = create new; string = merge into that entity. */
type ResolutionChoice = string | null;

export function ImportsClient() {
  const [phase, setPhase] = React.useState<Phase>('idle');
  const [error, setError] = React.useState<string | null>(null);
  const [filename, setFilename] = React.useState<string | null>(null);
  const [kind, setKind] = React.useState<ImportSourceKind | null>(null);
  const [contacts, setContacts] = React.useState<ImportContactDraft[]>([]);
  const [resolutions, setResolutions] = React.useState<Record<number, ResolutionChoice>>({});
  const [result, setResult] = React.useState<{
    created: number;
    matched: number;
    total: number;
    batchId: string;
    kind: ImportSourceKind;
  } | null>(null);
  const [deviceSupported] = React.useState(() => deviceContactsSupported());
  const inputRef = React.useRef<HTMLInputElement>(null);
  /** Bumps on each file selection so a stale `file.text()` cannot overwrite newer state. */
  const parseGenRef = React.useRef(0);

  const busyUploading = phase === 'uploading';
  const previewEnabled = contacts.length > 0 && (phase === 'ready' || phase === 'uploading');
  const preview = trpc.imports.previewBatch.useQuery(
    { contacts },
    { enabled: previewEnabled },
  );

  const upsert = trpc.imports.upsertBatch.useMutation({
    onSuccess: (res) => {
      const parsedKind = (res.importSource.split(':')[0] ?? 'vcard') as ImportSourceKind;
      setResult({
        created: res.created,
        matched: res.matched,
        total: res.total,
        batchId: res.batchId,
        kind: parsedKind,
      });
      setPhase('done');
    },
    onError: () => {
      setError('import failed — try a smaller file or check the format');
      setPhase('error');
    },
  });

  const undo = trpc.imports.undoBatch.useMutation({
    onSuccess: (res) => {
      setPhase('undone');
      setError(null);
      setResult((prev) =>
        prev
          ? { ...prev, created: 0, matched: prev.matched, total: res.removed }
          : prev,
      );
    },
    onError: () => {
      setError('could not undo — try again');
    },
  });

  // Seed default choices when preview reports ambiguous rows.
  React.useEffect(() => {
    if (!preview.data) return;
    setResolutions((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const row of preview.data.rows) {
        if (row.status !== 'ambiguous') continue;
        if (next[row.index] !== undefined) continue;
        // Default: create new (safe) until the user picks.
        next[row.index] = null;
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [preview.data]);

  async function handleFile(file: File) {
    if (busyUploading) return;
    const gen = ++parseGenRef.current;
    setError(null);
    setResult(null);
    setPhase('parsing');
    setFilename(file.name);
    setContacts([]);
    setKind(null);
    setResolutions({});
    try {
      if (file.size > IMPORT_MAX_BYTES) {
        if (gen !== parseGenRef.current) return;
        setError(
          `file too large (${Math.ceil(file.size / (1024 * 1024))}MB) — keep under ${Math.floor(IMPORT_MAX_BYTES / (1024 * 1024))}MB`,
        );
        setPhase('error');
        return;
      }
      const text = await file.text();
      if (gen !== parseGenRef.current) return;
      const parsed = normalizeContactsFromFile({ filename: file.name, text });
      if (gen !== parseGenRef.current) return;
      if (parsed.contacts.length === 0) {
        setError('no contacts found in that file');
        setPhase('error');
        setContacts([]);
        setKind(null);
        return;
      }
      if (parsed.contacts.length > IMPORT_MAX_BATCH) {
        setError(
          `too many contacts (${parsed.contacts.length}) — split the file to ${IMPORT_MAX_BATCH} or fewer`,
        );
        setPhase('error');
        setContacts([]);
        setKind(null);
        return;
      }
      setKind(parsed.kind);
      setContacts(parsed.contacts);
      setPhase('ready');
    } catch {
      if (gen !== parseGenRef.current) return;
      setError('could not read that file');
      setPhase('error');
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    if (busyUploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  async function handleDevicePick() {
    if (busyUploading) return;
    setError(null);
    setResult(null);
    setPhase('parsing');
    setFilename('device contacts');
    setContacts([]);
    setKind(null);
    setResolutions({});
    try {
      const picked = await pickDeviceContacts();
      if (picked == null) {
        setError('device contacts not available — drop a .vcf instead');
        setPhase('error');
        return;
      }
      if (picked.length === 0) {
        setError('no contacts selected');
        setPhase('error');
        return;
      }
      if (picked.length > IMPORT_MAX_BATCH) {
        setError(
          `too many contacts (${picked.length}) — select ${IMPORT_MAX_BATCH} or fewer`,
        );
        setPhase('error');
        return;
      }
      setKind('device');
      setContacts(picked);
      setPhase('ready');
    } catch {
      setError('could not read device contacts');
      setPhase('error');
    }
  }

  const ambiguousRows = preview.data?.rows.filter((r) => r.status === 'ambiguous') ?? [];
  const unresolved = React.useMemo(
    () => ambiguousRows.length > 0 && ambiguousRows.some((r) => resolutions[r.index] === undefined),
    [ambiguousRows, resolutions],
  );
  const previewFailed = Boolean(preview.isError);
  const commitBlocked = busyUploading || unresolved || preview.isFetching || previewFailed;

  function commitImport() {
    if (!kind || contacts.length === 0 || unresolved || previewFailed) return;
    setPhase('uploading');
    const resolutionPayload = Object.entries(resolutions).map(([index, entityId]) => ({
      index: Number(index),
      entityId,
    }));
    upsert.mutate({
      kind,
      contacts,
      resolutions: resolutionPayload.length > 0 ? resolutionPayload : undefined,
    });
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
          padding: '14px clamp(14px, 4vw, 20px)',
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
          padding: '16px clamp(14px, 4vw, 20px) 36px',
          maxWidth: 680,
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
          onClick={() => {
            if (busyUploading) return;
            inputRef.current?.click();
          }}
          role="button"
          tabIndex={busyUploading ? -1 : 0}
          aria-disabled={busyUploading}
          onKeyDown={(e) => {
            if (busyUploading) return;
            if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
          }}
          style={{
            minHeight: 132,
            padding: '24px clamp(14px, 4vw, 20px)',
            borderRadius: 14,
            border: `1.5px dashed ${accent}66`,
            background: `${accent}0d`,
            textAlign: 'center',
            cursor: busyUploading ? 'not-allowed' : 'pointer',
            marginBottom: 16,
            opacity: busyUploading ? 0.6 : 1,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
            {phase === 'parsing'
              ? 'reading…'
              : busyUploading
                ? 'importing…'
                : 'tap or drop a file'}
          </div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-40)' }}>
            .csv · .vcf · up to {IMPORT_MAX_BATCH} contacts
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.vcf,.vcard,text/csv,text/vcard,text/x-vcard"
            hidden
            data-testid="imports-file-input"
            disabled={busyUploading}
            onChange={(e) => {
              if (busyUploading) {
                e.target.value = '';
                return;
              }
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = '';
            }}
          />
        </div>

        {deviceSupported ? (
          <button
            type="button"
            data-testid="imports-device-pick"
            disabled={busyUploading}
            onClick={() => void handleDevicePick()}
            style={{
              width: '100%',
              marginBottom: 16,
              minHeight: 44,
              padding: 12,
              borderRadius: 10,
              border: '1px solid var(--border-soft)',
              background: 'var(--surface-1)',
              color: 'var(--ink)',
              font: '600 13px Inter, system-ui, sans-serif',
              cursor: busyUploading ? 'not-allowed' : 'pointer',
              opacity: busyUploading ? 0.7 : 1,
            }}
          >
            pick from phone contacts →
          </button>
        ) : null}

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
              {preview.data
                ? ` · ${preview.data.matchCount} match · ${preview.data.newCount} new · ${preview.data.ambiguousCount} review`
                : preview.isFetching
                  ? ' · matching…'
                  : ''}
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

            {previewFailed ? (
              <div
                data-testid="imports-preview-error"
                role="alert"
                style={{
                  marginTop: 14,
                  paddingTop: 12,
                  borderTop: '1px solid var(--border-soft)',
                }}
              >
                <p
                  className="mono"
                  style={{ fontSize: 12, color: '#FF6B6B', margin: '0 0 10px' }}
                >
                  could not match contacts — check your connection and retry
                </p>
                <button
                  type="button"
                  data-testid="imports-preview-retry"
                  onClick={() => void preview.refetch()}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border-soft)',
                    background: 'var(--bg-page)',
                    color: 'var(--ink)',
                    font: '600 12px Inter, system-ui, sans-serif',
                    cursor: 'pointer',
                  }}
                >
                  retry matching →
                </button>
              </div>
            ) : null}

            {ambiguousRows.length > 0 ? (
              <div
                data-testid="imports-conflicts"
                style={{
                  marginTop: 14,
                  paddingTop: 12,
                  borderTop: '1px solid var(--border-soft)',
                }}
              >
                <div
                  className="mono"
                  style={{ fontSize: 11, color: 'var(--text-55)', marginBottom: 10 }}
                >
                  {ambiguousRows.length} contact
                  {ambiguousRows.length === 1 ? '' : 's'} need a match — email / linkedin / name
                  point at different people.
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {ambiguousRows.map((row) => (
                    <li
                      key={row.index}
                      data-testid={`imports-conflict-${row.index}`}
                      style={{ marginBottom: 12 }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                        {row.contactName}
                      </div>
                      <label className="mono" style={{ fontSize: 11, color: 'var(--text-40)' }}>
                        map to
                        <select
                          data-testid={`imports-conflict-select-${row.index}`}
                          value={
                            resolutions[row.index] === undefined
                              ? ''
                              : resolutions[row.index] === null
                                ? '__new__'
                                : resolutions[row.index]!
                          }
                          disabled={busyUploading}
                          onChange={(e) => {
                            const v = e.target.value;
                            setResolutions((prev) => ({
                              ...prev,
                              [row.index]: v === '__new__' ? null : v,
                            }));
                          }}
                          style={{
                            display: 'block',
                            width: '100%',
                            marginTop: 4,
                            minHeight: 40,
                            padding: '8px 10px',
                            borderRadius: 8,
                            border: '1px solid var(--border-soft)',
                            background: 'var(--bg-page)',
                            color: 'var(--ink)',
                            font: '12px Inter, system-ui, sans-serif',
                          }}
                        >
                          <option value="__new__">create new person</option>
                          {row.candidates.map((c) => (
                            <option key={c.entityId} value={c.entityId}>
                              {c.name} ({c.reasons.join(' + ')})
                            </option>
                          ))}
                        </select>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <button
              type="button"
              data-testid="imports-commit"
              disabled={commitBlocked}
              onClick={commitImport}
              style={{
                marginTop: 14,
                width: '100%',
                minHeight: 44,
                padding: 12,
                borderRadius: 10,
                background: accent,
                color: '#000',
                border: '1.5px solid #000',
                boxShadow: '3px 3px 0 #000',
                font: '700 13px Inter, system-ui, sans-serif',
                cursor: commitBlocked ? 'not-allowed' : 'pointer',
                opacity: commitBlocked ? 0.7 : 1,
              }}
            >
              {busyUploading
                ? 'importing…'
                : previewFailed
                  ? 'matching failed'
                  : preview.isFetching
                    ? 'matching…'
                    : `import ${contacts.length} →`}
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
            <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
              {result.created > 0 ? (
                <button
                  type="button"
                  data-testid="imports-undo"
                  disabled={undo.isPending}
                  onClick={() =>
                    undo.mutate({ kind: result.kind, batchId: result.batchId })
                  }
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: 'var(--text-55)',
                    background: 'transparent',
                    border: '1px solid var(--border-soft)',
                    borderRadius: 8,
                    padding: '8px 10px',
                    cursor: undo.isPending ? 'not-allowed' : 'pointer',
                  }}
                >
                  {undo.isPending ? 'undoing…' : 'undo this import'}
                </button>
              ) : null}
              <Link
                href="/"
                className="mono"
                style={{
                  display: 'inline-block',
                  fontSize: 11,
                  color: accent,
                  textDecoration: 'none',
                  padding: '8px 0',
                }}
              >
                back to home →
              </Link>
            </div>
          </div>
        ) : null}

        {phase === 'undone' ? (
          <div
            data-testid="imports-undone"
            style={{
              padding: 16,
              borderRadius: 14,
              border: '1px solid var(--border-soft)',
              background: 'var(--surface-1)',
              marginBottom: 12,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>import undone</div>
            <p className="mono" style={{ fontSize: 12, color: 'var(--text-55)', margin: 0 }}>
              newly created contacts from that batch were soft-deleted.
            </p>
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
