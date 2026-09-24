/**
 * Client-safe API-key scope definitions — imported by both the key service
 * (server) and the dashboard key-management UI (client). Keep this module
 * free of node: builtins; the client bundle cannot carry them.
 */
export const API_SCOPES = ['graph:read', 'capture:write', 'search:read'] as const;
export type ApiScope = (typeof API_SCOPES)[number];

export function isApiScope(value: string): value is ApiScope {
  return (API_SCOPES as readonly string[]).includes(value);
}

/** Parse the `scopes` column (JSON array). Unknown entries are dropped. */
export function parseScopes(json: string): ApiScope[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((s): s is ApiScope => typeof s === 'string' && isApiScope(s));
}
