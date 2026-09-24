import { describe, it, expect, vi } from 'vitest';
import { describeMicDenial, requestMicAccess } from '../micPrime';

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
