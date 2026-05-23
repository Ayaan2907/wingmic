# Monorepo Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure wingmic into a Turborepo monorepo with two Next.js apps (`apps/web` static landing → `wingmic.xyz` via Cloudflare Pages, `apps/app` dynamic product → `app.wingmic.xyz` via Cloudflare Workers) plus shared packages (`brand`, `design-tokens`, `db`, `extractor`, `config/{tsconfig,eslint,vitest}`), and ship a project-root `CLAUDE.md`.

**Architecture:** 11 sequenced PRs against `staging` (per new branch protection). Step 3.3 (web/app split) is the highest-churn atomic commit. Package hoists (3.4–3.7) move code from `apps/app/lib/*` (post-split) into `packages/*`. Each PR keeps `bun run typecheck` and `bun run build` green. Final PR (Task 11) closes the epic [#13](https://github.com/Ayaan2907/wingmic/issues/13) after the 10-step verification matrix passes.

**Tech Stack:** Bun 1.3 workspaces + Turborepo (NEW) + tsup, Next.js 15, Drizzle ORM + libSQL/Turso, BetterAuth + Resend magic link, Vercel AI SDK v6 + Anthropic Claude Sonnet 4.6, OpenAI text-embedding-3-small (1536-d), tRPC v11, Vitest + Playwright, @opennextjs/cloudflare.

**Source spec:** [`docs/superpowers/specs/2026-05-11-monorepo-restructure-design.md`](../specs/2026-05-11-monorepo-restructure-design.md) (commit `96827a4`).

---

## branch + PR conventions (applies to every task)

**Branch protection is now live.** All work happens through PRs targeting `staging`. Direct pushes to `main` are blocked. CI status check `lint · typecheck · build · vitest` is required.

Every task in this plan follows this pattern:

```bash
# Start of task
git checkout staging
git pull --rebase origin staging
git checkout -b <kind>/<short-name>

# ... work ...

# End of task
git add <specific files>
git commit -m "<conventional commit message>

Refs #13 · spec §3.X"
git push -u origin <branch>
gh pr create --base staging --head <branch> \
  --title "<conventional title>" \
  --body "<body referencing #13 and the spec step>"
```

**Closes vs Refs:**
- Tasks 1–10: `Refs #13 · spec §3.X` (epic stays open).
- Task 11: `Closes #13` (final verification PR closes the epic).

---

## pre-flight

- [ ] **Step 0.1: Confirm starting state**

Run from repo root:

```bash
cd /Users/ayaan/Developer/wingmic
git fetch origin
git checkout staging
git pull --rebase origin staging
git log --oneline -5
```

Expected: `staging` matches `main` at commit `96827a4` (or later if PR #14 has merged). Latest commit message references `docs(spec)` or `docs(workflow)`.

- [ ] **Step 0.2: Confirm tooling**

```bash
bun --version    # ≥ 1.3.10
node --version   # ≥ 20
gh --version     # any recent
git --version    # any recent
```

If `bun` missing: `curl -fsSL https://bun.sh/install | bash`. If `gh` missing: `brew install gh`.

- [ ] **Step 0.3: Confirm CI baseline is green**

```bash
gh run list --branch staging --limit 1
```

Expected: most recent run on staging is `completed success`. If failing, fix CI before starting.

---

## Task 1: Install Turborepo + tsup at root (spec §3.1)

**Files:**
- Modify: `package.json` (root) — add deps, replace scripts
- Create: `turbo.json`

**Branch:** `chore/install-turbo`

- [ ] **Step 1.1: Branch from staging**

```bash
git checkout staging && git pull --rebase origin staging
git checkout -b chore/install-turbo
```

- [ ] **Step 1.2: Install dev deps at the workspace root**

```bash
bun add -d turbo tsup
```

Expected output ends with: `installed turbo@<version>` and `installed tsup@<version>`. Both land in root `package.json` under `devDependencies`.

- [ ] **Step 1.3: Create `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**", "out/**"]
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "lint": {
      "outputs": []
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

- [ ] **Step 1.4: Replace root `package.json` scripts**

In root `package.json`, replace the `scripts` block with:

```json
"scripts": {
  "dev":          "turbo dev --filter=@wingmic/web",
  "build":        "turbo build",
  "test":         "turbo test",
  "lint":         "turbo lint",
  "typecheck":    "turbo typecheck",
  "format":       "prettier --write \"**/*.{ts,tsx,md,json}\"",
  "format:check": "prettier --check \"**/*.{ts,tsx,md,json}\""
}
```

The `dev` script defaults to landing — when product app exists (after Task 3), the maintainer passes `--filter=@wingmic/app` explicitly.

- [ ] **Step 1.5: Add `.turbo/` to `.gitignore`**

In `.gitignore`, append (if not already present):

```
# Turborepo
.turbo/
```

- [ ] **Step 1.6: Verify turbo runs**

```bash
bun run typecheck
```

Expected: `turbo` discovers `@wingmic/web`, runs its existing `typecheck` script, exits 0. Build output shows a turbo summary like `Tasks: 1 successful, 1 total`.

```bash
bun run build
```

Expected: `apps/web` builds via Next.js (same as before, just orchestrated by turbo). Exit 0.

- [ ] **Step 1.7: Commit + PR**

```bash
git add package.json bun.lock turbo.json .gitignore
git commit -m "chore: install Turborepo + tsup at workspace root

Refs #13 · spec §3.1"
git push -u origin chore/install-turbo
gh pr create --base staging --head chore/install-turbo \
  --title "chore: install Turborepo + tsup at workspace root" \
  --body "Refs #13 · spec §3.1

Adds Turborepo orchestration + tsup for future library packages. Root scripts now delegate to \`turbo\` (typecheck, build, lint, test, dev).

## checklist
- [x] Base branch is staging
- [x] bun run typecheck → exit 0
- [x] bun run build → exit 0
- [x] No behavior change yet — same single app, same output"
```

After merge to staging, proceed to Task 2.

---

## Task 2: Create shared config packages (spec §3.2)

**Files:**
- Create: `packages/config/tsconfig/{package.json,base.json,nextjs.json,node.json,react.json}`
- Create: `packages/config/eslint/{package.json,base.js,next.js,node.js}`
- Create: `packages/config/vitest/{package.json,base.config.ts}`
- Modify: `apps/web/tsconfig.json` (extend `@wingmic/config-tsconfig/nextjs.json`)

**Branch:** `chore/shared-config-packages`

- [ ] **Step 2.1: Branch**

```bash
git checkout staging && git pull --rebase origin staging
git checkout -b chore/shared-config-packages
```

- [ ] **Step 2.2: Create `packages/config/tsconfig/`**

```bash
mkdir -p packages/config/tsconfig
```

Create `packages/config/tsconfig/package.json`:

```json
{
  "name": "@wingmic/config-tsconfig",
  "version": "0.0.0",
  "private": true,
  "files": ["*.json"]
}
```

Create `packages/config/tsconfig/base.json`:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "forceConsistentCasingInFileNames": true,
    "incremental": true
  },
  "exclude": ["node_modules", "dist", ".next", ".open-next", ".turbo"]
}
```

Create `packages/config/tsconfig/nextjs.json`:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "ES2022"],
    "jsx": "preserve",
    "allowJs": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

Create `packages/config/tsconfig/node.json`:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "types": ["node"]
  }
}
```

