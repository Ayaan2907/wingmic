import type { ActionCandidate } from '@wingmic/extractor';
import type { PendingAct } from '@/app/_components/ActCard';
import { chooseActChannel, type ActChannel, type ActKind } from './chooseActChannel';

export type { ActChannel, ActKind };

const accent = '#FFC452';
const blue = '#7DD3FC';
const violet = '#A78BFA';

const CHANNEL_UI: Record<
  ActChannel,
  { glyph: string; label: string; accent: PendingAct['accent']; color: string }
> = {
  email: { glyph: '✉', label: 'email', accent: 'amber', color: accent },
  linkedin: { glyph: 'in', label: 'linkedin', accent: 'blue', color: blue },
  reminder: { glyph: '◷', label: 'reminder', accent: 'blue', color: blue },
  meeting: { glyph: '◷', label: 'meeting', accent: 'blue', color: blue },
  intro: { glyph: '⇌', label: 'intro', accent: 'violet', color: violet },
  memo: { glyph: '✎', label: 'memo', accent: 'amber', color: accent },
};

/** Map a DB/API act row into the shared ActCard shape. */
export function toPendingAct(row: {
  kind: string;
  body: string;
  whenHint?: string | null;
  confidence: number;
  targetName?: string | null;
  secondaryName?: string | null;
  subject?: string | null;
  hasEmail?: boolean;
  hasLinkedin?: boolean;
}): PendingAct {
  const kind = (['reminder', 'email', 'meeting', 'todo', 'intro'].includes(row.kind)
    ? row.kind
    : 'todo') as ActKind;
  const channel = chooseActChannel({
    kind,
    hasEmail: Boolean(row.hasEmail),
    hasLinkedin: Boolean(row.hasLinkedin),
  });
  const ui = CHANNEL_UI[channel];
  const name =
    kind === 'intro' && row.targetName && row.secondaryName
      ? `${row.targetName} → ${row.secondaryName}`
      : row.targetName?.trim() || (kind === 'intro' ? 'intro' : 'follow-up');
  return {
    kind: ui.label,
    glyph: ui.glyph,
    name,
    why: row.whenHint?.trim() || '',
    conf: Math.max(0, Math.min(100, Math.round(row.confidence))),
    accent: ui.accent,
    color: ui.color,
    actionKind: kind,
    channel,
    subject: row.subject ?? null,
    whenHint: row.whenHint ?? null,
    body: row.body,
  };
}

/** Skip undated meetings — "I met with X" is a memory, not a calendar hold. */
function isUndatedMeeting(action: Pick<ActionCandidate, 'kind' | 'whenHint'>): boolean {
  return action.kind === 'meeting' && !action.whenHint?.trim();
}

/**
 * One draft per person per kind per capture. Prefer an explicit target,
 * else the first extracted person (so cards never title themselves "meeting").
 */
export function collapseActionsForCapture(
  actions: ActionCandidate[],
  persons: Array<{ name: string }>,
): ActionCandidate[] {
  const fallbackName = persons[0]?.name?.trim() || null;
  const seen = new Set<string>();
  const out: ActionCandidate[] = [];
  for (const action of actions) {
    if (isUndatedMeeting(action)) continue;
    const target = (action.targetPersonName?.trim() || fallbackName || '').toLowerCase();
    const key = `${action.kind}:${target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      ...action,
      targetPersonName: action.targetPersonName?.trim() || fallbackName,
    });
  }
  return out;
}

/** Tokenize a display name for whole-token matching (avoids "Ann" → "Joanne"). */
function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}'-]/gu, ''))
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
  // Only attach a secondary once a target resolved — otherwise the first
  // person becomes a misleading "→ Alice" intro with no real target.
  if (!targetEntityId) {
    return { targetEntityId: null, secondaryEntityId: null };
  }
  for (let i = 0; i < persons.length; i++) {
    const id = entityIds[i];
    if (id && id !== targetEntityId) {
      return { targetEntityId, secondaryEntityId: id };
    }
  }
  return { targetEntityId, secondaryEntityId: null };
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Escape ICS TEXT values (CRLF/CR/LF → literal \\n). */
function escapeIcsText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n/g, '\\n')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\n');
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
  const uidSuffix =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  const hint = opts.whenHint?.trim() ?? '';
  // Date-only ISO → all-day VALUE=DATE (avoids UTC-midnight day shift).
  if (DATE_ONLY_RE.test(hint)) {
    const startDay = hint.replace(/-/g, '');
    const next = new Date(`${hint}T00:00:00.000Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    const endDay = next.toISOString().slice(0, 10).replace(/-/g, '');
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//wingmic//acts//EN',
      'BEGIN:VEVENT',
      `UID:wingmic-${stamp}-${uidSuffix}@wingmic.xyz`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${startDay}`,
      `DTEND;VALUE=DATE:${endDay}`,
      `SUMMARY:${escapeIcsText(opts.title)}`,
      `DESCRIPTION:${escapeIcsText(opts.description)}`,
      'END:VEVENT',
      'END:VCALENDAR',
      '',
    ].join('\r\n');
  }

  // If whenHint isn't ISO, schedule +24h as a safe default — user edits in calendar.
  let start = new Date(Date.now() + 24 * 60 * 60 * 1000);
  if (hint) {
    const parsed = Date.parse(hint);
    if (!Number.isNaN(parsed)) start = new Date(parsed);
  }
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const fmt = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}Z$/, 'Z');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//wingmic//acts//EN',
    'BEGIN:VEVENT',
    `UID:wingmic-${stamp}-${uidSuffix}@wingmic.xyz`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${escapeIcsText(opts.title)}`,
    `DESCRIPTION:${escapeIcsText(opts.description)}`,
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
