type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
};

function barcodeDetector(): BarcodeDetectorLike | null {
  const Detector = (
    globalThis as {
      BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike;
    }
  ).BarcodeDetector;
  if (!Detector) return null;
  return new Detector({ formats: ['qr_code'] });
}

export async function readQrFromImage(source: ImageBitmapSource): Promise<string | null> {
  const detector = barcodeDetector();
  if (!detector) return null;
  try {
    const codes = await detector.detect(source);
    return codes[0]?.rawValue?.trim() || null;
  } catch {
    return null;
  }
}

export async function readQrFromVideo(video: HTMLVideoElement): Promise<string | null> {
  return readQrFromImage(video);
}

export async function readQrFromFile(file: File): Promise<string | null> {
  if (typeof createImageBitmap !== 'function') return null;
  try {
    const bitmap = await createImageBitmap(file);
    try {
      return await readQrFromImage(bitmap);
    } finally {
      bitmap.close();
    }
  } catch {
    return null;
  }
}