Create `packages/config/tsconfig/react.json`:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "ES2022"],
    "jsx": "react-jsx"
  }
}
```

- [ ] **Step 2.3: Create `packages/config/eslint/`**

```bash
mkdir -p packages/config/eslint
```

Create `packages/config/eslint/package.json`:

```json
{
  "name": "@wingmic/config-eslint",
  "version": "0.0.0",
  "private": true,
  "files": ["*.js"]
}
```

Create `packages/config/eslint/base.js`:

```js
module.exports = {
  extends: ['eslint:recommended'],
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  ignorePatterns: ['node_modules', 'dist', '.next', '.open-next', '.turbo'],
};
```

Create `packages/config/eslint/next.js`:

```js
module.exports = {
  extends: ['./base.js', 'next/core-web-vitals'],
  rules: {
    '@next/next/no-html-link-for-pages': 'off',
    'react/no-unescaped-entities': 'off',
  },
};
```

Create `packages/config/eslint/node.js`:

```js
module.exports = {
  extends: ['./base.js'],
  env: { node: true },
};
```

- [ ] **Step 2.4: Create `packages/config/vitest/`**

```bash
mkdir -p packages/config/vitest
```

Create `packages/config/vitest/package.json`:

```json
{
  "name": "@wingmic/config-vitest",
  "version": "0.0.0",
  "private": true,
  "main": "./base.config.ts",
  "files": ["*.ts"]
}
```

Create `packages/config/vitest/base.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['node_modules', 'dist', 'e2e'],
  },
});
```

- [ ] **Step 2.5: Re-point `apps/web/tsconfig.json`**

Replace `apps/web/tsconfig.json` with:

```json
{
  "extends": "@wingmic/config-tsconfig/nextjs.json",
  "compilerOptions": {
    "plugins": [{ "name": "next" }],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

Add `@wingmic/config-tsconfig` to `apps/web/package.json` devDependencies:

```bash
cd apps/web
bun add -d @wingmic/config-tsconfig
cd -
```

Expected: `bun.lock` updates; `apps/web/package.json` shows `"@wingmic/config-tsconfig": "workspace:*"`.

- [ ] **Step 2.6: Re-point `apps/web/.eslintrc.json`**

Replace `apps/web/.eslintrc.json` with:

```json
{
  "extends": ["@wingmic/config-eslint/next"]
}
```

Add the dep:

```bash
cd apps/web
bun add -d @wingmic/config-eslint
cd -
```

- [ ] **Step 2.7: Verify**

```bash
bun run typecheck
```

Expected: exit 0. `apps/web` now resolves its tsconfig through `@wingmic/config-tsconfig/nextjs.json`.

```bash
bun --filter=@wingmic/web lint
```

Expected: 0 errors / 0 warnings (same as before, just routing through the shared eslint preset).

```bash
bun run build
```

Expected: build succeeds.

- [ ] **Step 2.8: Commit + PR**

```bash
git add packages/config apps/web/tsconfig.json apps/web/.eslintrc.json apps/web/package.json bun.lock
git commit -m "chore(config): shared @wingmic/config-{tsconfig,eslint,vitest} packages

apps/web's tsconfig.json and .eslintrc.json now extend the shared presets.
Vitest preset goes unused until packages with own test runners arrive.

Refs #13 · spec §3.2"
git push -u origin chore/shared-config-packages
gh pr create --base staging --head chore/shared-config-packages \
  --title "chore(config): shared @wingmic/config-* packages" \
  --body "Refs #13 · spec §3.2

Adds @wingmic/config-tsconfig (base, nextjs, node, react), @wingmic/config-eslint (base, next, node), @wingmic/config-vitest (base.config.ts). apps/web re-points to the shared presets; behavior unchanged."
```

---

## Task 3: Split `apps/web` → `apps/web` (landing) + `apps/app` (product) (spec §3.3) — ATOMIC

This is the highest-churn step. Move all dynamic surface from `apps/web` to a new `apps/app`; reduce `apps/web` to landing-only. Atomic commit — both apps must build green at the end.

**Files (major changes):**
- Create: `apps/app/` (entire app directory tree, see below)
- Modify: `apps/web/` (strip to landing-only)

**Branch:** `chore/split-web-app`

- [ ] **Step 3.1: Branch**

```bash
git checkout staging && git pull --rebase origin staging
git checkout -b chore/split-web-app
```

- [ ] **Step 3.2: Scaffold `apps/app/` directory**

```bash
mkdir -p apps/app/app/{signin,capture,recall,dashboard}
mkdir -p apps/app/app/api/auth/'[...all]'
mkdir -p apps/app/app/api/trpc/'[trpc]'
mkdir -p apps/app/lib/{db,extractor,email,trpc/routers,config}
mkdir -p apps/app/lib/extractor/eval
mkdir -p apps/app/drizzle/meta
mkdir -p apps/app/scripts
mkdir -p apps/app/e2e
mkdir -p apps/app/public
echo "" > apps/app/public/.gitkeep
```

- [ ] **Step 3.3: Move dynamic files from `apps/web` to `apps/app`**

Run from repo root:

```bash
# App routes
git mv apps/web/app/signin/page.tsx apps/app/app/signin/page.tsx
git mv apps/web/app/signin/SignInClient.tsx apps/app/app/signin/SignInClient.tsx
git mv apps/web/app/capture/page.tsx apps/app/app/capture/page.tsx
git mv apps/web/app/capture/CaptureClient.tsx apps/app/app/capture/CaptureClient.tsx
git mv apps/web/app/capture/_components apps/app/app/capture/_components
git mv apps/web/app/recall/page.tsx apps/app/app/recall/page.tsx
git mv apps/web/app/recall/RecallClient.tsx apps/app/app/recall/RecallClient.tsx
git mv 'apps/web/app/api/auth/[...all]/route.ts' 'apps/app/app/api/auth/[...all]/route.ts'
git mv 'apps/web/app/api/trpc/[trpc]/route.ts' 'apps/app/app/api/trpc/[trpc]/route.ts'

# Lib
git mv apps/web/lib/auth.ts apps/app/lib/auth.ts
git mv apps/web/lib/auth-client.ts apps/app/lib/auth-client.ts
git mv apps/web/lib/email apps/app/lib/email
git mv apps/web/lib/trpc apps/app/lib/trpc
git mv apps/web/lib/db apps/app/lib/db
git mv apps/web/lib/extractor apps/app/lib/extractor
git mv apps/web/lib/config apps/app/lib/config

# Middleware
git mv apps/web/middleware.ts apps/app/middleware.ts

# Drizzle
git mv apps/web/drizzle apps/app/drizzle
git mv apps/web/drizzle.config.ts apps/app/drizzle.config.ts
git mv apps/web/scripts/migrate.ts apps/app/scripts/migrate.ts

# Vitest + Playwright configs
git mv apps/web/vitest.config.ts apps/app/vitest.config.ts
git mv apps/web/playwright.config.ts apps/app/playwright.config.ts
git mv apps/web/e2e/signin.spec.ts apps/app/e2e/signin.spec.ts

# Open Next / Cloudflare configs
git mv apps/web/open-next.config.ts apps/app/open-next.config.ts
git mv apps/web/wrangler.jsonc apps/app/wrangler.jsonc

# Env example (app gets the big one)
git mv apps/web/.env.example apps/app/.env.example
```

`e2e/homepage.spec.ts` stays in `apps/web/e2e/` — it tests the landing.

- [ ] **Step 3.4: Create `apps/app/package.json`**

```json
{
  "name": "@wingmic/app",
  "version": "0.1.0-beta.0",
  "private": true,
  "description": "wingmic product app — capture, recall, dashboard",
  "scripts": {
    "dev": "next dev --port 3211",
    "build": "next build",
    "start": "next start --port 3211",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "db:generate": "drizzle-kit generate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "db:apply": "bun run scripts/migrate.ts",
    "extract:eval": "bun run lib/extractor/eval/runner.ts",
    "cf:build": "bunx opennextjs-cloudflare build",
    "cf:preview": "bunx opennextjs-cloudflare preview",
    "cf:deploy": "bunx opennextjs-cloudflare deploy",
    "cf:upload": "bunx opennextjs-cloudflare upload"
  },
  "dependencies": {
    "@ai-sdk/anthropic": "^3.0.74",
    "@ai-sdk/openai": "^3.0.58",
    "@libsql/client": "^0.17.3",
    "@paralleldrive/cuid2": "^3.3.0",
    "@tanstack/react-query": "^5.100.9",
    "@trpc/client": "^11.17.0",
    "@trpc/next": "^11.17.0",
    "@trpc/react-query": "^11.17.0",
    "@trpc/server": "^11.17.0",
    "@wingmic/brand": "workspace:*",
    "@wingmic/design-tokens": "workspace:*",
    "@wingmic/db": "workspace:*",
    "@wingmic/extractor": "workspace:*",
    "ai": "^6.0.174",
    "better-auth": "^1.6.9",
    "drizzle-orm": "^0.45.2",
    "next": "^15.0.3",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-force-graph-2d": "^1.29.1",
    "resend": "^6.12.2",
    "superjson": "^2.2.6",
    "zod": "^4.4.2",
    "zustand": "^5.0.12"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "*",
    "@opennextjs/cloudflare": "^1.19.5",
    "@playwright/test": "^1.59.1",
    "@testing-library/dom": "^10.4.1",
    "@testing-library/react": "^16.3.2",
    "@types/node": "^22.9.0",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.1",
    "@wingmic/config-eslint": "workspace:*",
    "@wingmic/config-tsconfig": "workspace:*",
    "@wingmic/config-vitest": "workspace:*",
    "autoprefixer": "^10.4.20",
    "drizzle-kit": "^0.31.10",
    "eslint": "^9.14.0",
    "eslint-config-next": "^15.0.3",
    "jsdom": "^29.1.1",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.14",
    "typescript": "^5.6.3",
    "vitest": "^4.1.5",
    "wrangler": "^4.87.0"
  }
}
```

The version numbers mirror the current `apps/web/package.json`. `bun install` resolves to the same versions.

- [ ] **Step 3.5: Create `apps/app/tsconfig.json`**

```json
{
  "extends": "@wingmic/config-tsconfig/nextjs.json",
  "compilerOptions": {
    "plugins": [{ "name": "next" }],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3.6: Create `apps/app/.eslintrc.json`**

```json
{
  "extends": ["@wingmic/config-eslint/next"]
}
```

- [ ] **Step 3.7: Create `apps/app/next.config.ts`**

```ts
import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
  outputFileTracingRoot: path.join(__dirname, '../..'),
};

export default nextConfig;
```

- [ ] **Step 3.8: Create `apps/app/postcss.config.mjs` and `apps/app/tailwind.config.ts`**

`apps/app/postcss.config.mjs`:

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

`apps/app/tailwind.config.ts` (copy from `apps/web/tailwind.config.ts` — same content; will reduce to a preset in Task 5):

```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Same theme as apps/web; replaced by @wingmic/design-tokens preset in Task 5.
      colors: {
        ink: { page: '#0a0a0a', card: '#08080d', DEFAULT: '#f4f1ea', pure: '#ffffff' },
        accent: '#FFC452',
        second: '#86efac',
        third: '#FF8FAB',
        alarm: '#FF6B6B',
        info: { blue: '#7DD3FC', violet: '#A78BFA' },
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 3.9: Create `apps/app/app/layout.tsx`** (minimal, product-only)

```tsx
import type { Metadata, Viewport } from 'next';
import { Inter, Instrument_Serif, JetBrains_Mono } from 'next/font/google';
import { TRPCProvider } from '@/lib/trpc/client';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-inter',
  display: 'swap',
});

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-instrument',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://app.wingmic.xyz'),
  title: { default: 'wingmic', template: '%s · wingmic' },
  description: 'your social RAM, on disk.',
  robots: { index: false, follow: false }, // product app not indexed
};

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3.10: Create `apps/app/app/globals.css`**

Copy from `apps/web/app/globals.css` verbatim. Same design tokens; the page surface needs them too.

- [ ] **Step 3.11: Create `apps/app/app/page.tsx`** (root redirects to /capture or /signin)

```tsx
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user) redirect('/capture');
  redirect('/signin');
}
```

- [ ] **Step 3.12: Create `apps/app/app/dashboard/page.tsx`** (placeholder)

```tsx
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';

export const metadata = { title: 'dashboard' };

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect('/signin?next=/dashboard');

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 20px',
        background: 'var(--bg-page)',
        color: 'var(--ink)',
      }}
    >
      <div style={{ maxWidth: 480, textAlign: 'center' }}>
        <div
          className="mono"
          style={{
            fontSize: 11,
            letterSpacing: 2,
            color: '#FFC452',
            textTransform: 'uppercase',
            marginBottom: 14,
          }}
        >
          dashboard · placeholder
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.05 }}>
          coming soon.{' '}
          <span className="serif" style={{ fontStyle: 'italic', color: '#FFC452', fontWeight: 400 }}>
            for now, capture + recall.
          </span>
        </h1>
        <p style={{ marginTop: 14, color: 'var(--text-55)', fontSize: 15, lineHeight: 1.55 }}>
          go to <a href="/capture" style={{ color: '#FFC452', textDecoration: 'underline' }}>/capture</a> or <a href="/recall" style={{ color: '#FFC452', textDecoration: 'underline' }}>/recall</a>.
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 3.13: Update `apps/app/lib/auth.ts`** for the new product URL

