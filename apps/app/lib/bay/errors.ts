import { TRPCError } from '@trpc/server';

/**
 * tRPC v11's error-code table has no 410, and its transport derives the HTTP
 * status from the code. The bay contract's expired state ("history is kept; the
 * live board is not" — a known-but-over event must never read as "no such
 * event") needs a real 410, so it rides NOT_FOUND plus a `bayHttpStatus` that
 * the app's errorFormatter surfaces in `error.data.httpStatus`, which the tRPC
 * transport prefers when computing the response status.
 */
export class ExpiredEventError extends TRPCError {
  readonly bayHttpStatus = 410;

  constructor(message = 'that event is over — history is kept, the live board is not') {
    super({ code: 'NOT_FOUND', message });
    this.name = 'ExpiredEventError';
  }
}
