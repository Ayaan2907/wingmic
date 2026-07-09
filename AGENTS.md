# AGENTS.md

## Cursor Cloud specific instructions

Bun/Turborepo monorepo (`apps/web` landing, `apps/app` product, `packages/*`).
The full command list lives in `CLAUDE.md` ("helpful agent commands"); this
section only records non-obvious caveats for running things in the cloud VM.

### Toolchain
- Package manager is **Bun 1.3.10** (pinned via `.bun-version` + `packageManager`).
  It is installed at `~/.bun/bin/bun` and symlinked to `/usr/local/bin/bun`, so
  it is on `PATH` in fresh shells. Node 22 is present but Bun runs everything.
- The startup update script runs `bun install --frozen-lockfile`. `predev`/`prebuild`
  hooks copy brand assets into each app's `public/`, so no manual asset step is needed.

### Local database (non-obvious gotcha)
- The libSQL URL defaults to a **relative** path `file:./local.db`, resolved from
  the process cwd. `bun run db:apply` runs inside `packages/db`, so a plain run
  writes `packages/db/local.db` — but `apps/app` runs with cwd `apps/app` and reads
  `apps/app/local.db`. They are different files.
- To (re)create the DB the product app actually uses, apply migrations with an
  absolute URL pointing at the app:
  `TURSO_DB_URL="file:/workspace/apps/app/local.db" bun run db:apply`
- `apps/app/local.db` is git-ignored and lives only in the VM/snapshot; recreate it
  with the command above if it is missing before running the app.

### Running with no secrets
- The app boots with **zero secrets**: `apps/app/lib/config/env.ts` makes every var
  optional/defaulted (empty strings are stripped). TURSO defaults to the local file DB.
- **Magic-link auth works without email keys**: when `RESEND_API_KEY` is unset, the
  sign-in URL is printed to the dev-server console (`[wingmic auth] ... magic link for <email>: <url>`).
  Grab it from the `bun run dev` output to complete login.
- Feature-gated external keys (not needed to boot): `ASSEMBLYAI_API_KEY` (voice
  transcription at `/api/capture/transcribe`) and `OPENROUTER_API_KEY` (entity
  extraction, embeddings, recall). Missing keys only fail those specific features.

### Ports / health
- `apps/app` → `:3211`, `apps/web` → `:3210`. Liveness: `GET http://localhost:3211/api/health` → `{"status":"ok"}`.
