import { describe, expect, it } from 'vitest';
import { WingmicApiClient } from './client';
import { WingmicApiError } from './errors';
import type { FetchLike } from './client';

const config = { baseUrl: 'https://api.test/', apiKey: 'wk_live_test_key' };

function jsonFetch(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): {
  fetch: FetchLike;
  calls: Array<{ url: string; init: RequestInit }>;
} {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl: FetchLike = (url, init) => {
    calls.push({ url, init });
    return Promise.resolve(
      new Response(body === undefined ? undefined : JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', ...headers },
      }),
    );
  };
  return { fetch: fetchImpl, calls };
}

describe('WingmicApiClient', () => {
  it('sends the bearer key and strips trailing slashes from the base URL', async () => {
    const { fetch, calls } = jsonFetch(200, { people: [] });
    const client = new WingmicApiClient(config, fetch);
    await client.listPeople(5);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.test/api/v1/people?limit=5');
    expect(new Headers(calls[0].init.headers).get('Authorization')).toBe('Bearer wk_live_test_key');
  });

  it('maps a 403 insufficient_scope body to missingScope', async () => {
    const { fetch } = jsonFetch(403, {
      error: {
        code: 'insufficient_scope',
        message: 'key is missing the required scope: search:read',
        missingScope: 'search:read',
      },
    });
    const client = new WingmicApiClient(config, fetch);
    const err = await client.recall('who ships rust').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(WingmicApiError);
    expect((err as WingmicApiError).status).toBe(403);
    expect((err as WingmicApiError).code).toBe('insufficient_scope');
    expect((err as WingmicApiError).missingScope).toBe('search:read');
    expect((err as WingmicApiError).retryable).toBe(false);
  });

  it('maps a 429 with Retry-After to a retryable error', async () => {
    const { fetch } = jsonFetch(
      429,
      { error: { code: 'rate_limited', message: 'rate limit exceeded' } },
      {
        'Retry-After': '12',
      },
    );
    const client = new WingmicApiClient(config, fetch);
    const err = (await client.recall('q').catch((e: unknown) => e)) as WingmicApiError;
    expect(err.code).toBe('rate_limited');
    expect(err.retryable).toBe(true);
    expect(err.retryAfterSeconds).toBe(12);
  });

  it('maps 401 to unauthorized without retry', async () => {
    const { fetch } = jsonFetch(401, { error: { code: 'unauthorized', message: 'unknown key' } });
    const client = new WingmicApiClient(config, fetch);
    const err = (await client.listPeople().catch((e: unknown) => e)) as WingmicApiError;
    expect(err.code).toBe('unauthorized');
    expect(err.retryable).toBe(false);
  });

  it('maps transport failures to network_error (retryable) without leaking the key', async () => {
    const fetch: FetchLike = () => Promise.reject(new Error('ECONNREFUSED'));
    const client = new WingmicApiClient(config, fetch);
    const err = (await client.getGraph().catch((e: unknown) => e)) as WingmicApiError;
    expect(err.code).toBe('network_error');
    expect(err.retryable).toBe(true);
    expect(err.message).not.toContain('wk_live_test_key');
  });

  it('posts capture bodies as JSON', async () => {
    const { fetch, calls } = jsonFetch(200, { extracted: {}, interactionId: 'i1', entityIds: [] });
    const client = new WingmicApiClient(config, fetch);
    await client.capture({ transcript: 'coffee with Sarah' });
    expect(calls[0].init.method).toBe('POST');
    expect(new Headers(calls[0].init.headers).get('Content-Type')).toBe('application/json');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ transcript: 'coffee with Sarah' });
  });
});
