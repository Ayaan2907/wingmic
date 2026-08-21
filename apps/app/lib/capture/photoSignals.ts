export type PhotoSignals = {
  visibleText: string | null;
  linkedin: string | null;
  eventUrl: string | null;
};

export function mergePhotoSignals(
  transcript: string,
  signals: PhotoSignals,
): string {
  const bits = [transcript.trim()];
  const seen = transcript.toLowerCase();
  const push = (value: string | null | undefined) => {
    const trimmed = value?.trim();
    if (!trimmed) return;
    if (seen.includes(trimmed.toLowerCase())) return;
    bits.push(trimmed);
  };
  push(signals.visibleText);
  push(signals.linkedin);
  push(signals.eventUrl);
  return bits.filter(Boolean).join(' ').trim();
}
