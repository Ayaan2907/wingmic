/** Client-side JPEG cap for chat attachments. Vision / QR stay a later slice. */
export const MAX_ATTACHMENT_BYTES = 400_000;

export type CompressedImage = {
  jpegBase64: string;
  byteSize: number;
  qrText?: string | null;
};

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

type BarcodeDetectorLike = {
  detect: (source: ImageBitmap) => Promise<Array<{ rawValue: string }>>;
};

async function readQrText(file: File): Promise<string | null> {
  const Detector = (
    globalThis as {
      BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike;
    }
  ).BarcodeDetector;
  if (!Detector || typeof createImageBitmap !== 'function') return null;
  try {
    const bitmap = await createImageBitmap(file);
    const codes = await new Detector({ formats: ['qr_code'] }).detect(bitmap);
    bitmap.close();
    return codes[0]?.rawValue?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Prefer a small JPEG as-is. Larger / non-JPEG images go through canvas when
 * the browser can decode them. Throws a short user-facing message on failure.
 */
export async function compressImageFile(file: File): Promise<CompressedImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error('drop a photo');
  }
  const qrText = await readQrText(file);
  const buf = new Uint8Array(await file.arrayBuffer());
  if (file.type === 'image/jpeg' && buf.byteLength <= MAX_ATTACHMENT_BYTES) {
    return { jpegBase64: bytesToBase64(buf), byteSize: buf.byteLength, qrText };
  }
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    throw new Error('photo is too large — try a closer crop');
  }

  const bitmapUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('couldnt read that photo'));
      el.src = bitmapUrl;
    });
    const maxEdge = 1600;
    const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('couldnt read that photo');
    ctx.drawImage(img, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    const comma = dataUrl.indexOf(',');
    const jpegBase64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
    const byteSize = Math.ceil((jpegBase64.length * 3) / 4);
    if (byteSize > MAX_ATTACHMENT_BYTES) {
      throw new Error('photo is too large — try a closer crop');
    }
    return { jpegBase64, byteSize, qrText };
  } finally {
    URL.revokeObjectURL(bitmapUrl);
  }
}
