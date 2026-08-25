import { describe, expect, it } from 'vitest';
import { namesOverlap } from '../namesOverlap';

describe('namesOverlap', () => {
  it('matches exact names case-insensitively', () => {
    expect(namesOverlap('Sarah Chen', 'sarah chen')).toBe(true);
  });

  it('matches a short name against a longer one', () => {
    expect(namesOverlap('Sagar', 'Sagar Patel')).toBe(true);
    expect(namesOverlap('Sarah', 'Sarah Chen')).toBe(true);
  });

  it('does not match a token that is only a substring of another token', () => {
    expect(namesOverlap('Ann', 'Joanne Smith')).toBe(false);
  });

  it('rejects empty names', () => {
    expect(namesOverlap(' ', 'Ada')).toBe(false);
  });
});
