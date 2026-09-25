/**
 * Attachment keys are content-addressed: the SHA-256 of the exact bytes is
 * part of the key. Consequences:
 *   - `put` is idempotent (same bytes → same key → identical overwrite), so
 *     capture retries can re-upload safely.
 *   - Integrity is self-verifying: sha256(bytes) must equal the key segment.
 *   - Identical photos across users share storage at the object-store level
 *     if keys ever become global; today the userId segment scopes them.
 */
export const ATTACHMENT_KEY_VERSION = 'v1';

export function attachmentStorageKey(input: {
  userId: string;
  sha256Hex: string;
}): string {
  const idSegment = input.userId.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!idSegment) {
    throw new Error('attachment storage key requires a user id');
  }
  const hash = input.sha256Hex.toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(hash)) {
    throw new Error('attachment storage key requires a sha-256 hex digest');
  }
  return `attachments/${ATTACHMENT_KEY_VERSION}/${idSegment}/${hash}.jpg`;
}

/** Extract the sha-256 hex segment from a valid attachment key. */
export function sha256FromAttachmentKey(key: string): string | null {
  const parts = key.split('/');
  if (parts.length !== 4 || parts[0] !== 'attachments') return null;
  const file = parts[3];
  if (!file?.endsWith('.jpg')) return null;
  const hex = file.slice(0, -'.jpg'.length);
  return /^[a-f0-9]{64}$/.test(hex) ? hex : null;
}
