import { describe, expect, it } from 'vitest';
import { TOOL_SCOPES } from './server';
import { jsonResponse, makeHarness, recordingFetch } from './test-helpers';

/** Extracts the text out of a CallToolResult for assertions. */
function resultText(result: { content: Array<{ type: string; text?: string }> }): string {
  return result.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text ?? '')
    .join('');
}

const scopeErrorBody = (missingScope: string) => ({
  error: {
    code: 'insufficient_scope',
    message: `key is missing the required scope: ${missingScope}`,
    missingScope,
  },
});

describe('tool → scope mapping', () => {
  it('maps each tool to its REST v1 scope', () => {
    expect(TOOL_SCOPES).toEqual({
      search_network: 'search:read',
      log_interaction: 'capture:write',
      get_person: 'graph:read',
      create_followup: 'capture:write',
    });
  });
});

describe('scope errors surface as tool-level errors naming the missing scope', () => {
  const cases: Array<{ tool: string; args: Record<string, unknown>; missingScope: string }> = [
    { tool: 'search_network', args: { query: 'who ships rust' }, missingScope: 'search:read' },
    {
      tool: 'log_interaction',
      args: { note: 'coffee with Sarah Chen' },
      missingScope: 'capture:write',
    },
    {
      tool: 'create_followup',
      args: { what: 'follow up with Sarah' },
      missingScope: 'capture:write',
    },
    { tool: 'get_person', args: { name: 'Sarah Chen' }, missingScope: 'graph:read' },
  ];

  for (const { tool, args, missingScope } of cases) {
    it(`${tool} reports a 403 naming ${missingScope}`, async () => {
      const { fetch } = recordingFetch(() => jsonResponse(scopeErrorBody(missingScope), 403));
      const { client } = await makeHarness(fetch);
      const result = (await client.callTool({ name: tool, arguments: args })) as {
        isError?: boolean;
        content: Array<{ type: string; text?: string }>;
      };
      expect(result.isError).toBe(true);
      expect(resultText(result)).toContain(missingScope);
      // The key never leaks into tool output.
      expect(resultText(result)).not.toContain('wk_live_test_key');
    });
  }
});

describe('rate-limit (429) paths are retryable tool errors with the Retry-After hint', () => {
  const cases: Array<{ tool: string; args: Record<string, unknown> }> = [
    { tool: 'search_network', args: { query: 'who ships rust' } },
    { tool: 'log_interaction', args: { note: 'coffee with Sarah Chen' } },
    { tool: 'create_followup', args: { what: 'follow up with Sarah' } },
    { tool: 'get_person', args: { name: 'Sarah Chen' } },
  ];

  for (const { tool, args } of cases) {
    it(`${tool} surfaces 429 as a retryable tool error`, async () => {
      const { fetch } = recordingFetch(() =>
        jsonResponse({ error: { code: 'rate_limited', message: 'rate limit exceeded' } }, 429, {
          'Retry-After': '30',
        }),
      );
      const { client } = await makeHarness(fetch);
      const result = (await client.callTool({ name: tool, arguments: args })) as {
        isError?: boolean;
        content: Array<{ type: string; text?: string }>;
      };
      expect(result.isError).toBe(true);
      const text = resultText(result);
      expect(text.toLowerCase()).toContain('rate limit');
      expect(text).toContain('30');
      // A retryable error should tell the caller to retry rather than treat it as fatal.
      expect(text.toLowerCase()).toContain('retry');
    });
  }
});

