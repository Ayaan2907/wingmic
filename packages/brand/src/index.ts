/**
 * Canonical brand asset URLs.
 *
 * Most consumers don't import these — landing + app copy the raw files
 * into their own public/ at prebuild time. This module exists for
 * server-side metadata + OG-image generation, where the canonical URL
 * is needed (e.g., absolute URLs for Open Graph tags).
 */

// Resolved to file:// URLs at runtime via import.meta.url.
// Points at ../src/ so it works both in dev (running src/index.ts directly,
// where ../src/foo.svg resolves back to this same directory) and in prod
// (running dist/index.js, where ../src/foo.svg resolves up to the package
// root and back down to src/).
const here = (rel: string) => new URL(`../src/${rel}`, import.meta.url).href;

export const brandAssets = {
  icon: here('icon.svg'),
  iconTile: here('icon-tile.svg'),
  iconMono: here('icon-mono.svg'),
  ogImage: here('og-image.png'),
  manifest: here('manifest.webmanifest'),
  appleTouchIcon: here('apple-touch-icon.png'),
  pngs: {
    px16: here('icon-16.png'),
    px32: here('icon-32.png'),
    px64: here('icon-64.png'),
    px192: here('icon-192.png'),
    px512: here('icon-512.png'),
  },
} as const;

export type BrandAssets = typeof brandAssets;