Open `apps/app/lib/auth.ts`. The `env` reference is already in place (from commit `705bbcb`). Verify the `baseURL` line reads:

```ts
baseURL: env.BETTER_AUTH_URL,
```

No code change needed; only the env value moves: `BETTER_AUTH_URL` should be `https://app.wingmic.xyz` in production (already documented in `apps/app/.env.example`).

- [ ] **Step 3.14: Strip `apps/web` to landing-only**

Reduce `apps/web/package.json` to the static-landing deps:

```json
{
  "name": "@wingmic/web",
  "version": "0.1.0-beta.0",
  "private": true,
  "description": "wingmic static landing page",
  "scripts": {
    "dev": "next dev --port 3210",
    "build": "next build && next export -o out",
    "start": "next start --port 3210",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "prebuild": "cp -r ../../packages/brand/src/*.{svg,png,webmanifest} public/ 2>/dev/null || true",
    "predev":   "cp -r ../../packages/brand/src/*.{svg,png,webmanifest} public/ 2>/dev/null || true"
  },
  "dependencies": {
    "next": "^15.0.3",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@wingmic/brand": "workspace:*",
    "@wingmic/design-tokens": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^22.9.0",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@wingmic/config-eslint": "workspace:*",
    "@wingmic/config-tsconfig": "workspace:*",
    "autoprefixer": "^10.4.20",
    "eslint": "^9.14.0",
    "eslint-config-next": "^15.0.3",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.14",
    "typescript": "^5.6.3"
  }
}
```

The `prebuild` / `predev` hooks pre-copy assets from `packages/brand/src/`. The `|| true` lets it pass before Task 4 lands the brand package.

- [ ] **Step 3.15: Update `apps/web/next.config.ts` for static export**

```ts
import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
  outputFileTracingRoot: path.join(__dirname, '../..'),
};

export default nextConfig;
```

- [ ] **Step 3.16: Update homepage CTAs to point at the product domain**

In `apps/web/app/HomeClient.tsx`, find each anchor that points at `/signin` (or `Get beta access` / `get an invite`) and replace `href="/signin"` with the absolute product URL:

```tsx
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3211';
// at each CTA:
<a href={`${APP_URL}/signin`} ...>get an invite →</a>
```

For static export, `process.env.NEXT_PUBLIC_APP_URL` is inlined at build time. `apps/web/.env.production` should set `NEXT_PUBLIC_APP_URL=https://app.wingmic.xyz`. For local dev it falls back to `http://localhost:3211`.

Create `apps/web/.env.production`:

```
NEXT_PUBLIC_APP_URL=https://app.wingmic.xyz
```

Create `apps/web/.env.example`:

```
# ── Landing canonical URL (used for absolute links to product) ────────────
NEXT_PUBLIC_APP_URL=http://localhost:3211
```

- [ ] **Step 3.17: Update `apps/app/.env.example`** to reflect new BETTER_AUTH_URL

Open `apps/app/.env.example`. Change:

```
BETTER_AUTH_URL=http://localhost:3210
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3210
```

to:

```
BETTER_AUTH_URL=http://localhost:3211
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3211
```

(Local dev port for `apps/app` is 3211.)

Add a comment for production:

```
# In production:
#   BETTER_AUTH_URL=https://app.wingmic.xyz
#   NEXT_PUBLIC_BETTER_AUTH_URL=https://app.wingmic.xyz
#   NEXT_PUBLIC_APP_URL=https://app.wingmic.xyz
```

- [ ] **Step 3.18: Update root `package.json` workspaces (verify)**

```json
"workspaces": [
  "apps/*",
  "packages/*",
  "packages/config/*"
]
```

The `packages/config/*` glob is needed because each config package (`tsconfig`, `eslint`, `vitest`) is at depth 3.

- [ ] **Step 3.19: Update root `package.json` scripts to surface app filters**

```json
"scripts": {
  "dev":          "turbo dev",
  "dev:web":      "turbo dev --filter=@wingmic/web",
  "dev:app":      "turbo dev --filter=@wingmic/app",
  "build":        "turbo build",
  "test":         "turbo test",
  "lint":         "turbo lint",
  "typecheck":    "turbo typecheck",
  "format":       "prettier --write \"**/*.{ts,tsx,md,json}\"",
  "format:check": "prettier --check \"**/*.{ts,tsx,md,json}\"",
  "db:generate":  "bun --filter=@wingmic/app db:generate",
  "db:apply":     "bun --filter=@wingmic/app db:apply",
  "db:studio":    "bun --filter=@wingmic/app db:studio",
  "extract:eval": "bun --filter=@wingmic/app extract:eval"
}
```

(Note: db/extractor scripts proxy through `apps/app` until Task 6/7 move them to packages.)

- [ ] **Step 3.20: Update `apps/app/middleware.ts`** matcher (no change needed; verify)

The matcher already covers `/capture`, `/recall`, `/dashboard`. Routes `/` and `/signin` are public per the middleware logic. Verify the import remains:

```ts
import { NextResponse, type NextRequest } from 'next/server';
```

(No further edits needed.)

- [ ] **Step 3.21: Reinstall and verify both apps build**

```bash
rm -rf node_modules apps/*/node_modules apps/*/.next apps/web/out apps/app/.open-next
bun install
```

Expected: workspace resolves both apps; `@wingmic/app` and `@wingmic/web` show in `bun pm ls`.

```bash
bun run typecheck
```

Expected: both apps + config packages typecheck clean. Exit 0.

```bash
bun --filter=@wingmic/web build
```

Expected: `apps/web/out/index.html` exists. Static export emits `out/_next/static/...` chunks.

```bash
ls apps/web/out/index.html
```

```bash
bun --filter=@wingmic/app build
```

Expected: `apps/app/.next/` has the route map for `/signin`, `/capture`, `/recall`, `/dashboard`, `/api/auth/[...all]`, `/api/trpc/[trpc]`.

- [ ] **Step 3.22: Verify landing bundle has zero auth/db code**

```bash
grep -rE "betterAuth|libsql|drizzle|@trpc" apps/web/out/_next/static/chunks/*.js 2>/dev/null | wc -l
```

Expected: `0`. (If non-zero, something dynamic leaked into the landing bundle — find the import and remove.)

- [ ] **Step 3.23: Commit + PR**

```bash
git add apps/web apps/app package.json bun.lock
git commit -m "chore(restructure): split apps/web → apps/web (static landing) + apps/app (dynamic product)

apps/web reduced to landing-only:
- Removed /signin, /capture, /recall, /api/auth, /api/trpc, middleware, lib/{auth,db,extractor,email,trpc,config}, drizzle, scripts
- Removed all dynamic deps (@ai-sdk/*, @libsql/client, drizzle-orm, better-auth, resend, @trpc/*, @opennextjs/cloudflare, wrangler, vitest, playwright)
- next.config.ts: output: 'export', images.unoptimized, trailingSlash
- prebuild/predev hooks copy assets from packages/brand/src/ (lands in Task 4)
- Homepage CTAs link to NEXT_PUBLIC_APP_URL/signin (default http://localhost:3211)

apps/app created with full dynamic surface:
- /signin, /capture, /recall, /dashboard (placeholder), /api/auth, /api/trpc
- lib/{auth, auth-client, email, trpc, db, extractor, config}
- middleware.ts (protected route gate)
- drizzle migrations + drizzle.config.ts + scripts/migrate.ts
- Vitest + Playwright configs
- @opennextjs/cloudflare config + wrangler.jsonc
- next dev runs on port 3211 (apps/web stays on 3210)

BETTER_AUTH_URL defaults updated to http://localhost:3211 (dev) / https://app.wingmic.xyz (prod).

Refs #13 · spec §3.3"
git push -u origin chore/split-web-app
gh pr create --base staging --head chore/split-web-app \
  --title "chore(restructure): split apps/web → apps/web + apps/app" \
  --body "Refs #13 · spec §3.3

**Atomic structural pivot.** apps/web becomes static-landing-only; apps/app is new and contains all dynamic product surface (signin/capture/recall/api/auth/trpc).

## checklist
- [x] Base branch is staging
- [x] apps/web bundle: \`grep -rE 'betterAuth|libsql|drizzle' apps/web/out/_next/static/chunks/*.js\` returns 0
- [x] apps/web dev runs on :3210, apps/app dev on :3211
- [x] BETTER_AUTH_URL / NEXT_PUBLIC_APP_URL updated to product domain
- [x] bun run typecheck → exit 0 across both apps
- [x] bun run build → both apps build green"
```

After merge: proceed to Task 4.

---

## Task 4: Hoist `packages/brand` (spec §3.4)

**Files:**
- Create: `packages/brand/{package.json,README.md,src/...,scripts/generate-icons.ts,tsup.config.ts}`
- Modify: `apps/web/package.json`, `apps/app/package.json` (add brand dep)
- Modify: `.gitignore` (add `apps/*/public/` except `.gitkeep`)

**Branch:** `chore/hoist-packages-brand`

- [ ] **Step 4.1: Branch**

```bash
git checkout staging && git pull --rebase origin staging
git checkout -b chore/hoist-packages-brand
```

- [ ] **Step 4.2: Move brand source files into `packages/brand/src/`**

```bash
mkdir -p packages/brand/src packages/brand/scripts
git mv apps/web/public/icon.svg packages/brand/src/icon.svg 2>/dev/null || true
git mv apps/web/public/icon-tile.svg packages/brand/src/icon-tile.svg 2>/dev/null || true
git mv apps/web/public/icon-mono.svg packages/brand/src/icon-mono.svg 2>/dev/null || true
git mv apps/web/public/og-image.svg packages/brand/src/og-image.svg 2>/dev/null || true
git mv apps/web/public/og-image.png packages/brand/src/og-image.png 2>/dev/null || true
git mv apps/web/public/icon-16.png packages/brand/src/icon-16.png 2>/dev/null || true
git mv apps/web/public/icon-32.png packages/brand/src/icon-32.png 2>/dev/null || true
git mv apps/web/public/icon-64.png packages/brand/src/icon-64.png 2>/dev/null || true
git mv apps/web/public/icon-192.png packages/brand/src/icon-192.png 2>/dev/null || true
git mv apps/web/public/icon-512.png packages/brand/src/icon-512.png 2>/dev/null || true
git mv apps/web/public/apple-touch-icon.png packages/brand/src/apple-touch-icon.png 2>/dev/null || true
git mv apps/web/public/manifest.webmanifest packages/brand/src/manifest.webmanifest 2>/dev/null || true
git mv apps/web/public/favicon.ico packages/brand/src/favicon.ico 2>/dev/null || true
# Generator script:
[ -f apps/web/scripts/generate-icons.ts ] && git mv apps/web/scripts/generate-icons.ts packages/brand/scripts/generate-icons.ts
```

