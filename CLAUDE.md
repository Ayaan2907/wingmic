# wingmic — Claude Code project context

You are working on **wingmic**, a voice-first networking memory app.
Homepage: <https://wingmic.xyz> · Repo: <https://github.com/Ayaan2907/wingmic>

## one-paragraph product

User speaks 10–30s into mic after meeting someone. LLM extracts persons,
companies, events, topics, follow-up actions into a graph. NL recall:
"who at acme works on rust?" returns matches in <500ms. Open source, MIT,
deployed on Cloudflare Pages (landing) + Railway (product app) + libSQL/Turso.

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
| Hosting | Cloudflare Pages (apps/web static) + Railway (apps/app dynamic, Node.js) |
| Tests | Vitest unit + Playwright E2E |

## monorepo map

```
apps/web              ← static landing → wingmic.xyz (Cloudflare Pages)
apps/app              ← dynamic product → app.wingmic.xyz (Railway, Node.js)
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
9. **One mic, one surface.** Any mic affordance lands in chat with the
   mic engaged — never build a separate capture screen. See
   `design/design-system.md §12` for the full contract.

## execution principles — apply to every task

1. **Think before coding.** Avoid assumptions; ask clarifying questions
   before jumping into execution. When intent is ambiguous, stop and ask.
2. **Simplicity first.** Strive for the simplest possible solution. Avoid
   over-engineering or writing excessive, unnecessary code. The smallest
   change that solves the problem wins.
3. **Surgical changes.** Focus exclusively on the specific instructions
   provided. Do not touch unrelated code or introduce unintended side
   effects. If you spot something worth fixing, flag it — don't fix it.
4. **Goal-driven execution.** Define clear success criteria and the
   desired end state before beginning any task. Result must align with
   stated requirements, not your interpretation of them.

## skill routing (when working on this repo)

**Planning → Execution flow:**
1. new feature idea → `/office-hours` (design draft saved to `~/.gstack/projects/Ayaan2907-wingmic/`, personal lake)
2. finalize spec → promote design doc to `docs/superpowers/specs/` (team-visible, committed)
3. write execution plan → `/superpowers:writing-plans` (plan saved to `docs/superpowers/plans/`, repo-tracked)
4. implement → follow plan, then `/review` pre-merge

**Other routes:**
- bug / "why broken" → `/investigate`
- code review / pre-merge → `/review`
- ship / deploy → `/ship` (then `/document-release`)
- design / brand questions → read `design/design-system.md` first
- architecture changes → `/plan-eng-review` mandatory

## design (canonical — do not deviate without /design-consultation)

- `design/design-system.md` — design tokens, brand voice, component primitives. **v2 as of 2026-05-24** (Claude Design bundle).
- `design/v2/screens.md` — reference doc for every screen, mapped to lib-* components.
- `design/v2/screens.md` is the source of truth for the next-iteration UI direction. The chat-thread plan at `docs/superpowers/plans/2026-05-23-v0.1.1-hosted-capture.md` describes v0.1.1a/b implementation; design/v2/ describes the visual + interaction target.

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
- `bun --filter @wingmic/app dev` — start product app (port 3211)
- `bun --filter @wingmic/web dev` — start landing app (port 3210)
- `bun run extract:eval` — run extraction-accuracy harness (gate for releases)

## current blockers & plans

**v0.1.1 GA** (8 tasks, 0 checked):
- Task 1: capture → resolution → recall integration test (#8)
- Task 2: lazy-promotion (Company/Event union) (#2)
- Task 3: modularize HomeClient.tsx (#1)
- Task 4: text-input fallback (#5)
- Task 5: confidence-prompt UI for 0.5–0.85 (#3)
- Task 6: iOS Safari SpeechRecognition chunking (#4)
- Task 7: Sentry + PostHog (#9, p2)
- ~~Task 8: OpenNext + libSQL bundling (#7)~~ — obsolete; pivoted to Railway (Node.js runtime, no edge-bundling problem)

**Critical blockers:**
- None — landing live on Cloudflare Pages, apps/app deploys to Railway (no edge runtime constraints)
- **#9** (Sentry/PostHog) — observability; p2, can slip to v0.1.2

## deployment

- **apps/web** → Cloudflare Pages (static export, no secrets)
- **apps/app** → Railway (Node.js, full Next.js runtime, see root `railway.json`)
- **Database** → libSQL/Turso (works identically across both targets)
- Railway service root: **repo root** (`/`); config in `railway.json` (not `apps/app/`)

**Next upstream:**
- v0.2: contact imports (#10)
- v0.3: Acts agent (#11)
