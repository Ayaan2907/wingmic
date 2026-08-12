import { z } from 'zod';

/** Shared client + server batch ceiling — do not duplicate elsewhere. */
export const IMPORT_MAX_BATCH = 1000;

/** Normalized contact row ready for upsert — fake PII only in fixtures. */
export const importContactDraftSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().nullable().optional(),
  linkedinUrl: z.string().trim().url().nullable().optional(),
  company: z.string().trim().max(200).nullable().optional(),
  role: z.string().trim().max(200).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export type ImportContactDraft = z.infer<typeof importContactDraftSchema>;

export const importSourceKindSchema = z.enum(['linkedin', 'vcard', 'device']);
export type ImportSourceKind = z.infer<typeof importSourceKindSchema>;

/** `linkedin:<batchId>` / `vcard:<batchId>` / `device:<batchId>` — used for undo. */
export function formatImportSource(kind: ImportSourceKind, batchId: string): string {
  return `${kind}:${batchId}`;
}

export function parseImportSource(
  value: string | null | undefined,
): { kind: ImportSourceKind; batchId: string } | null {
  if (!value) return null;
  const m = /^(linkedin|vcard|device):(.+)$/.exec(value);
  if (!m) return null;
  return { kind: m[1] as ImportSourceKind, batchId: m[2]! };
}
