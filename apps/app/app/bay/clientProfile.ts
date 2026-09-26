// apps/app/app/bay/clientProfile.ts — the throwaway viewer profile, held in
// the browser only. locked decision 3: no anonymous principal exists on the
// server, so the pasted profile lives in localStorage and travels exclusively
// as an input to bay.score / bay.ask / bay.claim. The shape is the same
// clientProfileSchema the router validates — one module, both sides.

import { clientProfileSchema } from '@/lib/bay/clientProfile';
import type { ClientProfile } from '@/lib/bay/clientProfile';

export { clientProfileSchema };
export type { ClientProfile };

const STORAGE_KEY = 'bay.clientProfile.v1';
const ASKS_KEY = 'bay.recentAsks';

export function loadClientProfile(): ClientProfile | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = clientProfileSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function saveClientProfile(profile: ClientProfile): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // storage blocked (private mode, quota) is never a failure — the
    // in-memory profile still drives this session's scoring and claim
  }
}

export function clearClientProfile(): void {
  window.localStorage.removeItem(STORAGE_KEY);
  window.sessionStorage.removeItem(ASKS_KEY);
}

/** A pasted profile (linkedin url or free text) rides as raw text — the
 * router's pipeline parses it. Validated here so junk never leaves the
 * browser; returns null when the paste is empty or oversized. */
export function profileFromText(text: string): ClientProfile | null {
  const parsed = clientProfileSchema.safeParse({ text });
  return parsed.success ? parsed.data : null;
}

/** Local recent history for the ask bar's hints (browser-held, session only). */
export function noteAskRun(question: string): void {
  try {
    const runs = recentAsks();
    runs.unshift(question);
    window.sessionStorage.setItem(ASKS_KEY, JSON.stringify(runs.slice(0, 5)));
  } catch {
    // storage blocked — hints are best-effort, never a failure
  }
}

export function recentAsks(): string[] {
  try {
    const raw = window.sessionStorage.getItem(ASKS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}
