/**
 * Shared ESLint rules for Next.js apps.
 *
 * Usage in .eslintrc.json (legacy mode):
 *   { "extends": ["next/core-web-vitals"], "rules": <see below> }
 *
 * The `extends` is intentionally omitted here so this file can be
 * require()d from any directory without resolution-context issues.
 * Consumers should extend `next/core-web-vitals` separately.
 */
module.exports = {
  rules: {
    '@next/next/no-html-link-for-pages': 'off',
    'react/no-unescaped-entities': 'off',
  },
};