(The `2>/dev/null || true` shrugs off any file not present.)

- [ ] **Step 4.3: Create `packages/brand/package.json`**

```json
{
  "name": "@wingmic/brand",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist", "src", "scripts"],
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
    "./assets/*": "./src/*"
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts --clean --sourcemap",
    "dev": "tsup src/index.ts --format esm --dts --watch",
    "typecheck": "tsc --noEmit",
    "generate-icons": "bun run scripts/generate-icons.ts"
  },
  "devDependencies": {
    "@wingmic/config-tsconfig": "workspace:*",
    "tsup": "^8.0.0",
    "typescript": "^5.6.3"
  }
}
```

- [ ] **Step 4.4: Create `packages/brand/tsconfig.json`**

```json
{
  "extends": "@wingmic/config-tsconfig/node.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "noEmit": false
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 4.5: Create `packages/brand/src/index.ts`**

```ts
/**
 * Canonical brand asset URLs.
 *
 * Most consumers don't import these — landing + app copy the raw files
 * into their own public/ at prebuild time. This module exists for
 * server-side metadata + OG-image generation, where the canonical URL
 * is needed (e.g., absolute URLs for Open Graph tags).
 */

// Resolved to file:// URLs at runtime via import.meta.url.
const here = (rel: string) => new URL(rel, import.meta.url).href;

export const brandAssets = {
  icon: here('./icon.svg'),
  iconTile: here('./icon-tile.svg'),
  iconMono: here('./icon-mono.svg'),
  ogImage: here('./og-image.png'),
  manifest: here('./manifest.webmanifest'),
  faviconIco: here('./favicon.ico'),
  appleTouchIcon: here('./apple-touch-icon.png'),
  pngs: {
    px16: here('./icon-16.png'),
    px32: here('./icon-32.png'),
    px64: here('./icon-64.png'),
    px192: here('./icon-192.png'),
    px512: here('./icon-512.png'),
  },
} as const;

export type BrandAssets = typeof brandAssets;
```

- [ ] **Step 4.6: Create `packages/brand/README.md`**

```markdown
# @wingmic/brand

Canonical brand assets — logos, favicons, OG image, manifest.

Consumers (apps/web, apps/app) **copy** these files into their own
`public/` directories at prebuild. Do not edit `apps/*/public/*` directly;
those directories are gitignored and regenerated.

## files

- `src/icon.svg` — primary square icon
- `src/icon-tile.svg` — windows tile / large surface
- `src/icon-mono.svg` — single-color mark for monochrome contexts
- `src/og-image.png` — 1200x630 Open Graph image (also `.svg` source)
- `src/icon-{16,32,64,192,512}.png` — favicon rasters
- `src/apple-touch-icon.png` — 180x180 iOS home-screen
- `src/manifest.webmanifest` — PWA manifest
- `src/favicon.ico` — multi-resolution legacy favicon

## generation

`bun run generate-icons` regenerates the PNG rasters from `icon.svg`
using `scripts/generate-icons.ts`. Run after every SVG edit.
```

- [ ] **Step 4.7: Update `apps/web/package.json` deps + scripts**

In `apps/web/package.json`, the brand dep is already declared (workspace:*). Verify the `prebuild` / `predev` scripts:

```json
"prebuild": "cp -r ../../packages/brand/src/*.{svg,png,webmanifest,ico} public/ 2>/dev/null || true",
"predev":   "cp -r ../../packages/brand/src/*.{svg,png,webmanifest,ico} public/ 2>/dev/null || true"
```

- [ ] **Step 4.8: Add identical hook to `apps/app/package.json`**

In `apps/app/package.json`, add the same two scripts:

```json
"prebuild": "cp -r ../../packages/brand/src/*.{svg,png,webmanifest,ico} public/ 2>/dev/null || true",
"predev":   "cp -r ../../packages/brand/src/*.{svg,png,webmanifest,ico} public/ 2>/dev/null || true"
```

- [ ] **Step 4.9: Gitignore `apps/*/public/` (except `.gitkeep`)**

Append to `.gitignore`:

```
# Brand assets copied at prebuild from packages/brand/src/
apps/web/public/*
!apps/web/public/.gitkeep
apps/app/public/*
!apps/app/public/.gitkeep
```

Create `apps/web/public/.gitkeep` (empty file) and `apps/app/public/.gitkeep` if not already.

- [ ] **Step 4.10: Verify prebuild copies assets to both apps**

```bash
rm -rf apps/web/public/* apps/app/public/*
touch apps/web/public/.gitkeep apps/app/public/.gitkeep
bun install
bun run build
```

Expected:
```bash
ls apps/web/public/icon.svg apps/web/public/manifest.webmanifest
ls apps/app/public/icon.svg apps/app/public/manifest.webmanifest
```

Both lists print files.

- [ ] **Step 4.11: Commit + PR**

```bash
git add packages/brand apps/web/package.json apps/app/package.json .gitignore apps/web/public/.gitkeep apps/app/public/.gitkeep
git commit -m "chore(brand): hoist brand assets into @wingmic/brand

- Logos / favicons / OG image / manifest moved from apps/web/public to packages/brand/src
- packages/brand exports brandAssets URL helpers via tsup esm build
- apps/web + apps/app both have prebuild + predev hooks that cp src files to their public/
- apps/*/public/ now gitignored except .gitkeep

Refs #13 · spec §3.4"
git push -u origin chore/hoist-packages-brand
gh pr create --base staging --head chore/hoist-packages-brand \
  --title "chore(brand): hoist into @wingmic/brand" \
  --body "Refs #13 · spec §3.4

