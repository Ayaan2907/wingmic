import {
  importContactDraftSchema,
  type ImportContactDraft,
  type ImportSourceKind,
} from './types';
import { parseLinkedInCsv } from './parseLinkedInCsv';
import { parseVcard } from './parseVcard';

/**
 * Detect format from filename / mime and return normalized drafts.
 * Returns an empty list for empty input; parsers themselves skip bad rows.
 */
export function normalizeContactsFromFile(opts: {
  filename: string;
  text: string;
  kind?: ImportSourceKind;
}): { kind: ImportSourceKind; contacts: ImportContactDraft[] } {
  const name = opts.filename.toLowerCase();
  const kind: ImportSourceKind =
    opts.kind ??
    (name.endsWith('.vcf') || name.endsWith('.vcard')
      ? 'vcard'
      : name.endsWith('.csv')
        ? 'linkedin'
        : /BEGIN:VCARD/i.test(opts.text)
          ? 'vcard'
          : 'linkedin');

  const raw = kind === 'vcard' ? parseVcard(opts.text) : parseLinkedInCsv(opts.text);
  const contacts = raw
    .map((c) => importContactDraftSchema.safeParse(c))
    .filter((r): r is { success: true; data: ImportContactDraft } => r.success)
    .map((r) => r.data);

  return { kind, contacts };
}
