# Railway deploy runbook — `apps/app` (evidence-based)

This document is the **operator source of truth** for deploying the wingmic product (`apps/app`) on Railway. Every dashboard instruction below is tied to official Railway, Railpack, or Turborepo documentation — not trial-and-error fixes.

**Related:** [deploy.md](./deploy.md) (secrets, Turso, domains) · [CONTRIBUTING.md](../CONTRIBUTING.md) (release flow)

---

## 1. How the three layers fit together

| Layer | What it does | Official docs |
|---|---|---|
| **Railway** | Connects GitHub, chooses build context (root directory), runs Railpack, injects service variables at build + runtime, deploys container | [Build configuration](https://docs.railway.com/builds/build-configuration) |
| **Railpack** | Zero-config builder (successor to Nixpacks on Railway): detects Node/Bun, runs install → build → start | [Railpack on Railway](https://docs.railway.com/builds/build-configuration#railpack) · [Node.js](https://railpack.com/languages/node/) |
| **Turborepo** | Runs only during the **build** step via `bun run build:app`; builds workspace packages (`^build`) then Next.js | [Constructing CI](https://turbo.build/repo/docs/crafting-your-repository/constructing-ci) · [Filtering](https://turbo.build/repo/docs/crafting-your-repository/constructing-ci#filtering-for-entry-points) |

Railway does **not** run Turbo directly. Railpack runs your shell command; that command invokes Turbo.

```text
GitHub push
    → Railway clones repo (per Root Directory setting)
    → Railpack v0.23.x (builder from railway.json)
        → install: bun install (auto when bun.lock + workspaces visible)
        → build:  bun run build:app  (from railpack.json)
                    → turbo build --filter=@wingmic/app  (from package.json)
        → pre-deploy: sh scripts/predeploy-migrate.sh  (from railway.json)
                    → bun run db:apply  (Drizzle migrations → Turso)
        → deploy: bun run start:app  (from railpack.json)
                    → next start -p $PORT  (apps/app)
```

---

## 2. Monorepo type (critical for Root Directory)

wingmic is a **shared monorepo**: workspaces in root `package.json`, packages under `apps/*` and `packages/*`, shared `bun.lock`.

| Monorepo type | Root Directory on Railway | wingmic |
|---|---|---|
| **Isolated** (no shared code between services) | Set to subdir, e.g. `/frontend`, `/backend` | ❌ Not this repo |
| **Shared** (workspaces, shared packages) | **Leave empty** (repo root `/`) | ✅ **This repo** |

**Official sources:**

- Railway — [Deploying a monorepo (isolated)](https://docs.railway.com/guides/deploying-a-monorepo): subdirectory roots for apps that do not share code.
- Railway — [Monorepo deployments](https://docs.railway.com/deployments/monorepo): shared monorepos; config file path is absolute from repo root.
- Railpack — [Monorepo support](https://railpack.com/languages/node/#monorepo-support): detects `workspaces` in root `package.json`; build/start scripts should be defined at root or in `railpack.json`.

**If Root Directory = `apps/app`:** Railway copies only that folder. `bun.lock`, `packages/*`, and workspace roots are missing → Railpack cannot detect Bun → defaults to `npm install` → fails with `EUNSUPPORTEDPROTOCOL workspace:*`.

**If Root Directory is empty:** Full repo is build context → logs show `Found workspace with 9 packages` and `Using bun package manager`.

---

## 3. Repo config files (current)

These files live at the **repository root**. Railway’s config file path does **not** follow Root Directory ([Build configuration — Set the root directory](https://docs.railway.com/builds/build-configuration#set-the-root-directory)).

### `railway.json`

```json
{
  "build": { "builder": "RAILPACK" },
  "deploy": {
    "preDeployCommand": ["sh scripts/predeploy-migrate.sh"],
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

| Field | Purpose |
|---|---|
| `build.builder` | Selects **Railpack** (not Nixpacks). Railway: [Railpack](https://docs.railway.com/builds/build-configuration#railpack). |
| `deploy.preDeployCommand` | Runs `bun run db:apply` against `TURSO_*` before the app starts ([pre-deploy command](https://docs.railway.com/deployments/pre-deploy-command)). Failed migration blocks deploy. |
| `deploy.healthcheckPath` | Railway HTTP health check after deploy |

Does **not** define install/build/start commands — those come from `railpack.json` (and Railpack auto-detection).

### `railpack.json`

```json
{
  "$schema": "https://schema.railpack.com",
  "steps": {
    "build": { "commands": ["bun run build:app"] }
  },
  "deploy": { "startCommand": "bun run start:app" }
}
```

| Field | Purpose | Doc reference |
|---|---|---|
| `steps.build.commands` | Overrides default build (root `package.json` has `"build": "turbo build"` which would build everything) | [Config file — steps](https://railpack.com/config/file/#steps) |
| `deploy.startCommand` | Container start command | [Config file — deploy](https://railpack.com/config/file/#deploy) |

**Install step is intentionally omitted.** Railpack auto-detects Bun from `bun.lock` + `packageManager` ([Package managers — lock files](https://railpack.com/languages/node/#package-managers)).

**Do not add** `"install": { "inputs": ["."] }` — Railpack rejects it: `install inputs must be an image or step input` ([Layers](https://railpack.com/config/file/#layers): first install input must be image or step, not a bare `"."` local shortcut).

**Invalid (removed):** `railpack.toml` with `[nodejs] installCommand` — not part of the [railpack.json schema](https://schema.railpack.com).

### `package.json` (root scripts)

| Script | Command | Role on Railway |
|---|---|---|
| `build:app` | `turbo build --filter=@wingmic/app --env-mode=loose` | Invoked by Railpack build step |
| `start:app` | `bun --filter @wingmic/app start` | Invoked by Railpack deploy |

`packageManager: "bun@1.3.10"` — used by Railpack/Corepack when `packageManager` field triggers Corepack ([Package managers](https://railpack.com/languages/node/#package-managers)).

### `turbo.json`

```json
"build": {
  "dependsOn": ["^build"],
  "outputs": ["dist/**", ".next/**", "!.next/cache/**", "out/**"]
}
```

`build:app` runs `@wingmic/app` build **after** dependency packages (`@wingmic/db`, `@wingmic/extractor`, etc.) because of `dependsOn: ["^build"]`. Turbo: [Running tasks in CI](https://turbo.build/repo/docs/crafting-your-repository/constructing-ci#running-tasks-in-ci) — same graph locally and in Railpack.

### `nixpacks.toml` (fallback only)

Only used if the service is still on **Nixpacks**. Current Railway default builder for new services is **Railpack**. If logs say `using build driver nixpacks`, switch builder in dashboard or ensure `railway.json` is loaded.

---

## 4. Railway dashboard — exact settings

Open: **Project → `wingmic-app` service → Settings** (and **Variables** for secrets).

### 4.1 Required settings

| UI location | Field | Value | Why (doc) |
|---|---|---|---|
| **Settings → Source** | Connected repo | `Ayaan2907/wingmic` | — |
| **Settings → Source** | Branch | `staging` or `main` per environment | — |
| **Settings → Source** | **Root Directory** | **Leave empty** | [Shared monorepo](https://docs.railway.com/deployments/monorepo); subdir root excludes `bun.lock` / `packages/` |
| **Settings → Build** | **Builder** | **Railpack** | [Railpack](https://docs.railway.com/builds/build-configuration#railpack); logs: `using build driver railpack-v0.23.0` |
| **Settings → Build** | **Config file path** | `railway.json` | At repo root; [does not follow Root Directory](https://docs.railway.com/builds/build-configuration#set-the-root-directory) — use `/railway.json` only if UI requires absolute path |
| **Settings → Build** | **Custom build command** | **Empty** | Commands come from `railpack.json`; Railway: [Customize build command](https://docs.railway.com/builds/build-configuration#customize-the-build-command) overrides *detected* build, conflicts with config file |
| **Settings → Deploy** | **Custom start command** | **Empty** | `railpack.json` → `deploy.startCommand` |
| **Variables** | Runtime secrets | Doppler → Railway sync or manual | See [deploy.md § Product](./deploy.md#-product-deploy-appwingmicxyz); canonical names in `apps/app/lib/config/env.ts` |

### 4.2 Optional but recommended

| Field | Value |
|---|---|
| **Watch paths** | `apps/app/**`, `packages/**`, `bun.lock`, `package.json`, `railpack.json`, `railway.json`, `turbo.json` |
| **Health check** | Path `/api/health` (also in `railway.json`) — not an auth route; `/api/auth/get-session` needs DB and may 404 if misnamed |

### 4.3 Do not set (common mistakes)

| Field | Wrong value | Result |
|---|---|---|
| Root Directory | `apps/app` | `npm install`, `workspace:*` error |
| Custom build command | `cd ../.. && bun ...` | Fights `railpack.json`; wrong when root is already repo root |
| Builder | Nixpacks (stale) | `npm i` on Bun workspace |
| `railpack.json` install | `"inputs": ["."]` | `install inputs must be an image or step input` |

### 4.4 GitHub

**No GitHub repository settings are required** for Railway build fix beyond:

- Railway GitHub app installed on `Ayaan2907/wingmic`
- Branch you deploy (`staging` / `main`) contains root `railway.json`, `railpack.json`, `bun.lock`

GitHub Actions CI is separate; it does not replace Railway’s builder.

---

## 5. Doppler + Railway

| Environment | Secret injection | Build uses secrets? |
|---|---|---|
| **Local** | `doppler run -- bun run dev:doppler` | Optional |
| **Railway** | Variables tab or Doppler ↔ Railway integration | Yes for `next build` if auth/DB modules load at build time; set `BETTER_AUTH_SECRET` etc. on Railway |

Railway does **not** run `doppler run` in the container. Sync secrets into Railway Variables per environment (`dev` / `stg` / `prd` configs).

---

## 6. Verify a successful build (log checklist)

After deploy, build logs should include **all** of:

| # | Log line | Meaning |
|---|---|---|
| 1 | `using build driver railpack-v0.23.0` | Railpack active ([Railway Railpack](https://docs.railway.com/builds/build-configuration#railpack)) |
| 2 | `Using config file railpack.json` | Root config found ([Railpack config file](https://railpack.com/config/file/)) |
| 3 | `Using bun package manager` | Bun detected ([lock files](https://railpack.com/languages/node/#package-managers)) |
| 4 | `Found workspace with N packages` | Monorepo root correct (N ≈ 9 for wingmic) |
| 5 | Install step: `bun install` (not `npm install`) | — |
| 6 | Build step: `bun run build:app` | `railpack.json` |
| 7 | Turbo tasks for `@wingmic/db`, `@wingmic/extractor`, `@wingmic/app` | `turbo.json` `^build` |
| 8 | Pre-deploy: `[migrate] applying migrations to libsql://…` then `[migrate] done` | `railway.json` → `preDeployCommand` |
| 9 | Deploy: `bun run start:app` | `railpack.json` |

---

## 7. Failure modes (symptom → cause → fix)

### 7.1 `npm error Unsupported URL Type "workspace:": workspace:*`

| | |
|---|---|
| **Log** | `Using npm package manager` or install step `npm install` |
| **Cause** | Root Directory = `apps/app`, or no `bun.lock` in build context |
| **Fix** | Clear Root Directory; redeploy |
| **Source** | [Railpack package managers](https://railpack.com/languages/node/#package-managers); [Railway root directory](https://docs.railway.com/builds/build-configuration#set-the-root-directory) |

### 7.2 `install inputs must be an image or step input`

| | |
|---|---|
| **Log** | `✖ install inputs must be an image or step input` after `Using config file railpack.json` |
| **Cause** | Invalid `railpack.json`: `"install": { "inputs": ["."] }` |
| **Fix** | Remove custom `install` block; let Railpack auto-install with Bun |
| **Source** | [Railpack layers](https://railpack.com/config/file/#layers) |

### 7.3 `No package manager inferred, using npm default`

| | |
|---|---|
| **Log** | `INFO No package manager inferred, using npm default` |
| **Cause** | Partial repo copy (subdir root) or missing `bun.lock` in install layer |
| **Fix** | Empty Root Directory; ensure `bun.lock` committed at repo root |
| **Source** | [Railpack — lock file detection](https://railpack.com/languages/node/#package-managers) |

### 7.4 `using build driver nixpacks`

| | |
|---|---|
| **Log** | `using build driver nixpacks-v1.x` |
| **Cause** | Builder not Railpack, or `railway.json` not loaded |
| **Fix** | Set Builder = Railpack; Config file = `railway.json` at repo root |
| **Source** | [Railway Railpack](https://docs.railway.com/builds/build-configuration#railpack) |

### 7.6 `no such table: …` at runtime

| | |
|---|---|
| **Log** | libSQL / Drizzle error referencing a missing table (e.g. `act`) |
| **Cause** | Deploy ran before `preDeployCommand` landed, or pre-deploy failed/skipped (missing `TURSO_*`) |
| **Fix** | Check deploy log pre-deploy phase; run `bun run db:apply` once with staging/prod `TURSO_*`; redeploy so automated step runs |
| **Source** | `packages/db/drizzle/`, `scripts/predeploy-migrate.sh` |

### 7.5 Build succeeds but runtime 500 / auth errors

| | |
|---|---|
| **Cause** | Missing Railway Variables (`BETTER_AUTH_SECRET`, `TURSO_*`, `OPENROUTER_API_KEY`, etc.) |
| **Fix** | Variables tab; align with `apps/app/lib/config/env.ts` |
| **Source** | App code, not builder docs |

---

## 8. Override hooks (optional, doc-backed)

Railway service variables ([Railpack on Railway](https://docs.railway.com/builds/build-configuration#install-specific-packages-using-railpack)):

| Variable | Use |
|---|---|
| `RAILPACK_INSTALL_CMD` | Override install command ([Specify custom install](https://docs.railway.com/builds/build-configuration#specify-a-custom-install-command)) — only if auto-detect fails |
| `RAILPACK_BUN_VERSION` | Pin Bun ([Config variables](https://railpack.com/languages/node/#config-variables)) |
| `RAILPACK_NODE_VERSION` | Pin Node for native modules |

Prefer repo `railpack.json` + empty Root Directory before adding these.

---

## 9. Local parity commands

Simulate what Railpack runs (from repo root):

```bash
bun install --frozen-lockfile
bun run build:app
TURSO_DB_URL="file:$(pwd)/packages/db/local.db" bun run db:apply   # local only
bun run start:app
```

---

## 10. Document changelog

| Date | Change |
|---|---|
| 2026-08-10 | Pre-deploy Drizzle migrations via `railway.json` `preDeployCommand` (closes #89) |
| 2026-05-26 | Initial evidence-based runbook; maps Railway UI to Railpack + Turbo; documents failures seen in production logs |
