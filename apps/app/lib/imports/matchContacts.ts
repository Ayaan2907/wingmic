import type { ImportContactDraft } from './types';

export type MatchIndexes = {
  byEmail: Map<string, string>;
  byLinkedIn: Map<string, string>;
  byName: Map<string, string>;
};

export type MatchCandidate = {
  entityId: string;
  reasons: Array<'email' | 'linkedin' | 'name'>;
};

export type MatchResult =
  | { kind: 'none' }
  | { kind: 'match'; entityId: string; reasons: MatchCandidate['reasons'] }
  | { kind: 'ambiguous'; candidates: MatchCandidate[] };

/** Collect every index hit; one id = match, multiple = ambiguous. */
export function resolveMatch(contact: ImportContactDraft, indexes: MatchIndexes): MatchResult {
  const reasonsById = new Map<string, MatchCandidate['reasons']>();

  const add = (id: string | undefined, reason: MatchCandidate['reasons'][number]) => {
    if (!id) return;
    const existing = reasonsById.get(id) ?? [];
    if (!existing.includes(reason)) existing.push(reason);
    reasonsById.set(id, existing);
  };

  if (contact.email) {
    add(indexes.byEmail.get(contact.email.trim().toLowerCase()), 'email');
  }
  if (contact.linkedinUrl) {
    add(indexes.byLinkedIn.get(contact.linkedinUrl.trim().toLowerCase()), 'linkedin');
  }
  add(indexes.byName.get(contact.name.trim().toLowerCase()), 'name');

  if (reasonsById.size === 0) return { kind: 'none' };
  if (reasonsById.size === 1) {
    const [entityId, reasons] = [...reasonsById.entries()][0]!;
    return { kind: 'match', entityId, reasons };
  }
  return {
    kind: 'ambiguous',
    candidates: [...reasonsById.entries()].map(([entityId, reasons]) => ({
      entityId,
      reasons,
    })),
  };
}

/**
 * Register contact identifiers for later rows in the same batch.
 * Never overwrite a key that already points at a different entity.
 */
export function registerIdentifiers(
  indexes: MatchIndexes,
  entityId: string,
  contact: ImportContactDraft,
): void {
  const setIfOwnOrAbsent = (map: Map<string, string>, key: string) => {
    const existing = map.get(key);
    if (existing !== undefined && existing !== entityId) return;
    map.set(key, entityId);
  };

  setIfOwnOrAbsent(indexes.byName, contact.name.trim().toLowerCase());
  if (contact.email) {
    setIfOwnOrAbsent(indexes.byEmail, contact.email.trim().toLowerCase());
  }
  if (contact.linkedinUrl) {
    setIfOwnOrAbsent(indexes.byLinkedIn, contact.linkedinUrl.trim().toLowerCase());
  }
}

/**
 * Identifier facts that already belong to another owned entity must not be
 * copied onto the matched target (prevents cross-entity pollution).
 */
export function filterSafeIdentifierFacts(
  indexes: MatchIndexes,
  entityId: string,
  contact: ImportContactDraft,
): Array<{ key: string; value: string }> {
  const out: Array<{ key: string; value: string }> = [];
  if (contact.email) {
    const owner = indexes.byEmail.get(contact.email.trim().toLowerCase());
    if (owner == null || owner === entityId) {
      out.push({ key: 'email', value: contact.email.trim() });
    }
  }
  if (contact.linkedinUrl) {
    const owner = indexes.byLinkedIn.get(contact.linkedinUrl.trim().toLowerCase());
    if (owner == null || owner === entityId) {
      out.push({ key: 'linkedin', value: contact.linkedinUrl.trim() });
    }
  }
  return out;
}
