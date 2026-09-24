#!/usr/bin/env node
/**
 * wingmic MCP server — stdio entry point.
 *
 * Usage (MCP client config, e.g. Claude Desktop):
 *   { "command": "npx", "args": ["-y", "@wingmic/mcp"], "env": {
 *       "WINGMIC_API_URL": "https://app.wingmic.xyz",
 *       "WINGMIC_API_KEY": "wk_live_…" } }
 *
 * All diagnostics go to stderr; stdout is the MCP protocol channel.
 */
import { ConfigError, loadConfig } from './config';
import { runStdioServer } from './server';

async function main(): Promise<void> {
  let config;
  try {
    config = loadConfig(process.env);
  } catch (err) {
    if (err instanceof ConfigError) {
      process.stderr.write(`wingmic-mcp: ${err.message}\n`);
      process.exit(1);
    }
    throw err;
  }
  await runStdioServer(config);
}

main().catch((err: unknown) => {
  process.stderr.write(`wingmic-mcp: fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
