'use client';

/**
 * ApiKeysClient — /dashboard key management.
 *
 * Create (raw key shown exactly once), list, and revoke API keys for the
 * /api/v1 surface. Follows SettingsClient conventions: trpc hooks +
 * inline styles, tokens from the chat surface palette.
 */

import * as React from 'react';
import { trpc } from '@/lib/trpc/client';
import { accent, second, coral } from '@/app/chat/_components/tokens';
import { API_SCOPES, type ApiScope } from '@/lib/api/scopes';

type ApiKeyRow = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: Date | string;
  lastUsedAt: Date | string | null;
  revokedAt: Date | string | null;
};

const SCOPE_HINTS: Record<string, string> = {
  'graph:read': 'read your graph — /api/v1/graph, /api/v1/people',
  'capture:write': 'commit memos — POST /api/v1/capture',
  'search:read': 'semantic recall — GET /api/v1/recall',
};

function fmtDate(d: Date | string | null): string {
  if (!d) return 'never';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ApiKeysClient() {
  const utils = trpc.useUtils();
  const list = trpc.apiKeys.list.useQuery();
  const [name, setName] = React.useState('');
  const [scopes, setScopes] = React.useState<ApiScope[]>(['graph:read']);
  const [freshKey, setFreshKey] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const create = trpc.apiKeys.create.useMutation({
    onSuccess: (data) => {
      setFreshKey(data.rawKey);
      setCopied(false);
      setName('');
      setFormError(null);
      void utils.apiKeys.list.invalidate();
    },
    onError: (err) => setFormError(err.message),
  });
  const toggleScope = (scope: ApiScope) => {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (scopes.length === 0) {
      setFormError('pick at least one scope');
      return;
    }
    create.mutate({ name: name.trim(), scopes });
  };

  const copy = async () => {
    if (!freshKey) return;
    await navigator.clipboard.writeText(freshKey);
    setCopied(true);
  };

  return (
    <section
      style={{
        width: '100%',
        maxWidth: 640,
        margin: '0 auto',
        textAlign: 'left',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16,
        padding: '24px 20px',
        background: 'rgba(255,255,255,0.03)',
      }}
    >
      <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>
        api keys{' '}
        <span style={{ fontStyle: 'italic', fontWeight: 400, color: accent }}>
          for the public rest api.
        </span>
      </h2>
      <p style={{ marginTop: 8, color: 'var(--text-55)', fontSize: 14, lineHeight: 1.5 }}>
        bearer keys for <code style={{ color: accent }}>app.wingmic.xyz/api/v1</code> — see{' '}
        <a
          href="https://github.com/Ayaan2907/wingmic/blob/main/docs/api.md"
          target="_blank"
          rel="noreferrer"
          style={{ color: accent, textDecoration: 'underline' }}
        >
          docs/api.md
        </a>
        .
      </p>

      {list.isLoading && <p style={{ marginTop: 16, color: 'var(--text-55)' }}>loading keys…</p>}
      {list.isError && (
        <p style={{ marginTop: 16, color: coral }}>couldn&apos;t load keys — try a reload.</p>
      )}

      {list.data && list.data.length === 0 && (
        <p style={{ marginTop: 16, color: 'var(--text-55)', fontSize: 14 }}>
          no keys yet. name one, pick scopes, create.
        </p>
      )}

      {list.data && list.data.length > 0 && (
        <ul style={{ marginTop: 16, display: 'grid', gap: 10 }}>
          {list.data.map((key) => (
            <ApiKeyRowItem key={key.id} row={key} />
          ))}
        </ul>
      )}

      {freshKey && (
        <div
          style={{
            marginTop: 18,
            padding: 14,
            borderRadius: 12,
            border: `1px solid ${second}`,
            background: 'rgba(134,239,172,0.08)',
          }}
        >
          <div
            className="mono"
            style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: second }}
          >
            new key — copy it now
          </div>
          <p style={{ marginTop: 8, fontSize: 13, color: 'var(--text-55)' }}>
            this is the only time the full key is shown. it is stored hashed and can&apos;t be
            recovered.
          </p>
          <code
            style={{
              display: 'block',
              marginTop: 8,
              padding: '10px 12px',
              borderRadius: 8,
              background: 'rgba(0,0,0,0.35)',
              fontSize: 13,
              wordBreak: 'break-all',
            }}
          >
            {freshKey}
          </code>
          <div style={{ marginTop: 10, display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={copy}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: `1px solid ${second}`,
                color: second,
                background: 'transparent',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {copied ? 'copied ✓' : 'copy key'}
            </button>
            <button
              type="button"
              onClick={() => setFreshKey(null)}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.2)',
                color: 'var(--text-55)',
                background: 'transparent',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              done
            </button>
          </div>
        </div>
      )}

      <form onSubmit={submit} style={{ marginTop: 20 }}>
        <div
          className="mono"
          style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: accent }}
        >
          create a key
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="key name — e.g. “cli”, “ayaan-map”"
          maxLength={60}
          style={{
            marginTop: 10,
            width: '100%',
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(0,0,0,0.25)',
            color: 'var(--ink)',
            fontSize: 14,
          }}
        />
        <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
          {API_SCOPES.map((scope) => (
            <label
              key={scope}
              style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 14 }}
            >
              <input
                type="checkbox"
                checked={scopes.includes(scope)}
                onChange={() => toggleScope(scope)}
                style={{ accentColor: accent }}
              />
              <span>
                <code style={{ color: accent }}>{scope}</code>
                <span style={{ color: 'var(--text-55)' }}> — {SCOPE_HINTS[scope]}</span>
              </span>
            </label>
          ))}
        </div>
        {formError && <p style={{ marginTop: 8, color: coral, fontSize: 13 }}>{formError}</p>}
        <button
          type="submit"
          disabled={create.isPending || name.trim().length === 0}
          style={{
            marginTop: 14,
            padding: '10px 18px',
            borderRadius: 8,
            border: 'none',
            background: accent,
            color: '#1a1a1a',
            fontWeight: 700,
            fontSize: 14,
            cursor: create.isPending || name.trim().length === 0 ? 'default' : 'pointer',
            opacity: create.isPending || name.trim().length === 0 ? 0.5 : 1,
          }}
        >
          {create.isPending ? 'creating…' : 'create key'}
        </button>
      </form>
    </section>
  );
}

