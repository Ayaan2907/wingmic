import { describe, it, expect } from 'vitest';
import { cosine } from './embeddings';

describe('cosine', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosine([1, 0, 0], [1, 0, 0])).toBe(1);
    expect(cosine([0.3, 0.4, 0.5], [0.3, 0.4, 0.5])).toBeCloseTo(1, 6);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosine([1, 0], [0, 1])).toBe(0);
  });

  it('returns -1 for opposite vectors', () => {
    expect(cosine([1, 0], [-1, 0])).toBe(-1);
  });

  it('returns 0 when either vector is zero', () => {
    expect(cosine([0, 0, 0], [1, 2, 3])).toBe(0);
    expect(cosine([1, 2, 3], [0, 0, 0])).toBe(0);
  });

  it('throws on dim mismatch', () => {
    expect(() => cosine([1, 2], [1, 2, 3])).toThrow(/dim mismatch/);
  });

  it('matches a known reference value', () => {
    // sklearn cosine_similarity([[1,2,3]], [[4,5,6]]) → 0.9746318...
    const result = cosine([1, 2, 3], [4, 5, 6]);
    expect(result).toBeCloseTo(0.974631846, 6);
  });
});
