export async function snapshotVideoToJpeg(video: HTMLVideoElement): Promise<File> {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) throw new Error('camera not ready');
  const canvas = document.createElement('canvas');
  const maxEdge = 1600;
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('camera not ready');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (next) => (next ? resolve(next) : reject(new Error('couldnt take that photo'))),
      'image/jpeg',
      0.82,
    );
  });
  return new File([blob], 'capture.jpg', { type: 'image/jpeg' });
}
