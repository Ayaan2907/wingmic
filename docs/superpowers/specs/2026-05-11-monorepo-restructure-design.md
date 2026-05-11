# Monorepo Restructure — Design Spec

**Status:** Approved (brainstorm) · awaiting user spec review before plan
**Author:** Ayaan (with Claude Code via /superpowers:brainstorming)
**Date:** 2026-05-11
**Supersedes:** scaffold-time decisions in `~/.claude/plans/before-you-write-anything-polished-bumblebee.md` § "Bun workspaces only"

---

## Goal

Restructure wingmic into a Turborepo monorepo with **two apps** (`apps/web` for the static landing, `apps/app` for the dynamic product) and shared packages (`brand`, `design-tokens`, `db`, `extractor`).

Domain split:

- **wingmic.xyz** → `apps/web` static export → Cloudflare Pages (CDN-only, zero cold start)
- **app.wingmic.xyz** → `apps/app` dynamic Next.js → Cloudflare Workers via @opennextjs/cloudflare

Why split: the current `apps/web` mixes a static marketing site (homepage canvas + animations + SEO copy) with the dynamic product (signin, capture, recall, tRPC, BetterAuth, libSQL). The two surfaces have opposite operational profiles. Landing wants pure-static, zero-Worker, free CDN. Product wants stateful, server-side, secret-gated. One Next.js app for both is wrong on every axis.

Plus: the next deep product iteration is designing the **entity detection + search/recall algorithms**, all of which lives in `packages/extractor`. That package iterates fastest when isolated with its own test boundaries, eval fixtures, and clean import surfaces — consumed by `apps/app` over a typed contract.

Plus: ship a project-root `CLAUDE.md` so every contributor's Claude Code session inherits project context, conventions, and scope guards.

## Non-goals

- Publishing any package to npm.
- Adding any app beyond `apps/web` (landing) and `apps/app` (product). No native iOS, browser extension, CLI, Raycast, Obsidian, MCP server in this spec.
- Switching from Bun to pnpm/Yarn (Bun stays).
- Replacing tRPC, Drizzle, BetterAuth, AI SDK, Cloudflare Workers — see eng-review lock.
- Solving the OpenNext + libSQL Cloudflare bundling issue here — that's [#7](https://github.com/Ayaan2907/wingmic/issues/7), separate PR. This restructure must NOT regress that path further; we mitigate by extending the post-build bundle script's `nodePaths`. Landing ships independently and is unaffected by #7.

---

## §1 · final package layout

```
wingmic/
  apps/
    web/                              ← static landing → wingmic.xyz (Cloudflare Pages)
      app/
        page.tsx                      ← homepage (force-static)
        layout.tsx                    ← SEO + JSON-LD + OG metadata
        HomeClient.tsx                ← canvas force-graph + sections
        _components/marketing-ui.tsx
        globals.css
      next.config.ts                  ← output: 'export'
      public/                         ← generated at prebuild from packages/brand
    app/                              ← NEW. dynamic product → app.wingmic.xyz (Cloudflare Workers)
      app/
        signin/                       ← moved from old apps/web
        capture/                      ← moved from old apps/web
        recall/                       ← moved from old apps/web
        dashboard/                    ← future product surface (placeholder route)
        api/auth/[...all]/            ← moved from old apps/web
        api/trpc/[trpc]/              ← moved from old apps/web
      lib/
        auth.ts, auth-client.ts      ← moved
        email/                        ← moved
        trpc/                         ← moved
        config/env.ts                ← moved
      middleware.ts                   ← moved
      open-next.config.ts             ← Cloudflare Workers config
      wrangler.jsonc                  ← Worker bindings + custom domain
      public/                         ← generated at prebuild from packages/brand
  packages/
    brand/                            ← icon.svg, icon-tile.svg, icon-mono.svg, og-image.*,
                                        manifest.webmanifest, scripts/generate-icons.ts, README
    design-tokens/                    ← TS exports of design.md tokens + Tailwind preset
    db/                               ← Drizzle schema + libSQL client + migrations + drizzle.config + migrate.ts
    extractor/                        ← entity-detection pipeline:
                                        Zod schema, Claude prompt, AI SDK client, embeddings,
                                        resolution, search/recall algorithms, eval harness
    logger/                           ← (issue #12) Logger class + subscribe seam — placeholder dir for now
    env/                              ← (issue #12) Zod-validated env loader — placeholder dir for now
    config/
      tsconfig/                       ← base.json, nextjs.json, node.json, react.json
      eslint/                         ← base.js, next.js, node.js
      vitest/                         ← base.config.ts
  design/                             ← canonical mocks: homepage-v2.html, design-system.md, screenshots/, brand/ (read-only mirror)
  docs/                               ← architecture.md (rewritten), deploy.md (split: landing + app), packages.md (new), superpowers/
  CLAUDE.md                           ← NEW: project-level Claude Code context (pushed to GH)
  turbo.json                          ← NEW: Turborepo pipeline + cache config
  package.json                        ← workspaces + root scripts (turbo build/test/lint/typecheck)
  bun.lock
```

