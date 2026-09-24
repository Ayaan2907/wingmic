import type { McpConfig } from './types';

export const DEFAULT_API_BASE_URL = 'https://app.wingmic.xyz';

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Reads MCP server configuration from the environment:
 * - WINGMIC_API_URL — REST v1 base URL (default https://app.wingmic.xyz)
 * - WINGMIC_API_KEY — required bearer key, `wk_live_...`, issued in the dashboard
 *
 * The MCP client (Claude Desktop, inspector, etc.) stores the key in its own
 * config and passes it through env. Values are validated here so a missing
 * key fails at startup with a pointing message, not as a 401 on first tool call.
 */
export function loadConfig(env: Record<string, string | undefined> = process.env): McpConfig {
  const baseUrl = env.WINGMIC_API_URL?.trim() || DEFAULT_API_BASE_URL;
  if (!/^https?:\/\//.test(baseUrl)) {
    throw new ConfigError(`WINGMIC_API_URL must be an http(s) URL, got "${baseUrl}"`);
  }

  const apiKey = env.WINGMIC_API_KEY?.trim();
  if (!apiKey) {
    throw new ConfigError(
      'WINGMIC_API_KEY is required — create a scoped API key in the wingmic dashboard ' +
        '(app.wingmic.xyz/dashboard) and set it in your MCP client config.',
    );
  }
  if (!apiKey.startsWith('wk_')) {
    throw new ConfigError(
      'WINGMIC_API_KEY should look like wk_live_… — create keys in the wingmic dashboard.',
    );
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey };
}
