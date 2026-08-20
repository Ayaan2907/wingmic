/** Canonical sender for magic links + bulk email. Update here, not in Railway/Doppler. */
export const DEFAULT_RESEND_FROM = 'wingmic <info@mail.wingmic.xyz>';

export type NodeEnv = 'development' | 'production' | 'test';

/**
 * Resolve the outbound sender address.
 *
 * Production always uses {@link DEFAULT_RESEND_FROM} so a stale `RESEND_FROM`
 * in Railway/Doppler cannot shadow a code change. Dev/test may override via env
 * (e.g. a fork testing against their own verified Resend domain).
 */
export function resolveResendFrom(
  nodeEnv: NodeEnv,
  rawFromEnv: string | undefined,
): string {
  const override = rawFromEnv?.trim();
  if (nodeEnv === 'production') {
    if (override && override !== DEFAULT_RESEND_FROM) {
      console.warn(
        `[env] RESEND_FROM="${override}" ignored in production — using code default "${DEFAULT_RESEND_FROM}". Remove RESEND_FROM from Railway/Doppler.`,
      );
    }
    return DEFAULT_RESEND_FROM;
  }
  return override || DEFAULT_RESEND_FROM;
}
