import { describe, expect, it } from 'vitest';
import { webSearchProviderFromEnv } from '../fromEnv';

describe('webSearchProviderFromEnv', () => {
  it('skips when env has no provider or key (jsdom / client-shaped env)', () => {
    expect(() => webSearchProviderFromEnv()).not.toThrow();
    expect(webSearchProviderFromEnv()).toBeNull();
  });
});
