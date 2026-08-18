import { isBlockedExtractUrl } from './query';
import {
  WebSearchError,
  type WebExtractQuery,
  type WebExtractResult,
  type WebSearchHit,
  type WebSearchProvider,
  type WebSearchQuery,
} from './types';

const TAVILY_BASE = 'https://api.tavily.com';
const TAVILY_TIMEOUT_MS = 12_000;

type FetchLike = typeof fetch;

export class TavilyWebSearchProvider implements WebSearchProvider {
  readonly id = 'tavily' as const;
  private readonly apiKey: string;
  private readonly fetchImpl: FetchLike;

  constructor(opts: { apiKey: string; fetch?: FetchLike }) {
    this.apiKey = opts.apiKey;
    this.fetchImpl = opts.fetch ?? fetch;
  }

  async search(query: WebSearchQuery): Promise<WebSearchHit[]> {
    const maxResults = query.maxResults ?? 5;
    const body: Record<string, unknown> = {
      query: query.q,
      search_depth: 'basic',
      max_results: maxResults,
      include_answer: false,
      include_raw_content: false,
      topic: query.intent === 'event' ? 'news' : 'general',
    };
    if (query.intent === 'profile') {
      body.include_domains = ['linkedin.com'];
    }

    const json = await this.postJson<{
      results?: Array<{ title?: string; url?: string; content?: string }>;
    }>('/search', body);

    return (json.results ?? [])
      .filter((row) => row.title && row.url)
      .map((row) => ({
        title: row.title as string,
        url: row.url as string,
        snippet: (row.content ?? '').trim(),
      }));
  }

  async extract(query: WebExtractQuery): Promise<WebExtractResult[]> {
    const urls = query.urls.filter((url) => !isBlockedExtractUrl(url));
    if (urls.length === 0) return [];

    const body: Record<string, unknown> = {
      urls,
      extract_depth: 'basic',
      format: 'text',
    };
    if (query.query) body.query = query.query;

    const json = await this.postJson<{
      results?: Array<{ url?: string; raw_content?: string }>;
    }>('/extract', body);

    return (json.results ?? [])
      .filter((row) => row.url && row.raw_content)
      .map((row) => ({
        url: row.url as string,
        content: (row.raw_content as string).trim(),
      }));
  }

  private async postJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${TAVILY_BASE}${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TAVILY_TIMEOUT_MS),
      });
    } catch (err) {
      throw new WebSearchError(`tavily ${path} network error`, err);
    }

    if (!res.ok) {
      throw new WebSearchError(`tavily ${path} failed (${res.status})`);
    }

    try {
      return (await res.json()) as T;
    } catch (err) {
      throw new WebSearchError(`tavily ${path} returned invalid json`, err);
    }
  }
}
