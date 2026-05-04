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

## quick start (local dev)

Prerequisites:

- **Bun 1.3+** (`curl -fsSL https://bun.sh/install | bash`)
- **Node 20+**

```bash
# 1. Clone + install
git clone https://github.com/Ayaan2907/wingmic.git
cd wingmic
bun install

# 2. Copy env, fill in keys (see "secrets" below)
cp apps/web/.env.example apps/web/.env.local

# 3. Apply DB schema to a local SQLite file
cd apps/web && bun run db:apply

# 4. Start the dev server
bun run dev
# → http://localhost:3210
```

For local dev the only **required** env vars are `ANTHROPIC_API_KEY` and `OPENAI_API_KEY`. The rest fall back to safe defaults (file-based libSQL, console-logged magic links). See [docs/deploy.md](docs/deploy.md) for the full table.

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
