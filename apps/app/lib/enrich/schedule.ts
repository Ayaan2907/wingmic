/** Fire-and-forget. Capture/onboarding must not await this. */
export function scheduleEnrich(work: () => Promise<void>): void {
  void Promise.resolve()
    .then(work)
    .catch(() => {
      // graph write already succeeded
    });
}
