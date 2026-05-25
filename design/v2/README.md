# wingmic design v2 — runnable component library

This folder is the **canonical visual source-of-truth** for the v2 design system. It contains the full Claude Design (claude.ai/design) handoff: an HTML entry point that mounts every screen, atom, token, and state on a pannable canvas, plus the JSX modules that compose them.

**Date:** 2026-05-24 · **Handle:** `IeDyiNzPI2mu5WRJRWuuKQ`

## What's here

```
design/v2/
├── README.md                           ← you are here
├── Wingmic Component Library.html      ← entry point — open this in a browser
├── screens.md                          ← per-screen spec (component composition, layout, tokens, interactions)
└── library/
    ├── design-canvas.jsx               ← pan/zoom canvas (host for every artboard)
    ├── lib-tokens.jsx                  ← TokensColors, TokensType, TokensSpacing, TokensRadii, TokensShadows, TokensMotion, TokensIcons
    ├── lib-shared.jsx                  ← Pill, EntityTag, Card primitives, gradient helpers
    ├── lib-atoms.jsx                   ← buttons, inputs, pills, cards, avatars, stickers, stats, activity, bottom nav
    ├── lib-voice.jsx                   ← MicOrb (7 states), voice-bars, ChatThread, ChatComposer
    ├── lib-entities.jsx                ← entity templates (person, company, event)
    ├── lib-states.jsx                  ← loading, empty, modal, toast
    ├── lib-screens.jsx                 ← 13 mobile screens + ChatHeader + MobileNav
    ├── lib-capture-variants.jsx        ← 3 readings of the capture moment (A/B/C)
    ├── lib-desktop.jsx                 ← 4 desktop screens
    ├── lib-logic.jsx                   ← system-logic canvases (mic-surface, nav-map, flow-storyboard)
    └── assets/                         ← mark.svg, mark-mono.svg, mark-tile.svg, mark-512.png
```

## How to open

The HTML loads React + Babel standalone from a CDN, then loads the local `library/*.jsx` files. Browsers block local `file://` script loads with CORS, so serve over HTTP:

```bash
cd design/v2
python3 -m http.server 8000
# then open http://localhost:8000/Wingmic%20Component%20Library.html
```

Or use any static server (`npx serve .`, `bun --bun http-server .`, etc.).

Pan with mouse drag · pinch / scroll-wheel to zoom · click section anchors at the top to focus.

## Source-of-truth hierarchy

When the markdown spec ([`design/design-system.md`](../design-system.md), [`design/v2/screens.md`](./screens.md)) and the canvas disagree, **the canvas wins**. Tokens were extracted verbatim from `library/lib-tokens.jsx`. Screens were documented from `library/lib-screens.jsx` and its imports. If you spot a discrepancy, file a PR against `design/design-system.md` or `design/v2/screens.md` — not against the JSX. The JSX is the prototype; the markdown is the engineering contract.

## What NOT to do with this folder

- **Don't import these .jsx files from `apps/` or `packages/`.** They're prototypes (CDN React, Babel-in-browser, inline styles). Production components live in `apps/app/` and `packages/`. These exist purely for visual reference and to ground future implementation against pixel-exact spec.
- **Don't render these in your build pipeline.** The HTML expects `unpkg.com` + browser Babel transform. Not a build target.
- **Don't take screenshots and check them in.** They go stale. Open the HTML locally when you need to look at something.

## Updating this folder

This folder is replaced wholesale when a new handoff bundle drops. To update:

1. Receive a new bundle from Claude Design (URL handle or zip).
2. Extract; verify `lib-tokens.jsx` against `design/design-system.md`. If tokens change, that's a v3 design-system rev — open a separate PR via `chore/design-system-v3`.
3. Run a diff between the new `library/` and `design/v2/library/`. Flag screen additions/removals in `design/v2/screens.md`.
4. Replace `design/v2/` contents in a single commit.

Do NOT cherry-pick partial updates from a handoff bundle. Either the whole canvas refreshes or none of it does — partial updates fragment the source-of-truth.
