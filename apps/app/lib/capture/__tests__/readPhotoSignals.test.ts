import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateObject } from 'ai';

vi.mock('ai', () => ({
  generateObject: vi.fn(),
}));

vi.mock('@openrouter/ai-sdk-provider', () => ({
  createOpenRouter: () => () => 'vision-model',
}));

vi.mock('@/lib/config/env', () => ({
  env: {
    OPENROUTER_API_KEY: 'test-key',
    EXTRACTION_MODEL: 'test-model',
  },
}));

import { readPhotoSignals } from '../readPhotoSignals';

const generateObjectMock = vi.mocked(generateObject);

describe('readPhotoSignals', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    generateObjectMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('aborts the provider request when vision times out', async () => {
    let signal: AbortSignal | undefined;
    generateObjectMock.mockImplementation((options: { abortSignal?: AbortSignal }) => {
      signal = options.abortSignal;
      return new Promise(() => {});
    });

    const pending = readPhotoSignals('a'.repeat(32));
    await vi.advanceTimersByTimeAsync(8_000);

    await expect(pending).resolves.toEqual({
      personName: null,
      companyName: null,
      eventName: null,
      linkedin: null,
      eventUrl: null,
    });
    expect(signal?.aborted).toBe(true);
  });
});
