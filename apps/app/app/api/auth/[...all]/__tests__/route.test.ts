// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({
  auth: {},
  LANDING_ORIGINS: ['https://wingmic.xyz', 'http://localhost:3210'],
}));

vi.mock('better-auth/next-js', () => ({
  toNextJsHandler: () => ({
    GET: async () => Response.json({ ok: true }),
    POST: async () => Response.json({ status: true }, { status: 200 }),
  }),
}));

import { GET, POST, OPTIONS } from '../route';

function req(method: string, origin?: string): Request {
  return new Request('http://localhost:3211/api/auth/sign-in/magic-link', {
    method,
    headers: origin ? { origin } : undefined,
  });
}

describe('auth route CORS', () => {
  it('preflight from the landing origin is allowed', async () => {
    const res = OPTIONS(req('OPTIONS', 'https://wingmic.xyz'));
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://wingmic.xyz');
    expect(res.headers.get('access-control-allow-methods')).toContain('POST');
    expect(res.headers.get('access-control-allow-credentials')).toBeNull();
  });

  it('preflight from a foreign origin gets no CORS grant', async () => {
    const res = OPTIONS(req('OPTIONS', 'https://evil.example'));
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('POST from the landing origin gains the allow-origin header', async () => {
    const res = await POST(req('POST', 'http://localhost:3210'));
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:3210');
    expect(await res.json()).toEqual({ status: true });
  });

  it('same-origin requests pass through untouched', async () => {
    const res = await GET(req('GET'));
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
    expect(await res.json()).toEqual({ ok: true });
  });
});
