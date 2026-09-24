import { isWingmicApiError, WingmicApiError } from './errors';

/**
 * Renders any thrown error as deterministic, actionable text for the tool
 * result. Scope gaps name the missing scope (the API's 403 contract); rate
 * limits carry the Retry-After hint; the key never appears in output.
 */
export function formatToolError(err: unknown): string {
  if (isWingmicApiError(err)) {
    if (err.missingScope !== undefined) {
      const grants = toolForScope(err.missingScope);
      return (
        `This tool needs the ${err.missingScope} API scope, but the configured key does not have it. ` +
        `Create a key with that scope in the wingmic dashboard and update WINGMIC_API_KEY.` +
        (grants ? ` (${grants})` : '')
      );
    }
    if (err.code === 'rate_limited') {
      const wait =
        err.retryAfterSeconds !== undefined
          ? ` Retry in about ${err.retryAfterSeconds}s.`
          : ' Retry shortly.';
      return `wingmic API rate limit reached (60 requests per key per minute).${wait}`;
    }
    if (err.code === 'network_error') {
      return `${err.message} Check WINGMIC_API_URL and your connection, then retry.`;
    }
    return `wingmic API error (${err.code}): ${err.message}`;
  }
  if (err instanceof Error) {
    return `unexpected error: ${err.message}`;
  }
  return `unexpected error: ${String(err)}`;
}

function toolForScope(scope: string): string | undefined {
  switch (scope) {
    case 'graph:read':
      return 'get_person';
    case 'capture:write':
      return 'log_interaction, create_followup';
    case 'search:read':
      return 'search_network';
    default:
      return undefined;
  }
}

export type { WingmicApiError };
