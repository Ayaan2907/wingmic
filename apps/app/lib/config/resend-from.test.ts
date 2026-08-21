import { describe, expect, it } from 'vitest';
import { DEFAULT_RESEND_FROM, resolveResendFrom } from './resend-from';

describe('resolveResendFrom', () => {
  it('returns code default in production when env unset', () => {
    expect(resolveResendFrom('production', undefined)).toBe(DEFAULT_RESEND_FROM);
  });

  it('ignores env override in production', () => {
    expect(resolveResendFrom('production', 'wingmic <auth@wingmic.xyz>')).toBe(
      DEFAULT_RESEND_FROM,
    );
  });

  it('allows env override in development', () => {
    expect(resolveResendFrom('development', 'test <dev@example.com>')).toBe(
      'test <dev@example.com>',
    );
  });

  it('falls back to code default in development when env unset', () => {
    expect(resolveResendFrom('development', undefined)).toBe(DEFAULT_RESEND_FROM);
  });

  it('treats empty env as unset', () => {
    expect(resolveResendFrom('development', '   ')).toBe(DEFAULT_RESEND_FROM);
  });
});
