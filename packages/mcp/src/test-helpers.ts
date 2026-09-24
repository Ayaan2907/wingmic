import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createWingmicServer } from './server';
import type { FetchLike } from './client';
import type { McpConfig } from './types';

export const TEST_CONFIG: McpConfig = { baseUrl: 'https://api.test', apiKey: 'wk_live_test_key' };

/** Records every request the client makes, then replies with a canned response. */
export function recordingFetch(
  handler: (url: string, init: RequestInit) => Response | Promise<Response>,
): {
  fetch: FetchLike;
  calls: Array<{ url: string; init: RequestInit }>;
} {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  return {
    calls,
    fetch: async (url, init) => {
      calls.push({ url, init });
      return handler(url, init);
    },
  };
}

export function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

/**
 * Boots the real MCP server against an in-memory transport with a real SDK
 * Client on the other side — tool calls traverse the full protocol path.
 */
export async function makeHarness(fetchImpl: FetchLike): Promise<{ client: Client }> {
  const server = createWingmicServer(TEST_CONFIG, fetchImpl);
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client };
}
