import { describe, expect, it } from 'vitest';
import { ConfigError, DEFAULT_API_BASE_URL, loadConfig } from './config';

describe('loadConfig', () => {
  it('applies the default API base URL and accepts a valid key', () => {
    const config = loadConfig({ WINGMIC_API_KEY: 'wk_live_abc123' });
    expect(config).toEqual({ baseUrl: DEFAULT_API_BASE_URL, apiKey: 'wk_live_abc123' });
  });

  it('honors a custom WINGMIC_API_URL and strips trailing slashes', () => {
    const config = loadConfig({
      WINGMIC_API_URL: 'http://localhost:3000/',
      WINGMIC_API_KEY: 'wk_live_x',
    });
    expect(config.baseUrl).toBe('http://localhost:3000');
  });

  it('throws a pointing error when the key is missing', () => {
    expect(() => loadConfig({})).toThrow(ConfigError);
    expect(() => loadConfig({})).toThrow(/WINGMIC_API_KEY/);
  });

  it('rejects keys that do not look like wingmic keys', () => {
    expect(() => loadConfig({ WINGMIC_API_KEY: 'sk-proj-lookalike' })).toThrow(/wk_/);
  });

  it('rejects a non-http WINGMIC_API_URL', () => {
    expect(() =>
      loadConfig({ WINGMIC_API_URL: 'ftp://example.com', WINGMIC_API_KEY: 'wk_live_x' }),
    ).toThrow(/http/);
  });
});
