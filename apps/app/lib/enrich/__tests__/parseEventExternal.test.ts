import { describe, it, expect } from 'vitest';
import { parseEventExternal } from '../parseEventExternal';

describe('parseEventExternal', () => {
  it('reads lu.ma and partiful ids', () => {
    expect(parseEventExternal('https://lu.ma/abc123')).toEqual({
      source: 'luma',
      id: 'abc123',
    });
    expect(parseEventExternal('https://partiful.com/e/xyz')).toEqual({
      source: 'partiful',
      id: 'xyz',
    });
    expect(parseEventExternal('https://www.ethdenver.com')).toBeNull();
  });
});
