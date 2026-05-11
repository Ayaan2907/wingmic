# Monorepo Restructure — Design Spec

**Status:** Approved (brainstorm) · awaiting user spec review before plan
**Author:** Ayaan (with Claude Code via /superpowers:brainstorming)
**Date:** 2026-05-11
**Supersedes:** scaffold-time decisions in `~/.claude/plans/before-you-write-anything-polished-bumblebee.md` § "Bun workspaces only"

---

## Goal

Restructure wingmic from a single-app workspace (`apps/web` + empty `packages/*` placeholders) into a fully-extracted Turborepo monorepo where shared brand, design tokens, db schema, extractor pipeline, and types live as first-class internal packages. Unblocks v0.4 MCP server, v0.3 Inngest worker, and v0.5 self-host portability without further extraction work.

Plus: ship a project-root `CLAUDE.md` so every contributor's Claude Code (and other AI coding assistants) session inherits project context, conventions, and scope guards.

## Non-goals

- Publishing any package to npm (defer until v0.4 ships `@wingmic/mcp-server`).
- Native iOS app, browser extension, CLI, Raycast, Obsidian — none of these are on the roadmap, do not engineer the workspace for them yet.
- Switching from Bun to pnpm/Yarn (Bun stays).
- Replacing tRPC, Drizzle, BetterAuth, AI SDK, Cloudflare Workers — see eng-review lock.
- Solving the OpenNext + libSQL Cloudflare bundling issue here — that's [#7](https://github.com/Ayaan2907/wingmic/issues/7), separate PR. This restructure must NOT regress that path further; we mitigate by extending the post-build bundle script's `nodePaths`.

---

## §1 · final package layout

```
wingmic/
  apps/
    web/                              ← Next.js homepage + product app
    mcp-server/                       ← v0.4 placeholder, package.json + tsup skeleton
  packages/
    brand/                            ← icon.svg, icon-tile.svg, icon-mono.svg, og-image.*,
                                        manifest.webmanifest, scripts/generate-icons.ts, README
    design-tokens/                    ← TS exports of design.md tokens + Tailwind preset
    db/                               ← Drizzle schema + libSQL client + migrations + drizzle.config + migrate.ts
    extractor/                        ← Zod schema + Claude prompt + AI SDK client + embeddings + resolution + eval
    types/                            ← shared TS re-exports from db + extractor
    logger/                           ← (issue #12) Logger class + subscribe seam — placeholder dir for now
    env/                              ← (issue #12) Zod-validated env loader — placeholder dir for now
    config/
      tsconfig/                       ← base.json, nextjs.json, node.json, react.json
      eslint/                         ← base.js, next.js, node.js
      vitest/                         ← base.config.ts
  design/                             ← canonical mocks: homepage-v2.html, design-system.md, screenshots/, brand/ (read-only mirror)
  docs/                               ← architecture.md (rewritten), deploy.md, packages.md (new), superpowers/
  CLAUDE.md                           ← NEW: project-level Claude Code context (pushed to GH)
  turbo.json                          ← NEW: Turborepo pipeline + cache config
  package.json                        ← workspaces + root scripts (turbo build/test/lint/typecheck)
  bun.lock
```

Naming: `@wingmic/<name>` for all packages. All `private: true` until v0.4 npm publish.

---

## §2 · build pipeline (Turborepo + tsup)

