import { describe, it, expect } from 'vitest';
import { eventEmbedText } from '../eventEmbed';

describe('eventEmbedText', () => {
  it('joins name and location for the embedder', () => {
    expect(eventEmbedText({ name: 'ETHDenver', location: 'Denver, CO' })).toBe(
      'ETHDenver · Denver, CO',
    );
    expect(eventEmbedText({ name: 'ETHDenver', location: null })).toBe('ETHDenver');
  });
});
