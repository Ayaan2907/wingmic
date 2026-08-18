// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createWebSearchProvider } from '../createProvider';

describe('createWebSearchProvider', () => {
  it('returns null when provider is none', () => {
    expect(
      createWebSearchProvider({
        provider: 'none',
        tavilyApiKey: 'tvly-test',
      }),
    ).toBeNull();
  });

  it('returns null when tavily is selected but the key is missing', () => {
    expect(createWebSearchProvider({ provider: 'tavily' })).toBeNull();
  });

  it('returns a tavily provider when the key is set', () => {
    const provider = createWebSearchProvider({
      provider: 'tavily',
      tavilyApiKey: 'tvly-test',
    });
    expect(provider?.id).toBe('tavily');
  });

  it('throws a clear error for exa until that adapter is registered', () => {
    expect(() =>
      createWebSearchProvider({ provider: 'exa', exaApiKey: 'exa-test' }),
    ).toThrow(/not implemented/i);
  });
});
