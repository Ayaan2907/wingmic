# deploy

Wingmic ships on **Cloudflare Workers + libSQL/Turso** via `@opennextjs/cloudflare`. This guide takes you from a freshly-cloned repo to a live deployment, end-to-end, with no prior context assumed.

If you're just running locally for dev, jump to [§ 6 local development](#6-local-development).

---

## table of contents

1. [The 8 secrets you need](#1-the-8-secrets-you-need)
2. [Acquire each secret](#2-acquire-each-secret)
3. [Set up the production database (Turso)](#3-set-up-the-production-database-turso)
4. [Set secrets on Cloudflare](#4-set-secrets-on-cloudflare)
5. [Build + deploy](#5-build--deploy)
6. [Local development](#6-local-development)
7. [Custom domain](#7-custom-domain)
8. [Troubleshooting](#8-troubleshooting)
9. [Known issues](#9-known-issues)

---

## 1. the 8 secrets you need

Wingmic v0.1.1 needs exactly 8 environment variables to run in production. Here's the full table — keep it open while you work through § 2.

| Variable | What it is | How to get it | Required? |
|---|---|---|---|
| `TURSO_DB_URL` | URL of your libSQL/Turso database | [Turso CLI](#21-turso) | ✅ |
| `TURSO_AUTH_TOKEN` | Token to read/write your Turso DB | [Turso CLI](#21-turso) | ✅ |
| `BETTER_AUTH_SECRET` | 32+ byte random string for session signing | [openssl](#22-betterauth-secret) | ✅ |
| `BETTER_AUTH_URL` | The deployed origin (no trailing slash) | You set this | ✅ |
| `RESEND_API_KEY` | Sends magic-link emails | [Resend dashboard](#23-resend) | ✅ |
| `RESEND_FROM` | Sender display + address | After domain verified at Resend | ✅ |
| `ANTHROPIC_API_KEY` | Claude extraction calls | [Anthropic console](#24-anthropic) | ✅ |
| `OPENAI_API_KEY` | Embedding calls (text-embedding-3-small) | [OpenAI platform](#25-openai) | ✅ |

Optional:

| Variable | Default | When to override |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://wingmic.xyz` | If you self-host on your own domain |
| `ANTHROPIC_EXTRACTION_MODEL` | `claude-sonnet-4-6` | Try a different Claude model |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` | Try a different embedding model |

---

## 2. acquire each secret

### 2.1. Turso

[Turso](https://turso.tech) is the libSQL host. Free tier covers v0.1-beta scale (millions of rows, 9 GB storage, generous request count).

```bash
# Install the CLI (macOS / Linux)
curl -sSfL https://get.tur.so/install.sh | bash
turso auth login

# Create the database (pick a region close to your users)
turso db create wingmic-prod --location iad     # us-east
# or  --location lhr (London), --location nrt (Tokyo), etc.
# `turso db locations` lists all options.

# Get the URL
turso db show wingmic-prod --url
# → libsql://wingmic-prod-<your-org>.turso.io

# Generate a long-lived auth token (default = 7 days; use --expiration=none for no expiry)
turso db tokens create wingmic-prod --expiration none
# → eyJhbGciOiJF...
```

Save the URL as `TURSO_DB_URL` and the token as `TURSO_AUTH_TOKEN`.

> **Token rotation:** if you suspect compromise, run `turso db tokens invalidate wingmic-prod` then create a new one and update Cloudflare secrets. Sessions persist across rotations because they're sealed with `BETTER_AUTH_SECRET`.

### 2.2. BetterAuth secret

This signs session cookies. **Treat it like a password.** Anyone with this can mint sessions for any user.

```bash
openssl rand -base64 48
# → 64-char random string
```

Save as `BETTER_AUTH_SECRET`. Don't rotate this casually — rotating invalidates every active session.

### 2.3. Resend

[Resend](https://resend.com) sends the magic-link emails. Free tier = 3,000 emails/month, 100/day. Plenty for v0.1-beta.

1. Sign up at [resend.com/signup](https://resend.com/signup).
2. **Verify a sending domain.** Magic links won't deliver reliably from `onboarding@resend.dev`. You need a domain you control.
   - Add your domain at [resend.com/domains](https://resend.com/domains)
   - Add the 4 DNS records they show (SPF, DKIM, DMARC) at your registrar
   - Wait ~5 minutes, click "Verify"
3. Create an API key at [resend.com/api-keys](https://resend.com/api-keys). Choose **"Sending access"** (read-write isn't needed).
4. Save the key as `RESEND_API_KEY`.
5. Save your sender as `RESEND_FROM` in the format:
   ```
   wingmic <auth@your-domain.com>
   ```

### 2.4. Anthropic

[Anthropic](https://console.anthropic.com) provides Claude. We use **Claude Sonnet 4.6** for extraction; the cost is ~$0.003 per 1k input tokens, ~$0.015 per 1k output. A typical capture is ~500 tokens in / ~300 out → **~$0.005 per capture**.

1. Sign up at [console.anthropic.com](https://console.anthropic.com).
2. Add a payment method.
3. Set a monthly limit (recommended: $20 for early beta — far above expected usage).
4. Create an API key at **Settings → API Keys → Create Key**.
5. Save as `ANTHROPIC_API_KEY`.

> **Cost monitoring:** the Anthropic console shows real-time usage. The first 50 captures usually cost under $0.50.

### 2.5. OpenAI

[OpenAI](https://platform.openai.com) provides the embedding model. **text-embedding-3-small** at $0.02 per 1M tokens — basically free at v0.1-beta scale.

1. Sign up at [platform.openai.com/signup](https://platform.openai.com/signup).
2. Add a payment method (required even for the cheap embedding endpoint).
3. Set a usage limit (recommended: $5/month).
4. Create an API key at **Dashboard → API keys → Create new secret key**.
5. Restrict the key to **embeddings** only (Permissions → Restricted → only `text-embedding-3-small`).
6. Save as `OPENAI_API_KEY`.

---

## 3. set up the production database (Turso)

With `TURSO_DB_URL` and `TURSO_AUTH_TOKEN` from § 2.1, apply the schema:

```bash
cd apps/web

TURSO_DB_URL=libsql://wingmic-prod-<your-org>.turso.io \
TURSO_AUTH_TOKEN=eyJ... \
bun run db:apply

# Expected output:
#   [migrate] applying migrations to libsql://...
#   [migrate] done
```

Verify the tables landed:

```bash
turso db shell wingmic-prod
# wingmic-prod>  .tables
# user, session, account, verification, identity_claim, company, event, topic,
# entity, entity_resolution, interaction, entity_fact, entity_note,
# entity_company, entity_event, entity_topic, connection_request,
# __drizzle_migrations
# wingmic-prod>  .quit
```

If you see all 17 user tables + `__drizzle_migrations`, you're done.

---

## 4. set secrets on Cloudflare

You can use the dashboard or the CLI. CLI is faster.

### Option A: dashboard

[dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages → wingmic → Settings → Variables → Add variable** (encrypt = on).

### Option B: CLI

```bash
cd apps/web

bunx wrangler secret put TURSO_DB_URL
bunx wrangler secret put TURSO_AUTH_TOKEN
bunx wrangler secret put BETTER_AUTH_SECRET
bunx wrangler secret put BETTER_AUTH_URL          # https://wingmic.xyz (or your domain)
bunx wrangler secret put RESEND_API_KEY
bunx wrangler secret put RESEND_FROM              # wingmic <auth@your-domain.com>
bunx wrangler secret put ANTHROPIC_API_KEY
bunx wrangler secret put OPENAI_API_KEY
```

Wrangler will prompt for each value. Paste, hit enter. Done.

Confirm with:

```bash
bunx wrangler secret list
```

You should see all 8.

> **Don't put secrets in `wrangler.jsonc`.** That file is committed to git. The `[vars]` block is for **public** values only (like `NEXT_PUBLIC_APP_URL`).

---

## 5. build + deploy

```bash
cd apps/web

# 1. Build the worker bundle
bun run cf:build
# → produces .open-next/

# 2. Deploy
bun run cf:deploy
# → wrangler uploads to Cloudflare; first deploy creates the worker
```

First deploy emits a default URL like `https://wingmic.<your-subdomain>.workers.dev`. Verify the homepage loads.

Iterate:

```bash
bun run cf:build && bun run cf:deploy
```

Or wire **GitHub → Cloudflare Pages** so every `main` push deploys automatically:

1. Cloudflare dashboard → Workers & Pages → Create application → Pages → Connect to Git
2. Pick the `Ayaan2907/wingmic` repo
3. Build command: `cd apps/web && bun run cf:build`
4. Build output: `apps/web/.open-next/static`
5. Add the same 8 secrets under Settings → Variables (production + preview both)

---

## 6. local development

The fastest way to develop:

```bash
git clone https://github.com/Ayaan2907/wingmic.git
cd wingmic
bun install

cp apps/web/.env.example apps/web/.env.local
# Open apps/web/.env.local and fill in:
#   ANTHROPIC_API_KEY=sk-ant-...
#   OPENAI_API_KEY=sk-...
# Leave the rest blank — they default sanely for local dev:
#   TURSO_DB_URL → file:./local.db
#   BETTER_AUTH_URL → http://localhost:3210
#   RESEND_API_KEY → blank → magic links log to console instead of email

cd apps/web
bun run db:apply       # creates local.db
cd -

bun run dev            # → http://localhost:3210
```

Sign in:

1. Go to `http://localhost:3210/signin`
2. Type any email
3. Click "send sign-in link"
4. **Check the dev server console** — the magic link is logged there since `RESEND_API_KEY` isn't set
5. Copy the URL, paste in browser, you're signed in

Capture:

1. Go to `/capture`
2. Click "start recording"
3. Talk for ~10 seconds
4. Click "stop"
5. Click "commit →"
6. Watch the extracted person + company + topics + actions appear

Recall:

1. Go to `/recall`
2. Type a question relating to what you just captured
3. Hit ask

---

## 7. custom domain

Once you've deployed and verified the default `*.workers.dev` URL works:

1. Cloudflare dashboard → your worker → **Settings → Triggers → Custom Domains → Add Custom Domain**
2. Enter `wingmic.xyz` (or whatever you own)
3. Cloudflare auto-provisions the cert

Then update `BETTER_AUTH_URL` to match exactly:

```bash
bunx wrangler secret put BETTER_AUTH_URL
# → https://wingmic.xyz
```

Re-deploy: `bun run cf:deploy`. Sessions are stateless once secrets are right; there's nothing else to migrate.

---

## 8. troubleshooting

### "module not found" after a dependency change

```bash
rm -rf .next .open-next
bun install
bun run build
```

### libsql / Turso errors at runtime

```
Error: server returned UNAUTHORIZED
```

→ `TURSO_AUTH_TOKEN` is missing, expired, or for the wrong DB. Regenerate via § 2.1, push to Cloudflare via § 4.

```
Error: no such table: user
```

→ Migration didn't run on the prod DB. Re-run § 3 with the production URL/token.

### BetterAuth: "no session" right after sign-in

- `BETTER_AUTH_URL` doesn't match the deployed origin exactly. Check trailing slash, http vs https.
- `BETTER_AUTH_SECRET` is missing on the deployment. `bunx wrangler secret list` should show it.
- Cookie domain mismatch (you're on `wingmic.xyz` but `BETTER_AUTH_URL` says `www.wingmic.xyz`).

### Magic-link emails not arriving

- `RESEND_API_KEY` missing or wrong.
- Sending domain not verified at Resend (check [resend.com/domains](https://resend.com/domains)).
- Recipient's mail server is greylisting — check [Resend logs](https://resend.com/logs) for delivery status.
- Local dev: emails are logged to the console, not sent. That's the intended fallback.

### Extraction returns empty results

- `ANTHROPIC_API_KEY` missing on the deployment env.
- Anthropic monthly limit reached → check the console.
- Model rolled back. Open `apps/web/lib/extractor/client.ts` and confirm the model string matches an active Claude model.
- Run `bun run extract:eval` locally — if that fails too, the extractor itself is broken, not the deploy.

### Recall returns nothing

- The user has 0 entities. Capture first.
- `OPENAI_API_KEY` missing → the embed call fails → no recall path.
- Schema mismatch: if you migrated the DB and the embedding column dim changed, old rows become unscoreable. Re-capture to refresh.

### Cold-start slow on Cloudflare

Workers cold-start is normally ~100ms. If you're seeing 2-3s, the libSQL bundle is too big. Open an issue — this means the `useWorkerdCondition` ↔ libSQL/web alignment regressed.

---

## 9. known issues

### `bun run cf:build` fails with "Could not resolve `@libsql/client`"

OpenNext's esbuild step doesn't traverse Bun's symlink-hoisted node_modules from inside the deeply-nested `.open-next/server-functions/...` path. Three workaround paths:

1. **Add `@libsql/client` to `dangerous.external` in `open-next.config.ts`** + add a separate esbuild pass that bundles libsql against the worker. Preserves bun-workspaces.
2. **Move `apps/web` out of the workspace temporarily for deploy builds.** Fastest to ship; messes with the monorepo.
3. **Wait for upstream fix.** Tracked at [opennextjs/opennextjs-cloudflare](https://github.com/opennextjs/opennextjs-cloudflare/issues) (search "monorepo libsql").

Until resolved, `bun run cf:deploy` is **manual-only**. Local dev (`bun run dev`) is unaffected, and a regular `next build` works — you can ship the `.next/` output to Vercel as an interim if you need v0.1.1 live before the fix lands.

---

## got stuck?

Open a [discussion](https://github.com/Ayaan2907/wingmic/discussions) with what you tried and which step failed. Don't open a bug issue for setup — discussions get faster help.
