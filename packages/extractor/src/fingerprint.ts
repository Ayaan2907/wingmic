import { createHash } from 'node:crypto';
import { slugify } from './slug';
import { canonicalizeLinkedin } from './linkedin';
import type { PersonCandidate } from './schema';

/**
 * Ranked identity key for a private person (Framing D).
 * Hash **one** key, not the whole draft. Never a global people table.
 *
 * Strong keys may auto-merge later (`matchLocal`). `name_lower` must not.
 */
export type FingerprintKind =
  | 'linkedin_url_normalized'
  | 'email_lower'
  | 'name_company'
  | 'name_lower';

export interface PersonaDraft {
  name: string;
  email?: string | null;
  linkedin?: string | null;
  companyHint?: string | null;
  role?: string | null;
  aliases?: string[];
  notes?: string | null;
  /** Web / import source URL if known. Never persist vendor JSON. */
  sourceUrl?: string | null;
}

export interface Fingerprint {
  id: string;
  kind: FingerprintKind;
  /** Canonical string that was hashed (not a secret; useful in tests). */
  key: string;
}

const FINGERPRINT_VERSION = 'v1';

export function personaDraftFromPerson(person: PersonCandidate): PersonaDraft {
  return {
    name: person.name,
    email: person.email,
    linkedin: person.linkedin,
    companyHint: person.companyHint,
    role: person.role,
    aliases: person.aliases,
    notes: person.notes,
  };
}

/** True for keys that later `matchLocal` may auto-link without a confirm chip. */
export function isStrongFingerprint(kind: FingerprintKind): boolean {
  return kind === 'linkedin_url_normalized' || kind === 'email_lower';
}

export { canonicalizeLinkedin } from './linkedin';

/** Trim + lowercase. Rejects strings that are not a plausible email. */
export function canonicalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (!email || /\s/.test(email)) return null;
  const at = email.indexOf('@');
  if (at <= 0 || at !== email.lastIndexOf('@')) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (!local || local.startsWith('.') || local.endsWith('.') || local.includes('..')) {
    return null;
  }
  const labels = domain.split('.');
  if (labels.length < 2 || labels.some((label) => !label || /[^a-z0-9-]/.test(label))) {
    return null;
  }
  return email;
}

function hashKey(kind: FingerprintKind, key: string): Fingerprint {
  const digest = createHash('sha256').update(key).digest('hex');
  return {
    id: `fp:${FINGERPRINT_VERSION}:${kind}:${digest}`,
    kind,
    key,
  };
}

/**
 * Pick the strongest available key and fingerprint it.
 * Returns null when even the name cannot slugify.
 */
export function fingerprint(draft: PersonaDraft): Fingerprint | null {
  const linkedin = draft.linkedin ? canonicalizeLinkedin(draft.linkedin) : null;
  if (linkedin) return hashKey('linkedin_url_normalized', linkedin);

  const email = draft.email ? canonicalizeEmail(draft.email) : null;
  if (email) return hashKey('email_lower', email);

  const name = slugify(draft.name);
  if (!name) return null;

  const company = draft.companyHint ? slugify(draft.companyHint) : '';
  if (company) return hashKey('name_company', `${name}|${company}`);

  return hashKey('name_lower', name);
}
