import type { ApiErrorCode } from './types';

/**
 * Error raised by WingmicApiClient for any non-2xx API response or a
 * transport-level failure. `retryable` marks errors a client may retry as-is
 * (rate limits); `missingScope` is set on 403 insufficient_scope and names the
 * scope the key lacks; `retryAfterSeconds` is set on 429 from the Retry-After
 * header.
 */
export class WingmicApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly missingScope?: string;
  readonly retryAfterSeconds?: number;
  readonly retryable: boolean;

  constructor(params: {
    status: number;
    code: ApiErrorCode;
    message: string;
    missingScope?: string;
    retryAfterSeconds?: number;
  }) {
    super(params.message);
    this.name = 'WingmicApiError';
    this.status = params.status;
    this.code = params.code;
    this.missingScope = params.missingScope;
    this.retryAfterSeconds = params.retryAfterSeconds;
    this.retryable = params.code === 'rate_limited' || params.code === 'network_error';
  }
}

export function isWingmicApiError(err: unknown): err is WingmicApiError {
  return err instanceof WingmicApiError;
}
