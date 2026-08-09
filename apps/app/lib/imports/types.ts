import { z } from 'zod';

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

export const importSourceKindSchema = z.enum(['linkedin', 'vcard']);
export type ImportSourceKind = z.infer<typeof importSourceKindSchema>;

/** `linkedin:<batchId>` / `vcard:<batchId>` — used for undo (I8) later. */
export function formatImportSource(kind: ImportSourceKind, batchId: string): string {
  return `${kind}:${batchId}`;
}

export function parseImportSource(
  value: string | null | undefined,
): { kind: ImportSourceKind; batchId: string } | null {
  if (!value) return null;
  const m = /^(linkedin|vcard):(.+)$/.exec(value);
  if (!m) return null;
  return { kind: m[1] as ImportSourceKind, batchId: m[2]! };
}
