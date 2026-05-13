# Changelog

## 2026-05-13 — monorepo restructure

- apps/web split into static landing (apps/web) + dynamic product (apps/app)
- Shared packages extracted: brand, design-tokens, db, extractor, config/*
- Turborepo orchestrates build, test, lint, typecheck across all workspaces
- Landing deploys to Cloudflare Pages independently of issue #7
- Closes #13
