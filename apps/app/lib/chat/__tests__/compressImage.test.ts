import { describe, expect, it } from 'vitest';
import { compressImageFile } from '../compressImage';

describe('compressImageFile', () => {
  it('keeps an explicit qrText even when the still has no code', async () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const file = new File([bytes], 'capture.jpg', { type: 'image/jpeg' });
    const result = await compressImageFile(file, { qrText: 'https://lu.ma/ethdenver' });
    expect(result.qrText).toBe('https://lu.ma/ethdenver');
    expect(result.byteSize).toBe(4);
  });
});
