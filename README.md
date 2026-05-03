<div align="center">

# wingmic

**your social RAM, on disk**

Voice-first networking memory. Speak after you meet someone. Wingmic extracts the people, companies, events, and follow-ups, and builds a graph you can actually query.

[![License: MIT](https://img.shields.io/badge/License-MIT-FFC452.svg)](LICENSE)
[![Status](https://img.shields.io/badge/status-v0.1--beta-FFC452.svg)](https://github.com/wingmic/wingmic/releases)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-86efac.svg)](CONTRIBUTING.md)

</div>

---

## the handshake memory leak

You meet 12 people at a conference. By day's end you remember 3 names, 1 company, and zero context. Your brain's RAM got garbage-collected.

Wingmic is the tool you open right after you meet someone. Voice-dump the context, commit to your memory graph, never forget a connection again.

## what it does

```ts
// you, after a meetup, into your phone
"met sarah from acme, rust lead, she liked my edge worker repo,
 send her the link tomorrow morning"

// wingmic
✓ committed to graph
  → person: Sarah Chen (Lead Developer @ Acme)
  → event:  DevConnect 2026
  → topics: rust, edge workers
  → action: send github.com/me/edge-workers — tomorrow 9:00am

// three weeks later
> who do I know that ships rust?
↪ found 4 matches in 0.3s
   sarah chen   · acme corp     · met devconnect
   marcus webb  · solo          · met js conf
   priya patel  · cloudflare    · referred by lina
   alex rivera  · vercel        · met online
```

## status

`v0.1.0-beta` — homepage live. Beta access in waves of 50. Code is open, product is in active build.

## the four wedges

Wingmic is built around four moments. Each is a feature you can use independently:

1. **Capture** — voice in, structured graph out. Browser SpeechRecognition by default; Deepgram / AssemblyAI when you bring a key.
2. **Recall** — natural-language search across people, companies, events, topics. "who in NY ships rust?"
3. **Imports** — pull your existing contacts (LinkedIn export, Google contacts, vCard) and let wingmic enrich them as you talk about them over time.
4. **Acts** — agent drafts the follow-up email, the check-in, the intro. You review and send. Permission-first, never auto-sends.

Read the [design system](design/design-system.md) for the editorial-brutalist + terminal aesthetic and the full token reference.

## stack

| | |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript |
| Styling | Tailwind v4 with hand-tuned design tokens |
| Database | SQLite (dev) → Postgres (prod) via Prisma |
| Extraction | Anthropic Claude (Sonnet 4.6) with Zod schemas |
| Speech | Browser SpeechRecognition + Deepgram (BYO key) |
| Graph viz | `react-force-graph-2d` + Canvas |
| Tooling | Bun, Turborepo, Biome, Prettier |

## monorepo layout

```
apps/
  web/             # Next.js homepage + app
packages/
  ui/              # design tokens, shared components
  extractor/       # Claude prompts + Zod schemas (planned)
  db/              # Prisma schema + migrations (planned)
design/            # design system + canonical HTML mocks
docs/              # architecture, self-hosting, ADRs
```

## getting started

```bash
git clone https://github.com/wingmic/wingmic.git
cd wingmic
bun install
bun dev
# → http://localhost:3000
```

## contributing

Issues, PRs, and discussions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md) before opening a PR.

If you're looking for a place to start, check the [`good first issue`](https://github.com/wingmic/wingmic/labels/good%20first%20issue) label.

## privacy

Wingmic is built privacy-first. The hosted service stores your graph encrypted and never trains on your data. You can self-host the entire stack if you prefer (planned: Docker Compose + BYO API keys).

Read [SECURITY.md](SECURITY.md) for the responsible disclosure policy.

## license

MIT — see [LICENSE](LICENSE).