describe('each tool calls the REST v1 endpoint its scope grants', () => {
  it('search_network hits GET /api/v1/recall (search:read)', async () => {
    const { fetch, calls } = recordingFetch(() =>
      jsonResponse({
        entities: [
          {
            id: 'e1',
            name: 'Marco Diaz',
            aliases: [],
            score: 0.91,
            companies: [],
            events: [],
            topics: [],
            facts: [],
          },
        ],
        durationMs: 5,
        mode: 'semantic',
      }),
    );
    const { client } = await makeHarness(fetch);
    const result = (await client.callTool({
      name: 'search_network',
      arguments: { query: 'who ships rust', limit: 3 },
    })) as {
      isError?: boolean;
      content: Array<{ type: string; text?: string }>;
    };
    expect(result.isError).toBeUndefined();
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.test/api/v1/recall?q=who+ships+rust&limit=3');
    expect(resultText(result)).toContain('Marco Diaz');
  });

  it('log_interaction hits POST /api/v1/capture (capture:write)', async () => {
    const { fetch, calls } = recordingFetch(() =>
      jsonResponse({
        extracted: { persons: [{ name: 'Sarah Chen' }] },
        interactionId: 'i1',
        entityIds: ['p1'],
      }),
    );
    const { client } = await makeHarness(fetch);
    const result = (await client.callTool({
      name: 'log_interaction',
      arguments: {
        note: 'grabbed coffee with Sarah Chen at Acme',
        capturedAt: '2026-09-24T10:00:00Z',
        clientCaptureId: 'cli-1',
      },
    })) as { isError?: boolean; content: Array<{ type: string; text?: string }> };
    expect(result.isError).toBeUndefined();
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.test/api/v1/capture');
    expect(calls[0].init.method).toBe('POST');
    const body = JSON.parse(String(calls[0].init.body)) as Record<string, unknown>;
    expect(body).toEqual({
      transcript: 'grabbed coffee with Sarah Chen at Acme',
      capturedAt: '2026-09-24T10:00:00Z',
      clientCaptureId: 'cli-1',
    });
  });

  it('get_person reads /api/v1/people then /api/v1/graph (graph:read) and returns the neighborhood', async () => {
    const { fetch, calls } = recordingFetch((url) => {
      if (url.includes('/api/v1/people')) {
        return jsonResponse({ people: [{ id: 'p1', name: 'Sarah Chen' }] });
      }
      return jsonResponse({
        nodes: [
          { id: 'p1', kind: 'person', label: 'Sarah Chen' },
          { id: 'c1', kind: 'company', label: 'Acme' },
          { id: 'p2', kind: 'person', label: 'Marco Diaz' },
        ],
        links: [
          { source: 'p1', target: 'c1', rel: 'works_at' },
          { source: 'p2', target: 'c1', rel: 'works_at' },
        ],
      });
    });
    const { client } = await makeHarness(fetch);
    const result = (await client.callTool({
      name: 'get_person',
      arguments: { name: 'sarah chen' },
    })) as {
      isError?: boolean;
      content: Array<{ type: string; text?: string }>;
    };
    expect(result.isError).toBeUndefined();
    const peopleCalls = calls.filter((c) => c.url.includes('/api/v1/people'));
    const graphCalls = calls.filter((c) => c.url.includes('/api/v1/graph'));
    expect(peopleCalls).toHaveLength(1);
    expect(graphCalls).toHaveLength(1);
    const parsed = JSON.parse(resultText(result)) as {
      matched: boolean;
      person: { id: string };
      links: unknown[];
    };
    expect(parsed.matched).toBe(true);
    expect(parsed.person.id).toBe('p1');
    // Neighborhood is the person's own links, not the whole graph — Marco's link is excluded.
    expect(parsed.links).toHaveLength(1);
  });

  it('get_person falls back to recall when the name is unknown', async () => {
    const { fetch } = recordingFetch((url) => {
      if (url.includes('/api/v1/people'))
        return jsonResponse({ people: [{ id: 'p2', name: 'Marco Diaz' }] });
      return jsonResponse({
        entities: [
          {
            id: 'p1',
            name: 'Sarah Chen',
            aliases: [],
            score: 0.6,
            companies: [],
            events: [],
            topics: [],
            facts: [],
          },
        ],
        durationMs: 3,
        mode: 'semantic',
      });
    });
    const { client } = await makeHarness(fetch);
    const result = (await client.callTool({
      name: 'get_person',
      arguments: { name: 'Sarah' },
    })) as {
      isError?: boolean;
      content: Array<{ type: string; text?: string }>;
    };
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(resultText(result)) as {
      matched: boolean;
      matches: Array<{ name: string }>;
    };
    expect(parsed.matched).toBe(false);
    expect(parsed.matches[0].name).toBe('Sarah Chen');
  });

  it('create_followup hits POST /api/v1/capture (capture:write) with a follow-up transcript', async () => {
    const { fetch, calls } = recordingFetch(() =>
      jsonResponse({
        extracted: { actions: [{ what: 'send intro' }] },
        interactionId: 'i2',
        entityIds: [],
      }),
    );
    const { client } = await makeHarness(fetch);
    await client.callTool({
      name: 'create_followup',
      arguments: { what: 'send Sarah the intro to the Acme infra team', when: 'next week' },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.test/api/v1/capture');
    expect(calls[0].init.method).toBe('POST');
    const body = JSON.parse(String(calls[0].init.body)) as { transcript: string };
    expect(body.transcript).toContain('send Sarah the intro to the Acme infra team');
    expect(body.transcript).toContain('next week');
  });
});
