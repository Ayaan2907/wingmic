import { describe, expect, it } from 'vitest';
import { matchPerson } from './server';
import { jsonResponse, makeHarness, recordingFetch } from './test-helpers';

function resultText(result: { content: Array<{ type: string; text?: string }> }): string {
  return result.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text ?? '')
    .join('');
}

describe('MCP protocol conformance', () => {
  it('completes the initialize handshake and reports wingmic server identity', async () => {
    const { fetch } = recordingFetch(() => jsonResponse({ people: [] }));
    const { client } = await makeHarness(fetch);
    const version = client.getServerVersion();
    expect(version?.name).toBe('wingmic');
  });

  it('lists exactly the four promised tools with typed input schemas', async () => {
    const { fetch } = recordingFetch(() => jsonResponse({ people: [] }));
    const { client } = await makeHarness(fetch);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'create_followup',
      'get_person',
      'log_interaction',
      'search_network',
    ]);
    for (const tool of tools) {
      expect(tool.inputSchema?.type).toBe('object');
      expect(tool.description?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('rejects invalid tool arguments instead of passing them through', async () => {
    const { fetch, calls } = recordingFetch(() => jsonResponse({ people: [] }));
    const { client } = await makeHarness(fetch);
    let rejected = false;
    let surfacedAsToolError = false;
    try {
      const result = (await client.callTool({
        name: 'search_network',
        arguments: { query: '' },
      })) as {
        isError?: boolean;
        content: Array<{ type: string; text?: string }>;
      };
      surfacedAsToolError = result.isError === true;
    } catch {
      rejected = true;
    }
    expect(rejected || surfacedAsToolError).toBe(true);
    // The invalid call never reached the REST API.
    expect(calls).toHaveLength(0);
  });

  it('executes a full initialize → listTools → callTool round-trip', async () => {
    const { fetch } = recordingFetch(() =>
      jsonResponse({
        entities: [
          {
            id: 'e1',
            name: 'Marco Diaz',
            aliases: [],
            score: 0.9,
            companies: [],
            events: [],
            topics: [],
            facts: [],
          },
        ],
        durationMs: 4,
        mode: 'semantic',
      }),
    );
    const { client } = await makeHarness(fetch);
    await client.listTools();
    const result = (await client.callTool({
      name: 'search_network',
      arguments: { query: 'rust' },
    })) as {
      isError?: boolean;
      content: Array<{ type: string; text?: string }>;
    };
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(resultText(result)) as { mode: string; entities: unknown[] };
    expect(parsed.mode).toBe('semantic');
    expect(parsed.entities).toHaveLength(1);
  });
});

describe('matchPerson precedence', () => {
  const people = [
    { id: '1', name: 'Marco Diaz' },
    { id: '2', name: 'Sarah Chen' },
  ];

  it('prefers an exact case-insensitive match', () => {
    expect(matchPerson(people, 'sarah chen')?.id).toBe('2');
  });

  it('falls back to a prefix match', () => {
    expect(matchPerson(people, 'sarah')?.id).toBe('2');
  });

  it('returns undefined when nothing matches', () => {
    expect(matchPerson(people, 'jane')).toBeUndefined();
  });
});
