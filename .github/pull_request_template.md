<!-- Thanks for the PR. Keep it focused. Smaller is better. -->

> **Base branch must be `staging`.** Direct PRs to `main` are blocked.
> Release flow: feat/fix/docs branch → `staging` → maintainer cuts release PR `staging` → `main`.

## what changed

<!-- 1-2 sentences. What does this do, why does it matter. -->

## wedge

<!-- Pick one: capture · recall · imports · acts · cross-cutting · homepage -->

## screenshots / clip

<!-- Required for any visual change. Drag images here, or link a Loom. -->

## checklist

- [ ] Base branch is `staging` (NOT `main`)
- [ ] One focused change in this PR
- [ ] Branch name follows `feat/`, `fix/`, `docs/`, `chore/`, `refactor/`, `test/`, `perf/` convention
- [ ] Tests added or updated (Vitest or Playwright)
- [ ] `bun run typecheck` exits 0
- [ ] `bun run lint` clean
- [ ] `bun run test` passes
- [ ] `bun run build` succeeds
- [ ] Docs / `README.md` updated if behavior changed
- [ ] Brand voice intact (lowercase confident, italic-serif twist, no AI vocabulary)
- [ ] Issue linked below (Closes #N) — every PR maps to an open issue

closes #