Both apps' public/ directories now generated at prebuild from packages/brand/src/. Source-of-truth single, dual-consumer."
```

---

## Task 5: Hoist `packages/design-tokens` (spec §3.5)

**Files:**
- Create: `packages/design-tokens/{package.json,tsconfig.json,tsup.config.ts,src/...,tailwind-preset.ts}`
- Modify: `apps/web/tailwind.config.ts`, `apps/app/tailwind.config.ts` (extend the preset)

**Branch:** `chore/hoist-design-tokens`

- [ ] **Step 5.1: Branch**

```bash
git checkout staging && git pull --rebase origin staging
git checkout -b chore/hoist-design-tokens
```

- [ ] **Step 5.2: Create `packages/design-tokens/` skeleton**

```bash
mkdir -p packages/design-tokens/src
```

`packages/design-tokens/package.json`:

```json
{
  "name": "@wingmic/design-tokens",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist", "src", "tailwind-preset.ts"],
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
    "./tailwind-preset": "./tailwind-preset.ts"
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts --clean --sourcemap",
    "dev": "tsup src/index.ts --format esm --dts --watch",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@wingmic/config-tsconfig": "workspace:*",
    "tailwindcss": "^3.4.14",
    "tsup": "^8.0.0",
    "typescript": "^5.6.3"
  }
}
```

`packages/design-tokens/tsconfig.json`:

```json
{
  "extends": "@wingmic/config-tsconfig/node.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "noEmit": false
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 5.3: Create token source files**

`packages/design-tokens/src/colors.ts`:

```ts
export const colors = {
  bg: {
    page: '#0a0a0a',
    card: '#08080d',
  },
  ink: {
    DEFAULT: '#f4f1ea',
    pure: '#ffffff',
  },
  accent: '#FFC452',
  second: '#86efac',
  third: '#FF8FAB',
  alarm: '#FF6B6B',
  info: {
    blue: '#7DD3FC',
    violet: '#A78BFA',
  },
  surface: {
    1: 'rgba(255,255,255,0.025)',
    2: 'rgba(255,255,255,0.04)',
    3: 'rgba(255,255,255,0.06)',
  },
  border: {
    soft: 'rgba(255,255,255,0.06)',
    mid: 'rgba(255,255,255,0.10)',
    hard: 'rgba(255,255,255,0.15)',
  },
} as const;
```

`packages/design-tokens/src/spacing.ts`:

```ts
export const spacing = {
  px: { 4: 4, 6: 6, 8: 8, 10: 10, 12: 12, 14: 14, 16: 16, 20: 20, 24: 24, 28: 28, 32: 32, 40: 40, 48: 48, 60: 60, 72: 72, 96: 96, 120: 120 },
} as const;
```

`packages/design-tokens/src/radii.ts`:

```ts
export const radii = { sm: 6, md: 10, lg: 14, xl: 22, '2xl': 36, pill: 999 } as const;
```

`packages/design-tokens/src/shadows.ts`:

```ts
export const shadows = {
  sticker: '3px 3px 0 rgba(0,0,0,0.2)',
  button: '4px 4px 0 #000',
  buttonHover: '5px 5px 0 #000',
  card: '0 20px 50px rgba(0,0,0,0.4)',
  phone: '0 30px 60px rgba(0,0,0,0.5), inset 0 0 40px rgba(255,196,82,0.05)',
  glowAccent: '0 0 80px rgba(255,196,82,0.15)',
} as const;
```

`packages/design-tokens/src/typography.ts`:

```ts
export const typography = {
  family: {
    sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
    serif: ['var(--font-instrument)', 'serif'],
    mono: ['var(--font-jetbrains)', 'monospace'],
  },
  letterSpacing: {
    tighter: '-0.045em',
    tight: '-0.035em',
  },
} as const;
```

`packages/design-tokens/src/index.ts`:

```ts
export { colors } from './colors';
export { spacing } from './spacing';
export { radii } from './radii';
export { shadows } from './shadows';
export { typography } from './typography';
```

- [ ] **Step 5.4: Create the Tailwind preset**

`packages/design-tokens/tailwind-preset.ts`:

```ts
import type { Config } from 'tailwindcss';
import { colors } from './src/colors';
import { radii } from './src/radii';
import { shadows } from './src/shadows';
import { typography } from './src/typography';

export const wingmicPreset: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        ink: { page: colors.bg.page, card: colors.bg.card, DEFAULT: colors.ink.DEFAULT, pure: colors.ink.pure },
        accent: colors.accent,
        second: colors.second,
        third: colors.third,
        alarm: colors.alarm,
        info: { blue: colors.info.blue, violet: colors.info.violet },
        surface: colors.surface,
        border: colors.border,
      },
      fontFamily: {
        sans: typography.family.sans,
        serif: typography.family.serif,
        mono: typography.family.mono,
      },
      letterSpacing: typography.letterSpacing,
      borderRadius: {
        sm: `${radii.sm}px`,
        md: `${radii.md}px`,
        lg: `${radii.lg}px`,
        xl: `${radii.xl}px`,
        '2xl': `${radii['2xl']}px`,
      },
      boxShadow: {
        sticker: shadows.sticker,
        button: shadows.button,
        'button-hover': shadows.buttonHover,
        card: shadows.card,
        phone: shadows.phone,
        'glow-accent': shadows.glowAccent,
      },
      keyframes: {
        blink: { '0%, 50%': { opacity: '1' }, '51%, 100%': { opacity: '0' } },
        'drift-up': { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
        'pulse-d': { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.4' } },
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        'spin-slow': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
      },
      animation: {
        blink: 'blink 0.7s step-end infinite',
        'drift-up': 'drift-up 5s ease-in-out infinite',
        'pulse-d': 'pulse-d 1.5s ease-in-out infinite',
        marquee: 'marquee 40s linear infinite',
        'spin-slow': 'spin-slow 20s linear infinite',
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 5.5: Update `apps/web/tailwind.config.ts` to use the preset**

```ts
import type { Config } from 'tailwindcss';
import { wingmicPreset } from '@wingmic/design-tokens/tailwind-preset';

const config: Config = {
  presets: [wingmicPreset as Config],
  content: ['./app/**/*.{ts,tsx}'],
};

export default config;
```

- [ ] **Step 5.6: Update `apps/app/tailwind.config.ts`** identically

```ts
import type { Config } from 'tailwindcss';
import { wingmicPreset } from '@wingmic/design-tokens/tailwind-preset';

const config: Config = {
  presets: [wingmicPreset as Config],
  content: ['./app/**/*.{ts,tsx}'],
};

export default config;
```

- [ ] **Step 5.7: Verify both apps build with the preset**

```bash
bun install
bun run build
```

Expected: both apps build green. Tailwind classes resolve from the preset.

- [ ] **Step 5.8: Commit + PR**

```bash
git add packages/design-tokens apps/web/tailwind.config.ts apps/app/tailwind.config.ts bun.lock
git commit -m "chore(design-tokens): hoist into @wingmic/design-tokens

- TS source for colors / spacing / radii / shadows / typography
- Tailwind preset both apps extend (apps/web + apps/app)
- One source of truth for design system tokens

Refs #13 · spec §3.5"
git push -u origin chore/hoist-design-tokens
gh pr create --base staging --head chore/hoist-design-tokens \
  --title "chore(design-tokens): hoist into @wingmic/design-tokens" \
  --body "Refs #13 · spec §3.5"
```

---

## Task 6: Hoist `packages/db` (spec §3.6)

**Files:**
- Create: `packages/db/{package.json,tsconfig.json,tsup.config.ts,src/{schema.ts,client.ts,index.ts},drizzle/,drizzle.config.ts,scripts/migrate.ts}`
- Modify: every `apps/app/lib/...` file that imported `@/lib/db` — switch to `@wingmic/db`

**Branch:** `chore/hoist-packages-db`

- [ ] **Step 6.1: Branch**

```bash
git checkout staging && git pull --rebase origin staging
git checkout -b chore/hoist-packages-db
```

- [ ] **Step 6.2: Move files**

```bash
mkdir -p packages/db/src packages/db/drizzle/meta packages/db/scripts
git mv apps/app/lib/db/schema.ts packages/db/src/schema.ts
git mv apps/app/lib/db/client.ts packages/db/src/client.ts
git mv apps/app/lib/db/index.ts packages/db/src/index.ts
git mv apps/app/drizzle/*.sql packages/db/drizzle/
git mv apps/app/drizzle/meta packages/db/drizzle/meta
git mv apps/app/drizzle.config.ts packages/db/drizzle.config.ts
git mv apps/app/scripts/migrate.ts packages/db/scripts/migrate.ts
rmdir apps/app/lib/db apps/app/drizzle 2>/dev/null || true
```

- [ ] **Step 6.3: Create `packages/db/package.json`**

```json
{
  "name": "@wingmic/db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist", "src", "drizzle", "drizzle.config.ts", "scripts"],
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
    "./schema": { "types": "./dist/schema.d.ts", "import": "./dist/schema.js" },
    "./client": { "types": "./dist/client.d.ts", "import": "./dist/client.js" }
  },
  "scripts": {
    "build": "tsup src/index.ts src/schema.ts src/client.ts --format esm --dts --clean --sourcemap",
    "dev": "tsup src/index.ts src/schema.ts src/client.ts --format esm --dts --watch",
    "typecheck": "tsc --noEmit",
    "generate": "drizzle-kit generate",
    "push": "drizzle-kit push",
    "studio": "drizzle-kit studio",
    "apply": "bun run scripts/migrate.ts"
  },
  "dependencies": {
    "@libsql/client": "^0.17.3",
    "@paralleldrive/cuid2": "^3.3.0",
    "drizzle-orm": "^0.45.2"
  },
  "devDependencies": {
    "@wingmic/config-tsconfig": "workspace:*",
    "drizzle-kit": "^0.31.10",
    "tsup": "^8.0.0",
    "typescript": "^5.6.3"
  }
}
```

- [ ] **Step 6.4: Create `packages/db/tsconfig.json`**

```json
{
  "extends": "@wingmic/config-tsconfig/node.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "noEmit": false
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 6.5: Update `packages/db/drizzle.config.ts` paths**

Open the moved file. Change relative paths to point inside the package:

```ts
import { defineConfig } from 'drizzle-kit';
import { env } from '../app/lib/config/env'; // OLD — fix below

// Replace import path:
import { env } from '../../apps/app/lib/config/env';
```

Then change schema + out paths:

```ts
export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'turso',
  dbCredentials: {
    url: env.TURSO_DB_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  },
  verbose: true,
  strict: true,
});
```

(Note: env lives in `apps/app/lib/config/env.ts` until issue #12 hoists it to `packages/env`.)

- [ ] **Step 6.6: Update `packages/db/scripts/migrate.ts` paths**

```ts
import { createClient } from '@libsql/client';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { drizzle } from 'drizzle-orm/libsql';
import { env } from '../../../apps/app/lib/config/env';

async function main() {
  const client = createClient({
    url: env.TURSO_DB_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  });
  const db = drizzle(client);

  console.log(`[migrate] applying migrations to ${env.TURSO_DB_URL}`);
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log(`[migrate] done`);
  client.close();
}

main().catch((err) => {
  console.error('[migrate] failed:', err);
  process.exit(1);
});
```

- [ ] **Step 6.7: Update consumer imports in `apps/app/`**

Run from repo root:

```bash
# auth.ts
sed -i.bak "s|from './db/client'|from '@wingmic/db'|g; s|from './db/schema'|from '@wingmic/db/schema'|g" apps/app/lib/auth.ts
rm apps/app/lib/auth.ts.bak

# trpc context
sed -i.bak "s|from '@/lib/db/client'|from '@wingmic/db'|g; s|from '@/lib/db/schema'|from '@wingmic/db/schema'|g" apps/app/lib/trpc/context.ts
rm apps/app/lib/trpc/context.ts.bak

# capture router
sed -i.bak "s|from '@/lib/db/client'|from '@wingmic/db'|g; s|from '@/lib/db/schema'|from '@wingmic/db/schema'|g" apps/app/lib/trpc/routers/capture.ts
rm apps/app/lib/trpc/routers/capture.ts.bak

# recall router
sed -i.bak "s|from '@/lib/db/client'|from '@wingmic/db'|g; s|from '@/lib/db/schema'|from '@wingmic/db/schema'|g" apps/app/lib/trpc/routers/recall.ts
rm apps/app/lib/trpc/routers/recall.ts.bak

# extractor resolution (still in apps/app/lib until Task 7)
sed -i.bak "s|from '@/lib/db/client'|from '@wingmic/db'|g; s|from '@/lib/db/schema'|from '@wingmic/db/schema'|g" apps/app/lib/extractor/resolution.ts
rm apps/app/lib/extractor/resolution.ts.bak
```

- [ ] **Step 6.8: Add `@wingmic/db` dep to `apps/app/package.json`**

Already declared in Task 3 step 3.4 (`"@wingmic/db": "workspace:*"`). Verify it's there.

- [ ] **Step 6.9: Update root `package.json` db scripts**

```json
"db:generate": "bun --filter=@wingmic/db generate",
"db:apply":    "bun --filter=@wingmic/db apply",
"db:studio":   "bun --filter=@wingmic/db studio"
```

- [ ] **Step 6.10: Verify**

```bash
bun install
bun run typecheck
```

Expected: exit 0. `apps/app/lib/auth.ts` and friends now import from `@wingmic/db`.

```bash
bun run db:apply
```

Expected: `[migrate] applying migrations to file:./local.db` then `[migrate] done`. Local file: `packages/db/local.db`.

```bash
sqlite3 packages/db/local.db ".tables"
```

Expected: 17 tables + `__drizzle_migrations`.

```bash
bun run build
```

Expected: both apps build green.

- [ ] **Step 6.11: Commit + PR**

```bash
git add packages/db apps/app .gitignore package.json bun.lock
git commit -m "chore(db): hoist into @wingmic/db (Drizzle + libSQL + migrations)

- src/{schema.ts, client.ts, index.ts} moved from apps/app/lib/db
- drizzle/ migrations + drizzle.config.ts moved
- scripts/migrate.ts moved (relative-path env import fixed)
- apps/app consumers re-pointed from '@/lib/db' → '@wingmic/db'
- root db:generate / db:apply / db:studio scripts proxy via turbo filter

Refs #13 · spec §3.6"
git push -u origin chore/hoist-packages-db
gh pr create --base staging --head chore/hoist-packages-db \
  --title "chore(db): hoist into @wingmic/db" \
  --body "Refs #13 · spec §3.6"
```

---

## Task 7: Hoist `packages/extractor` (spec §3.7)

**Files:**
- Create: `packages/extractor/{package.json,tsconfig.json,vitest.config.ts,tsup.config.ts,src/...}`
- Modify: `apps/app/lib/trpc/routers/{capture,recall}.ts` — switch from `@/lib/extractor` → `@wingmic/extractor`

**Branch:** `chore/hoist-packages-extractor`

- [ ] **Step 7.1: Branch**

```bash
git checkout staging && git pull --rebase origin staging
git checkout -b chore/hoist-packages-extractor
```

- [ ] **Step 7.2: Move extractor files**

```bash
mkdir -p packages/extractor/src/__tests__ packages/extractor/src/eval
git mv apps/app/lib/extractor/schema.ts packages/extractor/src/schema.ts
git mv apps/app/lib/extractor/prompt.ts packages/extractor/src/prompt.ts
git mv apps/app/lib/extractor/client.ts packages/extractor/src/client.ts
git mv apps/app/lib/extractor/embeddings.ts packages/extractor/src/embeddings.ts
git mv apps/app/lib/extractor/slug.ts packages/extractor/src/slug.ts
git mv apps/app/lib/extractor/resolution.ts packages/extractor/src/resolution.ts
git mv apps/app/lib/extractor/index.ts packages/extractor/src/index.ts
git mv apps/app/lib/extractor/eval/fixtures.json packages/extractor/src/eval/fixtures.json
git mv apps/app/lib/extractor/eval/runner.ts packages/extractor/src/eval/runner.ts
git mv apps/app/lib/extractor/slug.test.ts packages/extractor/src/__tests__/slug.test.ts
git mv apps/app/lib/extractor/embeddings.test.ts packages/extractor/src/__tests__/embeddings.test.ts
# resolution.test.ts + integration.test.ts move only if planted by v0.1.1 Tasks 1 + 2
[ -f apps/app/lib/extractor/resolution.test.ts ] && git mv apps/app/lib/extractor/resolution.test.ts packages/extractor/src/__tests__/resolution.test.ts
[ -f apps/app/lib/extractor/integration.test.ts ] && git mv apps/app/lib/extractor/integration.test.ts packages/extractor/src/__tests__/integration.test.ts
rmdir apps/app/lib/extractor 2>/dev/null || true
```

- [ ] **Step 7.3: Create `packages/extractor/package.json`**

```json
{
  "name": "@wingmic/extractor",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist", "src"],
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
    "./schema": { "types": "./dist/schema.d.ts", "import": "./dist/schema.js" },
    "./eval/fixtures.json": "./src/eval/fixtures.json"
  },
  "scripts": {
    "build": "tsup src/index.ts src/schema.ts --format esm --dts --clean --sourcemap",
    "dev": "tsup src/index.ts src/schema.ts --format esm --dts --watch",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "eval": "bun run src/eval/runner.ts"
  },
  "dependencies": {
    "@ai-sdk/anthropic": "^3.0.74",
    "@ai-sdk/openai": "^3.0.58",
    "@wingmic/db": "workspace:*",
    "ai": "^6.0.174",
    "drizzle-orm": "^0.45.2",
    "zod": "^4.4.2"
  },
  "devDependencies": {
    "@wingmic/config-tsconfig": "workspace:*",
    "@wingmic/config-vitest": "workspace:*",
    "tsup": "^8.0.0",
    "typescript": "^5.6.3",
    "vitest": "^4.1.5"
  }
}
```

- [ ] **Step 7.4: Create `packages/extractor/tsconfig.json`**

```json
{
  "extends": "@wingmic/config-tsconfig/node.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "noEmit": false
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 7.5: Create `packages/extractor/vitest.config.ts`**

```ts
import baseConfig from '@wingmic/config-vitest/base.config';
import { mergeConfig, defineConfig } from 'vitest/config';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    },
  }),
);
```

- [ ] **Step 7.6: Update resolution.ts imports**

`packages/extractor/src/resolution.ts` previously imported via `@/lib/db/...`. Replace with package imports:

```ts
import type { DB } from '@wingmic/db';
import * as schema from '@wingmic/db/schema';
```

- [ ] **Step 7.7: Update `apps/app` consumer imports**

```bash
sed -i.bak "s|from '@/lib/extractor'|from '@wingmic/extractor'|g; s|from '@/lib/extractor/schema'|from '@wingmic/extractor/schema'|g" apps/app/lib/trpc/routers/capture.ts apps/app/lib/trpc/routers/recall.ts
rm apps/app/lib/trpc/routers/capture.ts.bak apps/app/lib/trpc/routers/recall.ts.bak
```

- [ ] **Step 7.8: Update root scripts**

In root `package.json`:

```json
"extract:eval": "bun --filter=@wingmic/extractor eval"
```

- [ ] **Step 7.9: Update eval runner relative paths**

`packages/extractor/src/eval/runner.ts` imports the fixture via `readFileSync(resolve(__dirname, 'fixtures.json'))`. Verify the path resolves to `packages/extractor/src/eval/fixtures.json` (it does — same directory).

- [ ] **Step 7.10: Verify**

```bash
bun install
bun run typecheck
```

Expected: exit 0.

```bash
bun --filter=@wingmic/extractor test
```

Expected: 19+ tests pass (slug + embeddings + any resolution/integration tests planted by v0.1.1).

```bash
bun run build
```

Expected: both apps build green.

- [ ] **Step 7.11: Commit + PR**

```bash
git add packages/extractor apps/app package.json bun.lock
git commit -m "chore(extractor): hoist into @wingmic/extractor

- src/{schema, prompt, client, embeddings, slug, resolution, index} moved
- src/eval/{fixtures.json, runner.ts} moved
- src/__tests__/{slug, embeddings}.test.ts moved
- apps/app consumers re-pointed '@/lib/extractor' → '@wingmic/extractor'
- Vitest config extends @wingmic/config-vitest preset

Refs #13 · spec §3.7"
git push -u origin chore/hoist-packages-extractor
gh pr create --base staging --head chore/hoist-packages-extractor \
  --title "chore(extractor): hoist into @wingmic/extractor" \
  --body "Refs #13 · spec §3.7

The entity-detection pipeline is now an isolated package — own test boundary, own eval gate, ready for the algorithm work."
```

---

## Task 8: Update `.github/workflows/ci.yml` (spec §3.8)

**Files:**
- Modify: `.github/workflows/ci.yml`

**Branch:** `ci/turbo-pipeline`

- [ ] **Step 8.1: Branch**

```bash
git checkout staging && git pull --rebase origin staging
git checkout -b ci/turbo-pipeline
```

- [ ] **Step 8.2: Replace `.github/workflows/ci.yml`**

```yaml
name: ci

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main, staging]

permissions:
  contents: read

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build:
    name: lint · typecheck · build · vitest
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5

      - name: setup bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.3.10

      - name: cache turbo
        uses: actions/cache@v4
        with:
          path: .turbo
          key: turbo-${{ runner.os }}-${{ github.sha }}
          restore-keys: |
            turbo-${{ runner.os }}-

      - name: install dependencies
        run: bun install --frozen-lockfile

      - name: typecheck
        run: bun run typecheck

      - name: lint
        run: bun run lint

      - name: test
        run: bun run test

      - name: build
        run: bun run build

      - name: verify landing has no auth/db leak
        run: |
          LEAKS=$(grep -rE "betterAuth|libsql|drizzle|@trpc" apps/web/out/_next/static/chunks/*.js 2>/dev/null | wc -l | tr -d ' ')
          if [ "$LEAKS" -ne "0" ]; then
            echo "ERROR: $LEAKS auth/db references found in apps/web/out — landing must be static"
            exit 1
          fi
```

- [ ] **Step 8.3: Verify locally**

```bash
bun run typecheck && bun run lint && bun run test && bun run build
```

Expected: all four green.

```bash
grep -rE "betterAuth|libsql|drizzle|@trpc" apps/web/out/_next/static/chunks/*.js 2>/dev/null | wc -l
```

Expected: `0`.

- [ ] **Step 8.4: Commit + PR**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: turbo pipeline with landing-leak guard

- Single job orchestrates lint + typecheck + test + build across all workspaces via turbo
- Adds Turborepo cache step (restore-keys for prefix-match invalidation)
- Adds explicit guard: apps/web/out must contain zero references to betterAuth/libsql/drizzle/@trpc (landing must be static)

Refs #13 · spec §3.8"
git push -u origin ci/turbo-pipeline
gh pr create --base staging --head ci/turbo-pipeline \
  --title "ci: turbo pipeline with landing-leak guard" \
  --body "Refs #13 · spec §3.8

Required status check name stays \`lint · typecheck · build · vitest\` — matches the branch protection config already set on main + staging."
```

---

## Task 9: Write `CLAUDE.md` + update README + docs (spec §3.9)

**Files:**
- Create: `CLAUDE.md` (project root)
- Create: `docs/packages.md`
- Modify: `README.md` (monorepo layout, scripts, deploy section)
- Modify: `CONTRIBUTING.md` (referenced files note)
- Modify: `docs/architecture.md` (add § 0 monorepo layout, update capture/recall flow paths)
- Modify: `docs/deploy.md` (split into Landing + Product sections)

**Branch:** `docs/restructure-claude-md`

- [ ] **Step 9.1: Branch**

```bash
git checkout staging && git pull --rebase origin staging
git checkout -b docs/restructure-claude-md
```

- [ ] **Step 9.2: Create `CLAUDE.md` at repo root**

Use the content block from spec §4 verbatim. Save as `CLAUDE.md`. Critical sections:

- Stack table — Hosting row reads: `Cloudflare Pages (apps/web static) + Cloudflare Workers (apps/app dynamic via @opennextjs/cloudflare)`
- Monorepo map includes both `apps/web` and `apps/app` lines
- Conventions: no AI co-author trailer, Conventional Commits, brand voice, no `process.env.X` outside `packages/env` (when issue #12 lands), no `console.log` outside `packages/logger` (when issue #12 lands), one change per PR
- Skill routing entries point at gstack skills
- Key files: docs/architecture.md, docs/deploy.md, docs/packages.md, CONTRIBUTING.md, design/design-system.md, current implementation plan path
- Scope guards: don't edit design/, don't edit eval fixtures, don't bypass the four wedges

(Full content body is in spec §4 lines 510–615 of the spec document — reuse verbatim.)

- [ ] **Step 9.3: Create `docs/packages.md`**

```markdown
# Adding a Package to the Monorepo

Wingmic uses Turborepo + Bun workspaces. Adding a new package is a five-minute job.

## naming

`@wingmic/<name>`. All-lowercase, hyphenated for multi-word (`@wingmic/design-tokens`, not `@wingmic/designTokens`). All packages are `private: true` — we don't publish to npm.

## minimum files

```
packages/<name>/
  package.json     ← name, scripts, deps
  tsconfig.json    ← extends @wingmic/config-tsconfig/node.json (or react.json)
  tsup.config.ts   ← optional, if package has runtime code
  vitest.config.ts ← optional, if package has tests
  src/
    index.ts       ← public surface
```

## package.json template

```json
{
  "name": "@wingmic/<name>",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist", "src"],
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts --clean --sourcemap",
    "dev": "tsup src/index.ts --format esm --dts --watch",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "devDependencies": {
    "@wingmic/config-tsconfig": "workspace:*",
    "@wingmic/config-vitest": "workspace:*",
    "tsup": "^8.0.0",
    "typescript": "^5.6.3"
  }
}
```

## tsconfig.json template

```json
{
  "extends": "@wingmic/config-tsconfig/node.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "noEmit": false
  },
  "include": ["src/**/*"]
}
```

## consuming the package from an app

In `apps/<app>/package.json`:

```json
"dependencies": {
  "@wingmic/<name>": "workspace:*"
}
```

Then `bun install` from repo root.

## running scripts for one package

```
bun --filter=@wingmic/<name> build
bun --filter=@wingmic/<name> test
bun --filter=@wingmic/<name> typecheck
```

## ordering

Turbo resolves build order from the dependency graph. A package that depends on `@wingmic/db` builds after `@wingmic/db`. Don't write circular deps; tsup will fail with `EBUSY` or unresolved imports.
```

