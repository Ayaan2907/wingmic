import { afterEach, describe, expect, it, vi } from 'vitest';
import { readQrFromFile, readQrFromVideo } from '../readQr';

describe('readQrFromVideo', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null when BarcodeDetector is missing', async () => {
    vi.stubGlobal('BarcodeDetector', undefined);
    expect(await readQrFromVideo({} as HTMLVideoElement)).toBeNull();
  });

  it('returns the trimmed first value', async () => {
    const detect = vi.fn(async () => [{ rawValue: '  https://lu.ma/ethdenver  ' }]);
    vi.stubGlobal(
      'BarcodeDetector',
      vi.fn(function BarcodeDetector() {
        return { detect };
      }),
    );
    const video = {} as HTMLVideoElement;
    expect(await readQrFromVideo(video)).toBe('https://lu.ma/ethdenver');
    expect(detect).toHaveBeenCalledWith(video);
  });

  it('ignores an empty rawValue', async () => {
    vi.stubGlobal(
      'BarcodeDetector',
      vi.fn(function BarcodeDetector() {
        return { detect: async () => [{ rawValue: '   ' }] };
      }),
    );
    expect(await readQrFromVideo({} as HTMLVideoElement)).toBeNull();
  });
});

describe('readQrFromFile', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null when createImageBitmap is missing', async () => {
    vi.stubGlobal('BarcodeDetector', vi.fn());
    vi.stubGlobal('createImageBitmap', undefined);
    expect(await readQrFromFile(new File(['x'], 'x.jpg', { type: 'image/jpeg' }))).toBeNull();
  });
});