Naming: `@wingmic/<name>` for all packages, `@wingmic/web` for landing app, `@wingmic/app` for product app. All `private: true`. No npm publish planned.

**Two apps, both Next.js, opposite deploy profiles.** `apps/web` is static-exportable — no DB import, no auth code, no API routes, no LLM calls. Builds to `apps/web/out/` via `next build && next export` and ships as static assets. `apps/app` is everything dynamic: signin, capture, recall, tRPC, BetterAuth, libSQL, AI SDK — built via @opennextjs/cloudflare to a Worker.

**Why `packages/extractor` is the centerpiece.** The next deep product iteration is designing the entity-detection + search algorithms. That package becomes the experimental surface: prompt versions, resolution heuristics, embedding strategies, recall ranking — all iterated with the fixture-driven eval harness as a regression gate. Consumed by `apps/app` over a typed contract. Pulling it out of the app's `lib/` lets it own its own tsconfig, vitest setup, and CI lane.

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
apps/web (depends on brand, design-tokens)               apps/app (depends on brand, design-tokens, db, extractor)
   ↓                                                       ↓
next build && next export                              opennextjs-cloudflare build
   ↓                                                       ↓
apps/web/out/                                          apps/app/.open-next/
```

Two apps build in parallel under Turbo — they share no source code beyond `packages/*`. Extractor exports its own schema types directly via the `./schema` subpath. No circular deps.

### Per-app Next.js config differences

- `apps/web/next.config.ts`: `output: 'export'`, `images: { unoptimized: true }`, no API routes, no middleware. Builds to `apps/web/out/`.
- `apps/app/next.config.ts`: default Next.js output (Worker via OpenNext adapter). Has API routes + middleware. Builds to `apps/app/.next/` then `apps/app/.open-next/` after cf:build.

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

### 3.3 — Split `apps/web` → `apps/web` (landing) + `apps/app` (product)

This step is the structural pivot. Land it before any package hoist so paths only churn once.

**Create `apps/app/` skeleton:**

```
apps/app/
  package.json              ← @wingmic/app, all dynamic deps
  tsconfig.json             ← extends @wingmic/config-tsconfig/nextjs.json
  next.config.ts            ← default output (Worker via OpenNext)
  open-next.config.ts       ← Cloudflare config
  wrangler.jsonc            ← Worker bindings + secrets + custom domain
  middleware.ts             ← (moved from apps/web)
  .env.example              ← 8-secret table for production
  app/
    layout.tsx              ← minimal layout (no marketing copy)
    page.tsx                ← redirects to /signin or /dashboard
    signin/                 ← (moved)
    capture/                ← (moved)
    recall/                 ← (moved)
    dashboard/              ← placeholder route, lands when product matures
    api/auth/[...all]/      ← (moved)
    api/trpc/[trpc]/        ← (moved)
  lib/
    auth.ts                 ← (moved)
    auth-client.ts          ← (moved)
    email/                  ← (moved)
    trpc/                   ← (moved)
    config/env.ts           ← (moved)
  public/                   ← generated at prebuild (gitignored)
```

**Strip `apps/web/` to landing-only:**

```bash
# Remove dynamic routes
git rm -r apps/web/app/signin apps/web/app/capture apps/web/app/recall
git rm -r apps/web/app/api

# Remove dynamic lib
git rm apps/web/lib/auth.ts apps/web/lib/auth-client.ts
git rm -r apps/web/lib/email apps/web/lib/trpc
git rm apps/web/middleware.ts

# Remove DB-side files (move to packages/db in step 3.6)
# Leave apps/web/lib/{db,extractor,config} in place — packages/* moves get them
```

After strip, `apps/web/` contains:

```
apps/web/
  package.json              ← @wingmic/web, ONLY static deps (react, next, tailwind, brand, design-tokens)
  tsconfig.json
  next.config.ts            ← output: 'export', images: { unoptimized: true }
  app/
    layout.tsx              ← SEO + JSON-LD + OG metadata (KEPT)
    page.tsx                ← homepage (KEPT)
    HomeClient.tsx          ← canvas + sections (KEPT)
    _components/
      marketing-ui.tsx
      sections/             ← (added by separate modularization PR; not required here)
    globals.css
  public/                   ← gitignored, generated from packages/brand
```

**Update `apps/web/package.json` deps:**

Keep: `next`, `react`, `react-dom`, `@types/*`, `tailwindcss`, `postcss`, `autoprefixer`, `eslint`, `typescript`.
Add: `@wingmic/brand`, `@wingmic/design-tokens`, `@wingmic/config-tsconfig`, `@wingmic/config-eslint`.
**Remove:** all of `@ai-sdk/*`, `ai`, `@anthropic-ai/sdk`, `@libsql/client`, `@paralleldrive/cuid2`, `drizzle-orm`, `drizzle-kit`, `better-auth`, `resend`, `@trpc/*`, `@tanstack/react-query`, `superjson`, `zustand`, `zod` (unless used in metadata), `react-force-graph-2d` (homepage uses inline canvas), `@playwright/test`, `vitest` (testing for static surface lives at the package level), `@opennextjs/cloudflare`, `wrangler`.

**Update `apps/app/package.json` deps:**

Inherits everything `apps/web` is losing, plus: `@wingmic/db`, `@wingmic/extractor`, `@wingmic/brand`, `@wingmic/design-tokens`, `@wingmic/config-*`.

**Update homepage CTAs in `apps/web/app/HomeClient.tsx`:**

Replace links to `/signin` with absolute URL to the product domain:

```tsx
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.wingmic.xyz';
// In any signin/get-invite button:
<a href={`${APP_URL}/signin`}>get an invite →</a>
```

**Update `apps/app/lib/auth.ts` BetterAuth config:**

```ts
baseURL: env.BETTER_AUTH_URL,       // https://app.wingmic.xyz in prod
// Cookie domain stays scoped to app.wingmic.xyz only — no .wingmic.xyz parent scope.
```

**Verify between this step and 3.4:**

```bash
bun install --frozen-lockfile        # both apps now resolve their deps independently
cd apps/web && bun run typecheck     # exit 0 (landing has no auth/db imports)
cd apps/app && bun run typecheck     # exit 0 (product has everything)
cd apps/web && bun run build         # produces apps/web/out/ via next export
cd apps/app && bun run build         # produces apps/app/.next/
```

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

**Both** apps prebuild copies static files into their respective `public/` directories. Apps each declare the prebuild + predev hooks (Next.js runs them automatically):

```json
// apps/web/package.json
"scripts": {
  "prebuild": "cp -r ../../packages/brand/src/*.{svg,png,webmanifest} public/",
  "predev":   "cp -r ../../packages/brand/src/*.{svg,png,webmanifest} public/"
}

// apps/app/package.json
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

Add `apps/web/public/` and `apps/app/public/` to `.gitignore`. Add `.gitkeep` to each directory to preserve them.

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

By this point step 3.3 has already moved db sources from `apps/web/lib/db` to `apps/app/lib/db`. This step lifts them out of `apps/app` into the shared package.

```
packages/db/
  package.json (exports: ".", "./schema", "./client")
  src/
    schema.ts        ← from apps/app/lib/db/schema.ts
    client.ts        ← from apps/app/lib/db/client.ts
    index.ts         ← from apps/app/lib/db/index.ts
  drizzle/           ← from apps/app/drizzle/
  drizzle.config.ts  ← from apps/app/drizzle.config.ts (path-adjusted)
  scripts/
    migrate.ts       ← from apps/app/scripts/migrate.ts (path-adjusted)
  tsup.config.ts
```

`apps/app` imports update from `@/lib/db` → `@wingmic/db`. Affected files (all in `apps/app/`):

- `apps/app/lib/auth.ts`
- `apps/app/lib/trpc/context.ts`
- `apps/app/lib/trpc/routers/capture.ts`
- `apps/app/lib/trpc/routers/recall.ts`
- `apps/app/lib/extractor/resolution.ts` (until 3.7 also moves it)

`apps/web` has no DB imports — landing is pure static. Step is a no-op for `apps/web`.

Local SQLite file moves: `apps/app/local.db` → `packages/db/local.db`. Update `.gitignore` glob — already covers `*.db` globally, no change.

### 3.7 — Hoist `packages/extractor`

Step 3.3 already moved extractor sources from `apps/web/lib/extractor` to `apps/app/lib/extractor`. This step lifts them out of `apps/app` into the shared package — the experimental surface for the entity-detection + search/recall algorithm work.

```
packages/extractor/
  package.json (exports: ".", "./schema", "./eval")
  src/
    schema.ts        ← from apps/app/lib/extractor/schema.ts
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

`apps/app` imports update from `@/lib/extractor` → `@wingmic/extractor`. Affected files (all in `apps/app/`):

- `apps/app/lib/trpc/routers/capture.ts`
- `apps/app/lib/trpc/routers/recall.ts`

`apps/web` has no extractor imports — landing has no AI calls. Step is a no-op for `apps/web`.

### 3.8 — Update `.github/workflows/ci.yml`

Single job, root-level turbo commands. Turbo runs `build` against both `@wingmic/web` and `@wingmic/app` in parallel automatically:

```yaml
- run: bun install --frozen-lockfile
- run: bun run typecheck     # turbo typecheck → both apps + all packages
- run: bun run lint          # turbo lint
- run: bun run test          # turbo test → unit tests in packages/*
- run: bun run build         # turbo build → apps/web (next export) + apps/app (next build)
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

**Deploy is NOT in CI for v0.1.1.** Both `apps/web` and `apps/app` deploy manually from the maintainer's laptop via `bun --filter=@wingmic/web export` + `wrangler pages deploy` for landing, and `bun --filter=@wingmic/app cf:deploy` for product. CI runs gates only.

### 3.9 — Write `CLAUDE.md` + update README + docs

Per §4 + §5 below.

### 3.10 — Cloudflare bundling tweak (mitigates regression of issue #7)

**Only affects `apps/app`** — `apps/web` is static, has zero libSQL deps, deploys as static assets via `wrangler pages deploy`, never touches OpenNext.

Update `apps/app/scripts/bundle-libsql.ts` (lands in v0.1.1 Task 8) to extend `nodePaths`:

```ts
nodePaths: [
  resolve(repoRoot, 'node_modules'),
  resolve(repoRoot, 'packages/db/node_modules'),
  resolve(repoRoot, 'packages/extractor/node_modules'),
  resolve(repoRoot, 'apps/app/node_modules'),
],
```

If Task 8 has not landed yet, defer this to that task; this PR does not regress Cloudflare product deploy because `cf:build` still fails the same way it does today — fixing it is issue #7's job. **Landing deploy is fully unblocked** and ships to `wingmic.xyz` independent of #7.

### 3.11 — Verify + commit + open PR

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
| Hosting | Cloudflare Pages (apps/web static) + Cloudflare Workers (apps/app dynamic via @opennextjs/cloudflare) |
| Tests | Vitest unit + Playwright E2E |

## monorepo map

```

apps/web              ← static landing → wingmic.xyz (Cloudflare Pages)
apps/app              ← dynamic product → app.wingmic.xyz (Cloudflare Workers)
packages/brand        ← logos, favicons, OG, manifest
packages/design-tokens
packages/db           ← Drizzle schema + libSQL client + migrations
packages/extractor    ← entity-detection pipeline: prompt + Zod + resolution + search/recall + eval
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

- Add new section near top: **"§ 0 monorepo layout"** referencing the package map (§1). Call out the two-app structure: `apps/web` (static landing → wingmic.xyz) + `apps/app` (dynamic product → app.wingmic.xyz).
- Update `§ 4 capture flow` + `§ 5 recall flow` ASCII pipelines: replace `apps/web/lib/extractor/...` → `@wingmic/extractor`, replace `apps/web/lib/db/...` → `@wingmic/db`. Pipelines run in `apps/app`, not `apps/web`.
- Other sections (Framing D, schema, failure modes, why-these-choices) stay verbatim.

### `README.md`

- Replace `monorepo layout` block with the new package map (two apps + packages).
- Add a new "**Two deploy targets**" subsection near the stack table:
  - `wingmic.xyz` (static landing) — `@wingmic/web` exported as static assets, deployed to Cloudflare Pages.
  - `app.wingmic.xyz` (dynamic product) — `@wingmic/app` built via `@opennextjs/cloudflare`, deployed to Cloudflare Workers.
- Update `scripts` cheat sheet to root-level commands (`bun run dev` delegates to turbo, defaults to `apps/web`; pass `--filter=@wingmic/app dev` for the product app).
- Add one-line note: "Built as a Turborepo monorepo — see `docs/architecture.md` § 0."
- Hero + features + roadmap + privacy sections unchanged.
- Agent-prompt boxes in "quick start" updated to use new package names + reference CLAUDE.md.
- "Get beta access" CTAs in the README's marketing examples now point at `https://app.wingmic.xyz/signin`.

### `CONTRIBUTING.md`

- Reference `CLAUDE.md` near the top: "Read CLAUDE.md before editing — it tells Claude Code (and you) the conventions enforced on this repo."
- Architecture cheat sheet inline already mentions Framing D; add a note that new packages extend `@wingmic/config-tsconfig` + `@wingmic/config-vitest`.
- Add a "which app does my change belong in?" hint: marketing copy / homepage visuals → `apps/web`. Everything else (auth, capture, recall, dashboard, API routes, tRPC procedures) → `apps/app`.

### `docs/deploy.md`

Restructure into two top-level sections:

**§ Landing deploy (`wingmic.xyz`)**

- Build: `bun --filter=@wingmic/web build` (produces `apps/web/out/` via `next build && next export`).
- Deploy: `bunx wrangler pages deploy apps/web/out --project-name=wingmic-landing`.
- Required env: only `NEXT_PUBLIC_APP_URL=https://wingmic.xyz` for canonical metadata.
- DNS: Cloudflare dashboard → Pages project → custom domain `wingmic.xyz`.
- Unblocked. Ships independent of issue #7.

**§ Product deploy (`app.wingmic.xyz`)**

- 8 secrets table (Turso, BetterAuth, Resend, Anthropic, OpenAI) — current content, scoped to the product app.
- Build: `bun --filter=@wingmic/app cf:build`.
- Deploy: `bun --filter=@wingmic/app cf:deploy`.
- DNS: Cloudflare dashboard → Worker → custom domain `app.wingmic.xyz`.
- Blocked on issue #7 (libSQL bundling fix).

**§ Local dev** — runs both apps in parallel via `turbo dev` (apps/web on :3210, apps/app on :3211).

**§ Troubleshooting** — add subsection for monorepo / Turborepo cache (`rm -rf .turbo` + `bun install --force` for stale-cache issues).

### NEW: `docs/packages.md`

One-page guide on how to add a new package: required files, naming, tsup config, version pinning (`"workspace:*"`), Vitest setup, ESLint preset extension, how to test it locally via `bun --filter @wingmic/<name> ...`.

---

## §6 · verification

```bash
cd /Users/ayaan/Developer/wingmic

# 1. Clean install everywhere
rm -rf node_modules apps/*/node_modules packages/*/node_modules \
       apps/*/.next apps/*/.open-next apps/web/out .turbo
bun install --frozen-lockfile

# 2. Turbo pipeline works
bun run typecheck   # → both apps + all packages exit 0
bun run lint        # → 0 errors / 0 warnings
bun run test        # → vitest in packages/* passes
bun run build       # → apps/web/out/ (export) + apps/app/.next/ + packages/*/dist/

