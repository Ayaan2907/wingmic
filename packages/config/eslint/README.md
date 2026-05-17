# @wingmic/config-eslint

Shared ESLint presets: `base`, `next`, `node`.

## Known quirk: legacy `.eslintrc.json` consumers

ESLint v9's legacy resolver mangles scoped extends — `extends: ["@wingmic/config-eslint/next"]` resolves to `@wingmic/eslint-config-config-eslint/next`, which does not exist. Legacy consumers must either:

1. **Inline the rules** (current approach in `apps/web/.eslintrc.json`).
2. **Use flat config** (`eslint.config.mjs`) which has no name mangling — recommended path for new consumers.

The preset itself (`next.js`, `base.js`, `node.js`) is fully spec-compliant and ready for flat-config or `@scope/eslint-config`-renamed consumers.
