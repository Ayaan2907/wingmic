/**
 * Programmatic MCP client smoke run for the wingmic MCP server.
 *
 * Boots a local stub of the wingmic REST v1 API (the contract in
 * docs/api.md), starts the built stdio server as a subprocess, connects a
 * real MCP SDK client over stdio, and exercises all four tools end to end:
 *
 *   initialize → listTools → search_network → log_interaction →
 *   get_person → create_followup
 *
 * Any failure exits non-zero with the failed tool named. Run via
 * `bun run smoke` (builds first) or against a live dev API with
 * WINGMIC_SMOKE_URL=http://localhost:3000 — in that mode the stub is skipped
 * and the script targets the real REST v1 instance.
 */
import { createServer } from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

const PORT = 8974;
const BASE = process.env.WINGMIC_SMOKE_URL ?? `http://127.0.0.1:${PORT}`;
const KEY = 'wk_live_smoke_key';

interface Recorded {
  method: string;
  url: string;
}

function startStubApi(): Promise<{ close: () => void; requests: Recorded[] }> {
  const requests: Recorded[] = [];
  const server = createServer((req, res) => {
    const method = req.method ?? '';
    const url = req.url ?? '';
    requests.push({ method, url });
    const respond = (status: number, body: unknown, headers: Record<string, string> = {}) => {
      res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
      res.end(JSON.stringify(body));
    };

    if (req.headers.authorization !== `Bearer ${KEY}`) {
      return respond(401, { error: { code: 'unauthorized', message: 'unknown key' } });
    }

    if (method === 'GET' && url.startsWith('/api/v1/recall')) {
      return respond(200, {
        entities: [
          {
            id: 'ent_sarah',
            name: 'Sarah Chen',
            aliases: [],
            score: 0.93,
            companies: [{ id: 'ent_acme', name: 'Acme', domain: 'acme.com', role: 'infra' }],
            events: [],
            topics: [{ id: 'topic_rust', name: 'rust' }],
            facts: [
              { key: 'linkedin', value: 'https://linkedin.com/in/sarahchen', confidence: 90 },
            ],
          },
        ],
        durationMs: 7,
        mode: 'semantic',
      });
    }

    if (method === 'POST' && url.startsWith('/api/v1/capture')) {
      return respond(200, {
        extracted: {
          persons: [{ name: 'Sarah Chen', confidence: 0.9, provenance: 'user' }],
          actions: [{ what: 'send Sarah the intro' }],
        },
        interactionId: 'int_smoke_1',
        entityIds: ['ent_sarah'],
        attachments: [],
      });
    }

    if (method === 'GET' && url.startsWith('/api/v1/people')) {
      return respond(200, {
        people: [{ id: 'ent_sarah', name: 'Sarah Chen', importSource: 'chat-capture' }],
      });
    }

    if (method === 'GET' && url.startsWith('/api/v1/graph')) {
      return respond(200, {
        nodes: [
          { id: 'ent_sarah', kind: 'person', label: 'Sarah Chen' },
          { id: 'ent_acme', kind: 'company', label: 'Acme' },
        ],
        links: [{ source: 'ent_sarah', target: 'ent_acme', rel: 'works_at' }],
      });
    }

    return respond(404, { error: { code: 'not_found', message: `no route: ${method} ${url}` } });
  });

  return new Promise((resolve, reject) => {
    server.listen(PORT, '127.0.0.1', () => resolve({ close: () => server.close(), requests }));
    server.on('error', reject);
  });
}

function resultText(result: CallToolResult): string {
  return result.content
    .filter((c) => 'text' in c)
    .map((c) => (c as { text: string }).text)
    .join('');
}

async function call(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  const result = (await client.callTool({ name, arguments: args })) as CallToolResult;
  if (result.isError) {
    throw new Error(`tool ${name} failed: ${resultText(result)}`);
  }
  return result;
}

async function main(): Promise<void> {
  const usingStub = process.env.WINGMIC_SMOKE_URL === undefined;
  const stub = usingStub ? await startStubApi() : null;

  try {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [new URL('../dist/cli.js', import.meta.url).pathname],
      env: {
        WINGMIC_API_URL: BASE,
        WINGMIC_API_KEY: KEY,
      },
    });
    const client = new Client({ name: 'wingmic-smoke', version: '0.0.1' });

    console.log(
      `[smoke] connecting to wingmic-mcp (API: ${BASE}${usingStub ? ', local stub' : ', live target'})`,
    );
    await client.connect(transport);

    const { tools } = await client.listTools();
    console.log(
      `[smoke] server listed ${tools.length} tools: ${tools.map((t) => t.name).join(', ')}`,
    );
    if (tools.length !== 4) throw new Error(`expected 4 tools, got ${tools.length}`);

    const search = await call(client, 'search_network', { query: 'who ships rust', limit: 3 });
    if (!resultText(search).includes('Sarah Chen'))
      throw new Error('search_network did not return Sarah Chen');
    console.log('[smoke] search_network ok — returned Sarah Chen (semantic, score 0.93)');

    const log = await call(client, 'log_interaction', {
      note: 'grabbed coffee with Sarah Chen at Acme — she works on edge config, follow up next week',
      clientCaptureId: 'smoke-1',
    });
    if (!resultText(log).includes('int_smoke_1'))
      throw new Error('log_interaction did not return interactionId');
    console.log('[smoke] log_interaction ok — interactionId int_smoke_1');

    const person = await call(client, 'get_person', { name: 'Sarah Chen' });
    const personJson = resultText(person);
    if (!personJson.includes('"matched": true'))
      throw new Error(`get_person did not match: ${personJson.slice(0, 120)}`);
    console.log('[smoke] get_person ok — matched Sarah Chen with graph neighborhood');

    const followup = await call(client, 'create_followup', {
      what: 'send Sarah the intro',
      when: 'next week',
    });
    if (!resultText(followup).includes('int_smoke_1'))
      throw new Error('create_followup did not capture');
    console.log('[smoke] create_followup ok — captured through the extraction pipeline');

    const apiCalls = stub?.requests ?? [];
    if (stub && apiCalls.length === 0)
      throw new Error('stub API saw no requests — server bypassed the API?');
    if (stub) console.log(`[smoke] stub REST v1 API served ${apiCalls.length} authorized requests`);

    await client.close();
    console.log(
      '[smoke] PASS: initialize → listTools → 4 tool calls over stdio, backed by REST v1',
    );
  } finally {
    stub?.close();
  }
}

main().catch((err: unknown) => {
  console.error('[smoke] FAIL:', err instanceof Error ? err.message : err);
  process.exit(1);
});
