# deploy

Wingmic ships two surfaces:

- **wingmic.xyz** — static landing built from `apps/web`, served by Cloudflare Pages. No secrets, no runtime.
- **app.wingmic.xyz** — dynamic product built from `apps/app`, served by Railway (Node.js, standard `next start`). Needs 8 secrets.

This guide covers both. If you're just running locally for dev, jump to [§ Local development](#-local-development).

---

## table of contents

- [§ Landing deploy (`wingmic.xyz`)](#-landing-deploy-wingmicxyz)
- [§ Product deploy (`app.wingmic.xyz`)](#-product-deploy-appwingmicxyz)
  - [The 8 secrets](#the-8-secrets)
  - [Acquire each secret](#acquire-each-secret)
  - [Set up the production database (Turso)](#set-up-the-production-database-turso)
  - [Set secrets on Railway](#set-secrets-on-railway)
  - [Build + deploy](#build--deploy)
- [§ Custom domains](#-custom-domains)
- [§ Local development](#-local-development)
- [§ Troubleshooting](#-troubleshooting)
- [§ Known issues](#-known-issues)

---

## § Landing deploy (`wingmic.xyz`)

Static export. No secrets. No runtime. Pure CDN.

### Cloudflare Pages setup (dashboard, one-time)

1. **dash.cloudflare.com** → Workers & Pages → **Create** → Pages → **Connect to Git** → select `Ayaan2907/wingmic`
2. Production branch: `main`
3. Build configuration:
   - **Framework preset:** None
   - **Build command:** `bun run --filter=@wingmic/web build`
   - **Build output directory:** `apps/web/out`
   - **Root directory:** *(leave blank — repo root)*
4. Save & deploy. Subsequent pushes to `main` auto-deploy.

### Build locally (sanity check)

```bash
bun run --filter=@wingmic/web build
# → produces apps/web/out/
```

### DNS

Cloudflare dashboard → Pages → `wingmic-landing` → Custom Domains → add `wingmic.xyz`.

### Required env

Only `NEXT_PUBLIC_APP_URL=https://app.wingmic.xyz` (compile-time; set in `apps/web/.env.production`). No runtime secrets.

---

## § Product deploy (`app.wingmic.xyz`)

Dynamic Next.js app on Railway (Node.js runtime, standard `next start`). Needs 8 secrets.

### the 8 secrets

Wingmic v0.1.1 needs exactly 8 environment variables to run the product in production. Keep this table open while you work through the next subsection.

| Variable | What it is | How to get it | Required? |
|---|---|---|---|
| `TURSO_DB_URL` | URL of your libSQL/Turso database | [Turso CLI](#turso) | ✅ |
| `TURSO_AUTH_TOKEN` | Token to read/write your Turso DB | [Turso CLI](#turso) | ✅ |
| `BETTER_AUTH_SECRET` | 32+ byte random string for session signing | [openssl](#betterauth-secret) | ✅ |
| `BETTER_AUTH_URL` | The deployed origin (no trailing slash) | You set this | ✅ |
| `RESEND_API_KEY` | Sends magic-link emails | [Resend dashboard](#resend) | ✅ |
| `RESEND_FROM` | Sender display + address | After domain verified at Resend | ✅ |
| `ANTHROPIC_API_KEY` | Claude extraction calls | [Anthropic console](#anthropic) | ✅ |
| `OPENAI_API_KEY` | Embedding calls (text-embedding-3-small) | [OpenAI platform](#openai) | ✅ |

Optional:

| Variable | Default | When to override |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://app.wingmic.xyz` | If you self-host on your own domain |
| `ANTHROPIC_EXTRACTION_MODEL` | `claude-sonnet-4-6` | Try a different Claude model |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` | Try a different embedding model |

### acquire each secret

#### Turso

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

> **Token rotation:** if you suspect compromise, run `turso db tokens invalidate wingmic-prod` then create a new one and update the Railway `TURSO_AUTH_TOKEN` variable. Sessions persist across rotations because they're sealed with `BETTER_AUTH_SECRET`.

#### BetterAuth secret

This signs session cookies. **Treat it like a password.** Anyone with this can mint sessions for any user.

```bash
openssl rand -base64 48
# → 64-char random string
```

Save as `BETTER_AUTH_SECRET`. Don't rotate this casually — rotating invalidates every active session.

#### Resend

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

#### Anthropic

[Anthropic](https://console.anthropic.com) provides Claude. We use **Claude Sonnet 4.6** for extraction; the cost is ~$0.003 per 1k input tokens, ~$0.015 per 1k output. A typical capture is ~500 tokens in / ~300 out → **~$0.005 per capture**.

1. Sign up at [console.anthropic.com](https://console.anthropic.com).
2. Add a payment method.
3. Set a monthly limit (recommended: $20 for early beta — far above expected usage).
4. Create an API key at **Settings → API Keys → Create Key**.
5. Save as `ANTHROPIC_API_KEY`.

> **Cost monitoring:** the Anthropic console shows real-time usage. The first 50 captures usually cost under $0.50.

#### OpenAI

[OpenAI](https://platform.openai.com) provides the embedding model. **text-embedding-3-small** at $0.02 per 1M tokens — basically free at v0.1-beta scale.

1. Sign up at [platform.openai.com/signup](https://platform.openai.com/signup).
2. Add a payment method (required even for the cheap embedding endpoint).
3. Set a usage limit (recommended: $5/month).
4. Create an API key at **Dashboard → API keys → Create new secret key**.
5. Restrict the key to **embeddings** only (Permissions → Restricted → only `text-embedding-3-small`).
6. Save as `OPENAI_API_KEY`.

### set up the production database (Turso)

With `TURSO_DB_URL` and `TURSO_AUTH_TOKEN` from above, apply the schema from the workspace root:

```bash
TURSO_DB_URL=libsql://wingmic-prod-<your-org>.turso.io \
TURSO_AUTH_TOKEN=eyJ... \
bun --filter=@wingmic/app db:apply

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

### set secrets on Railway

**Dashboard** — [railway.com](https://railway.com) → your project → `wingmic-app` service → **Variables** tab → **+ New Variable** (Railway encrypts at rest).

Add all 8:

```
TURSO_DB_URL=libsql://wingmic-prod-<your-org>.turso.io
TURSO_AUTH_TOKEN=eyJhbGciOiJF...
BETTER_AUTH_SECRET=<64-char random>
BETTER_AUTH_URL=https://app.wingmic.xyz
RESEND_API_KEY=re_...
RESEND_FROM=wingmic <auth@your-domain.com>
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

**CLI alternative** (after `npm i -g @railway/cli && railway login && railway link`):

```bash
railway variables --set TURSO_DB_URL=libsql://...
railway variables --set TURSO_AUTH_TOKEN=...
# etc.
```

Railway also auto-injects `PORT` — `next start -p ${PORT:-3211}` handles it (see `apps/app/package.json`).

### build + deploy

**One-time Railway setup:**

1. [railway.com](https://railway.com) → **+ New Project** → **Deploy from GitHub repo** → select `Ayaan2907/wingmic`
2. **Service settings:**
   - **Root Directory:** `/` (repository root — **not** `apps/app`; subdir roots omit `packages/` and `bun.lock`)
   - **Builder:** Railpack (reads root `railway.json`; `builder: RAILPACK`)
3. Set the 8 secrets above (Doppler → Railway sync is fine)
4. **Deploy** — Railway auto-deploys on every `main` push

Root `railway.json` config:
- **Build:** `bun install --frozen-lockfile && bun run build:app` (Turbo builds `@wingmic/db`, `@wingmic/extractor`, then Next)
- **Start:** `bun run start:app`
- **Healthcheck:** `GET /api/auth/session` (30s timeout)

If the dashboard still uses Nixpacks, root `nixpacks.toml` forces `bun install` instead of `npm i` (fixes `EUNSUPPORTEDPROTOCOL workspace:*`).

First deploy emits a default URL like `https://wingmic-app-production.up.railway.app`. Verify it loads.

**Iterate locally then push:**

```bash
git push origin main
# → Railway auto-builds and deploys
```

**Manual redeploy** (no code change):

```bash
railway redeploy --service wingmic-app
```

---

## § Custom domains

### Landing (`wingmic.xyz`)

Cloudflare dashboard → Pages → `wingmic-landing` → Custom Domains → add `wingmic.xyz`. Cloudflare auto-provisions the cert.

### Product (`app.wingmic.xyz`)

Railway dashboard → `wingmic-app` service → **Settings → Networking → Custom Domain** → enter `app.wingmic.xyz`. Railway will give you a CNAME target (`xxxxx.up.railway.app`).

Add a CNAME in your DNS provider:
```
app.wingmic.xyz  CNAME  xxxxx.up.railway.app
```

Railway provisions a Let's Encrypt cert automatically once DNS resolves.

Then update `BETTER_AUTH_URL` to match exactly:

```
BETTER_AUTH_URL=https://app.wingmic.xyz
```

(Variables tab in Railway, or `railway variables --set BETTER_AUTH_URL=...`.)

Railway redeploys automatically on env-var change. Sessions are stateless once secrets are right; there's nothing else to migrate.

---

## § Local development

```bash
git clone https://github.com/Ayaan2907/wingmic.git
cd wingmic
bun install

cp apps/app/.env.example apps/app/.env.local
# Open apps/app/.env.local and fill in:
#   ANTHROPIC_API_KEY=sk-ant-...
#   OPENAI_API_KEY=sk-...
# Leave the rest blank — they default sanely for local dev:
#   TURSO_DB_URL → file:./local.db
#   BETTER_AUTH_URL → http://localhost:3211
#   RESEND_API_KEY → blank → magic links log to console instead of email

bun --filter=@wingmic/app db:apply       # creates local.db

bun run dev:app          # → http://localhost:3211 (product)
# or
bun run dev:web          # → http://localhost:3210 (landing)
```

Sign in:

1. Go to `http://localhost:3211/signin`
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

## § Troubleshooting

### "module not found" after a dependency change

```bash
rm -rf .next
bun install
bun run build
```

### stale Turborepo cache

```bash
rm -rf .turbo apps/*/.next
bun install --force
bun run build
```

### libsql / Turso errors at runtime

```
Error: server returned UNAUTHORIZED
```

→ `TURSO_AUTH_TOKEN` is missing, expired, or for the wrong DB. Regenerate via the Turso section above, push to Railway via the Variables tab (or `railway variables --set`).

```
Error: no such table: user
```

→ Migration didn't run on the prod DB. Re-run `bun --filter=@wingmic/app db:apply` with the production URL/token.

### BetterAuth: "no session" right after sign-in

- `BETTER_AUTH_URL` doesn't match the deployed origin exactly. Check trailing slash, http vs https.
- `BETTER_AUTH_SECRET` is missing on the deployment. Check the Railway Variables tab (or `railway variables`).
- Cookie domain mismatch (you're on `app.wingmic.xyz` but `BETTER_AUTH_URL` says `wingmic.xyz`). The auth cookie must be scoped to `app.wingmic.xyz`.

### Magic-link emails not arriving

- `RESEND_API_KEY` missing or wrong.
- Sending domain not verified at Resend (check [resend.com/domains](https://resend.com/domains)).
- Recipient's mail server is greylisting — check [Resend logs](https://resend.com/logs) for delivery status.
- Local dev: emails are logged to the console, not sent. That's the intended fallback.

### Extraction returns empty results

- `ANTHROPIC_API_KEY` missing on the deployment env.
- Anthropic monthly limit reached → check the console.
- Model rolled back. Open `packages/extractor/src/client.ts` and confirm the model string matches an active Claude model.
- Run `bun run extract:eval` locally — if that fails too, the extractor itself is broken, not the deploy.

### Recall returns nothing

- The user has 0 entities. Capture first.
- `OPENAI_API_KEY` missing → the embed call fails → no recall path.
- Schema mismatch: if you migrated the DB and the embedding column dim changed, old rows become unscoreable. Re-capture to refresh.

### Slow first response after deploy on Railway

Railway containers go to sleep on the free/hobby tier. First request after idle takes 2-5s while the container wakes. Mitigations:
- Upgrade to a paid plan (always-on)
- Add an external uptime ping (e.g., UptimeRobot every 5min hitting `/api/auth/session`)
- Move long-running work to Inngest (v0.2)

### Railway build fails: `EUNSUPPORTEDPROTOCOL` / `workspace:*`

Nixpacks ran `npm i` on a Bun workspace. Fix:

1. **Root Directory** = repo root (`/`), not `apps/app`.
2. **Builder** = Railpack (root `railway.json` sets `RAILPACK`).
3. If still on Nixpacks, root `nixpacks.toml` forces `bun install`.

### Railway build fails: "bun: command not found"

Use **Railpack** or root `nixpacks.toml` (installs `bun`). Root Directory must be repo root so `packageManager: bun@1.3.10` in root `package.json` is visible.

---

## § Known issues

None currently blocking deploy. Previously: OpenNext + libSQL bundling for Cloudflare Workers (closed by Railway migration, see issue #7).

---

## got stuck?

Open a [discussion](https://github.com/Ayaan2907/wingmic/discussions) with what you tried and which step failed. Don't open a bug issue for setup — discussions get faster help.