- [ ] **Step 9.4: Update `README.md` monorepo layout block**

Find the `## monorepo layout` block in `README.md`. Replace it with:

````markdown
## monorepo layout

```
apps/web              ← static landing → wingmic.xyz (Cloudflare Pages)
apps/app              ← dynamic product → app.wingmic.xyz (Cloudflare Workers)
packages/
  brand               ← logos, favicons, OG, manifest
  design-tokens       ← Tailwind preset + token TS exports
  db                  ← Drizzle schema + libSQL + migrations
  extractor           ← entity-detection pipeline + eval harness
  config/{tsconfig,eslint,vitest}
design/               ← canonical mocks (read-only)
docs/                 ← architecture.md, deploy.md, packages.md, superpowers/
CLAUDE.md             ← Claude Code project context
turbo.json
```

Built as a Turborepo monorepo. See [`docs/architecture.md`](docs/architecture.md) § 0 for the full map.
````

- [ ] **Step 9.5: Add "Two deploy targets" subsection to README.md**

Insert after the `## stack` table (or wherever appropriate):

````markdown
## two deploy targets

| Surface | Source | Hosting | URL |
|---|---|---|---|
| **Landing** (static) | `apps/web` → `next export` | Cloudflare Pages | `wingmic.xyz` |
| **Product** (dynamic) | `apps/app` → @opennextjs/cloudflare | Cloudflare Workers | `app.wingmic.xyz` |

