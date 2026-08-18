// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TavilyWebSearchProvider } from '../tavily';

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('TavilyWebSearchProvider.search', () => {
  it('POSTs /search with bearer token and maps hits', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('https://api.tavily.com/search');
      expect(init?.method).toBe('POST');
      expect(init?.headers).toMatchObject({
        Authorization: 'Bearer tvly-test',
        'Content-Type': 'application/json',
      });
      const body = JSON.parse(String(init?.body));
      expect(body.query).toBe('"Ada Lovelace" Analytical Engines');
      expect(body.search_depth).toBe('basic');
      expect(body.include_answer).toBe(false);
      expect(body.include_raw_content).toBe(false);
      return jsonResponse({
        results: [
          {
            title: 'Ada Lovelace',
            url: 'https://www.linkedin.com/in/ada-lovelace',
            content: 'Analyst at Analytical Engines.',
          },
        ],
      });
    });

    const provider = new TavilyWebSearchProvider({
      apiKey: 'tvly-test',
      fetch: fetchMock,
    });
    const hits = await provider.search({
      intent: 'person',
      q: '"Ada Lovelace" Analytical Engines',
    });

    expect(hits).toEqual([
      {
        title: 'Ada Lovelace',
        url: 'https://www.linkedin.com/in/ada-lovelace',
        snippet: 'Analyst at Analytical Engines.',
      },
    ]);
  });

  it('restricts profile intent to linkedin.com include_domains', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.include_domains).toEqual(['linkedin.com']);
      return jsonResponse({ results: [] });
    });

    const provider = new TavilyWebSearchProvider({
      apiKey: 'tvly-test',
      fetch: fetchMock,
    });
    await provider.search({ intent: 'profile', q: 'Ada Lovelace Analytical Engines' });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

describe('TavilyWebSearchProvider.extract', () => {
  it('POSTs /extract and maps page text', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('https://api.tavily.com/extract');
      const body = JSON.parse(String(init?.body));
      expect(body.urls).toEqual(['https://www.analytical-engines.example/']);
      expect(body.extract_depth).toBe('basic');
      return jsonResponse({
        results: [
          {
            url: 'https://www.analytical-engines.example/',
            raw_content: 'Analytical Engines builds difference engines.',
          },
        ],
      });
    });

    const provider = new TavilyWebSearchProvider({
      apiKey: 'tvly-test',
      fetch: fetchMock,
    });
    const pages = await provider.extract({
      urls: ['https://www.analytical-engines.example/'],
    });
    expect(pages).toEqual([
      {
        url: 'https://www.analytical-engines.example/',
        content: 'Analytical Engines builds difference engines.',
      },
    ]);
  });

  it('does not ask the vendor to extract LinkedIn URLs', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      return jsonResponse({
        results: [
          {
            url: 'https://www.analytical-engines.example/',
            raw_content: 'ok',
          },
        ],
      });
    });
    const provider = new TavilyWebSearchProvider({
      apiKey: 'tvly-test',
      fetch: fetchMock,
    });
    const pages = await provider.extract({
      urls: [
        'https://www.linkedin.com/in/ada-lovelace',
        'https://www.analytical-engines.example/',
      ],
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.urls).toEqual(['https://www.analytical-engines.example/']);
    expect(pages).toHaveLength(1);
  });
});
