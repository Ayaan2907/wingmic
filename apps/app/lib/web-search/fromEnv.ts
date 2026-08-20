import { env } from '@/lib/config/env';
import { createWebSearchProvider } from './createProvider';
import type { WebSearchProvider } from './types';

/** App wiring: env → factory. Adapters never read `process.env`. */
export function webSearchProviderFromEnv(): WebSearchProvider | null {
  const provider = env.WEB_SEARCH_PROVIDER ?? 'none';
  if (provider === 'none') return null;
  return createWebSearchProvider({
    provider,
    tavilyApiKey: env.TAVILY_API_KEY,
    exaApiKey: env.EXA_API_KEY,
  });
}