### `turbo.json`

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build":     { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**", "!.next/cache/**"] },
    "typecheck": { "dependsOn": ["^build"], "outputs": [] },
    "lint":      { "outputs": [] },
    "test":      { "dependsOn": ["^build"], "outputs": ["coverage/**"] },
    "dev":       { "cache": false, "persistent": true }
  }
}
```

### Per-library-package conventions

- `name`: `@wingmic/<package>`
- `private: true`
- `type: "module"`
- `main` / `types` / `exports` point at `./dist/...`
- Build with `tsup` (esm only, `dts: true`, `clean: true`, `sourcemap: true`)
- `scripts`: `build`, `dev` (watch), `typecheck`, `test` (vitest)
- Workspace deps declared as `"@wingmic/x": "workspace:*"`
- `devDependencies`: `@wingmic/config-tsconfig`, `@wingmic/config-vitest`, `tsup`, `vitest`

### Root scripts

```json
{
  "scripts": {
    "dev":          "turbo dev --filter=@wingmic/web",
    "build":        "turbo build",
    "test":         "turbo test",
    "lint":         "turbo lint",
    "typecheck":    "turbo typecheck",
    "format":       "prettier --write \"**/*.{ts,tsx,md,json}\"",
    "format:check": "prettier --check \"**/*.{ts,tsx,md,json}\"",
    "db:apply":     "bun --filter @wingmic/db apply",
    "db:generate":  "bun --filter @wingmic/db generate",
    "db:studio":    "bun --filter @wingmic/db studio",
    "extract:eval": "bun --filter @wingmic/extractor eval"
  }
}
```

### Build order Turborepo resolves automatically

```
config/* (no build)
   ↓
brand · design-tokens · db
   ↓
extractor (depends on db)
   ↓
types (re-exports types from db + extractor — type-only, no build step)
   ↓
apps/web · apps/mcp-server (depend on everything above)
```

**No circular deps.** Extractor exports its own schema types directly via `./schema` subpath. `packages/types` is a downstream type-only convenience package that re-exports for consumers who want one import surface. Extractor does NOT depend on types.

---

## §3 · migration steps

One branch `chore/monorepo-restructure`, sequenced commits. Build green between every commit.

### 3.1 — Install Turborepo + tsup at root

```bash
# From repo root
bun add -d turbo tsup
```

Write `turbo.json` at repo root. Update root `package.json` scripts per §2.

### 3.2 — Create shared config packages (no behavior change)

Files:

```
packages/config/tsconfig/
  package.json    ({ "name": "@wingmic/config-tsconfig", "private": true, "files": ["*.json"] })
  base.json
  nextjs.json
  node.json
  react.json
packages/config/eslint/
  package.json
  base.js
  next.js
  node.js
packages/config/vitest/
  package.json
  base.config.ts
```

`apps/web/tsconfig.json` switches from inline to `"extends": "@wingmic/config-tsconfig/nextjs.json"`. Same for ESLint + Vitest configs.

### 3.3 — Create `packages/types` (zero own logic, builds last)

```ts
// packages/types/src/index.ts
export type {
  User, NewUser, Entity, NewEntity, Company, Event, Topic,
  Interaction, NewInteraction, EntityFact, EntityNote,
} from '@wingmic/db/schema';
export type {
  ExtractionResult, PersonCandidate, CompanyCandidate,
  EventCandidate, ActionCandidate,
} from '@wingmic/extractor/schema';
```

Consumers: `import type { Entity } from '@wingmic/types'`.

### 3.4 — Hoist `packages/brand`

```
packages/brand/
  package.json
  src/
    icon.svg
    icon-tile.svg
    icon-mono.svg
    og-image.svg
    og-image.png
    icon-16.png  icon-32.png  icon-64.png  icon-192.png  icon-512.png
    apple-touch-icon.png
    manifest.webmanifest
    index.ts          ← URL helpers (see below)
  scripts/
    generate-icons.ts ← moved from apps/web/scripts/
  README.md
```

`packages/brand/src/index.ts`:

```ts
export const brandAssets = {
  icon:        new URL('./icon.svg', import.meta.url).href,
  iconTile:    new URL('./icon-tile.svg', import.meta.url).href,
  iconMono:    new URL('./icon-mono.svg', import.meta.url).href,
  ogImage:     new URL('./og-image.png', import.meta.url).href,
  manifest:    new URL('./manifest.webmanifest', import.meta.url).href,
} as const;
```

`apps/web` prebuild copies static files into `apps/web/public/`:

```json
"scripts": {
  "prebuild": "cp -r ../../packages/brand/src/*.{svg,png,webmanifest} public/",
  "predev":   "cp -r ../../packages/brand/src/*.{svg,png,webmanifest} public/"
}
```

Untrack the current `apps/web/public/*` (it is checked in as of commit `4a79da8`):

```bash
git rm apps/web/public/icon.svg apps/web/public/icon-tile.svg apps/web/public/icon-mono.svg \
       apps/web/public/og-image.svg apps/web/public/og-image.png \
       apps/web/public/icon-16.png apps/web/public/icon-32.png apps/web/public/icon-64.png \
       apps/web/public/icon-192.png apps/web/public/icon-512.png \
       apps/web/public/apple-touch-icon.png \
       apps/web/public/manifest.webmanifest
```

Add `apps/web/public/` to `.gitignore`. Add `apps/web/public/.gitkeep` to preserve directory.

### 3.5 — Hoist `packages/design-tokens`

```
packages/design-tokens/
  package.json
  src/
    colors.ts        ← #FFC452, #86efac, #FF8FAB, #FF6B6B, #7DD3FC, #A78BFA, etc.
    spacing.ts       ← 4 · 6 · 8 · 10 · 12 · 14 · 16 · 20 · 24 · 28 · 32 · 40 · 48 · 60 · 72 · 96 · 120
    radii.ts         ← sm 6, md 10, lg 14, xl 22, '2xl' 36, pill 999
    shadows.ts       ← sticker, button, button-hover, card, phone, glow-accent
    typography.ts    ← font families + scale
    index.ts         ← consolidated export
  tailwind-preset.ts ← exports Tailwind config consumers extend
```

`apps/web/tailwind.config.ts`:

```ts
import { wingmicPreset } from '@wingmic/design-tokens/tailwind-preset';
export default { presets: [wingmicPreset], content: ['./app/**/*.{ts,tsx}'] };
```

`apps/web/app/globals.css` keeps CSS vars; values come from `@wingmic/design-tokens` via the Tailwind preset.

### 3.6 — Hoist `packages/db`

```
packages/db/
  package.json (exports: ".", "./schema", "./client")
  src/
    schema.ts        ← from apps/web/lib/db/schema.ts
    client.ts        ← from apps/web/lib/db/client.ts
    index.ts         ← from apps/web/lib/db/index.ts
  drizzle/           ← from apps/web/drizzle/
  drizzle.config.ts  ← from apps/web/drizzle.config.ts (path-adjusted)
  scripts/
    migrate.ts       ← from apps/web/scripts/migrate.ts (path-adjusted)
  tsup.config.ts
