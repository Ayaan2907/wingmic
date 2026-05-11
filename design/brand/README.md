# wingmic brand assets

Canonical brand marks for `wingmic`. These mirror `apps/web/public/` so referencing them from outside the app (README, docs, decks) keeps a clean path.

## the mark — "W-Wave"

The W is the wordmark first letter and a waveform second. Endpoints are graph nodes; the baseline is the signal floor. The mark visually compresses the three product verbs (speak → extract → query) into one shape.

Direction picked from five exploratory marks (A capsule, B w-wave, C node+arc, D brackets, E spark). Variant **B** ships.

## files

| File | Use |
|---|---|
| `mark.svg` | 64×64 viewbox, transparent background, amber `#FFC452`. Use on dark surfaces. |
| `mark-tile.svg` | 512×512 rounded-square tile with `#0a0a0a` background. Use as app icon / favicon source. |
| `mark-mono.svg` | `currentColor` stroke + fill. Use inside CSS-styled containers (e.g., `color: white`). |
| `mark-512.png` | Rasterized 512×512 PNG of `mark-tile.svg`. Use in markdown / sites that don't trust SVG. |

## tokens

```
amber       #FFC452     primary brand accent
bg deep     #0a0a0a     dark backdrop (never pure black)
node radius 3.5 (endpoint), 2.5 (midpoint)
stroke      6 at 64-viewbox scale
baseline    opacity 0.25, stroke 1.5
corner      96 / 512 = 18.75%  (app icon tile radius)
```

## do

- Use the SVG when possible. Re-rasterize from `mark-tile.svg` when a PNG is required.
- Keep the warm dark background under the mark; never put the amber stroke on pure black.
- Pair with Inter (sans), Instrument Serif italic (twist word), JetBrains Mono (labels).

## don't

- No drop shadows. No gradients. No outline-only variants.
- Don't recolor outside the four-color palette (`#FFC452`, `#86efac`, `#FF8FAB`, `#7DD3FC`).
- Don't add a wordmark inside the mark.
- Don't skew, stretch, or rotate beyond the design system's ±0.5° body / ±6° sticker rules.

## regenerate PNGs

Source SVGs live in `apps/web/public/`. After editing them, re-run:

```bash
cd apps/web && bun run scripts/generate-icons.ts
cp public/icon-512.png ../../design/brand/mark-512.png
cp public/icon.svg public/icon-tile.svg public/icon-mono.svg ../../design/brand/
```

(Or wait until we automate this in a `pre-commit` hook.)

## see also

- [`design/design-system.md`](../design-system.md) — full design system tokens, type scale, components.
- [`design/homepage-v2.html`](../homepage-v2.html) — canonical homepage mock the marks were designed against.
