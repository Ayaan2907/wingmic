import type { ImportContactDraft } from './types';

export type MatchIndexes = {
  byEmail: Map<string, Set<string>>;
  byLinkedIn: Map<string, Set<string>>;
  byName: Map<string, Set<string>>;
};

export type MatchCandidate = {
  entityId: string;
  reasons: Array<'email' | 'linkedin' | 'name'>;
};

export type MatchResult =
  | { kind: 'none' }
  | { kind: 'match'; entityId: string; reasons: MatchCandidate['reasons'] }
  | { kind: 'ambiguous'; candidates: MatchCandidate[] };

function addOwners(
  reasonsById: Map<string, MatchCandidate['reasons']>,
  owners: Set<string> | undefined,
  reason: MatchCandidate['reasons'][number],
): void {
  if (!owners) return;
  for (const id of owners) {
    const existing = reasonsById.get(id) ?? [];
    if (!existing.includes(reason)) existing.push(reason);
    reasonsById.set(id, existing);
  }
}

function toCandidates(
  reasonsById: Map<string, MatchCandidate['reasons']>,
): MatchCandidate[] {
  return [...reasonsById.entries()].map(([entityId, reasons]) => ({
    entityId,
    reasons,
  }));
}

/** Collect every index hit; one id = match, multiple = ambiguous. Name-only → ambiguous. */
export function resolveMatch(contact: ImportContactDraft, indexes: MatchIndexes): MatchResult {
  const reasonsById = new Map<string, MatchCandidate['reasons']>();

  if (contact.email) {
    addOwners(reasonsById, indexes.byEmail.get(contact.email.trim().toLowerCase()), 'email');
  }
  if (contact.linkedinUrl) {
    addOwners(
      reasonsById,
      indexes.byLinkedIn.get(contact.linkedinUrl.trim().toLowerCase()),
      'linkedin',
    );
  }
  addOwners(reasonsById, indexes.byName.get(contact.name.trim().toLowerCase()), 'name');

  if (reasonsById.size === 0) return { kind: 'none' };

  const hasStrong = [...reasonsById.values()].some((reasons) =>
    reasons.some((r) => r === 'email' || r === 'linkedin'),
  );
  // Name alone is too weak for an automatic merge — surface for confirmation.
  if (!hasStrong) {
    return { kind: 'ambiguous', candidates: toCandidates(reasonsById) };
  }

  if (reasonsById.size === 1) {
    const [entityId, reasons] = [...reasonsById.entries()][0]!;
    return { kind: 'match', entityId, reasons };
  }
  return { kind: 'ambiguous', candidates: toCandidates(reasonsById) };
}

/** Register contact identifiers for later rows in the same batch (union into owner sets). */
export function registerIdentifiers(
  indexes: MatchIndexes,
  entityId: string,
  contact: ImportContactDraft,
): void {
  const addOwner = (map: Map<string, Set<string>>, key: string) => {
    let owners = map.get(key);
    if (!owners) {
      owners = new Set();
      map.set(key, owners);
    }
    owners.add(entityId);
  };

  addOwner(indexes.byName, contact.name.trim().toLowerCase());
  if (contact.email) {
    addOwner(indexes.byEmail, contact.email.trim().toLowerCase());
  }
  if (contact.linkedinUrl) {
    addOwner(indexes.byLinkedIn, contact.linkedinUrl.trim().toLowerCase());
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
  const hasForeignOwner = (owners: Set<string> | undefined) =>
    !!owners && [...owners].some((id) => id !== entityId);

  if (contact.email) {
    const key = contact.email.trim().toLowerCase();
    if (!hasForeignOwner(indexes.byEmail.get(key))) {
      out.push({ key: 'email', value: contact.email.trim() });
    }
  }
  if (contact.linkedinUrl) {
    const key = contact.linkedinUrl.trim().toLowerCase();
    if (!hasForeignOwner(indexes.byLinkedIn.get(key))) {
      out.push({ key: 'linkedin', value: contact.linkedinUrl.trim() });
    }
  }
  return out;
}

/** Unfiltered identifier facts — used when force-creating a new person. */
export function identifierFacts(
  contact: ImportContactDraft,
): Array<{ key: string; value: string }> {
  const out: Array<{ key: string; value: string }> = [];
  if (contact.email) out.push({ key: 'email', value: contact.email.trim() });
  if (contact.linkedinUrl) out.push({ key: 'linkedin', value: contact.linkedinUrl.trim() });
  return out;
}
