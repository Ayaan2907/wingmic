import { z } from 'zod';
import { importContactDraftSchema, normalizeLinkedInUrl, type ImportContactDraft } from './types';

/** LinkedIn Connections.csv header aliases (export variants). */
const HEADER_ALIASES: Record<string, keyof RowFields> = {
  'first name': 'firstName',
  'last name': 'lastName',
  'email address': 'email',
  email: 'email',
  company: 'company',
  position: 'role',
  title: 'role',
  url: 'linkedinUrl',
  'profile url': 'linkedinUrl',
  'connected on': 'connectedOn',
  notes: 'notes',
};

type RowFields = {
  firstName?: string;
  lastName?: string;
  email?: string;
  company?: string;
  role?: string;
  linkedinUrl?: string;
  connectedOn?: string;
  notes?: string;
};

function stripBom(text: string): string {
  return text.replace(/^\uFEFF/, '');
}

/** Minimal CSV splitter — handles quoted fields with commas/newlines. */
export function splitCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const src = stripBom(text);

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      continue;
    }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((c) => c.trim().length > 0)) rows.push(row);
      row = [];
      continue;
    }
    field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim().length > 0)) rows.push(row);
  return rows;
}

function mapHeader(cell: string): keyof RowFields | null {
  const key = cell.trim().toLowerCase();
  return HEADER_ALIASES[key] ?? null;
}

function emptyToNull(s: string | undefined): string | null {
  const t = s?.trim() ?? '';
  return t.length ? t : null;
}

/** Invalid / placeholder emails become null so the rest of the row still imports. */
function parseEmail(raw: string | null): string | null {
  if (!raw) return null;
  const parsed = z.string().trim().email().safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/**
 * Parse a LinkedIn Connections.csv export into ImportContactDraft rows.
 * Skips malformed rows; never throws on bad data cells.
 */
export function parseLinkedInCsv(text: string): ImportContactDraft[] {
  const rows = splitCsvRows(text);
  if (rows.length < 2) return [];

  // LinkedIn sometimes prepends notes rows before the real header.
  let headerIdx = 0;
  for (let i = 0; i < rows.length; i++) {
    const mapped = rows[i]!.map(mapHeader);
    if (mapped.includes('firstName') || mapped.includes('linkedinUrl')) {
      headerIdx = i;
      break;
    }
  }

  const header = rows[headerIdx]!;
  const fields = header.map(mapHeader);
  if (!fields.some(Boolean)) return [];

  const out: ImportContactDraft[] = [];
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const cells = rows[r]!;
    const raw: RowFields = {};
    for (let c = 0; c < fields.length; c++) {
      const f = fields[c];
      if (!f) continue;
      raw[f] = cells[c]?.trim() ?? '';
    }

    const first = emptyToNull(raw.firstName) ?? '';
    const last = emptyToNull(raw.lastName) ?? '';
    const name = `${first} ${last}`.trim();
    if (!name) continue;

    const draft = importContactDraftSchema.safeParse({
      name,
      email: parseEmail(emptyToNull(raw.email)),
      linkedinUrl: normalizeLinkedInUrl(emptyToNull(raw.linkedinUrl)),
      company: emptyToNull(raw.company),
      role: emptyToNull(raw.role),
      phone: null,
      notes: emptyToNull(raw.notes),
    });
    if (draft.success) out.push(draft.data);
  }
  return out;
}
