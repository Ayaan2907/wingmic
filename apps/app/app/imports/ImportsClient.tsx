'use client';

/**
 * ImportsClient — one-tap LinkedIn CSV / zip / vCard import (v0.2 #102).
 * Parses client-side, previews matches, upserts without a confirm step.
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
import { colors, shadows } from '@wingmic/design-tokens';

const accent = colors.accent;

/** LinkedIn self-serve data export (Connections arrive by email). */
export const LINKEDIN_DATA_EXPORT_URL =
  'https://www.linkedin.com/mypreferences/d/download-my-data';

type Phase = 'idle' | 'parsing' | 'matching' | 'uploading' | 'done' | 'error' | 'undone';

type PreviewRow = {
  index: number;
  status: 'new' | 'match' | 'ambiguous';
  contactName: string;
  entityId: string | null;
  candidates: Array<{
    entityId: string;
    name: string;
    reasons: Array<'email' | 'linkedin' | 'name'>;
  }>;
};

type PreviewSnapshot = {
  rows: PreviewRow[];
  ambiguousCount: number;
};

/** `null` = keep the auto-created person; string = merge duplicate into that entity. */
type ResolutionChoice = string | null;

export function ImportsClient() {
  const [phase, setPhase] = React.useState<Phase>('idle');
  const [error, setError] = React.useState<string | null>(null);
  const [filename, setFilename] = React.useState<string | null>(null);
  const [kind, setKind] = React.useState<ImportSourceKind | null>(null);
  const [contacts, setContacts] = React.useState<ImportContactDraft[]>([]);
  const [importPreview, setImportPreview] = React.useState<PreviewSnapshot | null>(null);
  const [batchEntityIds, setBatchEntityIds] = React.useState<string[]>([]);
  const [postResolutions, setPostResolutions] = React.useState<Record<number, ResolutionChoice>>(
    {},
  );
  const [result, setResult] = React.useState<{
    created: number;
    matched: number;
    total: number;
    batchId: string;
    kind: ImportSourceKind;
  } | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);
  const [deviceSupported] = React.useState(() => deviceContactsSupported());
  const inputRef = React.useRef<HTMLInputElement>(null);
  const parseGenRef = React.useRef(0);
  const autoImportStartedRef = React.useRef(false);
  const lastAmbiguousCountRef = React.useRef(0);

  const busyImport =
    phase === 'parsing' || phase === 'matching' || phase === 'uploading';

  const previewEnabled =
    contacts.length > 0 && (phase === 'matching' || phase === 'uploading');
  const preview = trpc.imports.previewBatch.useQuery(
    { contacts },
    { enabled: previewEnabled },
  );

  const upsert = trpc.imports.upsertBatch.useMutation({
    onSuccess: (res) => {
      const parsedKind = (res.importSource.split(':')[0] ?? 'vcard') as ImportSourceKind;
      setBatchEntityIds(res.entityIds);
      setResult({
        created: res.created,
        matched: res.matched,
        total: res.total,
        batchId: res.batchId,
        kind: parsedKind,
      });
      setToast(
        `added ${res.created}, merged ${res.matched}${
          lastAmbiguousCountRef.current > 0
            ? ` · ${lastAmbiguousCountRef.current} needed a judgement call`
            : ''
        }`,
      );
      setPhase('done');
    },
    onError: () => {
      setError('import failed — try a smaller file or check the format');
      setPhase('error');
      autoImportStartedRef.current = false;
    },
  });

  const undo = trpc.imports.undoBatch.useMutation({
    onSuccess: (res) => {
      setPhase('undone');
      setError(null);
      setToast(null);
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

  const resolveAmbiguous = trpc.imports.resolveAmbiguousImport.useMutation({
    onError: () => {
      setError('could not apply that match — try again');
    },
  });

  React.useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 12_000);
    return () => window.clearTimeout(t);
  }, [toast]);

  // One-tap: when preview finishes, upsert immediately (ambiguous rows default to create-new).
  React.useEffect(() => {
    if (phase !== 'matching' || !kind || contacts.length === 0) return;
    if (preview.isFetching || preview.isError || !preview.data) return;
    if (autoImportStartedRef.current) return;
    autoImportStartedRef.current = true;
    lastAmbiguousCountRef.current = preview.data.ambiguousCount;
    setImportPreview({
      rows: preview.data.rows,
      ambiguousCount: preview.data.ambiguousCount,
    });
    setPhase('uploading');
    upsert.mutate({ kind, contacts });
  }, [phase, kind, contacts, preview.isFetching, preview.isError, preview.data, upsert.mutate]);

  async function readFilePayload(
    file: File,
  ): Promise<{ text?: string; bytes?: Uint8Array }> {
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.zip')) {
      const buf = await file.arrayBuffer();
      return { bytes: new Uint8Array(buf) };
    }
    return { text: await file.text() };
  }

  async function handleFile(file: File) {
    if (phase === 'uploading') return;
    const gen = ++parseGenRef.current;
    autoImportStartedRef.current = false;
    setError(null);
    setResult(null);
    setToast(null);
    setImportPreview(null);
    setBatchEntityIds([]);
    setPostResolutions({});
    setPhase('parsing');
    setFilename(file.name);
    setContacts([]);
    setKind(null);
    try {
      if (file.size > IMPORT_MAX_BYTES) {
        if (gen !== parseGenRef.current) return;
        setError(
          `file too large (${Math.ceil(file.size / (1024 * 1024))}MB) — keep under ${Math.floor(IMPORT_MAX_BYTES / (1024 * 1024))}MB`,
        );
        setPhase('error');
        return;
      }
      const payload = await readFilePayload(file);
      if (gen !== parseGenRef.current) return;
      const parsed = normalizeContactsFromFile({ filename: file.name, ...payload });
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
      setPhase('matching');
    } catch {
      if (gen !== parseGenRef.current) return;
      setError('could not read that file');
      setPhase('error');
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    if (phase === 'uploading') return;
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  async function handleDevicePick() {
    if (phase === 'uploading') return;
    autoImportStartedRef.current = false;
    setError(null);
    setResult(null);
    setToast(null);
    setImportPreview(null);
    setBatchEntityIds([]);
    setPostResolutions({});
    setPhase('parsing');
    setFilename('device contacts');
    setContacts([]);
    setKind(null);
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
      setPhase('matching');
    } catch {
      setError('could not read device contacts');
      setPhase('error');
    }
  }

  const ambiguousRows =
    importPreview?.rows.filter((r) => r.status === 'ambiguous') ?? [];

  function applyPostImportResolution(rowIndex: number, targetEntityId: string | null) {
    setPostResolutions((prev) => ({ ...prev, [rowIndex]: targetEntityId }));
    if (targetEntityId === null) return;
    const createdEntityId = batchEntityIds[rowIndex];
    if (!createdEntityId) return;
    resolveAmbiguous.mutate({ createdEntityId, targetEntityId });
  }

  function retryMatching() {
    autoImportStartedRef.current = false;
    setPhase('matching');
    void preview.refetch();
  }

  const previewFailed = phase === 'matching' && preview.isError;

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
          padding: '20px clamp(14px, 4vw, 20px) 40px',
          maxWidth: 680,
          width: '100%',
          margin: '0 auto',
          boxSizing: 'border-box',
          animation: 'wm-fade var(--dur-slow, 420ms) var(--ease-relaxed, ease-out) both',
        }}
      >
        <p
          className="mono"
          style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-55)', margin: '0 0 12px' }}
        >
          drop a LinkedIn export,{' '}
          <em style={{ fontStyle: 'italic', fontFamily: 'serif' }}>Connections.csv</em>, or a{' '}
          <em style={{ fontStyle: 'italic', fontFamily: 'serif' }}>.vcf</em> — contacts stay private
          to your account. clean files import in one tap.
        </p>

        <a
          href={LINKEDIN_DATA_EXPORT_URL}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="imports-linkedin-export"
          className="mono"
          style={{
            display: 'block',
            fontSize: 11,
            lineHeight: 1.55,
            color: accent,
            marginBottom: 20,
            textDecoration: 'none',
          }}
        >
          get your LinkedIn export → LinkedIn emails the zip when it&apos;s ready; drop it here
          without unzipping.
        </a>

        <div
          data-testid="imports-dropzone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          onClick={() => {
            if (phase === 'uploading') return;
            inputRef.current?.click();
          }}
          role="button"
          tabIndex={phase === 'uploading' ? -1 : 0}
          aria-disabled={phase === 'uploading'}
          onKeyDown={(e) => {
            if (phase === 'uploading') return;
            if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
          }}
          style={{
            minHeight: 148,
            padding: '28px clamp(14px, 4vw, 20px)',
            borderRadius: 20,
            border: `1px dashed ${accent}59`,
            background: `${accent}0a`,
            textAlign: 'center',
            cursor: phase === 'uploading' ? 'not-allowed' : 'pointer',
            marginBottom: 16,
            opacity: phase === 'uploading' ? 0.6 : 1,
            transition: 'border-color 240ms var(--ease-relaxed, ease-out), opacity 240ms var(--ease-relaxed, ease-out)',
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
            {phase === 'parsing'
              ? 'reading…'
              : phase === 'matching'
                ? preview.isFetching
                  ? 'matching…'
                  : 'starting import…'
                : phase === 'uploading'
                  ? 'importing…'
                  : 'tap or drop a file'}
          </div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-40)' }}>
            .csv · .zip · .vcf · up to {IMPORT_MAX_BATCH} contacts
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.zip,.vcf,.vcard,text/csv,application/zip,text/vcard,text/x-vcard"
            hidden
            data-testid="imports-file-input"
            disabled={phase === 'uploading'}
            onChange={(e) => {
              if (phase === 'uploading') {
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
            disabled={busyImport}
            onClick={() => void handleDevicePick()}
            style={{
              width: '100%',
              marginBottom: 16,
              minHeight: 44,
              padding: 12,
              borderRadius: 14,
              border: '1px solid var(--border-soft)',
              background: 'var(--surface-2)',
              color: 'var(--ink)',
              font: '600 13px Inter, system-ui, sans-serif',
              cursor: busyImport ? 'not-allowed' : 'pointer',
              opacity: busyImport ? 0.7 : 1,
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
            style={{ fontSize: 12, color: colors.alarm, marginBottom: 12 }}
          >
            {error}
          </p>
        ) : null}

        {previewFailed ? (
          <div
            data-testid="imports-preview-error"
            role="alert"
            style={{
              padding: 16,
              borderRadius: 18,
              border: '1px solid var(--border-soft)',
              background: 'var(--surface-1)',
              marginBottom: 12,
            }}
          >
            <p
              className="mono"
              style={{ fontSize: 12, color: colors.alarm, margin: '0 0 10px' }}
            >
              could not match contacts — check your connection and retry
            </p>
            <button
              type="button"
              data-testid="imports-preview-retry"
              onClick={retryMatching}
              style={{
                padding: '10px 14px',
                minHeight: 40,
                borderRadius: 12,
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

        {phase === 'done' && result ? (
          <div
            data-testid="imports-result"
            style={{
              padding: 18,
              borderRadius: 18,
              border: `1px solid ${accent}38`,
              background: `${accent}0f`,
              marginBottom: 12,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>import complete</div>
            <p className="mono" style={{ fontSize: 12, color: 'var(--text-85)', margin: 0 }}>
              added {result.created} · merged {result.matched} · {result.total} total
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
                padding: '8px 0',
              }}
            >
              back to home →
            </Link>
          </div>
        ) : null}

        {phase === 'done' && ambiguousRows.length > 0 ? (
          <div
            data-testid="imports-conflicts"
            style={{
              padding: 16,
              borderRadius: 18,
              border: '1px solid var(--border-soft)',
              background: 'var(--surface-1)',
              boxShadow: shadows.card,
              marginBottom: 12,
            }}
          >
            <div
              className="mono"
              style={{ fontSize: 11, color: 'var(--text-55)', marginBottom: 10 }}
            >
              {ambiguousRows.length} needed a judgement call — review
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
                        postResolutions[row.index] === undefined
                          ? '__new__'
                          : postResolutions[row.index] === null
                            ? '__new__'
                            : postResolutions[row.index]!
                      }
                      disabled={resolveAmbiguous.isPending}
                      onChange={(e) => {
                        const v = e.target.value;
                        applyPostImportResolution(
                          row.index,
                          v === '__new__' ? null : v,
                        );
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        marginTop: 4,
                        minHeight: 40,
                        padding: '8px 12px',
                        borderRadius: 12,
                        border: '1px solid var(--border-soft)',
                        background: 'var(--surface-2)',
                        color: 'var(--ink)',
                        font: '12px Inter, system-ui, sans-serif',
                      }}
                    >
                      <option value="__new__">keep new person (imported)</option>
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

        {phase === 'undone' ? (
          <div
            data-testid="imports-undone"
            style={{
              padding: 18,
              borderRadius: 18,
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
              padding: 18,
              borderRadius: 18,
              border: '1px dashed var(--border-soft)',
              color: 'var(--text-55)',
              fontSize: 13.5,
              lineHeight: 1.6,
            }}
          >
            no imports yet — drop a file or request your LinkedIn export above.
          </div>
        ) : null}
      </section>

      {toast ? (
        <div
          data-testid="imports-toast"
          role="status"
          className="mono"
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 88,
            transform: 'translateX(-50%)',
            padding: '10px 14px',
            background: 'var(--bg-raised, var(--surface-1))',
            border: `1px solid ${accent}38`,
            borderRadius: 999,
            color: 'var(--text-85)',
            fontSize: 12,
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            boxShadow: shadows.card,
            maxWidth: 'min(92vw, 420px)',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          <span>{toast}</span>
          {result && result.created > 0 && phase === 'done' ? (
            <button
              type="button"
              data-testid="imports-undo"
              disabled={undo.isPending}
              onClick={() => undo.mutate({ kind: result.kind, batchId: result.batchId })}
              style={{
                fontSize: 11,
                color: accent,
                background: 'transparent',
                border: 'none',
                cursor: undo.isPending ? 'not-allowed' : 'pointer',
                textDecoration: 'underline',
                padding: 0,
              }}
            >
              {undo.isPending ? 'undoing…' : 'undo'}
            </button>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