# 3. Verify db migrations still apply (against packages/db)
bun run db:apply    # → "[migrate] done" against file:./local.db
sqlite3 packages/db/local.db ".tables"  # → 17 + drizzle migrations table

# 4. Verify brand assets land in BOTH apps after prebuild
ls apps/web/public/icon*.svg apps/web/public/icon*.png
ls apps/web/public/manifest.webmanifest apps/web/public/og-image.{svg,png}
ls apps/app/public/icon*.svg apps/app/public/manifest.webmanifest

# 5. Landing static export sanity
ls apps/web/out/index.html            # → exists
ls apps/web/out/_next                 # → static chunks exist
grep -q "wingmic" apps/web/out/index.html

# 6. Dev smoke — both apps in parallel
bun run dev                            # turbo dev → apps/web on :3210, apps/app on :3211
curl -sI http://localhost:3210/        # → 200 (landing)
curl -sI http://localhost:3211/signin  # → 200 (product signin)
curl -sI http://localhost:3210/icon.svg
curl -sI http://localhost:3211/icon.svg

# 7. Landing deploy smoke (no secrets needed)
bunx wrangler pages deploy apps/web/out --project-name=wingmic-landing --dry-run

# 8. Product cf:build smoke (gates v0.1.1 product deploy; depends on Task 8 fix)
bun --filter=@wingmic/app cf:build     # → completes through libsql post-bundle (if Task 8 landed)