```

`apps/web` imports update from `@/lib/db` → `@wingmic/db`. Affected files:

- `apps/web/lib/auth.ts`
- `apps/web/lib/trpc/context.ts`
- `apps/web/lib/trpc/routers/capture.ts`
- `apps/web/lib/trpc/routers/recall.ts`
- `apps/web/lib/extractor/resolution.ts` (until 3.7 also moves it)

Local SQLite file moves: `apps/web/local.db` → `packages/db/local.db`. Update `.gitignore` glob — already covers `*.db` globally, no change.

### 3.7 — Hoist `packages/extractor`

```
packages/extractor/
  package.json (exports: ".", "./schema", "./eval")
  src/
    schema.ts        ← from apps/web/lib/extractor/schema.ts
    prompt.ts
    client.ts
    embeddings.ts
    slug.ts
    resolution.ts
    index.ts
    eval/
      fixtures.json
      runner.ts
    __tests__/
      slug.test.ts
      embeddings.test.ts
      resolution.test.ts (if planted by v0.1.1 Task 2)
      integration.test.ts (if planted by v0.1.1 Task 1)
  tsup.config.ts
  vitest.config.ts (extends @wingmic/config-vitest)
```

`apps/web` imports update from `@/lib/extractor` → `@wingmic/extractor`. Affected files:

- `apps/web/lib/trpc/routers/capture.ts`
- `apps/web/lib/trpc/routers/recall.ts`

### 3.8 — Stub `apps/mcp-server` + `packages/mcp-server`

```
apps/mcp-server/
  package.json (tsup build, scripts to run stdio + http transports)
  src/
    index.ts (placeholder: console.log + exit 0)
  README.md (v0.4 milestone, see issues #11 epic)
```

Add `apps/mcp-server` to workspace via root `package.json` `workspaces` field.

### 3.9 — Update `.github/workflows/ci.yml`

```yaml
- run: bun install --frozen-lockfile
- run: bun run typecheck
- run: bun run lint
- run: bun run test
- run: bun run build
```

Add Turborepo cache step (opt-in via env, no-op without token):

```yaml
- name: cache turbo
  uses: actions/cache@v4
  with:
    path: .turbo
    key: turbo-${{ runner.os }}-${{ github.sha }}
    restore-keys: turbo-${{ runner.os }}-
```

### 3.10 — Write `CLAUDE.md` + update README + docs

Per §4 + §5 below.

### 3.11 — Cloudflare bundling tweak (mitigates regression of issue #7)

Update `apps/web/scripts/bundle-libsql.ts` (lands in v0.1.1 Task 8) to extend `nodePaths`:

```ts
nodePaths: [
  resolve(repoRoot, 'node_modules'),
  resolve(repoRoot, 'packages/db/node_modules'),
  resolve(repoRoot, 'packages/extractor/node_modules'),
],
```

If Task 8 has not landed yet, defer this to that task; this PR does not regress Cloudflare deploy because cf:build still fails the same way it does today — fixing it is issue #7's job.

### 3.12 — Verify + commit + open PR

Per §6 below.

---

## §4 · `CLAUDE.md` content (project root, pushed to GitHub)

Target: < 200 lines. Loaded into every contributor's Claude Code session. Concrete, scannable, no fluff.

```markdown
# wingmic — Claude Code project context

You are working on **wingmic**, a voice-first networking memory app.
Homepage: <https://wingmic.xyz> · Repo: <https://github.com/Ayaan2907/wingmic>

## one-paragraph product

User speaks 10–30s into mic after meeting someone. LLM extracts persons,
companies, events, topics, follow-up actions into a graph. NL recall:
"who at acme works on rust?" returns matches in <500ms. Open source, MIT,
deployed on Cloudflare Workers + libSQL/Turso.

## stack (locked — do not change without /plan-eng-review)

| Layer | Choice |
|---|---|
| Framework | Next.js 15 App Router |
| Runtime | Bun 1.3 + workspaces + **Turborepo** |
| Styling | Tailwind 3 + `@wingmic/design-tokens` |
| DB + ORM | Drizzle + libSQL/Turso |
| LLM | Vercel AI SDK v6 + Anthropic Claude Sonnet 4.6 |
| Embeddings | OpenAI text-embedding-3-small (1536-d) |
| Auth | BetterAuth + Resend magic link |
| API | tRPC v11 + Server Actions hybrid |
| Hosting | Cloudflare Workers via @opennextjs/cloudflare |
| Tests | Vitest unit + Playwright E2E |

## monorepo map

```

apps/web              ← Next.js homepage + product
apps/mcp-server       ← v0.4 placeholder
packages/brand        ← logos, favicons, OG, manifest
packages/design-tokens
packages/db           ← Drizzle schema + libSQL client + migrations
packages/extractor    ← Claude prompt + Zod + resolution + eval
packages/types        ← shared TS re-exports
packages/logger       ← (issue #12) Logger with analytics seam
packages/env          ← (issue #12) Zod-validated env
packages/config/*     ← tsconfig + eslint + vitest presets
design/               ← canonical mocks (do not edit without /design-review)
docs/                 ← architecture.md, deploy.md, superpowers/

```

## conventions — non-negotiable

1. **No AI co-author trailer.** Never `Co-Authored-By: Claude` on any
   commit, PR, or GitHub artifact. Authorship is the human committer's.
2. **Conventional Commits.** `feat(extractor): ...`, `fix(db): ...`,
   `docs(readme): ...`, `chore(deploy): ...`, `refactor(web): ...`,
   `test(...): ...`, `perf(...): ...`.
3. **Brand voice in user-facing copy + commits.** Lowercase confident,
   one italic-serif twist per heading, no AI vocabulary ("delve",
   "robust", "comprehensive", "seamless", "powerful", "cutting-edge").
   Source of truth: `design/design-system.md`.
4. **One change per PR.** Stack multiple PRs for bigger changes.
5. **CI gates green before merge.** typecheck + lint + vitest + build.
6. **Tests with new code.** Vitest for units, Playwright for E2E.
7. **No `process.env.X` outside `packages/env`.** No `console.log`
   outside `packages/logger`. (Enforced once issue #12 lands.)
8. **No new top-level packages without a roadmap entry.** Check README
   roadmap or v0.x epic issues before adding to `packages/`.

## skill routing (when working on this repo)

- new feature idea → `/office-hours` first (saves to ~/.gstack/projects/wingmic/)
- bug / "why broken" → `/investigate`
- code review / pre-merge → `/review`
- ship / deploy → `/ship` (then `/document-release`)
- design / brand questions → read `design/design-system.md` first
- architecture changes → `/plan-eng-review` mandatory

## key files

- `docs/architecture.md` — Framing-D identity model, capture + recall pipelines, schema map
- `docs/deploy.md` — operator runbook, 8-secret table, troubleshooting
- `docs/packages.md` — how to add or modify a package in the monorepo
- `CONTRIBUTING.md` — branch + commit conventions, PR checklist
- `design/design-system.md` — brand voice + tokens (canonical handoff)
- `design/brand/` — logo + mark usage docs
- `docs/superpowers/plans/2026-05-03-v0.1.1-ga.md` — current implementation plan
- `packages/extractor/src/eval/fixtures.json` — regression baseline (do NOT edit casually)

## scope guards

- Do NOT modify files in `design/` (mocks are canonical handoff)
- Do NOT edit eval fixtures without explicit user direction
- Do NOT install dependencies without checking they're already in the closest `package.json`
- Do NOT bypass the issue tree for the four wedges (capture, recall, imports, acts) — each wedge has labeled scope on GH

## helpful agent commands

- `gh issue list --label "good first issue"` — beginner-friendly work
- `gh issue list --label "wedge:<name>"` — work for one wedge
- `bun run db:studio` — open Drizzle Studio
- `bun --filter @wingmic/extractor test` — run extractor unit tests only
- `bun --filter @wingmic/web dev` — start web app
- `bun run extract:eval` — run extraction-accuracy harness (gate for releases)
```

### What stays OUT of project `CLAUDE.md`

- User's personal `~/.claude/CLAUDE.md` global preferences (gstack skill list, graphify, statusline, etc.)
- API keys / secrets / paths
- User's personal handle / email / signature
- Editor-specific config
- Anything that varies per contributor

### Why push to GitHub

- Every contributor's Claude Code session auto-loads `CLAUDE.md` from repo root
- Cursor + Codex + other AI tools also recognise it as project context
- Onboarding time drops from hours to minutes
- Brand voice + commit conventions enforced by every AI helper, not just the maintainer's
- It is a maintainer-friendly form of `CONTRIBUTING.md` — same rules, agent-readable

---

## §5 · docs + README rewrite scope

Targeted edits, not full rewrites. Each file gets the smallest change that reflects the new layout.

### `docs/architecture.md`

- Add new section near top: **"§ 0 monorepo layout"** referencing the package map (§1).
- Update `§ 4 capture flow` + `§ 5 recall flow` ASCII pipelines: replace `apps/web/lib/extractor/...` → `@wingmic/extractor`, replace `apps/web/lib/db/...` → `@wingmic/db`.
- Other sections (Framing D, schema, failure modes, why-these-choices) stay verbatim.

### `README.md`

- Replace `monorepo layout` block with the new package map.
- Update `scripts` cheat sheet to root-level commands (`bun run dev` delegates to turbo, no `cd apps/web` required).
- Add one-line note: "Built as a Turborepo monorepo — see `docs/architecture.md` § 0."
- Hero + features + roadmap + privacy sections unchanged.
- Agent-prompt boxes in "quick start" updated to use new package names + reference CLAUDE.md.

### `CONTRIBUTING.md`

- Reference `CLAUDE.md` near the top: "Read CLAUDE.md before editing — it tells Claude Code (and you) the conventions enforced on this repo."
- Architecture cheat sheet inline already mentions Framing D; add a note that new packages extend `@wingmic/config-tsconfig` + `@wingmic/config-vitest`.

### `docs/deploy.md`

- `bun run cf:build` now runs at workspace root, not `cd apps/web` first.
- `bun run db:apply` runs at root, delegates via Turbo to `@wingmic/db`.
- Troubleshooting section gains a "monorepo / Turborepo cache" subsection (delete `.turbo/` + `bun install --force` for stale-cache issues).

### NEW: `docs/packages.md`

One-page guide on how to add a new package: required files, naming, tsup config, version pinning (`"workspace:*"` until first npm publish at v0.4), Vitest setup, ESLint preset extension, how to test it locally via `bun --filter @wingmic/<name> ...`.

---

## §6 · verification

```bash
cd /Users/ayaan/Developer/wingmic

# 1. Clean install everywhere
rm -rf node_modules apps/*/node_modules packages/*/node_modules apps/*/.next apps/*/.open-next .turbo
bun install --frozen-lockfile

# 2. Turbo pipeline works
bun run typecheck   # → all packages exit 0, build order respected
bun run lint        # → 0 errors / 0 warnings
bun run test        # → vitest in extractor + brand passes
bun run build       # → apps/web .next/ + packages/*/dist/

# 3. Verify db migrations still apply
bun run db:apply    # → "[migrate] done" against file:./local.db
sqlite3 packages/db/local.db ".tables"  # → 17 + drizzle migrations table

# 4. Verify brand assets land in apps/web/public after prebuild
ls apps/web/public/icon*.svg apps/web/public/icon*.png
ls apps/web/public/manifest.webmanifest
ls apps/web/public/og-image.{svg,png}

# 5. Dev smoke
bun run dev                # → http://localhost:3210 renders homepage
curl -sI http://localhost:3210/icon.svg          # → 200, content-type image/svg+xml
curl -sI http://localhost:3210/manifest.webmanifest

# 6. Cf build smoke (gates v0.1.1 deploy; depends on Task 8)
cd apps/web && bun run cf:build   # → completes through libsql post-bundle

# 7. Eval gate
bun run extract:eval       # → ≥85% pass rate

# 8. CI dry run via act (optional)
act -j build               # → green
```

### Acceptance criteria

- [ ] All 8 verification steps pass
- [ ] 19+ existing unit tests still pass (slug, embeddings)
- [ ] Build artifacts unchanged: `/` route at ~17.4 kB / ~119 kB First Load JS
- [ ] No files remain in `apps/web/lib/{db,extractor}` (all moved)
- [ ] `apps/web/public/` is gitignored; assets generated by prebuild
- [ ] `CLAUDE.md` exists at repo root and renders correctly on GitHub
- [ ] `docs/architecture.md` § 0 monorepo layout matches reality
- [ ] `bun --filter @wingmic/extractor test` works (filter routing exercised)
- [ ] `gh repo view` topics still set; CI green badge still green

---

## Risk + mitigation

| Risk | Likelihood | Mitigation |
|---|---|---|
| Type resolution breaks during 3.6 db hoist (apps/web imports go red mid-PR) | High | Sequence step 3.6 + 3.7 as paired commits. CI gates each. Local `bun run typecheck` between every commit. |
| Cloudflare libSQL bundling regresses harder | Medium | §3.11 extends `nodePaths` in the post-build script. Task 8 of v0.1.1 plan is the canonical fix; this PR pre-stages the path additions. |
| Stale Turborepo cache produces phantom failures | Medium | Add `rm -rf .turbo` to docs/deploy.md troubleshooting. CI cache step uses `restore-keys` with prefix match — bad entry never reused after invalidation. |
| `apps/web/public/` gitignore breaks GitHub Pages auto-deploy if anyone wires that up | Low | Cloudflare deploy uses build-time prebuild; pages auto-deploy is not the path. Note in docs/deploy.md. |
| Eval fixtures path change orphans the v0.1.1 Task 1 integration test | Medium | Bake import-path update into the same PR; integration.test.ts imports go through `@wingmic/extractor`. |
| Turborepo + Bun edge cases on Cloudflare Workers cold-start | Low | Worker bundle is already produced by `@opennextjs/cloudflare`, not Turborepo. Turborepo only orchestrates build tasks; runtime is unaffected. |

---

## Out of scope (this spec)

- Publishing any `@wingmic/*` to npm (defer to v0.4 milestone)
- iOS / browser-extension / CLI / Raycast / Obsidian packages (not on the roadmap)
- Pinning specific package versions in `package.json` (workspace ranges only)
- Switching from `tsup` to another bundler
- Adding Storybook or component-library tooling
- Adding remote Turbo cache (defer to when CI > 5 min)

---

## Decisions captured

| Decision | Choice |
|---|---|
| Monorepo orchestrator | Turborepo |
| Library bundler per package | tsup (esm only, dts) |
| Workspace manager | Bun 1.3 (continued) |
| Package naming | `@wingmic/<name>` |
| Visibility | All `private: true` until v0.4 |
| `apps/web/public/` source | Generated at prebuild from `packages/brand/src/` |
| `CLAUDE.md` location | Repo root, pushed to GitHub |
| Project-level `CLAUDE.md` overlaps with user global | Only the no-AI-co-author rule (it is project policy AND user preference) |
| Shared types path | `@wingmic/types` re-exports from `@wingmic/db/schema` + `@wingmic/extractor/schema` |
| Eval fixtures path | `packages/extractor/src/eval/fixtures.json` |
| Cf bundle script | Extend `nodePaths` per §3.11 |
| ci.yml changes | Root-level turbo commands + opt-in cache step |
| Empty placeholders ok? | Yes for `packages/logger` + `packages/env` (issue #12) + `apps/mcp-server` (v0.4) — they get just a `package.json` + `src/index.ts` stub |

---

## Implementation reference (handoff to /superpowers:writing-plans)

This spec is the authoritative source for the plan. The plan will:

1. Decompose §3.1–§3.12 into TDD-style bite-sized tasks
2. Each task: files / failing test (where applicable) / minimal change / run / commit
3. Maintain ordering: 3.1 → 3.2 → 3.3 → 3.4 → 3.5 → 3.6 → 3.7 → 3.8 → 3.9 → 3.10 → 3.11 → 3.12
4. Each commit keeps `bun run typecheck` + `bun run build` green
5. Final task = run §6 verification + open PR

Plan output: `docs/superpowers/plans/2026-05-11-monorepo-restructure.md`.
