const ENRICH_DEADLINE_MS = 15_000;

/** Fire-and-forget with a hard cap. Capture/onboarding must not await this. */
export function scheduleEnrich(work: () => Promise<void>): void {
  void Promise.race([
    work(),
    new Promise<void>((resolve) => {
      setTimeout(resolve, ENRICH_DEADLINE_MS);
    }),
  ]).catch(() => {
    // graph write already succeeded
  });
}