# 9. Eval gate
bun run extract:eval       # → ≥85% pass rate on canonical fixtures

# 10. CI dry run via act (optional)
act -j build               # → green
```

### Acceptance criteria

- [ ] All 10 verification steps pass (step 8 may fail until Task 8 of v0.1.1 plan lands — that's #7's scope, not this PR's)
- [ ] 19+ existing unit tests still pass (slug, embeddings) under `bun --filter @wingmic/extractor test`
- [ ] Landing build: `apps/web/out/index.html` exists; bundle has zero auth/db code (verify by grep: `grep -l "betterAuth\|libsql\|drizzle" apps/web/out/_next/static/chunks/*.js` returns empty)
- [ ] Product build: `apps/app/.next/` route map includes `/signin`, `/capture`, `/recall`, `/api/auth/*`, `/api/trpc/*`
- [ ] No files remain in `apps/web/lib/` other than possibly `globals.css` (everything else moved to apps/app or packages)
- [ ] `apps/web/public/` and `apps/app/public/` are gitignored; assets generated by prebuild
- [ ] `apps/web/package.json` dependencies block contains ZERO of: `@ai-sdk/*`, `ai`, `@anthropic-ai/sdk`, `@libsql/client`, `drizzle-orm`, `better-auth`, `resend`, `@trpc/*`, `superjson` (sanity that landing strip-down is real)
- [ ] `CLAUDE.md` exists at repo root and renders correctly on GitHub
- [ ] `docs/architecture.md` § 0 monorepo layout matches reality
- [ ] `gh repo view` topics still set; CI green badge still green
- [ ] Homepage CTAs link to `https://app.wingmic.xyz/signin` (or `http://localhost:3211/signin` in dev via `NEXT_PUBLIC_APP_URL`)

---

## Risk + mitigation

| Risk | Likelihood | Mitigation |
|---|---|---|
| Step 3.3 web-app split leaves dangling imports (apps/web references files moved to apps/app) | High | Sequence 3.3 as a single atomic commit: move all dynamic files AND strip apps/web deps in same commit. CI runs typecheck on both apps after. |
| Type resolution breaks during 3.6 db hoist (apps/app imports go red mid-PR) | High | Sequence step 3.6 + 3.7 as paired commits. CI gates each. Local `bun run typecheck` between every commit. |
| Cookie scope misconfigured — sessions don't persist across redirect from landing to product | Medium | `BETTER_AUTH_URL=https://app.wingmic.xyz` scopes cookies to that subdomain only. Landing never reads/writes the cookie. CTA on landing is a plain `<a href>`, not a fetch. |
| Cloudflare libSQL bundling regresses harder under `apps/app` path depth | Medium | §3.10 extends `nodePaths` in the post-build script to include `apps/app/node_modules`. Task 8 of v0.1.1 plan is the canonical fix; this PR pre-stages the path additions. |
| Stale Turborepo cache produces phantom failures | Medium | Add `rm -rf .turbo` to docs/deploy.md troubleshooting. CI cache step uses `restore-keys` with prefix match — bad entry never reused after invalidation. |
| Brand assets drift between apps/web/public and apps/app/public | Low | Both apps' prebuild copies from the same `packages/brand/src/` source. No way for them to diverge unless someone edits `apps/*/public/` directly (gitignored, so changes don't persist). |
| Eval fixtures path change orphans the v0.1.1 Task 1 integration test | Medium | Bake import-path update into the same PR; integration.test.ts imports go through `@wingmic/extractor`. |
| Two-app dev (`turbo dev`) port collision | Low | `apps/web` runs on :3210 (existing), `apps/app` on :3211. Hardcode in each app's `dev` script. |
| Turborepo + Bun edge cases on Cloudflare Workers cold-start | Low | Worker bundle is already produced by `@opennextjs/cloudflare`, not Turborepo. Turborepo only orchestrates build tasks; runtime is unaffected. |

---

## Out of scope (this spec)

- Publishing any `@wingmic/*` to npm
- Adding more apps beyond `apps/web` (landing) and `apps/app` (product) — no native iOS, browser extension, CLI, Raycast, Obsidian, MCP server in this spec
- Pinning specific package versions in `package.json` (workspace ranges only)
- Switching from `tsup` to another bundler
- Adding Storybook or component-library tooling
- Adding remote Turbo cache (defer to when CI > 5 min)
- Building the `/dashboard` route in `apps/app` (placeholder only; lands when product matures)

---

## Decisions captured

| Decision | Choice |
|---|---|
| Monorepo orchestrator | Turborepo |
| Library bundler per package | tsup (esm only, dts) |
| Workspace manager | Bun 1.3 (continued) |
| Package naming | `@wingmic/<name>` |
| Visibility | All `private: true` (no npm publish planned) |
| Two-app split | `apps/web` (static landing → wingmic.xyz) + `apps/app` (dynamic product → app.wingmic.xyz) |
| Landing framework | Next.js 15 with `output: 'export'` → static assets → Cloudflare Pages |
| Product framework | Next.js 15 default output → @opennextjs/cloudflare build → Cloudflare Workers |
| Signin location | `/signin` on `apps/app` only. Landing CTAs link to `https://app.wingmic.xyz/signin`. |
| Cookie scope | `app.wingmic.xyz` only (BetterAuth `baseURL`). Landing never reads/writes the session cookie. |
| Dev ports | `apps/web` on :3210, `apps/app` on :3211 |
| `apps/*/public/` source | Generated at prebuild from `packages/brand/src/`; both apps have prebuild hooks |
| `CLAUDE.md` location | Repo root, pushed to GitHub |
| Project-level `CLAUDE.md` overlaps with user global | Only the no-AI-co-author rule (it is project policy AND user preference) |
| Shared types path | Consumers import from `@wingmic/db/schema` + `@wingmic/extractor/schema` directly. No separate types package. |
| Eval fixtures path | `packages/extractor/src/eval/fixtures.json` |
| Cf bundle script | Extend `nodePaths` per §3.10 |
| ci.yml changes | Root-level turbo commands + opt-in cache step |
| Empty placeholders ok? | Yes for `packages/logger` + `packages/env` (issue #12 lands those properly) — they get just a `package.json` + `src/index.ts` stub for now |

---

## Implementation reference (handoff to /superpowers:writing-plans)

This spec is the authoritative source for the plan. The plan will:

1. Decompose §3.1–§3.11 into TDD-style bite-sized tasks
2. Each task: files / failing test (where applicable) / minimal change / run / commit
3. Maintain ordering: 3.1 → 3.2 → 3.3 (web/app split) → 3.4 → 3.5 → 3.6 → 3.7 → 3.8 → 3.9 → 3.10 → 3.11
4. Each commit keeps `bun run typecheck` + `bun run build` green
5. Special attention on step 3.3 (web/app split) — biggest churn, sequence as atomic commit
6. Final task = run §6 verification + open PR

**Critical post-restructure deploy unlock:** `apps/web` static export deploys to Cloudflare Pages with zero secrets. Run `bunx wrangler pages deploy apps/web/out --project-name=wingmic-landing` after the restructure PR merges → **wingmic.xyz goes public immediately**, independent of v0.1.1 Task 8 / issue #7.

Plan output: `docs/superpowers/plans/2026-05-11-monorepo-restructure.md`.
