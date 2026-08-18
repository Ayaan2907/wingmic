export type WebSearchIntent = 'person' | 'company' | 'event' | 'general' | 'profile';

/** Registered vendors. Add a factory in `createProvider.ts` to go live. */
export type WebSearchProviderId = 'tavily' | 'exa';

export type WebSearchConfig = {
  provider: WebSearchProviderId | 'none';
  tavilyApiKey?: string;
  exaApiKey?: string;
};

export type WebSearchQuery = {
  intent: WebSearchIntent;
  q: string;
  maxResults?: number;
};

export type WebSearchHit = {
  title: string;
  url: string;
  snippet: string;
};

export type WebExtractQuery = {
  urls: string[];
  /** Optional rerank hint forwarded to the vendor extract API. */
  query?: string;
};

export type WebExtractResult = {
  url: string;
  content: string;
};

/**
 * Vendor-agnostic public web lookup.
 * Call sites must not import Tavily/Exa modules — only this interface + the factory.
 */
export interface WebSearchProvider {
  readonly id: WebSearchProviderId;
  search(query: WebSearchQuery): Promise<WebSearchHit[]>;
  extract(query: WebExtractQuery): Promise<WebExtractResult[]>;
}

export class WebSearchError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'WebSearchError';
  }
}

export class WebSearchConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebSearchConfigError';
  }
}
