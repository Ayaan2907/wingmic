# Contributing to wingmic

Thanks for being here. Wingmic is built in public, MIT-licensed, and welcomes contributions of any size.

## ground rules

1. **Be excellent.** Read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). The short version: discuss the code, not the person.
2. **One change per PR.** Smaller PRs are easier to review and ship. If you have a big idea, open an issue or discussion first so we can split it up.
3. **Ship the test.** Code without coverage is half-shipped. We use Vitest for unit tests and Playwright for end-to-end.
4. **Match the voice.** Wingmic has a defined editorial tone. Read [design/design-system.md](design/design-system.md) before changing UI copy or visuals.

## development setup

```bash
git clone https://github.com/wingmic/wingmic.git
cd wingmic
bun install
bun dev               # web at http://localhost:3000
bun run typecheck     # no any, no errors
bun run lint          # fixes most issues automatically
```

Required:

- Node 20+
- Bun 1.1+

Optional, set in `.env.local` to enable extraction during development:

```
ANTHROPIC_API_KEY=sk-...
DEEPGRAM_API_KEY=...
```

## branch + commit conventions

- Branch from `main`. Use `kind/short-name`: `feat/voice-capture`, `fix/graph-z-index`, `docs/contributing`.
- Use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, `perf:`.
- Reference an issue in the body when relevant: `Closes #42`.

## pull request checklist

- [ ] Tests pass locally: `bun test`
- [ ] Typecheck passes: `bun run typecheck`
- [ ] Lint passes: `bun run lint`
- [ ] Screenshots or short clip attached for any visual change
- [ ] Updated `docs/` and `README.md` if behavior changed
- [ ] One focused change per PR

CI runs the same checks on every PR. Green CI is required before merge.

## reporting bugs

Open an issue using the **Bug report** template. Include:

- What you did
- What you expected
- What actually happened
- A reproduction (smallest possible)
- Browser + OS, if relevant

## suggesting features

Open a **Feature request** issue. Describe the user moment, not the implementation. Wingmic is shaped by four wedges (capture, recall, imports, acts) — say which one your idea touches.

## security

Do **not** open public issues for security problems. See [SECURITY.md](SECURITY.md).

## license

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
