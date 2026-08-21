# Graph renderer choice — `/graph` layout readability

**Date:** 2026-08-21  
**Status:** decided — keep `react-force-graph-2d`, fix force engine + label policy  
**Issue:** #152

## Problem

The product graph uses the correct `{ nodes, links }` JSON shape but renders as overlapping clusters: nodes stack, canvas captions collide, and topic hubs starburst. Person/company/event detail routes work; topic nodes 404.

## Candidates compared

| Option | Renderer | Layout | Fit for wingmic (~50–300 nodes) | Verdict |
|---|---|---|---|---|
| **react-force-graph-2d** (current) | Canvas 2D | d3-force live sim | Already integrated; custom node paint, neighborhood dim, tests | **Keep** — fix forces + labels |
| **D3 force (raw)** | SVG or Canvas | d3-force | Same physics as above, more boilerplate | Reject — no gain over tuning existing wrapper |
| **Cytoscape.js** | Canvas | Built-in COSE/fCoSE | Good layouts, heavy bundle, restyle all paint | Reject — full rewrite for marginal layout win at our scale |
| **Sigma.js + graphology** | WebGL | ForceAtlas2 (worker) | Best at 1k+ nodes; WebGL label overlays harder to match brand paint | Defer — revisit if graphs routinely exceed ~500 nodes |
| **TanStack Charts** | SVG/Canvas | Chart grammar (bar/line/pie) | Not a network-graph library | Reject — wrong tool |

## Decision

**Stay on `react-force-graph-2d@^1.29.1`.** Do not swap renderers in this PR.

Instead:

1. **Label policy** — canvas captions only on hover/select; full name in `GraphHoverCard` + detail rail (never at default zoom).
2. **Force engine** — stronger charge, per-relation link distance, larger collision radius, warmup + freeze after settle (`graph-force.ts`).
3. **Hub edges** — mark `company/event → topic` hub links; lay them out with longer distance so topics do not swallow orgs.
4. **Topic detail** — `/topic/[id]` + `entity.detail({ kind: 'topic' })` so graph open links resolve.

## Revisit triggers

- Median signed-in graph **>500 nodes** with interaction jank → evaluate Sigma + ForceAtlas2 worker.
- Need community detection / path finding on canvas → graphology ecosystem.
- Need print-quality static export → D3 SVG one-off, not live product graph.

## References

- [force-graph collision example](https://vasturiano.github.io/react-force-graph/example/collision-detection/)
- [d3-force](https://github.com/d3/d3/d3-force)
- Identity graph paint spec: `2026-08-20-append-merge-identity-graph-design.md` §1.4
