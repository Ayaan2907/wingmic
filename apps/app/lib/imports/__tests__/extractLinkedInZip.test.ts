// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { zipSync } from 'fflate';
import { extractConnectionsCsvFromZip } from '../extractLinkedInZip';
import { normalizeContactsFromFile } from '../normalizeContact';

const CSV = `First Name,Last Name,URL,Email Address,Company,Position,Connected On
Ada,Lovelace,https://www.linkedin.com/in/ada-lovelace,ada@example.com,Engines,Math,01 Jan 2024
`;

describe('extractConnectionsCsvFromZip', () => {
  it('finds Connections.csv inside a nested path', () => {
    const zip = zipSync({
      'Full_LinkedInDataExport/Connections.csv': new TextEncoder().encode(CSV),
      'readme.txt': new TextEncoder().encode('ignore'),
    });
    const text = extractConnectionsCsvFromZip(zip);
    expect(text).toContain('Ada,Lovelace');
  });

  it('throws when Connections.csv is missing', () => {
    const zip = zipSync({ 'other.csv': new TextEncoder().encode('x') });
    expect(() => extractConnectionsCsvFromZip(zip)).toThrow(/Connections.csv/i);
  });
});

describe('normalizeContactsFromFile zip', () => {
  it('parses linkedin contacts from a zip export', () => {
    const zip = zipSync({
      'Connections.csv': new TextEncoder().encode(CSV),
    });
    const res = normalizeContactsFromFile({
      filename: 'Basic_LinkedInDataExport.zip',
      bytes: zip,
    });
    expect(res.kind).toBe('linkedin');
    expect(res.contacts).toHaveLength(1);
    expect(res.contacts[0]!.name).toBe('Ada Lovelace');
  });
});
