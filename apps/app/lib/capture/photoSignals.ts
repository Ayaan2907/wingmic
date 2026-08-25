import { canonicalizeLinkedin } from '@wingmic/extractor/linkedin';

export type PhotoSignals = {
  personName: string | null;
  companyName: string | null;
  eventName: string | null;
  linkedin: string | null;
  eventUrl: string | null;
};

const NAME_MAX_CHARS = 80;
const NAME_MAX_WORDS = 8;

function compactName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (/[\n\r|;]/.test(raw)) return null;
  const trimmed = raw.replace(/\s+/g, ' ').trim();
  if (!trimmed) return null;
  if (trimmed.length > NAME_MAX_CHARS) return null;
  const words = trimmed.split(' ');
  if (words.length > NAME_MAX_WORDS) return null;
  if (/[.!?]/.test(trimmed) && words.length > 4) return null;
  return trimmed;
}

function compactHttpUrl(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return trimmed;
  } catch {
    return null;
  }
}

function linkedInProfileUrl(raw: string | null | undefined): string | null {
  const compact = compactHttpUrl(raw);
  if (!compact) return null;
  return canonicalizeLinkedin(compact);
}

export function normalizePhotoSignals(
  raw: Partial<PhotoSignals> | null | undefined,
): PhotoSignals {
  return {
    personName: compactName(raw?.personName),
    companyName: compactName(raw?.companyName),
    eventName: compactName(raw?.eventName),
    linkedin: linkedInProfileUrl(raw?.linkedin),
    eventUrl: compactHttpUrl(raw?.eventUrl),
  };
}

export function mergePhotoSignals(
  transcript: string,
  signals: PhotoSignals,
): string {
  const normalized = normalizePhotoSignals(signals);
  const bits = [transcript.trim()];
  const seen = transcript.toLowerCase();
  const appended = new Set<string>();
  const push = (value: string | null) => {
    if (!value) return;
    const key = value.toLowerCase();
    if (seen.includes(key) || appended.has(key)) return;
    bits.push(value);
    appended.add(key);
  };
  push(normalized.personName);
  push(normalized.companyName);
  push(normalized.eventName);
  push(normalized.linkedin);
  push(normalized.eventUrl);
  return bits.filter(Boolean).join(' ').trim();
}
