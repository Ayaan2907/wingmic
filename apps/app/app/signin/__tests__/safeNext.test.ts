import { describe, expect, it } from 'vitest';
import { safeNextPath } from '../safeNext';

describe('safeNextPath', () => {
  it('keeps a root-relative app path', () => {
    expect(safeNextPath('/graph')).toBe('/graph');
    expect(safeNextPath('/person/abc')).toBe('/person/abc');
  });

  it('rejects absolute and protocol-relative URLs', () => {
    expect(safeNextPath('https://evil.example/phish')).toBe('/chat');
    expect(safeNextPath('//evil.example/phish')).toBe('/chat');
    expect(safeNextPath('/\\evil.example')).toBe('/chat');
  });

  it('uses the first value when next is repeated', () => {
    expect(safeNextPath(['/acts', 'https://evil.example'])).toBe('/acts');
  });

  it('falls back when next is missing or empty', () => {
    expect(safeNextPath(undefined)).toBe('/chat');
    expect(safeNextPath('')).toBe('/chat');
  });
});
