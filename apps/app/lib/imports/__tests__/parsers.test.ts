import { describe, it, expect } from 'vitest';
import { parseLinkedInCsv } from '../parseLinkedInCsv';
import { parseVcard } from '../parseVcard';
import { normalizeContactsFromFile } from '../normalizeContact';
import { isLinkedInHost } from '../types';

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

  it('rejects phishing lookalike hosts', () => {
    const csv = `First Name,Last Name,URL,Email Address,Company,Position,Connected On
Ada,Lovelace,https://evillinkedin.com/in/ada,ada@example.com,Engines,Math,01 Jan 2024
`;
    const rows = parseLinkedInCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.linkedinUrl).toBeNull();
  });

  it('keeps the row when email is invalid placeholder text', () => {
    const csv = `First Name,Last Name,URL,Email Address,Company,Position,Connected On
Ada,Lovelace,https://www.linkedin.com/in/ada,(not specified),Engines,Math,01 Jan 2024
`;
    const rows = parseLinkedInCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.name).toBe('Ada Lovelace');
    expect(rows[0]!.email).toBeNull();
    expect(rows[0]!.linkedinUrl).toContain('linkedin.com/in/ada');
  });
});

describe('isLinkedInHost', () => {
  it('accepts linkedin.com and subdomains only', () => {
    expect(isLinkedInHost('linkedin.com')).toBe(true);
    expect(isLinkedInHost('www.linkedin.com')).toBe(true);
    expect(isLinkedInHost('evillinkedin.com')).toBe(false);
    expect(isLinkedInHost('linkedin.com.evil.example')).toBe(false);
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

  it('normalizes uppercase scheme and strips search/hash on LinkedIn URLs', () => {
    const card = `BEGIN:VCARD
VERSION:3.0
FN:Ada Lovelace
URL:HTTPS://www.linkedin.com/in/ada-lovelace?trk=share#section
END:VCARD
`;
    const rows = parseVcard(card);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.linkedinUrl).toBe('https://www.linkedin.com/in/ada-lovelace');
  });

  it('keeps escaped semicolons inside ORG company name', () => {
    const card = `BEGIN:VCARD
VERSION:3.0
FN:Ada Lovelace
ORG:Foo\\;Bar Engines;Dept
END:VCARD
`;
    const rows = parseVcard(card);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.company).toBe('Foo;Bar Engines');
  });

  it('maps NOTE into notes', () => {
    const card = `BEGIN:VCARD
VERSION:3.0
FN:Ada Lovelace
NOTE:Met at Analytical Engines demo
END:VCARD
`;
    const rows = parseVcard(card);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.notes).toBe('Met at Analytical Engines demo');
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

  it('sniffs lowercase begin:vcard when filename is unrecognized', () => {
    const lowercase = VCARD.replace(/BEGIN:VCARD/g, 'begin:vcard').replace(
      /END:VCARD/g,
      'end:vcard',
    );
    const res = normalizeContactsFromFile({ filename: 'contacts.txt', text: lowercase });
    expect(res.kind).toBe('vcard');
    expect(res.contacts.length).toBe(2);
  });
});