Operator runbook: [`docs/deploy.md`](docs/deploy.md).
````

- [ ] **Step 9.6: Update README.md scripts cheat sheet**

Replace the existing scripts block with:

````markdown
## scripts (workspace root)

```bash
bun run dev          # turbo dev — defaults to apps/web; use dev:app for product
bun run dev:web      # apps/web on :3210
bun run dev:app      # apps/app on :3211
bun run typecheck    # all workspaces
bun run lint         # all workspaces
bun run test         # all workspaces
bun run build        # apps/web (next export) + apps/app (next build)
bun run db:apply     # apply migrations against TURSO_DB_URL or local file
bun run db:studio    # open Drizzle Studio
bun run extract:eval # run canonical 50-fixture extractor accuracy suite
```

Filter to one workspace: `bun --filter=@wingmic/<name> <script>`.
````

- [ ] **Step 9.7: Update README.md "self-host" section**

Replace any references to `cd apps/web && bun run cf:deploy` with the workspace-root equivalents:

```bash
# Landing
bun --filter=@wingmic/web build
bunx wrangler pages deploy apps/web/out --project-name=wingmic-landing

# Product
bun --filter=@wingmic/app cf:build
bun --filter=@wingmic/app cf:deploy
```

- [ ] **Step 9.8: Update `docs/architecture.md`** to add § 0 monorepo layout

Add at the top (right after the title and TOC):

````markdown
## § 0 monorepo layout

Wingmic is a Turborepo monorepo with two Next.js apps and shared packages.

```
apps/
  web/                ← static landing → wingmic.xyz
  app/                ← dynamic product → app.wingmic.xyz
packages/
  brand               ← brand assets (logos, favicons, OG, manifest)
  design-tokens       ← Tailwind preset + token TS
  db                  ← Drizzle + libSQL + migrations + client
  extractor           ← entity-detection: Zod schema + Claude prompt + embeddings + resolution + eval
  config/             ← shared tsconfig, eslint, vitest presets
```

`apps/web` is pure-static — no DB import, no auth code, no API routes. It deploys to Cloudflare Pages as static assets, accepts zero secrets.

`apps/app` is dynamic — runs on Cloudflare Workers via @opennextjs/cloudflare. Handles authentication (BetterAuth + Resend magic link, cookie scoped to `app.wingmic.xyz`), capture, recall, dashboard, tRPC API.

Shared code lives in `packages/*` and is consumed by `apps/app`. `apps/web` only consumes `@wingmic/brand` and `@wingmic/design-tokens` — never `@wingmic/db` or `@wingmic/extractor` (would defeat the static promise).
````

- [ ] **Step 9.9: Update `docs/architecture.md` capture/recall flow paths**

Find every `apps/web/lib/extractor/...` reference in the capture and recall flow ASCII diagrams and replace with `@wingmic/extractor`. Same for `apps/web/lib/db/...` → `@wingmic/db`. Mention that the flows execute in `apps/app`, not `apps/web`.

- [ ] **Step 9.10: Rewrite `docs/deploy.md` into Landing + Product sections**

Use the content from spec §5 `docs/deploy.md` block as the target shape. Skeleton:

````markdown
# deploy

Wingmic ships two surfaces:

- **wingmic.xyz** — static landing built from `apps/web`, served by Cloudflare Pages.
- **app.wingmic.xyz** — dynamic product built from `apps/app`, served by Cloudflare Workers.

This guide covers both.

---

## § Landing deploy (`wingmic.xyz`)

Static export. No secrets. No Worker. Pure CDN.

### Build

```bash
bun --filter=@wingmic/web build
```

Produces `apps/web/out/` via `next build && next export`.

### Deploy

```bash
bunx wrangler pages deploy apps/web/out --project-name=wingmic-landing
```

First deploy creates the Pages project. Subsequent deploys overwrite.

### DNS

Cloudflare dashboard → Pages → `wingmic-landing` → Custom Domains → add `wingmic.xyz`.

### Required env

Only `NEXT_PUBLIC_APP_URL=https://app.wingmic.xyz` (compile-time; set in `apps/web/.env.production`). No runtime secrets.

---

## § Product deploy (`app.wingmic.xyz`)

Dynamic Next.js app on Cloudflare Workers. Needs 8 secrets.

### 8 secrets

[Reuse the 8-secret table from the existing deploy.md.]

### Build

```bash
bun --filter=@wingmic/app cf:build
```

### Deploy

```bash
bun --filter=@wingmic/app cf:deploy
```

### DNS

Cloudflare dashboard → Worker → Triggers → Custom Domains → add `app.wingmic.xyz`. Set `BETTER_AUTH_URL=https://app.wingmic.xyz` after the cert provisions; re-deploy.

### Blocked on issue #7 (libSQL bundling)

Until issue #7 is fixed via the post-build bundle script (lands as part of v0.1.1 Task 8), `cf:build` fails. Landing deploy is **not** affected.

---

## § Local development

```bash
git clone https://github.com/Ayaan2907/wingmic.git
cd wingmic
bun install
cp apps/app/.env.example apps/app/.env.local
# fill ANTHROPIC_API_KEY + OPENAI_API_KEY at minimum
bun --filter=@wingmic/app db:apply
bun run dev   # apps/web on :3210; for product run `bun run dev:app` on :3211
```

---

## § Troubleshooting

[Keep existing troubleshooting blocks; add a new "monorepo / Turborepo cache" subsection:]

### stale Turborepo cache

```bash
rm -rf .turbo apps/*/.next apps/*/.open-next
bun install --force
bun run build
```
````

- [ ] **Step 9.11: Update `CONTRIBUTING.md` ground rules**

In `CONTRIBUTING.md` near the top of the `ground rules` section, add:

```markdown
0. **Read `CLAUDE.md`.** It tells Claude Code (and you) the conventions enforced on this repo. AI coding assistants auto-load it on session start.
```

- [ ] **Step 9.12: Verify docs build / render**

```bash
bun run lint
bun run typecheck
```

Expected: both exit 0 (no code changes; markdown skipped by both).

- [ ] **Step 9.13: Commit + PR**

```bash
git add CLAUDE.md README.md CONTRIBUTING.md docs/architecture.md docs/deploy.md docs/packages.md
git commit -m "docs: CLAUDE.md + monorepo layout + dual-deploy runbook

- CLAUDE.md at repo root — project context, stack lock, monorepo map, conventions, skill routing, scope guards
- README: monorepo layout block, two-deploy-targets table, scripts cheat sheet for workspace-root commands
- docs/architecture.md: new § 0 monorepo layout; capture/recall flow paths updated to @wingmic/extractor + @wingmic/db
- docs/deploy.md: rewritten into Landing + Product sections, 8 secrets only required for product
- docs/packages.md: new — guide to adding a package to the monorepo
- CONTRIBUTING.md: ground rule 0 = read CLAUDE.md

Refs #13 · spec §3.9"
git push -u origin docs/restructure-claude-md
gh pr create --base staging --head docs/restructure-claude-md \
  --title "docs: CLAUDE.md + monorepo layout + dual-deploy runbook" \
  --body "Refs #13 · spec §3.9"
```

---

## Task 10: Cloudflare bundling tweak (spec §3.10)

**Files:**
- Modify: `apps/app/scripts/bundle-libsql.ts` (if landed via v0.1.1 Task 8) OR document the change in `docs/deploy.md` if Task 8 hasn't merged

**Branch:** `chore/cf-bundling-paths`

- [ ] **Step 10.1: Branch**

```bash
git checkout staging && git pull --rebase origin staging
git checkout -b chore/cf-bundling-paths
```

