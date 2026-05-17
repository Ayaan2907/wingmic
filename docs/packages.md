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
