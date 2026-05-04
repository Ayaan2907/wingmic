# deploy

wingmic ships on cloudflare workers + libsql/turso. the build pipeline uses `@opennextjs/cloudflare` to package the next.js 15 app for the workerd runtime.

## prerequisites

- a [cloudflare](https://dash.cloudflare.com) account
- a [turso](https://turso.tech) account with one db
- a [resend](https://resend.com) account + verified sender domain
- an [anthropic](https://console.anthropic.com) api key
- an [openai](https://platform.openai.com) api key

## 1. create the production database

```bash
turso db create wingmic-prod
turso db tokens create wingmic-prod
```

apply the schema:

```bash
TURSO_DB_URL=libsql://wingmic-prod-<your-org>.turso.io \
TURSO_AUTH_TOKEN=eyJ... \
bun run db:apply
```

## 2. set production secrets on cloudflare

via dashboard (workers & pages → wingmic → settings → variables) or cli:

```bash
cd apps/web
bunx wrangler secret put TURSO_DB_URL
bunx wrangler secret put TURSO_AUTH_TOKEN
bunx wrangler secret put BETTER_AUTH_SECRET     # openssl rand -base64 48
bunx wrangler secret put BETTER_AUTH_URL        # https://wingmic.xyz
bunx wrangler secret put RESEND_API_KEY
bunx wrangler secret put RESEND_FROM            # wingmic <auth@wingmic.xyz>
bunx wrangler secret put ANTHROPIC_API_KEY
bunx wrangler secret put OPENAI_API_KEY
```

## 3. build + deploy

from `apps/web/`:

```bash
bun run cf:build      # opennextjs-cloudflare build → .open-next/
bun run cf:deploy     # wrangler deploy → live on the workers domain
```

first deploy creates the worker. point your domain at it via cloudflare dashboard → workers & pages → wingmic → custom domains → add `wingmic.xyz`.

## 4. preview locally with the workerd runtime

```bash
bun run cf:build
bun run cf:preview    # spins up workerd locally; uses .dev.vars for secrets
```

create `.dev.vars` in `apps/web/` (gitignored) for local preview env:

```
TURSO_DB_URL=...
TURSO_AUTH_TOKEN=...
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=http://localhost:8787
RESEND_API_KEY=...
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
```

## known issue: monorepo + @libsql/client bundling

`bun run cf:build` currently fails when esbuild tries to resolve `@libsql/client` from the deeply-nested `.open-next/server-functions/...` path inside this bun-workspaces monorepo. workaround paths under evaluation:

1. add `@libsql/client` to `dangerous.external` in `open-next.config.ts` and inline-bundle libsql via a separate esbuild pass — preserves the bun workspace layout.
2. flatten apps/web out of workspaces temporarily for deploy builds — fastest to ship, worst architecturally.
3. wait for an upstream fix in `@opennextjs/cloudflare` for bun-workspaces (tracked: https://github.com/opennextjs/opennextjs-cloudflare/issues — search "monorepo libsql").

until resolved, `bun run cf:deploy` is **manual-only**: build via `bun run build` (works), then `bunx wrangler deploy` against a hand-assembled worker, or deploy via vercel as an interim. local dev (`bun run dev`) is unaffected.

## 5. local development

```bash
cp .env.example .env.local
# fill in keys; for local dev TURSO_DB_URL=file:./local.db works
bun run db:apply
bun run dev
# → http://localhost:3210
```

## troubleshooting

### "module not found" after dependency change

```bash
rm -rf .next .open-next
bun install
bun run build
```

### libsql / turso connection errors at runtime

- verify `TURSO_DB_URL` and `TURSO_AUTH_TOKEN` are set on the deployment env
- check the migration ran against the correct database (`turso db shell wingmic-prod` → `.tables`)
- check turso usage limits

### betterauth session not persisting

- `BETTER_AUTH_SECRET` must be set and stable across deploys
- `BETTER_AUTH_URL` must match the deployed origin exactly (https, no trailing slash)
- middleware cookie names: `better-auth.session_token` (dev) or `__Secure-better-auth.session_token` (prod over https)

### extraction returning empty results

- verify `ANTHROPIC_API_KEY` is set on the deployment env
- verify the model name in `lib/extractor/client.ts` matches an active model (default: `claude-sonnet-4-6`)
- run `bun run extract:eval` against the canonical fixtures locally before debugging anything else