function ApiKeyRowItem({ row }: { row: ApiKeyRow }) {
  const utils = trpc.useUtils();
  const [confirming, setConfirming] = React.useState(false);
  const [revokeError, setRevokeError] = React.useState<string | null>(null);
  const revoke = trpc.apiKeys.revoke.useMutation({
    onSuccess: () => void utils.apiKeys.list.invalidate(),
    onError: (err) => {
      // A failed revoke (network error, or the key was already revoked
      // elsewhere) must be visible — the row stays live until revocation
      // actually lands.
      setRevokeError(err.message);
      setConfirming(false);
    },
  });
  const revoked = row.revokedAt != null;
  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '12px 14px',
        borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.1)',
        opacity: revoked ? 0.5 : 1,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>
          {row.name} <code style={{ color: accent, fontSize: 12 }}>{row.prefix}…</code>
          {revoked && (
            <span
              className="mono"
              style={{
                marginLeft: 8,
                fontSize: 10,
                letterSpacing: 1,
                textTransform: 'uppercase',
                color: coral,
              }}
            >
              revoked
            </span>
          )}
        </div>
        <div style={{ marginTop: 2, fontSize: 12, color: 'var(--text-55)' }}>
          {row.scopes.join(' · ')} — created {fmtDate(row.createdAt)} · last used{' '}
          {fmtDate(row.lastUsedAt)}
        </div>
        {revokeError && (
          <div style={{ marginTop: 4, fontSize: 12, color: coral }}>{revokeError}</div>
        )}
      </div>
      {!revoked &&
        (confirming ? (
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              type="button"
              disabled={revoke.isPending}
              onClick={() => revoke.mutate({ id: row.id })}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: `1px solid ${coral}`,
                color: coral,
                background: 'transparent',
                fontSize: 12,
                cursor: revoke.isPending ? 'default' : 'pointer',
              }}
            >
              {revoke.isPending ? 'revoking…' : 'confirm revoke'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.2)',
                color: 'var(--text-55)',
                background: 'transparent',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: `1px solid ${coral}`,
              color: coral,
              background: 'transparent',
              fontSize: 12,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            revoke
          </button>
        ))}
    </li>
  );
}
