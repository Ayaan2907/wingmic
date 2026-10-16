import {
  importContactDraftSchema,
  type ImportContactDraft,
  type ImportSourceKind,
} from './types';
import { parseLinkedInCsv } from './parseLinkedInCsv';
import { parseVcard } from './parseVcard';
import { extractConnectionsCsvFromZip } from './extractLinkedInZip';

/**
 * Detect format from filename / mime and return normalized drafts.
 * Returns an empty list for empty input; parsers themselves skip bad rows.
 * Pass `bytes` for `.zip` LinkedIn exports; pass `text` for csv/vcard.
 */
export function normalizeContactsFromFile(opts: {
  filename: string;
  text?: string;
  bytes?: Uint8Array;
  kind?: ImportSourceKind;
}): { kind: ImportSourceKind; contacts: ImportContactDraft[] } {
  const name = opts.filename.toLowerCase();
  let text: string;
  let kind: ImportSourceKind;

  if (opts.kind) {
    kind = opts.kind;
    if (name.endsWith('.zip') || opts.bytes) {
      if (!opts.bytes) throw new Error('zip import requires file bytes');
      text = extractConnectionsCsvFromZip(opts.bytes);
    } else {
      text = opts.text ?? '';
      if (!text) throw new Error('csv/vcard import requires text');
    }
  } else if (name.endsWith('.zip')) {
    if (!opts.bytes) throw new Error('zip import requires file bytes');
    text = extractConnectionsCsvFromZip(opts.bytes);
    kind = 'linkedin';
  } else {
    text = opts.text ?? '';
    if (!text) throw new Error('csv/vcard import requires text');
    kind =
      name.endsWith('.vcf') || name.endsWith('.vcard')
        ? 'vcard'
        : name.endsWith('.csv')
          ? 'linkedin'
          : /BEGIN:VCARD/i.test(text)
            ? 'vcard'
            : 'linkedin';
  }

  const raw = kind === 'vcard' ? parseVcard(text) : parseLinkedInCsv(text);
  const contacts = raw
    .map((c) => importContactDraftSchema.safeParse(c))
    .filter((r): r is { success: true; data: ImportContactDraft } => r.success)
    .map((r) => r.data);

  return { kind, contacts };
}
