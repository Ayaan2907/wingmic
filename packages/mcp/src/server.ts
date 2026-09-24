import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { WingmicApiClient, type FetchLike } from './client';
import { WingmicApiError } from './errors';
import { formatToolError } from './tool-errors';
import type { McpConfig, Person, RecallEntity } from './types';

export const SERVER_NAME = 'wingmic';
export const SERVER_VERSION = '0.1.0';

/**
 * Tool → API scope mapping. One tool, one endpoint, one scope — errors from
 * the API name the missing scope, so a key scoped too narrowly fails with an
 * actionable message instead of silently degrading.
 *
 * | tool             | REST v1 endpoint        | scope          |
 * |------------------|-------------------------|----------------|
 * | search_network   | GET  /api/v1/recall     | search:read    |
 * | log_interaction  | POST /api/v1/capture    | capture:write  |
 * | get_person       | GET  /api/v1/people (+ graph) | graph:read |
 * | create_followup  | POST /api/v1/capture    | capture:write  |
 *
 * log_interaction and create_followup both write through POST /capture — the
 * extractor pipeline resolves people and follow-ups from the transcript, the
 * same path the app's chat surface uses. There is no dedicated follow-up
 * endpoint in REST v1.
 */
export const TOOL_SCOPES = {
  search_network: 'search:read',
  log_interaction: 'capture:write',
  get_person: 'graph:read',
  create_followup: 'capture:write',
} as const;

export type ToolName = keyof typeof TOOL_SCOPES;

function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

function jsonResult(value: unknown) {
  return textResult(JSON.stringify(value, null, 2));
}

/** Wraps a tool callback so API failures become isError tool results, not protocol crashes. */
function safeRun<Args>(run: (args: Args) => Promise<object>) {
  return async (args: Args) => {
    try {
      return jsonResult(await run(args));
    } catch (err) {
      return { ...textResult(formatToolError(err)), isError: true as const };
    }
  };
}

/** Case-insensitive name match on the people list; exact match wins over prefix. */
export function matchPerson(people: Person[], name: string): Person | undefined {
  const needle = name.trim().toLowerCase();
  return (
    people.find((p) => p.name.toLowerCase() === needle) ??
    people.find((p) => p.name.toLowerCase().startsWith(needle))
  );
}

/** The person node plus every node linked to it, with the incident links. */
export function personNeighborhood(
  graph: {
    nodes: Array<{ id: string; kind: string; label: string }>;
    links: Array<{ source: string; target: string; rel: string; hub?: boolean }>;
  },
  personId: string,
) {
  const incident = graph.links.filter((l) => l.source === personId || l.target === personId);
  const neighborIds = new Set(incident.flatMap((l) => [l.source, l.target]));
  const nodes = graph.nodes.filter((n) => neighborIds.has(n.id));
  return {
    person: graph.nodes.find((n) => n.id === personId) ?? { id: personId },
    links: incident,
    nodes,
  };
}

export function createWingmicServer(config: McpConfig, fetchImpl?: FetchLike): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  const client = new WingmicApiClient(config, fetchImpl);

  server.registerTool(
    'search_network',
    {
      title: 'Search network',
      description:
        'Semantic recall over the user’s wingmic network. Ask things like “who do I know that ships Rust”. ' +
        'Requires an API key with the search:read scope.',
      inputSchema: {
        query: z.string().min(1).max(500).describe('Natural-language query about the network'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe('Max entities to return (default 10, max 50)'),
      },
    },
    safeRun(async (args: { query: string; limit?: number }) =>
      client.recall(args.query, args.limit),
    ),
  );

  server.registerTool(
    'log_interaction',
    {
      title: 'Log interaction',
      description:
        'Capture an interaction into the wingmic graph. Write it as you would tell a colleague: name the ' +
        'person and what happened, e.g. "grabbed coffee with Sarah Chen at Acme — she works on edge config, follow up next week". ' +
        'Runs the same extraction pipeline as the app. Requires the capture:write scope.',
      inputSchema: {
        note: z
          .string()
          .min(1)
          .max(10000)
          .describe('The interaction, in natural language, naming the people involved'),
        capturedAt: z
          .string()
          .optional()
          .describe('ISO 8601 timestamp of the interaction; defaults to now'),
        clientCaptureId: z
          .string()
          .min(1)
          .max(128)
          .optional()
          .describe(
            'Client-generated id for retry idempotency — the same id returns the existing interaction',
          ),
      },
    },
    safeRun(async (args: { note: string; capturedAt?: string; clientCaptureId?: string }) =>
      client.capture({
        transcript: args.note,
        ...(args.capturedAt !== undefined ? { capturedAt: args.capturedAt } : {}),
        ...(args.clientCaptureId !== undefined ? { clientCaptureId: args.clientCaptureId } : {}),
      }),
    ),
  );

  server.registerTool(
    'get_person',
    {
      title: 'Get person',
      description:
        'Look up a person by name: their entry plus the orgs, events, and topics directly linked to them. ' +
        'Falls back to semantic search when no person matches the name exactly. Requires the graph:read scope.',
      inputSchema: {
        name: z.string().min(1).describe('Person name as captured in wingmic (case-insensitive)'),
      },
    },
    safeRun(async (args: { name: string }) => {
      const { people } = await client.listPeople(100);
      const person = matchPerson(people, args.name);
      if (person === undefined) {
        // No exact list match — semantic recall may still know this person
        // under an alias or a partial name.
        const recall = await client.recall(args.name, 5);
        return {
          matched: false,
          message: `No person named "${args.name}" in the graph. Closest semantic matches:`,
          matches: recall.entities.map((e: RecallEntity) => ({
            id: e.id,
            name: e.name,
            score: e.score,
          })),
        };
      }
      const graph = await client.getGraph();
      return { matched: true, ...personNeighborhood(graph, person.id) };
    }),
  );

  server.registerTool(
    'create_followup',
    {
      title: 'Create follow-up',
      description:
        'Create a follow-up on a person in the wingmic graph. The follow-up is captured through the extraction ' +
        'pipeline, so name the person in the text, e.g. "follow up with Sarah Chen about the intro to the Acme infra team". ' +
        'Requires the capture:write scope.',
      inputSchema: {
        what: z
          .string()
          .min(1)
          .max(10000)
          .describe('What the follow-up is, naming the person it concerns'),
        when: z
          .string()
          .optional()
          .describe('When to follow up (free text or ISO date), e.g. "next week"'),
      },
    },
    safeRun(async (args: { what: string; when?: string }) =>
      client.capture({
        transcript: `follow up: ${args.what}${args.when !== undefined ? ` by ${args.when}` : ''}`,
      }),
    ),
  );

  return server;
}

/** Connects a fresh server instance to stdio — the entry point for CLI usage. */
export async function runStdioServer(config: McpConfig): Promise<void> {
  const transport = new StdioServerTransport();
  const server = createWingmicServer(config);
  await server.connect(transport);
  // Keep the process alive until the transport closes; stdio has no other work.
  await new Promise<void>((resolve) => {
    transport.onclose = () => resolve();
  });
}

export { WingmicApiError };
