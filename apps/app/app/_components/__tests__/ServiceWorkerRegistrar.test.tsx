// @vitest-environment jsdom
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServiceWorkerRegistrar, shouldRegisterServiceWorker } from '../ServiceWorkerRegistrar';

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  // remove the mock registration API between tests
  Reflect.deleteProperty(navigator, 'serviceWorker');
  vi.restoreAllMocks();
});

function mockServiceWorkerApi() {
  const register = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'serviceWorker', {
    value: { register },
    configurable: true,
  });
  return register;
}

describe('shouldRegisterServiceWorker', () => {
  it('allows only production', () => {
    expect(shouldRegisterServiceWorker('production')).toBe(true);
  });

  it('rejects development, test and unknown environments', () => {
    expect(shouldRegisterServiceWorker('development')).toBe(false);
    expect(shouldRegisterServiceWorker('test')).toBe(false);
    expect(shouldRegisterServiceWorker(undefined)).toBe(false);
  });
});

describe('ServiceWorkerRegistrar', () => {
  it('registers /sw.js in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const register = mockServiceWorkerApi();

    render(<ServiceWorkerRegistrar />);

    await waitFor(() => expect(register).toHaveBeenCalledWith('/sw.js'));
  });

  it('never registers in development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const register = mockServiceWorkerApi();

    render(<ServiceWorkerRegistrar />);

    // the guard is synchronous inside the effect — if it passed, the call
    // would already have happened
    expect(register).not.toHaveBeenCalled();
  });

  it('is a no-op on browsers without the service worker API', () => {
    vi.stubEnv('NODE_ENV', 'production');

    expect(() => render(<ServiceWorkerRegistrar />)).not.toThrow();
  });

  it('warns instead of crashing when registration rejects', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const register = vi.fn().mockRejectedValue(new Error('quota exceeded'));
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register },
      configurable: true,
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(<ServiceWorkerRegistrar />);

    await waitFor(() =>
      expect(warn).toHaveBeenCalledWith(
        '[pwa] service worker registration failed',
        expect.any(Error),
      ),
    );
  });
});
