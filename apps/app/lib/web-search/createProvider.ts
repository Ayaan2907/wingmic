import { TavilyWebSearchProvider } from './tavily';
import {
  WebSearchConfigError,
  type WebSearchConfig,
  type WebSearchProvider,
} from './types';

/**
 * Build the active public-web provider from config (not `process.env`).
 *
 * Swap vendors by changing `provider` and adding a factory case — call sites
 * keep using `WebSearchProvider.search` / `.extract`.
 *
 * Missing Tavily key → `null` (enrich skipped). `exa` throws until registered.
 */
export function createWebSearchProvider(
  config: WebSearchConfig,
): WebSearchProvider | null {
  switch (config.provider) {
    case 'none':
      return null;
    case 'tavily': {
      const key = config.tavilyApiKey?.trim();
      if (!key) return null;
      return new TavilyWebSearchProvider({ apiKey: key });
    }
    case 'exa':
      throw new WebSearchConfigError(
        'web search provider "exa" is not implemented yet. add apps/app/lib/web-search/exa.ts and register it in createProvider.ts',
      );
    default: {
      const _exhaustive: never = config.provider;
      throw new WebSearchConfigError(`unknown web search provider: ${String(_exhaustive)}`);
    }
  }
}
