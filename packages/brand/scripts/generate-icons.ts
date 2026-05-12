/**
 * One-off script: rasterize SVG marks into PNG variants for favicons,
 * apple-touch-icon, PWA, and OG image. Re-run after editing icon.svg /
 * icon-tile.svg / og-image.svg.
 *
 *   bun run scripts/generate-icons.ts
 */
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const publicDir = resolve(__dirname, '../public');

interface Render {
  source: string;
  output: string;
  width: number;
}

const renders: Render[] = [
  // Favicon set (raster fallbacks; icon.svg covers modern browsers)
  { source: 'icon-tile.svg', output: 'icon-16.png', width: 16 },
  { source: 'icon-tile.svg', output: 'icon-32.png', width: 32 },
  { source: 'icon-tile.svg', output: 'icon-64.png', width: 64 },

  // Apple touch icon (180x180, required by iOS Safari)
  { source: 'icon-tile.svg', output: 'apple-touch-icon.png', width: 180 },

  // PWA manifest icons
  { source: 'icon-tile.svg', output: 'icon-192.png', width: 192 },
  { source: 'icon-tile.svg', output: 'icon-512.png', width: 512 },

  // Open Graph card (1200x630)
  { source: 'og-image.svg', output: 'og-image.png', width: 1200 },
];

for (const r of renders) {
  const svg = readFileSync(resolve(publicDir, r.source), 'utf-8');
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: r.width },
    font: { loadSystemFonts: true },
  });
  const png = resvg.render().asPng();
  writeFileSync(resolve(publicDir, r.output), png);
  console.log(`✓ ${r.output}  ${r.width}px  ${png.byteLength.toLocaleString()} bytes`);
}

console.log('\nDone. Commit the regenerated PNGs alongside any SVG source edits.');
