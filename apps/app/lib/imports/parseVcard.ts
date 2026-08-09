import { importContactDraftSchema, type ImportContactDraft } from './types';

/** Unfold vCard line continuations (leading space/tab on next line). */
function unfold(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
}

function decodeQuotedPrintable(value: string): string {
  return value.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';');
}

function parseNameFromN(n: string): string | null {
  // N: Last;First;Middle;Prefix;Suffix
  const parts = n.split(';').map((p) => p.trim());
  const last = parts[0] ?? '';
  const first = parts[1] ?? '';
  const name = `${first} ${last}`.trim();
  return name || null;
}

function getProp(line: string): { key: string; value: string } | null {
  const idx = line.indexOf(':');
  if (idx < 0) return null;
  const left = line.slice(0, idx);
  const value = decodeQuotedPrintable(line.slice(idx + 1).trim());
  const key = left.split(';')[0]!.trim().toUpperCase();
  return { key, value };
}

function normalizeUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const u = new URL(t.startsWith('http') ? t : `https://${t}`);
    return u.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

function isLinkedIn(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'linkedin.com' || host.endsWith('.linkedin.com');
  } catch {
    return false;
  }
}

/**
 * Parse one or more vCard 3.0 cards from a .vcf blob into ImportContactDrafts.
 */
export function parseVcard(text: string): ImportContactDraft[] {
  const lines = unfold(text).split('\n');
  const out: ImportContactDraft[] = [];
  let current: Record<string, string> = {};
  let inCard = false;

  const flush = () => {
    if (!inCard) return;
    const fn = current.FN?.trim() || null;
    const fromN = current.N ? parseNameFromN(current.N) : null;
    const name = fn || fromN;
    if (!name) {
      current = {};
      return;
    }
    const email = current.EMAIL?.trim() || null;
    const org = current.ORG?.split(';')[0]?.trim() || null;
    const role = current.TITLE?.trim() || null;
    const phone = current.TEL?.trim() || null;
    const url = current.URL ? normalizeUrl(current.URL) : null;
    const linkedinUrl = url && isLinkedIn(url) ? url : null;
    const draft = importContactDraftSchema.safeParse({
      name,
      email: email && email.includes('@') ? email : null,
      linkedinUrl,
      company: org,
      role,
      phone,
      notes: null,
    });
    if (draft.success) out.push(draft.data);
    current = {};
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line) continue;
    const upper = line.toUpperCase();
    if (upper === 'BEGIN:VCARD') {
      flush();
      inCard = true;
      current = {};
      continue;
    }
    if (upper === 'END:VCARD') {
      flush();
      inCard = false;
      continue;
    }
    if (!inCard) continue;
    const prop = getProp(line);
    if (!prop) continue;
    // Keep first occurrence of each key (EMAIL/TEL/URL).
    if (current[prop.key] == null) current[prop.key] = prop.value;
  }
  flush();
  return out;
}
