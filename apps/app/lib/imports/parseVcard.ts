import { importContactDraftSchema, isLinkedInHost, type ImportContactDraft } from './types';

/** Unfold vCard line continuations (leading space/tab on next line). */
function unfold(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
}

function decodeQuotedPrintable(value: string): string {
  return value.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';');
}

/** Split on `;` while honoring `\;` escapes (structured N / ORG fields). */
function splitVcardComponents(value: string): string[] {
  const parts: string[] = [];
  let cur = '';
  for (let i = 0; i < value.length; i++) {
    const ch = value[i]!;
    if (ch === '\\' && i + 1 < value.length) {
      cur += ch + value[i + 1]!;
      i++;
      continue;
    }
    if (ch === ';') {
      parts.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  parts.push(cur);
  return parts;
}

function parseNameFromN(n: string): string | null {
  // N: Last;First;Middle;Prefix;Suffix — split before unescaping.
  const parts = splitVcardComponents(n).map((p) => decodeQuotedPrintable(p).trim());
  const last = parts[0] ?? '';
  const first = parts[1] ?? '';
  const name = `${first} ${last}`.trim();
  return name || null;
}

function getProp(line: string): { key: string; value: string; raw: string } | null {
  const idx = line.indexOf(':');
  if (idx < 0) return null;
  const left = line.slice(0, idx);
  const raw = line.slice(idx + 1).trim();
  // Strip optional group prefix (item1.EMAIL → EMAIL).
  const key = left.split(';')[0]!.trim().split('.').at(-1)!.toUpperCase();
  return { key, value: decodeQuotedPrintable(raw), raw };
}

function normalizeUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    // Case-insensitive scheme — `HTTPS://…` must not fall through as a path.
    const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`;
    const u = new URL(withScheme);
    u.hash = '';
    u.search = '';
    return u.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

/**
 * Parse one or more vCard 3.0 cards from a .vcf blob into ImportContactDrafts.
 */
export function parseVcard(text: string): ImportContactDraft[] {
  const lines = unfold(text).split('\n');
  const out: ImportContactDraft[] = [];
  let current: Record<string, string> = {};
  let currentRaw: Record<string, string> = {};
  const urls: string[] = [];
  let inCard = false;

  const flush = () => {
    if (!inCard) return;
    const fn = current.FN?.trim() || null;
    const fromN = currentRaw.N ? parseNameFromN(currentRaw.N) : null;
    const name = fn || fromN;
    if (!name) {
      current = {};
      currentRaw = {};
      urls.length = 0;
      return;
    }
    const email = current.EMAIL?.trim() || null;
    const orgRaw = currentRaw.ORG
      ? decodeQuotedPrintable(splitVcardComponents(currentRaw.ORG)[0] ?? '').trim()
      : '';
    const org = orgRaw || null;
    const role = current.TITLE?.trim() || null;
    const phone = current.TEL?.trim() || null;
    const notes = current.NOTE?.trim() || null;
    let linkedinUrl: string | null = null;
    for (const raw of urls) {
      const normalized = normalizeUrl(raw);
      if (normalized && isLinkedInHost(new URL(normalized).hostname)) {
        linkedinUrl = normalized;
        break;
      }
    }
    const draft = importContactDraftSchema.safeParse({
      name,
      email: email && email.includes('@') ? email : null,
      linkedinUrl,
      company: org,
      role,
      phone,
      notes,
    });
    if (draft.success) out.push(draft.data);
    current = {};
    currentRaw = {};
    urls.length = 0;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line) continue;
    const upper = line.toUpperCase();
    if (upper === 'BEGIN:VCARD') {
      flush();
      inCard = true;
      current = {};
      currentRaw = {};
      urls.length = 0;
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
    if (prop.key === 'URL') {
      urls.push(prop.value);
      continue;
    }
    // Keep first occurrence of each other key (EMAIL/TEL/FN/…).
    if (current[prop.key] == null) {
      current[prop.key] = prop.value;
      currentRaw[prop.key] = prop.raw;
    }
  }
  flush();
  return out;
}
