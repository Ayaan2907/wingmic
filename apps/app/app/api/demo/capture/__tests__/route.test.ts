// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/config/env', () => ({
  env: {
    ASSEMBLYAI_API_KEY: 'test-key',
    NODE_ENV: 'test',
  },
}));

const extractHybridMock = vi.fn();
vi.mock('@wingmic/extractor', () => ({
  extractHybrid: (...args: unknown[]) => extractHybridMock(...args),
}));

const transcribeMock = vi.fn();
vi.mock('assemblyai', () => {
  class AssemblyAI {
    transcripts = { transcribe: transcribeMock };
    constructor(_params: { apiKey: string }) {}
  }
  return { AssemblyAI };
});

import { OPTIONS, POST } from '../route';
import { __testing } from '../_internals';

function buildRequest(audio: Blob, origin = 'http://localhost:3210'): Request {
  const form = new FormData();
  form.append('audio', audio, 'demo.webm');
  return new Request('http://localhost/api/demo/capture', {
    method: 'POST',
    body: form,
    headers: { origin },
  });
}

beforeEach(() => {
  __testing.reset();
  transcribeMock.mockReset();
  extractHybridMock.mockReset();
  extractHybridMock.mockResolvedValue({
    persons: [{ name: 'Sarah Chen', aliases: [], role: null, companyHint: 'Acme', topics: ['Rust'], email: null, linkedin: null, notes: null }],
    companies: [],
    events: [],
    topics: [],
    actions: [],
  });
});

describe('OPTIONS /api/demo/capture', () => {
  it('returns CORS headers for allowed origin', async () => {
    const res = await OPTIONS(new Request('http://localhost/api/demo/capture', {
      method: 'OPTIONS',
      headers: { origin: 'http://localhost:3210' },
    }));
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3210');
  });
});

describe('POST /api/demo/capture', () => {
  it('returns 400 when audio is missing', async () => {
    const res = await POST(new Request('http://localhost/api/demo/capture', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { origin: 'http://localhost:3210', 'content-type': 'application/json' },
    }));
    expect(res.status).toBe(400);
  });

  it('transcribes and extracts without persisting', async () => {
    transcribeMock.mockResolvedValueOnce({
      text: 'Met Sarah Chen from Acme, she leads Rust.',
      audio_duration: 4,
    });
    const res = await POST(buildRequest(new Blob([new Uint8Array(1024)], { type: 'audio/webm' })));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.transcript).toContain('Sarah');
    expect(body.extracted.persons[0].name).toBe('Sarah Chen');
    expect(extractHybridMock).toHaveBeenCalledWith({ transcript: 'Met Sarah Chen from Acme, she leads Rust.' });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3210');
  });

  it('extracts from transcript without AssemblyAI', async () => {
    const form = new FormData();
    form.append('transcript', 'Met Sarah Chen from Acme, she leads Rust.');
    const res = await POST(new Request('http://localhost/api/demo/capture', {
      method: 'POST',
      body: form,
      headers: { origin: 'http://localhost:3210' },
    }));
    expect(res.status).toBe(200);
    expect(transcribeMock).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.transcript).toContain('Sarah');
    expect(extractHybridMock).toHaveBeenCalledWith({ transcript: 'Met Sarah Chen from Acme, she leads Rust.' });
  });
});
