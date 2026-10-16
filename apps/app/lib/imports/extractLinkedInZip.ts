import { unzipSync } from 'fflate';

const CONNECTIONS_CSV = 'connections.csv';

/**
 * Pull LinkedIn `Connections.csv` out of a data-export `.zip` (client-side).
 * Matches any path segment ending in Connections.csv, case-insensitive.
 */
export function extractConnectionsCsvFromZip(bytes: Uint8Array): string {
  const entries = unzipSync(bytes);
  const matchKey = Object.keys(entries).find((name) => {
    const base = name.split('/').pop()?.toLowerCase() ?? '';
    return base === CONNECTIONS_CSV;
  });
  if (!matchKey) {
    throw new Error('Connections.csv not found in zip');
  }
  const raw = entries[matchKey];
  if (!raw || raw.length === 0) {
    throw new Error('Connections.csv is empty');
  }
  return new TextDecoder('utf-8').decode(raw);
}
