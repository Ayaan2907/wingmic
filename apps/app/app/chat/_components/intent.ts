const ASK_LEAD_RE =
  /^\s*(who|what|when|where|which|whose|how (?:do|did|many|long)|find|search|look up|list|show me|tell me|do i know|have i met|remind me (?:who|what|where|when))\b/i;
const FILLER_RE = /^\s*(?:so|hey|ok|okay|um|uh|hmm|well|yo|hi)[,\s]+/i;

/** Memo-biased intent router — pure primitive, no LLM call (WP-2 / #59). */
export function classifyIntent(text: string): 'memo' | 'ask' {
  const t = text.trim().replace(FILLER_RE, '');
  if (/\?\s*$/.test(t)) return 'ask';
  if (ASK_LEAD_RE.test(t)) return 'ask';
  return 'memo';
}
