// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock BetterAuth ────────────────────────────────────────────────────
const getSessionMock = vi.fn();
vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      get getSession() {
        return getSessionMock;
      },
    },
  },
}));

// ── Mock env (only ASSEMBLYAI_API_KEY matters here) ────────────────────
vi.mock('@/lib/config/env', () => ({
  env: {
    ASSEMBLYAI_API_KEY: 'test-key',
    NODE_ENV: 'test',
  },
}));

// ── Mock assemblyai SDK ────────────────────────────────────────────────
const transcribeMock = vi.fn();
vi.mock('assemblyai', () => {
  class AssemblyAI {
    transcripts = { transcribe: transcribeMock };
    constructor(_params: { apiKey: string }) {}
  }
  return { AssemblyAI };
});

// ── Mock db + daily cap (real client would dial Turso at import) ───────
vi.mock('@wingmic/db', () => ({ db: {} }));
const consumeDailyUsageMock = vi.fn();
vi.mock('@/lib/usage/dailyCap', () => ({
  consumeDailyUsage: (...args: unknown[]) => consumeDailyUsageMock(...args),
  DAILY_LIMITS: { recording: 10, message: 20, image: 10 },
}));

import { POST } from '../route';
import { __testing, MAX_AUDIO_BYTES } from '../_internals';

function authedSession(userId = 'user-1') {
  return { user: { id: userId } };
}

function buildRequest(audio: Blob): Request {
  const form = new FormData();
  form.append('audio', audio, 'memo.webm');
  return new Request('http://localhost/api/capture/transcribe', {
    method: 'POST',
    body: form,
  });
}

beforeEach(() => {
  __testing.reset();
  getSessionMock.mockReset();
  transcribeMock.mockReset();
  consumeDailyUsageMock.mockReset();
  consumeDailyUsageMock.mockResolvedValue(true);
});

describe('POST /api/capture/transcribe', () => {
  it('returns 401 when no session', async () => {
    getSessionMock.mockResolvedValueOnce(null);
    const req = buildRequest(new Blob([new Uint8Array(1024)], { type: 'audio/webm' }));
    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('unauthenticated');
    expect(transcribeMock).not.toHaveBeenCalled();
  });

  it('returns 413 too_big when audio exceeds 3MB', async () => {
    getSessionMock.mockResolvedValueOnce(authedSession());
    const oversized = new Blob([new Uint8Array(MAX_AUDIO_BYTES + 1)], {
      type: 'audio/webm',
    });
    const req = buildRequest(oversized);
    const res = await POST(req);
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error.code).toBe('too_big');
    expect(transcribeMock).not.toHaveBeenCalled();
  });

  it('returns 413 too_long when audio_duration exceeds 90s', async () => {
    getSessionMock.mockResolvedValueOnce(authedSession());
    transcribeMock.mockResolvedValueOnce({
      text: 'hello world',
      audio_duration: 120,
    });
    const req = buildRequest(new Blob([new Uint8Array(2048)], { type: 'audio/webm' }));
    const res = await POST(req);
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error.code).toBe('too_long');
  });

  it('returns 200 with transcript on success', async () => {
    getSessionMock.mockResolvedValueOnce(authedSession());
    transcribeMock.mockResolvedValueOnce({
      text: 'met sarah at acme about rust.',
      audio_duration: 30,
    });
    const req = buildRequest(new Blob([new Uint8Array(2048)], { type: 'audio/webm' }));
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.transcript).toBe('met sarah at acme about rust.');
    expect(typeof body.durationMs).toBe('number');
    expect(body.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('returns 429 when the daily recording cap is spent', async () => {
    getSessionMock.mockResolvedValueOnce(authedSession());
    consumeDailyUsageMock.mockResolvedValueOnce(false);
    const req = buildRequest(new Blob([new Uint8Array(1024)], { type: 'audio/webm' }));
    const res = await POST(req);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error.code).toBe('rate_limited');
    expect(body.error.message).toContain('midnight utc');
    expect(consumeDailyUsageMock).toHaveBeenCalledWith(expect.anything(), 'user-1', 'recording');
    expect(transcribeMock).not.toHaveBeenCalled();
  });

  it('returns 429 after 10 calls in the same minute', async () => {
    // 10 successful calls, then the 11th should be rate-limited.
    const userId = 'user-rl';
    for (let i = 0; i < 10; i++) {
      getSessionMock.mockResolvedValueOnce(authedSession(userId));
      transcribeMock.mockResolvedValueOnce({
        text: `transcript ${i}`,
        audio_duration: 5,
      });
      const req = buildRequest(new Blob([new Uint8Array(512)], { type: 'audio/webm' }));
      const res = await POST(req);
      expect(res.status).toBe(200);
    }
    // 11th call
    getSessionMock.mockResolvedValueOnce(authedSession(userId));
    const req = buildRequest(new Blob([new Uint8Array(512)], { type: 'audio/webm' }));
    const res = await POST(req);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error.code).toBe('rate_limited');
  });

  it('returns 502 provider_error when AssemblyAI throws', async () => {
    getSessionMock.mockResolvedValueOnce(authedSession());
    transcribeMock.mockRejectedValueOnce(new Error('upstream 503'));
    const req = buildRequest(new Blob([new Uint8Array(2048)], { type: 'audio/webm' }));
    const res = await POST(req);
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error.code).toBe('provider_error');
    expect(body.error.cause).toEqual({ provider: 'assemblyai', code: 'upstream 503' });
  });

  it('returns 422 transcript_empty when AssemblyAI returns ""', async () => {
    getSessionMock.mockResolvedValueOnce(authedSession());
    transcribeMock.mockResolvedValueOnce({
      text: '',
      audio_duration: 12,
    });
    const req = buildRequest(new Blob([new Uint8Array(2048)], { type: 'audio/webm' }));
    const res = await POST(req);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('transcript_empty');
  });
});
