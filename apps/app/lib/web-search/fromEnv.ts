import { env } from '@/lib/config/env';
import { createWebSearchProvider } from './createProvider';
import type { WebSearchProvider } from './types';

/** App wiring: env → factory. Adapters never read `process.env`. */
export function webSearchProviderFromEnv(): WebSearchProvider | null {
  return createWebSearchProvider({
    provider: env.WEB_SEARCH_PROVIDER,
    tavilyApiKey: env.TAVILY_API_KEY,
    exaApiKey: env.EXA_API_KEY,
  });
}
