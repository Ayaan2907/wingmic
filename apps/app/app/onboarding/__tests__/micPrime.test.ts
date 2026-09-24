import { describe, it, expect, vi, afterEach } from 'vitest';
import { describeMicDenial, micGrantPersistent, requestMicAccess } from '../micPrime';

describe('describeMicDenial', () => {
  it("maps NotAllowedError to the capture surface's held-mic copy", () => {
    const err = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    expect(describeMicDenial(err)).toEqual({
      code: 'NotAllowedError',
      message: 'your browser is holding the mic. unlock it, or type the memo.',
    });
  });

  it('maps a dismissed prompt (NotAllowedError DOMException) the same as a denial', () => {
    const err = new DOMException('permission dismissed', 'NotAllowedError');
    expect(describeMicDenial(err).code).toBe('NotAllowedError');
  });

  it('maps any other failure to mic_unavailable', () => {
    expect(describeMicDenial(new Error('boom'))).toEqual({
      code: 'mic_unavailable',
      message: 'mic unavailable. plug one in or type the memo.',
    });
    expect(describeMicDenial(new DOMException('no device', 'NotFoundError')).code).toBe(
      'mic_unavailable',
    );
  });

  it('maps non-Error throws to mic_unavailable instead of crashing', () => {
    expect(describeMicDenial('weird').code).toBe('mic_unavailable');
    expect(describeMicDenial(undefined).code).toBe('mic_unavailable');
  });
});

describe('micGrantPersistent', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is true when the browser reports the grant as granted', async () => {
    vi.stubGlobal('navigator', {
      permissions: { query: vi.fn().mockResolvedValue({ state: 'granted' }) },
    });
    await expect(micGrantPersistent()).resolves.toBe(true);
  });

  it('is false when the browser reports prompt or denied — grant not proven', async () => {
    vi.stubGlobal('navigator', {
      permissions: { query: vi.fn().mockResolvedValue({ state: 'prompt' }) },
    });
    await expect(micGrantPersistent()).resolves.toBe(false);

    vi.stubGlobal('navigator', {
      permissions: { query: vi.fn().mockResolvedValue({ state: 'denied' }) },
    });
    await expect(micGrantPersistent()).resolves.toBe(false);
  });

  it('is null where the query is unsupported (safari), so copy stays honest', async () => {
    vi.stubGlobal('navigator', {
      permissions: { query: vi.fn().mockRejectedValue(new Error('unsupported')) },
    });
    await expect(micGrantPersistent()).resolves.toBeNull();
  });

  it('is null when navigator.permissions is missing entirely', async () => {
    vi.stubGlobal('navigator', {});
    await expect(micGrantPersistent()).resolves.toBeNull();
  });
});

describe('requestMicAccess', () => {
  it('requests audio only and releases the track when granted', async () => {
    const stop = vi.fn();
    const request = vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] });

    await requestMicAccess(request);

    expect(request).toHaveBeenCalledWith({ audio: true });
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('releases every track on multi-track streams', async () => {
    const stop = vi.fn();
    const request = vi.fn().mockResolvedValue({ getTracks: () => [{ stop }, { stop }] });

    await requestMicAccess(request);

    expect(stop).toHaveBeenCalledTimes(2);
  });

  it('propagates denial — the caller maps it through describeMicDenial', async () => {
    const err = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    await expect(requestMicAccess(vi.fn().mockRejectedValue(err))).rejects.toBe(err);
  });
});
