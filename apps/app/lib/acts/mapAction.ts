import type { ActionCandidate } from '@wingmic/extractor';
import type { PendingAct } from '@/app/_components/ActCard';

const accent = '#FFC452';
const blue = '#7DD3FC';
const violet = '#A78BFA';

export type ActKind = ActionCandidate['kind'];

const KIND_UI: Record<
  ActKind,
  { glyph: string; label: string; accent: PendingAct['accent']; color: string }
> = {
  email: { glyph: '↗', label: 'email', accent: 'amber', color: accent },
  reminder: { glyph: '◷', label: 'reminder', accent: 'blue', color: blue },
  meeting: { glyph: '◷', label: 'meeting', accent: 'blue', color: blue },
  todo: { glyph: '✓', label: 'todo', accent: 'amber', color: accent },
  intro: { glyph: '⇌', label: 'intro', accent: 'violet', color: violet },
};

/** Map a DB/API act row into the shared ActCard shape. */
export function toPendingAct(row: {
  kind: string;
  body: string;
  whenHint?: string | null;
  confidence: number;
  targetName?: string | null;
  secondaryName?: string | null;
}): PendingAct {
  const kind = (['reminder', 'email', 'meeting', 'todo', 'intro'].includes(row.kind)
    ? row.kind
    : 'todo') as ActKind;
  const ui = KIND_UI[kind];
  const name =
    kind === 'intro' && row.targetName && row.secondaryName
      ? `${row.targetName} → ${row.secondaryName}`
      : row.targetName?.trim() || ui.label;
  const whyParts = [row.body.trim()];
  if (row.whenHint?.trim()) whyParts.push(row.whenHint.trim());
  return {
    kind: ui.label,
    glyph: ui.glyph,
    name,
    why: whyParts.filter(Boolean).join(' · '),
    conf: Math.max(0, Math.min(100, Math.round(row.confidence))),
    accent: ui.accent,
    color: ui.color,
    actionKind: kind,
    subject: null,
    whenHint: row.whenHint ?? null,
    body: row.body,
  };
}

/** Tokenize a display name for whole-token matching (avoids "Ann" → "Joanne"). */
function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z0-9'-]/g, ''))
    .filter(Boolean);
}

function tokensMatch(needle: string, haystack: string): boolean {
  const n = nameTokens(needle);
  if (n.length === 0) return false;
  const h = new Set(nameTokens(haystack));
  return n.every((t) => h.has(t));
}

/** Resolve targetPersonName against commit person order → entity ids. */
export function resolveTargetEntityId(
  targetPersonName: string | null | undefined,
  persons: Array<{ name: string }>,
  entityIds: string[],
): string | null {
  if (!targetPersonName?.trim() || persons.length === 0) return null;
  const needle = targetPersonName.trim();
  for (let i = 0; i < persons.length; i++) {
    if (persons[i]?.name.trim().toLowerCase() === needle.toLowerCase() && entityIds[i]) {
      return entityIds[i];
    }
  }
  for (let i = 0; i < persons.length; i++) {
    const personName = persons[i]?.name ?? '';
    if (tokensMatch(needle, personName) && entityIds[i]) return entityIds[i];
  }
  return null;
}

/** For intro actions, pick a second person from the commit when available. */
export function resolveIntroEntityIds(
  action: Pick<ActionCandidate, 'kind' | 'targetPersonName'>,
  persons: Array<{ name: string }>,
  entityIds: string[],
): { targetEntityId: string | null; secondaryEntityId: string | null } {
  const targetEntityId = resolveTargetEntityId(action.targetPersonName, persons, entityIds);
  if (action.kind !== 'intro') {
    return { targetEntityId, secondaryEntityId: null };
  }
  for (let i = 0; i < persons.length; i++) {
    const id = entityIds[i];
    if (id && id !== targetEntityId) {
      return { targetEntityId, secondaryEntityId: id };
    }
  }
  return { targetEntityId, secondaryEntityId: null };
}

/** Build a minimal .ics calendar invite for meeting/reminder CTAs. */
export function buildIcs(opts: {
  title: string;
  description: string;
  whenHint?: string | null;
}): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
  // If whenHint isn't ISO, schedule +24h as a safe default — user edits in calendar.
  let start = new Date(Date.now() + 24 * 60 * 60 * 1000);
  if (opts.whenHint) {
    const parsed = Date.parse(opts.whenHint);
    if (!Number.isNaN(parsed)) start = new Date(parsed);
  }
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const fmt = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}Z$/, 'Z');
  const escape = (s: string) =>
    s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  const uidSuffix =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//wingmic//acts//EN',
    'BEGIN:VEVENT',
    `UID:wingmic-${stamp}-${uidSuffix}@wingmic.xyz`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${escape(opts.title)}`,
    `DESCRIPTION:${escape(opts.description)}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

export function mailtoHref(opts: { subject?: string | null; body: string; to?: string | null }): string {
  const to = opts.to?.trim() ?? '';
  const q: string[] = [];
  if (opts.subject) q.push(`subject=${encodeURIComponent(opts.subject)}`);
  q.push(`body=${encodeURIComponent(opts.body)}`);
  return `mailto:${encodeURIComponent(to)}?${q.join('&')}`;
}
