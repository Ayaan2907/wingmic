import { WingmicApiError } from './errors';
import type {
  ApiErrorCode,
  CaptureInput,
  CaptureResponse,
  GraphResponse,
  McpConfig,
  PeopleResponse,
  RecallResponse,
} from './types';

/** Minimal injectable fetch — tests stub this; production uses global fetch. */
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
}

/** Parses a Retry-After header (integer seconds); undefined when absent or malformed. */
export function parseRetryAfter(value: string | null): number | undefined {
  if (value === null) return undefined;
  const seconds = Number.parseInt(value, 10);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}

function isApiErrorCode(code: string): code is ApiErrorCode {
  return [
    'unauthorized',
    'insufficient_scope',
    'rate_limited',
    'bad_request',
    'not_found',
    'internal_error',
  ].includes(code);
}

/**
 * Typed client over the wingmic public REST API v1 (docs/api.md).
 * One method per endpoint; scoped keys are the caller's concern — this client
 * sends whatever key it is configured with and surfaces 401/403/429 as typed
 * errors. The key is only ever placed in the Authorization header, never
 * logged and never included in error messages.
 */
export class WingmicApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchImpl: FetchLike;

  constructor(config: McpConfig, fetchImpl: FetchLike = fetch) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.apiKey = config.apiKey;
    this.fetchImpl = fetchImpl;
  }

  async recall(q: string, limit?: number): Promise<RecallResponse> {
    const params = new URLSearchParams({ q });
    if (limit !== undefined) params.set('limit', String(limit));
    return this.request<RecallResponse>(`/api/v1/recall?${params.toString()}`);
  }

  async capture(input: CaptureInput): Promise<CaptureResponse> {
    return this.request<CaptureResponse>('/api/v1/capture', { method: 'POST', body: input });
  }

  async listPeople(limit?: number): Promise<PeopleResponse> {
    const query = limit === undefined ? '' : `?limit=${limit}`;
    return this.request<PeopleResponse>(`/api/v1/people${query}`);
  }

  async getGraph(): Promise<GraphResponse> {
    return this.request<GraphResponse>('/api/v1/graph');
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body } = options;
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    } catch (cause) {
      throw new WingmicApiError({
        status: 0,
        code: 'network_error',
        message: `cannot reach the wingmic API at ${this.baseUrl}: ${cause instanceof Error ? cause.message : String(cause)}`,
      });
    }

    if (response.ok) {
      try {
        return (await response.json()) as T;
      } catch (cause) {
        throw new WingmicApiError({
          status: response.status,
          code: 'internal_error',
          message: `wingmic API returned malformed JSON on ${method} ${path}: ${cause instanceof Error ? cause.message : String(cause)}`,
        });
      }
    }

    throw await this.toApiError(response, method, path);
  }

  private async toApiError(
    response: Response,
    method: string,
    path: string,
  ): Promise<WingmicApiError> {
    const retryAfterSeconds = parseRetryAfter(response.headers.get('Retry-After'));

    let bodyCode: string | undefined;
    let bodyMessage: string | undefined;
    let missingScope: string | undefined;
    try {
      const parsed = (await response.json()) as {
        error?: { code?: string; message?: string; missingScope?: string };
      };
      bodyCode = parsed.error?.code;
      bodyMessage = parsed.error?.message;
      missingScope = parsed.error?.missingScope;
    } catch {
      // Non-JSON error body — fall through to status-based defaults.
    }

    const code: ApiErrorCode =
      bodyCode && isApiErrorCode(bodyCode)
        ? bodyCode
        : response.status === 401
          ? 'unauthorized'
          : response.status === 403
            ? 'insufficient_scope'
            : response.status === 429
              ? 'rate_limited'
              : 'internal_error';

    const fallbackMessages: Record<number, string> = {
      401: 'wingmic API key was rejected (401). Check that WINGMIC_API_KEY is set to a valid, unrevoked key.',
      403: 'wingmic API key lacks the scope required for this operation (403).',
      429: 'wingmic API rate limit reached (429).',
    };

    return new WingmicApiError({
      status: response.status,
      code,
      message:
        bodyMessage ??
        fallbackMessages[response.status] ??
        `wingmic API error on ${method} ${path} (${response.status})`,
      missingScope: code === 'insufficient_scope' ? missingScope : undefined,
      retryAfterSeconds: code === 'rate_limited' ? retryAfterSeconds : undefined,
    });
  }
}
