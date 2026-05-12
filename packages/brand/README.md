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

## generation

`bun run generate-icons` regenerates the PNG rasters from `icon.svg`
using `scripts/generate-icons.ts`. Run after every SVG edit.
