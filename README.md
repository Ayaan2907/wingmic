<div align="center">

```
  ┌──────────────────────────────────────────────────────┐
  │  ░ ░ ░  wingmic.xyz                                  │
  │                                                       │
  │  your social RAM, on disk.                            │
  └──────────────────────────────────────────────────────┘
```

**voice-first networking memory · open source · MIT**

Stop forgetting. *Start building.*

[![License: MIT](https://img.shields.io/badge/License-MIT-FFC452.svg?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/status-v0.1--beta-FFC452.svg?style=flat-square)](https://github.com/Ayaan2907/wingmic/releases)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-86efac.svg?style=flat-square)](CONTRIBUTING.md)
[![Live](https://img.shields.io/badge/wingmic.xyz-live-7DD3FC.svg?style=flat-square)](https://wingmic.xyz)
[![CI](https://github.com/Ayaan2907/wingmic/actions/workflows/ci.yml/badge.svg)](https://github.com/Ayaan2907/wingmic/actions/workflows/ci.yml)

[Live site](https://wingmic.xyz) ·
[Roadmap](#roadmap) ·
[Self-host](#self-host) ·
[Contribute](CONTRIBUTING.md) ·
[Discussions](https://github.com/Ayaan2907/wingmic/discussions)

</div>

---

## the handshake memory leak

You meet 12 people at a conference. By day's end you remember 3 names, 1 company, and zero context. Your brain's RAM got garbage-collected.

LinkedIn is a graveyard. Notion CRMs want typing time you don't have. Phone contacts are a graveyard. Between two sessions at a conf you have ninety seconds and a coffee in one hand. There's no typing budget.

Wingmic is the tool you open right after you meet someone. Voice-dump the context, commit to your memory graph, **never forget a connection again.**

---

## what it does

```
you, after a meetup, into your phone:
  > "met sarah from acme at the rust meetup, she leads their edge runtime team,
     send her the github link tomorrow morning"

wingmic, instantly:
  ✓ committed to graph
    → person:    Sarah  (Lead · Edge runtime @ Acme)
    → event:     Rust meetup  (canonical, shared)
    → topics:    rust · edge runtime
    → action:    send github link · tomorrow 9:00 AM

you, three weeks later:
  > "who at acme works on rust?"

  ↪ found 1 match in 0.3s:
    • Sarah  ·  Lead · Edge runtime  ·  Acme  ·  met at Rust meetup
      "she leads their edge runtime team, send her the repo"
```

That's the whole product. Hold a button. Talk for twenty seconds. Ask anything later, in plain English, get an answer.

---

## features

| | |
|---|---|
| 🎤 **voice capture** | Browser SpeechRecognition by default. AssemblyAI / Deepgram BYO key in v0.1.2. |
| 🧠 **claude extraction** | `generateObject` + Zod schema. Pulls people, companies, events, topics, follow-up actions. |
| 🔍 **NL recall** | "who at acme ships rust?" → top matches in &lt; 500ms. OpenAI embeddings + libSQL vector. |
| 🔒 **private people, public facts** | Sarah-the-person stays yours alone. Acme-the-company is canonical, shared across users (lazy promotion). |
| ✉️ **magic-link auth** | BetterAuth + Resend. No passwords, no OAuth, no install friction. |
| 🌐 **mobile-first PWA** | Responsive web. No App Store, no DMG, no install. Visit and use. |
| 🛠 **typed end-to-end** | Drizzle + tRPC + TypeScript. One source of truth from DB to UI. |

---

## roadmap

| version | what ships | status |
|---|---|---|
| **v0.1.1** | voice capture + NL recall (Approach B narrowed) | 🟡 wiring complete, awaiting first deploy |
| v0.2 | contact imports — LinkedIn export, Google Contacts, vCard | 📋 issue tree filed |
| v0.3 | Acts agent — drafts emails / check-ins / intros, **permission-first**, Inngest durability | 📋 issue tree filed |
| v0.4 | MCP server — query your network from Claude / ChatGPT directly | 📋 deferred |
| v0.5 | self-host — Docker Compose + BYO API keys | 📋 deferred |

Roadmap and milestone progress live on the [project board](https://github.com/Ayaan2907/wingmic/projects).

---

## stack

| layer | choice | why |
|---|---|---|
| Web framework | **Next.js 15** (App Router + RSC) | Mature, edge-ready, Server Actions cover most APIs |
| Runtime + pkgs | **Bun 1.3** + workspaces | 10-20× faster install, native TS, native sqlite |
| Styling | **Tailwind 3** + design tokens | App surface only — homepage uses inline styles by design |
| DB + ORM | **Drizzle + libSQL/Turso** | Edge-native, ~50 KB runtime, sqlite-with-replicas |
| LLM framework | **Vercel AI SDK v6** + Anthropic Claude Sonnet 4.6 | Single function call extraction; multi-provider config swap |
| Embeddings | **OpenAI text-embedding-3-small** (1536-d) | $0.02 / 1M tokens, native libSQL `F32_BLOB(1536)` |
| Auth | **BetterAuth** + Resend | OSS, self-hostable, magic-link only |
| API | **tRPC v11** + Server Actions hybrid | Typed end-to-end, multi-client (RN / MCP later) |
| State | **Zustand** for ephemeral UI; React Query for server | Minimal, no Redux |
| Hosting | **Cloudflare Workers** via `@opennextjs/cloudflare` | Global edge, pairs with Turso replicas |
| Tests | **Vitest** unit + **Playwright** E2E | Fastest TS testing, mobile + desktop projects |

---

## monorepo layout

```
wingmic/
  apps/
    web/                          ← Next.js homepage + product app
      app/                        ← App Router routes
        page.tsx                  ← homepage (HomeClient.tsx is the canvas + sections)
        signin/                   ← magic-link sign-in
        capture/                  ← voice → extract → graph
        recall/                   ← NL search across the graph
        api/auth/[...all]/        ← BetterAuth handler
        api/trpc/[trpc]/          ← tRPC handler
      lib/
        db/                       ← Drizzle schema + libSQL client
        auth.ts, auth-client.ts   ← BetterAuth wiring
        trpc/                     ← typed routers (capture, recall)
        extractor/                ← Zod schema + Claude prompts + resolution + eval
      drizzle/                    ← migrations
      e2e/                        ← Playwright specs
      scripts/                    ← migrate.ts (programmatic libSQL migrator)
  packages/                       ← (placeholder; promotion-on-demand)
    ui/  extractor/  db/
  design/                         ← canonical handoff: design-system.md, homepage-v2.html, video-v6.html
  docs/                           ← deploy.md, architecture.md
```

---

## quick start

Pick your path. Both work.

### 🤖 with an agent (Claude Code, Cursor, Codex, etc.)

Paste this prompt into your AI coding assistant. It walks you through clone → secrets → first run, asking at each step.

```
Set up wingmic for me on this machine. The repo is github.com/Ayaan2907/wingmic — an
open-source voice-first networking memory app.

Do this in order, stopping for me at each step:

  1. Check if Bun (>=1.3) and Node (>=20) are installed. Install Bun if missing
     via `curl -fsSL https://bun.sh/install | bash`.
  2. Clone https://github.com/Ayaan2907/wingmic.git into ./wingmic if not already.
  3. Run `bun install` from the repo root.
  4. Copy apps/web/.env.example to apps/web/.env.local.
  5. Walk me through obtaining the 8 required secrets per docs/deploy.md § 2:
       - TURSO_DB_URL + TURSO_AUTH_TOKEN  (turso CLI)
       - BETTER_AUTH_SECRET                (openssl rand -base64 48)
       - BETTER_AUTH_URL                   (http://localhost:3210 for local dev)
       - RESEND_API_KEY + RESEND_FROM      (resend.com — domain must be verified)
       - ANTHROPIC_API_KEY                 (console.anthropic.com)
       - OPENAI_API_KEY                    (platform.openai.com)
     Stop and ask me at each one — do NOT generate or fetch any keys yourself.
     For local dev only ANTHROPIC_API_KEY and OPENAI_API_KEY are required;
     the rest can be left blank with safe defaults.
  6. Once .env.local is filled, run `cd apps/web && bun run db:apply` to create
     a local SQLite at apps/web/local.db.
  7. Run `bun run dev` from the repo root. Show me http://localhost:3210 once it's up.
  8. Tell me to sign in: visit /signin, type any email, and check the dev-server
     console — the magic link is logged there since RESEND_API_KEY isn't set.

Brand voice rule: when committing or summarizing, do NOT add "Co-Authored-By: Claude"
or any AI co-author trailer. Authorship is mine.
```

### 🛠 manually

Prerequisites: **Bun 1.3+** (`curl -fsSL https://bun.sh/install | bash`) and **Node 20+**.

```bash
git clone https://github.com/Ayaan2907/wingmic.git
cd wingmic
bun install

cp apps/web/.env.example apps/web/.env.local
# Fill in ANTHROPIC_API_KEY and OPENAI_API_KEY at minimum.
# See docs/deploy.md § 2 for how to acquire each.

cd apps/web && bun run db:apply
cd -

bun run dev   # → http://localhost:3210
```

Sign in: type any email at `/signin`. The magic link is logged to the dev console since `RESEND_API_KEY` isn't set locally.

### 🤝 making your first contribution

Paste this into your AI coding assistant when you want to send a PR.

```
Help me make my first contribution to wingmic (github.com/Ayaan2907/wingmic).

  1. Read these in order — they're the maintainer contract:
       - README.md
       - CONTRIBUTING.md
       - docs/architecture.md
       - design/design-system.md (only if the work is UI / brand-voice)
  2. List open issues tagged `good first issue`:
       gh issue list --label "good first issue" --state open
  3. Ask me which issue number I want to tackle. Don't pick one for me.
  4. Read the issue body in full. Identify exact files to touch.
  5. Branch from main: `git checkout -b feat/<short-name>` or fix/, docs/, chore/
     per CONTRIBUTING.md branch conventions.
  6. Make the change. Add or update Vitest or Playwright tests for new behavior.
  7. Run the local CI checks before committing:
       - bun run typecheck
       - bun --filter @wingmic/web lint
       - bun run test
       - bun run build
     All must pass.
  8. Commit using Conventional Commits (e.g. `feat(capture): add text fallback`).
     Do NOT add "Co-Authored-By: Claude" or any AI trailer to the commit message.
  9. Push and open a PR with the template-required fields filled in. Reference
     the issue number with `closes #N`.
 10. Stop and let me review before pushing or merging.

Stay focused on the chosen issue. If you spot unrelated improvements, file
them as separate issues — don't pile them into the PR.
```

---

## scripts

From the repo root:

```bash
bun run dev            # start dev server (apps/web on :3210)
bun run typecheck      # tsc --noEmit across workspaces
bun run build          # next build
bun run lint           # next lint
bun run format         # prettier --write
bun run format:check   # prettier --check (CI gate)
```

From `apps/web/`:

```bash
bun run db:generate    # drizzle-kit generate (after schema edits)
bun run db:apply       # apply migrations to current TURSO_DB_URL or local file
bun run db:studio      # open Drizzle Studio in the browser
bun run extract:eval   # run the canonical 5-fixture extractor accuracy suite
bun run test           # vitest run
bun run test:watch     # vitest watch
bun run test:e2e       # playwright (run `bunx playwright install` once first)
bun run cf:build       # opennextjs-cloudflare build (see docs/deploy.md for known issue)
bun run cf:deploy      # wrangler deploy
```

---

## self-host

Wingmic is fully open source. You can run the entire stack on your own infra without touching the hosted version.

Status:

- **v0.1.1** — manual self-host works today (clone, fill env, deploy to your provider). Documented in [docs/deploy.md](docs/deploy.md).
- **v0.5** — single-command `docker-compose up` with BYO API keys is on the roadmap.

The hosted `wingmic.xyz` and the self-host code are **identical** — same repo, same migrations, same secrets. We don't keep a paid SaaS-only fork.

---

## privacy

- **People are private.** Captured people stay scoped to your user. Never shared, never used to enrich anyone else's graph.
- **Companies / events / topics are public facts.** Acme is Acme regardless of who knows about it. The canonical layer is shared across users with no consent surface (because it doesn't need one).
- **Voice transcripts** are sent to Anthropic for extraction. We disclose this in the UI before first capture; you can review the [exact prompt](apps/web/lib/extractor/prompt.ts).
- **Embeddings** are sent to OpenAI (text-embedding-3-small). 1536-d float vectors, no metadata.
- **No analytics on the homepage** by default. Self-host to verify.
- **Magic links** are short-lived (10 min) and single-use.

Read the full ethics + data handling page (in progress at [`/ethics`](docs/ethics.md)).

---

## contributing

PRs are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md) before opening a pull request.

If you're new, look for the [`good first issue`](https://github.com/Ayaan2907/wingmic/labels/good%20first%20issue) label. Each labeled issue includes context, acceptance criteria, and which file(s) to touch.

Bugs go to [issues](https://github.com/Ayaan2907/wingmic/issues). Security to [SECURITY.md](SECURITY.md). Ideas + general questions to [discussions](https://github.com/Ayaan2907/wingmic/discussions).

---

## brand voice

Wingmic has a defined voice. Lowercase confident. One italic-serif twist per heading. Editorial-brutalist + terminal aesthetic. No "powered by," no "seamless," no "cutting-edge." See [`design/design-system.md`](design/design-system.md) for the full reference. Match it in any UI copy.

---

## license

MIT — see [LICENSE](LICENSE).

If you build something on top of wingmic, we'd love to see it — open a discussion or tag [@Ayaan2907](https://github.com/Ayaan2907).
