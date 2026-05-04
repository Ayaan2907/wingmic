# Contributing to wingmic

Thanks for being here. Wingmic is built in public, MIT-licensed, and welcomes contributions of any size — bug fixes, features, docs, design feedback, brand-voice nits.

This guide covers everything you need to ship a clean PR.

---

## ground rules

1. **Be excellent.** Read the [Code of Conduct](CODE_OF_CONDUCT.md). Discuss the code, not the person.
2. **One change per PR.** Smaller PRs review faster and ship faster. Big idea? Open an issue or discussion first so we can split it up.
3. **Ship the test.** New code path → new test. Bug fix → regression test. Vitest for units, Playwright for E2E.
4. **Match the voice.** Wingmic has a defined editorial-brutalist tone. Read [`design/design-system.md`](design/design-system.md) before changing UI copy or visuals.
5. **Don't break the build.** CI runs typecheck, lint, vitest, and `next build` on every PR. Run them locally first.

---

## quick start

```bash
git clone https://github.com/Ayaan2907/wingmic.git
cd wingmic
bun install

# Required for local dev
cp apps/web/.env.example apps/web/.env.local
# fill in ANTHROPIC_API_KEY and OPENAI_API_KEY at minimum

bun run dev   # → http://localhost:3210
```

Required:

- **Bun 1.3+** (`curl -fsSL https://bun.sh/install | bash`)
- **Node 20+**

See [`docs/deploy.md`](docs/deploy.md) for how to acquire each API key.

---

## branch + commit conventions

### branches

Branch from `main`. Use `kind/short-name`:

```
feat/voice-capture
fix/graph-z-index
docs/contributing-rewrite
chore/bump-drizzle
refactor/split-homeclient
```

Kinds we use: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`.

### commits

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(capture): add hold-to-talk haptic feedback
fix(extractor): handle empty transcript without crashing
docs(deploy): clarify Turso token rotation
```

Reference an issue in the body when relevant: `Closes #42`.

Wingmic's brand voice extends to commit messages — lowercase confident, no AI vocabulary. **Do not** include "Co-Authored-By: Claude" or any AI co-author trailer in commits or PR descriptions.

---

## pull request checklist

Before opening:

- [ ] Branched from `main`
- [ ] One focused change
- [ ] Tests added or updated (Vitest or Playwright)
- [ ] `bun run typecheck` exits 0
- [ ] `bun --filter @wingmic/web lint` clean
- [ ] `bun run test` (unit) passes
- [ ] `bun run build` succeeds
- [ ] Screenshots / short clip attached for any visual change
- [ ] Updated `docs/` and `README.md` if behavior changed

CI re-runs all of the above. Green CI is required before merge.

---

## architecture cheat sheet

Wingmic's data model is **Framing D**: per-kind identity. People are private to each user. Companies, events, and topics are canonical (shared) with lazy promotion. Read [`docs/architecture.md`](docs/architecture.md) before touching the schema.

```
       canonical (shared)              user layer (private)
       ───────────────────             ──────────────────────────
        company  ─── wikidata-like      user
        event   ─── public facts       │  └── identity_claim
        topic   ─── shared vocab       │
                                       entity (kind=person, owner-scoped)
                                       │  ├── entity_company  ──→ company
                                       │  ├── entity_event    ──→ event
                                       │  ├── entity_topic    ──→ topic
                                       │  ├── entity_fact     (key/value + embedding)
                                       │  └── entity_note     (free-form, owner-scoped)
                                       interaction (transcript + embedding)
```

The flow on a capture:

```
voice → SpeechRecognition → transcript
       → Vercel AI SDK generateObject(Claude, schema)
       → ExtractionResult { persons[], companies[], events[], topics[], actions[] }
       → resolution.ts (deterministic):
            upsert canonical Company / Event / Topic (lazy promotion)
            score Person against owner's entities (name + embedding cosine + companyHint)
            link if score ≥ 0.85, create new otherwise
       → persist Interaction with full embedding
       → wire EntityCompany / EntityEvent / EntityTopic edges
       → return CommitResult to the client
```

Recall uses the inverse: embed the query → cosine over the user's entities → hydrate edges → return ranked results. v0.1.1 is in-memory cosine; v0.2 swaps to libSQL `vector_top_k(idx, vector, k)`.

---

## what to work on

Issues are tagged for findability:

- [`good first issue`](https://github.com/Ayaan2907/wingmic/labels/good%20first%20issue) — small, contained, well-specified. Best place to start.
- [`help wanted`](https://github.com/Ayaan2907/wingmic/labels/help%20wanted) — bigger but well-scoped, mentor available.
- [`bug`](https://github.com/Ayaan2907/wingmic/labels/bug) — confirmed defects.
- [`enhancement`](https://github.com/Ayaan2907/wingmic/labels/enhancement) — feature requests, mapped to the four wedges.
- [`design`](https://github.com/Ayaan2907/wingmic/labels/design) — UI / brand-voice work, see `design/design-system.md`.

Wedge labels: `wedge:capture`, `wedge:recall`, `wedge:imports`, `wedge:acts`. Use the matching label so we can track surface-area progress.

If you have a bigger idea: open a [discussion](https://github.com/Ayaan2907/wingmic/discussions) first. We'll talk through it before you commit time.

---

## reporting bugs

Open a [bug report](https://github.com/Ayaan2907/wingmic/issues/new?template=bug_report.yml). Include:

- What you did
- What you expected
- What actually happened
- A reproduction (smallest possible)
- Browser + OS (especially helpful for SpeechRecognition issues — iOS Safari has known quirks)
- Console logs / network errors if relevant

---

## suggesting features

Open a [feature request](https://github.com/Ayaan2907/wingmic/issues/new?template=feature_request.yml). Frame it as a **user moment**, not an implementation:

> ✅ "When I'm at a conference and someone hands me a business card, I want to..."
>
> ❌ "Add a CSV import endpoint"

Tell us which wedge it touches (capture / recall / imports / acts / cross-cutting).

---

## design contributions

Visual / UX changes follow the same PR flow with one extra: include before/after screenshots **and** a one-paragraph rationale tied to the design system. If your change touches `design/`, include the export from your tool of choice.

The brand floor:

- Dark warm bg (`#0a0a0a` + warm radials, never pure black)
- Inter / Instrument Serif italic / JetBrains Mono
- Amber `#FFC452` accent
- One italic-serif twist per major heading
- No emoji in product chrome

---

## working with AI assistants

We use AI tooling internally to draft code. That's fine — but:

- **Test what AI writes.** AI hallucinates types, regex, and SQL. The test suite is the only proof.
- **No AI co-author trailers** on commits or PR descriptions. Authorship is the human committer's.
- **AI-generated docs** must be reviewed for the brand voice — no "delve," "robust," "comprehensive," etc.

---

## release process

Maintainer-only:

1. Land all PRs targeting the milestone.
2. Run `bun run extract:eval` — must hit ≥ 85% accuracy.
3. Bump version in root `package.json` and `apps/web/package.json`.
4. Tag: `git tag v0.x.y && git push --tags`
5. Cut a GitHub Release with a changelog summarizing PRs since the last tag.
6. Deploy: `cd apps/web && bun run cf:deploy`
7. Post launch update on the [project board](https://github.com/Ayaan2907/wingmic/projects).

---

## security

Do **not** open public issues for security problems. See [SECURITY.md](SECURITY.md).

---

## license

By contributing, you agree your contribution is licensed under [MIT](LICENSE).

---

If anything in this doc is wrong, outdated, or unclear — open a PR. The first contribution to wingmic is the README/CONTRIBUTING fix you're tempted to leave alone.
