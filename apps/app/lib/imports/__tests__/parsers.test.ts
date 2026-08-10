import { describe, it, expect } from 'vitest';
import { parseLinkedInCsv } from '../parseLinkedInCsv';
import { parseVcard } from '../parseVcard';
import { normalizeContactsFromFile } from '../normalizeContact';

const LINKEDIN_CSV = `First Name,Last Name,URL,Email Address,Company,Position,Connected On
Ada,Lovelace,https://www.linkedin.com/in/ada-lovelace,ada@example.com,Analytical Engines,Mathematician,01 Jan 2024
Grace,Hopper,https://www.linkedin.com/in/grace-hopper,,US Navy,Rear Admiral,02 Feb 2024
,,https://www.linkedin.com/in/no-name,nobody@example.com,Acme,Engineer,03 Mar 2024
`;

const VCARD = `BEGIN:VCARD
VERSION:3.0
N:Lovelace;Ada;;;
FN:Ada Lovelace
EMAIL;TYPE=INTERNET:ada@example.com
ORG:Analytical Engines
TITLE:Mathematician
URL:https://www.linkedin.com/in/ada-lovelace
END:VCARD
BEGIN:VCARD
VERSION:3.0
FN:Grace Hopper
EMAIL:grace@example.com
ORG:US Navy
END:VCARD
`;

describe('parseLinkedInCsv', () => {
  it('parses Connections.csv rows into drafts', () => {
    const rows = parseLinkedInCsv(LINKEDIN_CSV);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      company: 'Analytical Engines',
      role: 'Mathematician',
    });
    expect(rows[0]!.linkedinUrl).toContain('linkedin.com/in/ada-lovelace');
    expect(rows[1]!.name).toBe('Grace Hopper');
    expect(rows[1]!.email).toBeNull();
  });

  it('skips note preamble before the header', () => {
    const withNotes = `Notes:
"When exporting your connection data..."

First Name,Last Name,URL,Email Address,Company,Position,Connected On
Ada,Lovelace,https://www.linkedin.com/in/ada,ada@example.com,Engines,Math,01 Jan 2024
`;
    const rows = parseLinkedInCsv(withNotes);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.name).toBe('Ada Lovelace');
  });

  it('finds the header after a long preamble (>5 rows)', () => {
    const preamble = Array.from({ length: 12 }, (_, i) => `note row ${i + 1}`).join('\n');
    const withNotes = `${preamble}
First Name,Last Name,URL,Email Address,Company,Position,Connected On
Ada,Lovelace,https://www.linkedin.com/in/ada,ada@example.com,Engines,Math,01 Jan 2024
`;
    const rows = parseLinkedInCsv(withNotes);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.name).toBe('Ada Lovelace');
  });
});

describe('parseVcard', () => {
  it('parses multiple vCard 3.0 cards', () => {
    const rows = parseVcard(VCARD);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      company: 'Analytical Engines',
      role: 'Mathematician',
    });
    expect(rows[1]!.name).toBe('Grace Hopper');
  });

  it('strips grouped property prefixes like item1.EMAIL', () => {
    const grouped = `BEGIN:VCARD
VERSION:3.0
FN:Ada Lovelace
item1.EMAIL;TYPE=INTERNET:ada@example.com
item1.X-ABLabel:home
ORG:Analytical Engines
END:VCARD
`;
    const rows = parseVcard(grouped);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.email).toBe('ada@example.com');
  });

  it('prefers a LinkedIn URL when another URL appears first', () => {
    const multiUrl = `BEGIN:VCARD
VERSION:3.0
FN:Ada Lovelace
URL:https://example.com/ada
URL:https://www.linkedin.com/in/ada-lovelace
END:VCARD
`;
    const rows = parseVcard(multiUrl);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.linkedinUrl).toContain('linkedin.com/in/ada-lovelace');
  });
});

describe('normalizeContactsFromFile', () => {
  it('detects vcard from filename', () => {
    const res = normalizeContactsFromFile({ filename: 'contacts.vcf', text: VCARD });
    expect(res.kind).toBe('vcard');
    expect(res.contacts.length).toBe(2);
  });

  it('detects linkedin csv from filename', () => {
    const res = normalizeContactsFromFile({
      filename: 'Connections.csv',
      text: LINKEDIN_CSV,
    });
    expect(res.kind).toBe('linkedin');
    expect(res.contacts.length).toBe(2);
  });
});