- [ ] **Step 10.2: Check if Task 8 of v0.1.1 plan has landed**

```bash
ls apps/app/scripts/bundle-libsql.ts 2>/dev/null && echo "EXISTS" || echo "NOT YET"
```

If `NOT YET`: skip this task. Add a note to issue #7 that nodePaths must include the new monorepo locations when Task 8 lands. Close this branch:

```bash
git checkout staging
git branch -D chore/cf-bundling-paths
```

Then proceed to Task 11.

If `EXISTS`: continue with Step 10.3.

- [ ] **Step 10.3: Update `apps/app/scripts/bundle-libsql.ts` nodePaths**

Find the `build({...})` call. Update `nodePaths` to:

```ts
nodePaths: [
  resolve(repoRoot, 'node_modules'),
  resolve(repoRoot, 'packages/db/node_modules'),
  resolve(repoRoot, 'packages/extractor/node_modules'),
  resolve(repoRoot, 'apps/app/node_modules'),
],
```

`repoRoot` should be computed as `resolve(__dirname, '../../..')` to go up from `apps/app/scripts/` to repo root.

- [ ] **Step 10.4: Verify `cf:build` runs without import-resolution errors**

```bash
bun --filter=@wingmic/app cf:build
```

If issue #7 itself isn't resolved (which is independent of this restructure), `cf:build` may still fail on a different libsql-related error. The path-additions in this step are pre-staging — they don't fix #7, they just ensure the restructure doesn't add a new path-resolution issue.

- [ ] **Step 10.5: Commit + PR**

```bash
git add apps/app/scripts/bundle-libsql.ts
git commit -m "chore(deploy): extend bundle-libsql nodePaths for monorepo packages

After the restructure, @libsql/client + dependencies live in
packages/db/node_modules and packages/extractor/node_modules (via
hoisting + workspace symlinks). The Cloudflare bundle script's
esbuild step needs to see those locations to resolve imports.

Refs #13 · spec §3.10 · also touches #7"
git push -u origin chore/cf-bundling-paths
gh pr create --base staging --head chore/cf-bundling-paths \
  --title "chore(deploy): extend bundle-libsql nodePaths for monorepo" \
  --body "Refs #13 · spec §3.10

Pre-stages the path additions needed by issue #7's eventual fix."
```

---

## Task 11: Final verification + close epic (spec §3.11)

**Files:**
- No file changes — this is the verification + epic-closing PR.

**Branch:** `chore/restructure-final-verify`

- [ ] **Step 11.1: Branch**

```bash
git checkout staging && git pull --rebase origin staging
git checkout -b chore/restructure-final-verify
```

- [ ] **Step 11.2: Run the 10-step verification matrix**

```bash
# 1. Clean install
rm -rf node_modules apps/*/node_modules packages/**/node_modules \
       apps/*/.next apps/*/.open-next apps/web/out .turbo
bun install --frozen-lockfile
```

Expected: install completes.

```bash
# 2. Turbo pipeline
bun run typecheck
bun run lint
bun run test
bun run build
```

Expected: all four exit 0.

```bash
# 3. DB migrations still apply
bun run db:apply
sqlite3 packages/db/local.db ".tables"
```

Expected: `[migrate] done` + 17 tables + `__drizzle_migrations`.

```bash
# 4. Brand assets in both apps
ls apps/web/public/icon.svg apps/web/public/manifest.webmanifest
ls apps/app/public/icon.svg apps/app/public/manifest.webmanifest
```

Expected: both lists print files.

```bash
# 5. Landing static export
ls apps/web/out/index.html
grep -q "wingmic" apps/web/out/index.html && echo "OK"
```

Expected: file exists; `OK` printed.

```bash
# 6. Dev smoke (run two terminals)
bun run dev:web   # terminal 1
bun run dev:app   # terminal 2
curl -sI http://localhost:3210/
curl -sI http://localhost:3211/signin
```

Expected: both return `HTTP/1.1 200`.

```bash
# 7. Landing deploy dry-run
bunx wrangler pages deploy apps/web/out --project-name=wingmic-landing --dry-run
```

Expected: dry-run completes, prints planned upload.

```bash
# 8. Product cf:build smoke (may fail if Task 8 of v0.1.1 plan hasn't landed)
bun --filter=@wingmic/app cf:build || echo "blocked on #7"
```

Either green OR blocked on #7 — both are acceptable for the restructure PR.

```bash
# 9. Eval gate
bun run extract:eval
```

Expected: ≥ 85% pass rate on canonical fixtures (requires ANTHROPIC_API_KEY + OPENAI_API_KEY in `apps/app/.env.local`).

```bash
# 10. Landing-leak check
LEAKS=$(grep -rE "betterAuth|libsql|drizzle|@trpc" apps/web/out/_next/static/chunks/*.js 2>/dev/null | wc -l | tr -d ' ')
echo "leaks: $LEAKS"
```

Expected: `leaks: 0`.

- [ ] **Step 11.3: Acceptance criteria checklist**

Open the spec at `docs/superpowers/specs/2026-05-11-monorepo-restructure-design.md` § 6 Acceptance criteria. Tick each box that passed.

- [ ] **Step 11.4: Make a noop commit linking the restructure**

Add a one-line dated note to the changelog:

```bash
mkdir -p docs
echo "" >> docs/CHANGELOG.md
echo "## $(date +%Y-%m-%d) — monorepo restructure" >> docs/CHANGELOG.md
echo "" >> docs/CHANGELOG.md
echo "- apps/web split into static landing (apps/web) + dynamic product (apps/app)" >> docs/CHANGELOG.md
echo "- Shared packages extracted: brand, design-tokens, db, extractor, config/*" >> docs/CHANGELOG.md
echo "- Turborepo orchestrates build, test, lint, typecheck across all workspaces" >> docs/CHANGELOG.md
echo "- Landing deploys to Cloudflare Pages independently of issue #7" >> docs/CHANGELOG.md
echo "- Closes #13" >> docs/CHANGELOG.md
```

Create `docs/CHANGELOG.md` if it doesn't exist (just contains the header `# Changelog` plus the appended block).

- [ ] **Step 11.5: Commit + PR (closes the epic)**

```bash
git add docs/CHANGELOG.md
git commit -m "chore(restructure): final verification + changelog

10-step verification matrix passes (per spec §6):
- Clean install resolves both apps + all packages
- typecheck / lint / test / build all green via Turbo
- DB migrations apply against packages/db
- Brand assets land in apps/{web,app}/public via prebuild
- apps/web/out static export contains zero auth/db references
- Dev servers come up on :3210 (web) + :3211 (app)
- Landing deploy dry-run succeeds (wingmic-landing project)
- Extractor eval ≥ 85% on canonical fixtures

Closes #13 · spec §3.11"
git push -u origin chore/restructure-final-verify
gh pr create --base staging --head chore/restructure-final-verify \
  --title "chore(restructure): final verification + close epic" \
  --body "Closes #13 · spec §3.11

10-step verification matrix passed locally. Landing deploys to Cloudflare Pages on next \`wrangler pages deploy\` — wingmic.xyz unblocked.

## checklist
- [x] Base branch is staging
- [x] All 10 verification steps in spec §6 pass
- [x] Landing bundle has zero auth/db code (leaks: 0)
- [x] Both apps run dev / build / typecheck / lint / test green
- [x] DB migrations apply against packages/db/local.db (17 tables + drizzle table)
- [x] CHANGELOG entry recorded"
```

After this PR merges to `staging`, the maintainer opens the release PR `staging` → `main` and tags `v0.2.0-restructure` (or whatever version is appropriate).

---

## self-review

**1. Spec coverage:**

| Spec section | Plan task |
|---|---|
| §3.1 Install Turborepo + tsup | Task 1 ✓ |
| §3.2 Shared config packages | Task 2 ✓ |
| §3.3 Split apps/web → web + app | Task 3 ✓ |
| §3.4 Hoist packages/brand | Task 4 ✓ |
| §3.5 Hoist packages/design-tokens | Task 5 ✓ |
| §3.6 Hoist packages/db | Task 6 ✓ |
| §3.7 Hoist packages/extractor | Task 7 ✓ |
| §3.8 Update ci.yml | Task 8 ✓ |
| §3.9 CLAUDE.md + README + docs | Task 9 ✓ |
| §3.10 Cloudflare bundling tweak | Task 10 ✓ |
| §3.11 Verify + commit + PR | Task 11 ✓ |
| §4 CLAUDE.md content | Task 9 step 9.2 ✓ |
| §5 docs rewrite | Task 9 ✓ |
| §6 verification matrix | Task 11 ✓ |

**2. Placeholder scan:** No `TBD` / `TODO` / `fill in details`. The one conditional task (Task 10) explicitly handles both branches — Task 8 of v0.1.1 plan has landed OR not.

**3. Type consistency:**
- `@wingmic/db` exports `db`, `client`, `DB` type — used consistently in Task 6 step 6.2, Task 6 step 6.7, Task 7 step 7.6.
- `@wingmic/extractor` exports `extract`, `commit`, `cosine`, etc. — used in Task 7 step 7.7.
- `env` import path (`apps/app/lib/config/env`) referenced in Task 6 step 6.5 + 6.6 matches the file location set by commit `705bbcb`.
- Tailwind preset name `wingmicPreset` exported in Task 5 step 5.4, imported in Task 5 step 5.5 + 5.6.
- All package names follow `@wingmic/<name>` convention. No drift.

**4. Critical dependencies between tasks:**
- Task 3 must land before Tasks 4–7 (apps/app must exist before packages hoist out of it).
- Task 4 (brand) lands before Task 9 (docs reference brand structure).
- Task 6 (db) before Task 7 (extractor depends on db).
- Task 8 (ci) can land any time after Task 1 (turbo) — independent of structural changes.
- Task 9 (docs) is independent but lands after Task 8 so CI screenshots are correct.
- Task 10 conditional; doesn't block Task 11.
- Task 11 needs all prior tasks merged.

---

## execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-11-monorepo-restructure.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best for an 11-task PR queue where each landed PR feeds the next subagent's starting state. Tasks 3 (web/app split) and 6/7 (db/extractor hoists) are highest-churn — subagent isolation prevents cross-contamination of in-progress work.

**2. Inline Execution** — Execute tasks in this session using superpowers:executing-plans, batch execution with checkpoints. Faster if you want to drive each task interactively, but tasks 3, 6, 7 will be heavy turns.

Which approach?
