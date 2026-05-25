# Wingmic — Design System

> **v2 — synthesized from Claude Design bundle 2026-05-24 (handle: IeDyiNzPI2mu5WRJRWuuKQ)**
>
> **Source of truth (v2):** `design/v2/screens.md` (mobile-first screens + desktop layouts mapped to lib-* components) + the upstream Claude Design library `Wingmic Component Library.html` from which v2 was extracted.
> Earlier homepage/video/prototype HTMLs from v1 are superseded.
> Use this file as the **default design system for every artifact in this project** — homepage, prototype, product app, decks. When in doubt, match the component library.

The aesthetic is **editorial brutalist + terminal**: warm hand-set type colliding with monospace UI chrome, sticker tape and scribble underlines pinned to a clean dark canvas, a living graph background that hums rather than shouts. It should feel like something a developer made *and* a designer art-directed — not slick SaaS, not generic AI.

---

## Design Context

### Users

> Synthesized from chat1 (the handoff paragraph) and chat2 (the component-library brief).

Developers, founders, and conference-goers who lose connections after meeting many people in a short span ("Handshake Memory Leak"). They attend hackathons, conferences, dinners, meetups; they want to capture context without typing — "open mic post-conversation, speak naturally," then later ask "who was the rust person at acme?" and get matches in <500ms. The brand voice from the original handoff is *developer-centric, dry humor, "persistent storage for your social RAM."*

Job to be done: speak 10–30s after meeting someone → graph commits person/company/event/topic/follow-up → query later in plain English → agent drafts a check-in when the moment is right.

### Brand Personality

> Synthesized from chat1 ("dry humor, developer-centric") + design.md §1 + the chats' explicit voice rules.

- **Persona**: "someone smart who keeps eye contact at a dinner party. Direct, observant, dry." (design.md §1)
- **Three-word personality**: confident · editorial · terminal-native.
- **Tone**: lowercase confident. `"your social RAM, on disk"` not `"Powerful AI Memory Platform"`.
- **Emotional goals**: relief (you didn't forget), trust (sources always cited), competence (designer-made AND developer-made).

### Aesthetic Direction

> From chat1 ("brutalist-meets-terminal with editorial type, asymmetric layouts, oversized numerals, sticker/badge elements") and chat2 ("super sleek and low latent minimalist rich motion with UX expertise").

Editorial brutalist + terminal. Warm dark `#0a0a0a` page (never pure black) with two faint warm radials. Amber accent `#FFC452` as the single signature color. Three families: Inter sans for everything, JetBrains Mono for chrome/code, Instrument Serif italic for exactly one word per heading. Hard offset shadows on buttons + stickers; soft drops on cards + sheets — never mixed. Stickers and scribbles pinned in negative space, rotated ±2–6°.

### Accessibility & Inclusion

> Bundle is largely silent on explicit WCAG checks. What's specified:

- **44px minimum hit targets** for nav chrome and icon buttons (lib-atoms.jsx `AtomsButtons` — "round · 44px hit · for chrome").
- **Touch affordances**: push-to-talk has explicit slide-to-cancel + slide-up-to-lock; locked state separates `discard` (alarm red, destructive) from `send` (accent, primary).
- **Reduced-motion / contrast specifics**: (not specified in source).
- **Voice as primary input** is itself an accessibility posture — minimizes typing on the dominant path.

---

## 1. Voice & tone

| | |
|---|---|
| Persona | Someone smart who keeps eye contact at a dinner party. Direct, observant, dry. |
| Voice | Lowercase confident. `"your social RAM, on disk"` not `"Powerful AI Memory Platform"`. |
| Headlines | Short imperatives + one italic serif twist per phrase. `"Stop forgetting. Start *building.*"` |
| Body | Tight. ≤ 2 sentences per paragraph in marketing. No filler. |
| Forbidden | Em-dashes-as-pause-everywhere · "powered by" · "cutting-edge" · "seamless" · "robust" · "comprehensive" · "delve" · "nuanced" · emoji in product chrome |
| Numbers | Spell out small ones in body, but **always digits** in stat blocks (`12 people`, `3 names`). |
| Code voice | `wingmic.contacts.search("rust")` — never `WingmicAPI.searchContacts({...})`. Verbs over nouns. |

---

## 2. Color tokens

> Source: `lib-tokens.jsx` `TokensColors` + `lib-shared.jsx` `T.color` (verbatim hex values).

### Core palette

```css
--bg-page:       #0a0a0a;   /* deep ink, never pure black */
--bg-card:       #08080d;   /* terminal / code block surface */
--bg-raised:     #0e0e12;   /* raised card / sheet / modal body */
--ink:           #f4f1ea;   /* warm off-white — "newspaper", not #fff */
--ink-pure:      #ffffff;   /* reserved for headlines on dark cards */
--accent:        #FFC452;   /* amber — primary brand */
--second:        #86efac;   /* mint — success, secondary accent */
--third:         #FF8FAB;   /* coral pink — tertiary, sticker tape */
--alarm:         #FF6B6B;   /* red — forgetting / urgency / destructive */
--info-blue:     #7DD3FC;   /* tag pill, "Acme" / company chips */
--info-violet:   #A78BFA;   /* tag pill, technical / concept entities */
```

### Surfaces (translucent, on `--bg-page`)

```css
--surface-1:     rgba(255,255,255,0.025);   /* card base */
--surface-2:     rgba(255,255,255,0.04);    /* card hover / nested */
--surface-3:     rgba(255,255,255,0.06);    /* input / pill */
--border-soft:   rgba(255,255,255,0.06);
--border-mid:    rgba(255,255,255,0.10);
--border-hard:   rgba(255,255,255,0.15);
--border-acc:    rgba(255,196,82,0.4);      /* status / live badge */
--border-blk:    #000;                       /* 1.5px on primary buttons */
```

### Text on dark

```css
--text-100: #ffffff;                  /* headlines */
--text-85:  rgba(255,255,255,0.85);   /* body emphasis */
--text-70:  rgba(255,255,255,0.70);   /* body */
--text-55:  rgba(255,255,255,0.55);   /* secondary body */
--text-40:  rgba(255,255,255,0.40);   /* metadata, captions */
--text-30:  rgba(255,255,255,0.30);   /* timestamps, ghosts */
```

> v1 had `--text-78` in one row. v2 source is silent on 78% — retained from v1 only where v1 cards reference it; new code should use `--text-85` or `--text-70`.

### Tag-pill recipe (entity chips)

A tag pill takes a base color and uses **`1f` (≈12%) alpha background + `40` (≈25%) alpha border + full-color text** (verbatim from `lib-shared.jsx` `Pill`).

```css
.tag {
  padding: 3px 9px;
  border-radius: 999px;
  background: ${color}1f;
  color: ${color};
  border: 1px solid ${color}40;
  font: 600 10.5px/1 'JetBrains Mono', monospace;
  letter-spacing: 1px;
  text-transform: uppercase;
}
```

> v1 said `20%` alpha (`${color}20`) — bundle proves the live value is `${color}1f` for fill and `${color}40` for border. v2 takes the bundle. Keep the v1 prose "20% alpha" only as a near-correct mental model.

### Entity colors (chips)

| Kind | Color token | Hex | Glyph |
|---|---|---|---|
| `person`  | `--accent`        | `#FFC452` | `◉` |
| `company` | `--info-blue`     | `#7DD3FC` | `▤` |
| `concept` | `--info-violet`   | `#A78BFA` | `◇` |
| `event`   | `--text-40`       | `rgba(255,255,255,0.40)` | `◆` |
| `place`   | `--second`        | `#86efac` | `◍` |

### Page background grain

The page is **not flat black**. Layer two faint warm radials on `#0a0a0a` (verbatim from `lib-shared.jsx` `artboardBg`):

```css
background-image:
  radial-gradient(ellipse at 18% 0%,   rgba(255,196,82,0.05) 0%, transparent 55%),
  radial-gradient(ellipse at 82% 100%, rgba(255,107,107,0.035) 0%, transparent 55%);
```

> v1 used `at 20% 0%` / `at 80% 100%`, `0.04` / `0.03` alpha, `50%` stop. Bundle proves `18% / 82%`, `0.05 / 0.035` alpha, `55%` stop. v2 takes the bundle exactly.

### Selection

```css
::selection { background: #FFC452; color: #000; }
```

---

## 3. Typography

> Source: `lib-tokens.jsx` `TokensType` + `lib-shared.jsx` `T.font`.

### Families

| Token | Family | Weights | Use |
|---|---|---|---|
| `--font-sans`  | **Inter** (`'Inter', system-ui, -apple-system, sans-serif`) | 400, 500, 600, 700, 800, 900 | Headlines, body, UI |
| `--font-serif` | **Instrument Serif** (`'Instrument Serif', Georgia, serif`) | 400 italic | The editorial counterpoint — italic numerals, single accent words inside headlines |
| `--font-mono`  | **JetBrains Mono** (`'JetBrains Mono', ui-monospace, monospace`) | 400, 500, 600, 700 | Labels, code, timestamps, pills, terminal UI |

```html
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
```

### Body & default

```css
body {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  color: #f4f1ea;
  -webkit-font-smoothing: antialiased;
}
.mono  { font-family: 'JetBrains Mono', ui-monospace, monospace; }
.serif { font-family: 'Instrument Serif', Georgia, serif; font-style: italic; }
```

### Type scale (verbatim from `TokensType`)

| Token | Role | Family | Size | Weight | Letter | Line | Notes |
|---|---|---|---|---|---|---|---|
| `--display`        | Display / hero    | Inter             | `88px`  | 900 | `-0.04em`  | `0.95` | (v1 alias: `clamp(48, 8vw, 110)` retained for landing page) |
| `--h1`             | Section H1        | Inter             | `60px`  | 900 | `-0.03em`  | `1`    | Compose with one italic serif word inline |
| `--h2`             | Section H2        | Inter             | `40px`  | 800 | `-0.025em` | `1.05` | |
| `--h3`             | Subsection H3     | Inter             | `28px`  | 800 | `-0.02em`  | `1.15` | |
| `--serif-numeral`  | Stat numeral      | Instrument Serif italic | `84px`  | 400 | `-0.04em` | `0.85` | Signature element — always italic, drift-up loop |
| `--lead`           | Lead body         | Inter             | `19px`  | 500 | normal     | `1.55` | `color: var(--text-70)` |
| `--body`           | Body              | Inter             | `15px`  | 500 | normal     | `1.55` | `color: var(--text-70)` |
| `--mono`           | Code / terminal   | JetBrains Mono    | `12.5px`| 500 | `0.3px`    | `1.7`  | |
| `--eyebrow`        | Eyebrow / label   | JetBrains Mono    | `11px`  | 500 | `2px`      | `1.4`  | `color: var(--accent)`, uppercase, prefix `◆` |
| `--pill`           | Pill / chip       | JetBrains Mono    | `10px`  | 700 | `1px`      | `1.3`  | Uppercase |

> v1 had `Hero H1 = clamp(48, 8vw, 110)` and `Body = 17px` and `Card body = 14.5px`. Bundle proves the canonical product scale is **88 / 60 / 40 / 28** (Inter) plus **84** (serif italic), and body lives around **15–19px**. v2 takes the bundle for product surfaces; v1 hero clamp is retained as a marketing-only override.

### The italic-twist rule

Every major headline gets **one** italic serif word or phrase as its punctuation:

> **Stop forgetting.** *Start building.*
> Plain English. *From anywhere.*
> Drafts the follow-up. *You just send.*
> everyone *you know.*
> drafts *awaiting you.*

Don't italicize more than one fragment per heading. The serif is a knife, not a font.

---

## 4. Spacing, radii, elevation

### Spacing scale (px)

> Source: `lib-tokens.jsx` `TokensSpacing`.

`4 · 6 · 8 · 10 · 12 · 14 · 16 · 20 · 24 · 28 · 32 · 40 · 48 · 60 · 72 · 96`

> v1 included `120` as a top-of-scale step. Bundle stops at 96 in the scale grid but still uses `120` for hero `paddingTop`. v2 keeps `120` as a documented hero-padding value, not a numbered scale step.

Section vertical rhythm: **hero `120 / 60`**, **inner sections `80–96`**. Container max-width **`1280px`**, mobile gutter **`20px`**, desktop horizontal padding **`32px`**.

### Border radius

> Source: `lib-tokens.jsx` `TokensRadii`.

| Token   | Value | Use |
|---|---|---|
| `--r-sm`   | 6px   | Tags, chips |
| `--r-md`   | 10px  | Buttons, small cards |
| `--r-lg`   | 14px  | Code blocks, content cards |
| `--r-xl`   | 18px  | Hero / testimonial cards, sheets, modals |
| `--r-2xl`  | 36px  | Phone bezel outer; **48px** for inner content frame (iPhone 15 Pro proportions: `borderRadius: 56` bezel, `48` inner) |
| `--r-pill` | 999px | Pills · stickers · dots |

### Borders

Almost every card has a **1px translucent border**:

```css
border: 1px solid var(--border-soft);   /* default — most cards */
border: 1px solid var(--border-mid);    /* hover / emphasis */
border: 1.5px solid var(--border-acc);  /* status / live badge / focused input */
border: 1.5px solid #000;                /* primary buttons + brutal cards */
border: 8px solid #1a1a20;               /* phone bezel */
```

### Shadow / elevation

> Source: `lib-tokens.jsx` `TokensShadows`.

| Token | Value | Use |
|---|---|---|
| `--shadow-sticker` | `3px 3px 0 rgba(0,0,0,0.2)` | Sticker badges, soft hard-shadow |
| `--shadow-button`  | `4px 4px 0 #000` | Primary CTAs (brutalist offset, never blurred) |
| `--shadow-card`    | `0 20px 50px rgba(0,0,0,0.4)` | Code blocks, content cards |
| `--shadow-phone`   | `0 30px 60px rgba(0,0,0,0.5)` | Phone mocks (the v1 `inset 0 0 40px rgba(255,196,82,0.05)` is retained for the marketing hero phone) |
| `--shadow-glow`    | `0 0 80px rgba(255,196,82,0.15)` | Floating elements over the graph |
| `--shadow-md`      | `0 4px 12px rgba(0,0,0,0.35)` | Panels, sheets |

**Rule:** Buttons and stickers use **hard offset shadows** (no blur). Cards and surfaces use **soft drop shadows**. Never mix.

---

## 5. Signature elements

These are the bits that make Wingmic look like Wingmic. Use them sparingly and on purpose.

### Sticker badges

Small uppercase mono pills, rotated, with a hard offset shadow. Used as floating annotations on the page (`OPEN BETA`, `voice-first`, `MIT @ GA`, `v0.1 BETA`, `variant A · default`).

```jsx
<Sticker color={accent} rotate={-4}>v0.1 beta</Sticker>
```

```css
{
  padding: 5px 10px;            /* md: 6px 11px · lg: 9px 14px */
  border-radius: 999px;
  background: ${color};
  color: #000;
  font: 700 10px/1 'JetBrains Mono';   /* md: 11px · lg: 13px */
  letter-spacing: 1px;
  text-transform: uppercase;
  box-shadow: 3px 3px 0 rgba(0,0,0,0.25);
  transform: rotate(${-6 to 6}deg);
}
```

### Scribble underline

A hand-drawn SVG line under a single key word in marketing copy. Inline SVG, not a font:

```jsx
<Scribble color={accent}>forgetting</Scribble>
```

```html
<svg viewBox="0 0 200 12" preserveAspectRatio="none">
  <path d="M2 8 Q 50 2, 100 6 T 198 5"
        fill="none" stroke="#FFC452" stroke-width="3" stroke-linecap="round" />
</svg>
```

### Tape strip

A short dashed/translucent rectangle pinned at an angle near a card edge. Decorative only.

```css
.tape {
  position: absolute;
  background: rgba(255,196,82,0.18);
  border: 1px dashed rgba(255,196,82,0.4);
  width: 90px; height: 18px;
  transform: rotate(-5deg);
}
```

Second palette: `rgba(255,143,171,0.18)` background, `rgba(255,143,171,0.4)` border (third / coral).

### 48px grid background

For "developer / blueprint" sections only.

```css
.grid-bg {
  background-image:
    linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
  background-size: 48px 48px;
}
```

### Card rotation rhythm

Content cards rotate **±0.5°** in alternation:

```js
transform: i % 3 === 0 ? 'rotate(-0.4deg)' : i % 3 === 1 ? 'rotate(0.5deg)' : 'rotate(0deg)';
```

Stickers and pinned annotations rotate **±2° to ±6°**. Stat blocks rotate **`-2°, +1°, -1°`** in trios. Never rotate body text or buttons.

### Live graph background

A canvas-rendered force graph (60 nodes, ≤160px connection radius, 0.65 alpha, palette = [accent, second, third, white]). Lives behind the hero, dimmed to ~25% in z-stack. Tunable density (`density={1}` standard, `0.5` embedded).

---

## 6. Components

### Buttons

> Source: `lib-atoms.jsx` `Btn` — 5 variants × 3 sizes × states.

**Sizes**:
| Size | Padding | Font |
|---|---|---|
| `sm` | `8px 14px`  | 12.5px |
| `md` | `13px 22px` | 14.5px |
| `lg` | `16px 26px` | 15.5px |

**Variants**:
| Variant | Background | FG | Border | Shadow |
|---|---|---|---|---|
| `primary`     | `--accent` `#FFC452`    | `#000` | `1.5px solid #000` | `4px 4px 0 #000` |
| `destructive` | `--alarm`  `#FF6B6B`    | `#000` | `1.5px solid #000` | `4px 4px 0 #000` |
| `secondary`   | `#ffffff`               | `#000` | `1px solid rgba(255,255,255,0.15)` | none |
| `ghost`       | transparent             | `#fff` | `1.5px solid rgba(255,255,255,0.22)` | none |
| `mono`        | `--bg-card` `#08080d`   | `--accent` | `1px solid rgba(255,196,82,0.4)` | none — font: mono |

Disabled: opacity `0.45`, `pointer-events: none`.
Hover (primary): `translate(-1px, -1px)` + shadow `4px → 5px` over `0.12s ease-out`.
Loading: same silhouette, inline 14×14 spinner (`border: 2px solid rgba(0,0,0,0.25)`, top `#000`, `wm-spin 0.8s linear infinite`), caption changes to gerund (`Sending…`).

**Icon button (chrome)**: round, **44px hit target**, four flavors:
- Subtle: `rgba(255,255,255,0.05)` bg + `1px rgba(255,255,255,0.08)` border + white icon.
- Primary brutal: amber bg + `1.5px #000` border + `3px 3px 0 #000` shadow + black icon.
- Ghost: transparent + `1.5px rgba(255,255,255,0.22)` border.
- Destructive: `rgba(255,107,107,0.12)` bg + `1px rgba(255,107,107,0.4)` border + alarm-red icon.

### Inputs

> Source: `lib-atoms.jsx` `FieldFrame`.

```css
.field-frame {
  /* resting */
  padding: 12px 14px;
  border-radius: 10px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  font: 400 14.5px 'Inter';
  color: #f4f1ea;
}

.field-frame[data-state="focused"],
.field-frame:focus-within {
  border: 1.5px solid #FFC452;
  box-shadow: 0 0 0 4px rgba(255,196,82,0.08);
}

.field-frame[data-state="error"] {
  border: 1.5px solid rgba(255,107,107,0.6);
  box-shadow: 0 0 0 4px rgba(255,107,107,0.08);
}
```

States: `resting` · `filled` (check glyph trailing, second-color) · `focused` (amber ring + 4px halo + blink caret) · `error` (alarm ring + alarm halo, `↪ …` mono helper text in alarm color) · `search` (search icon leading + `⌘ K` trailing).

### Pills, chips, status dots

> Source: `lib-shared.jsx` `Pill` + `EntityTag`; `lib-atoms.jsx` `AtomsPills`.

- **`Pill`** sans/sentence-case — `#engineering`, `#rust`. 3 sizes (sm/md/lg).
- **`Pill mono`** uppercase tracked — `OPEN BETA`, `● LIVE`, `STEP 01`, `↗ check-in · 92%`.
- **`EntityTag kind="..."`** — color-coded by entity (table in §2).
- **Filter chips · selectable** — white-fill `#fff` on `#000` when selected; `rgba(255,255,255,0.04)` + `--text-55` when not.
- **Status dot** — 6px circle + `wm-pulse-d 1.6s` + mono 12px label inline.

### Cards (six surfaces)

> Source: `lib-atoms.jsx` `AtomsCards`. All have `borderRadius: 14`, all have a 1px translucent border.

| Tone | Background | Border | Shadow | Use |
|---|---|---|---|---|
| `default` | `rgba(255,255,255,0.025)` | `1px rgba(255,255,255,0.06)` | none | most content |
| `raised`  | `#0e0e12`                 | `1px rgba(255,255,255,0.06)` | `0 14px 30px rgba(0,0,0,0.45)` | floats above page |
| `inset`   | `#06060a`                 | `1px rgba(255,255,255,0.06)` | none | drafts, quotes |
| `brutal`  | `#08080d`                 | `1.5px #000`                  | `4px 4px 0 #000` | CTA hero feature |
| `glow`    | `#08080d`                 | `1px rgba(255,196,82,0.3)`    | `0 14px 30px rgba(0,0,0,0.45), 0 0 60px rgba(255,196,82,0.15)` | agent activity, live event |
| `ghost`   | transparent               | `1.5px dashed rgba(255,255,255,0.15)` | none | empty / placeholder |

### Avatars

Round (chat) or square (entity / acts tile, `borderRadius: Math.round(size * 0.28)`). Initial in `Inter 800 black`, sized `Math.round(size * 0.4)`. Color hashed deterministically from the initial across `[accent, second, third, blue, violet]`. Sizes used: `24 / 28 / 32 / 36 / 40 / 44 / 56 / 72`. Stacked variant for participants — overlap `-10px` with `2px solid var(--bg-page)` border, `+N` chip at end.

### Mic orb (the centerpiece)

> Source: `lib-voice.jsx` `MicOrb`. Seven states × three sizes.

**Sizes**: `sm 56` (composer · inline send), `md 88` (sheets · capture moments), `lg 140` (full-screen capture · hero).
The orb's outer wrapper is `size + 60` square. Inner orb has `2px` border, transitions `all 0.25s ease-out`.

**States**:
- `idle` — `bg: rgba(255,255,255,0.06)`, border `rgba(255,255,255,0.15)`, icon `--text-70`. No halo, no rings.
- `hover` — border `rgba(255,255,255,0.35)`.
- `recording` — bg `--accent`, border `--accent`, icon `#000`, halo `radial-gradient(circle, accent25 0%, transparent 65%)`, **three concentric rings** at `size + i*20`, opacity `0.55 − i·0.18`, animation `wm-pulse-s ${1.4 + i*0.3}s` each. Shadow `0 0 60px ${accent}50`.
- `locked` — same as recording, icon swapped to `lock`.
- `thinking` — bg `--accent`, no icon; three 9px black dots, `wm-pulse-d 1.4s` staggered by `0.18s`.
- `sending` — bg `--accent`, icon `arrowUp`.
- `done` — bg `--accent`, icon `check`, hold 600ms then fade.

### Voice-bar visualizer

> Source: `lib-shared.jsx` `VoiceBars`.

Defaults: `count 24, height 38, width 3, gap 3, radius 2`. Idle = `4px` flat bars at `rgba(255,255,255,0.2)`. Active = `4–38px` bars at `--accent`, transition `height 0.12s ease-out`. Drive heights from a **phase counter** (`performance.now() / 1000` via `requestAnimationFrame`), not random per-frame, so it feels musical. Compact variant: `count 14, height 20, width 2, gap 2`. Discard preview: swap color to `--alarm` before fade.

### Chat thread

> Source: `lib-voice.jsx` `MsgYou` + `MsgAgent`.

- **You · text** — amber brutal bubble: `padding 11px 15px`, `border-radius 18px 18px 4px 18px`, `bg --accent`, color `#000`, `1.5px solid #000` border, `3px 3px 0 #000` shadow. Time below in `mono 10px --text-30`.
- **You · voice** — same bubble silhouette, contents = `▶` play button (28×28 black) + `VoiceBars active count=14 color="#000"` + duration `mono 11px`.
- **Agent** — translucent bubble: `padding 12px 14px`, `border-radius 4px 14px 14px 14px`, `bg rgba(255,255,255,0.04)`, `1px rgba(255,255,255,0.08)` border, color `--text-85`, font `400 14.5px/1.55 Inter`. Avatar = `W` square 32px accent. Header row above: `wingmic` mono 12px accent + time mono 10px --text-30.
- **Streaming** — blink caret `2×16` `--accent` `wm-blink 0.7s step-end infinite`.
- **Sources line** — mono 10.5px --text-30, prefixed `↪ sourced from:`, items joined by ` · `.

### Chat composer (voice-first)

> Source: `lib-voice.jsx` `ChatComposerComponent`. Four states:

1. **Resting** — pill (`border-radius 999`), `+` button left, placeholder `ask wingmic…`, **44–48px mic** right (amber, brutal).
2. **Typing** — sub-text replaces placeholder, mic swaps to **`↑` send** (same brutal silhouette), border thickens to `1.5px var(--border-acc)`.
3. **Holding (push-to-talk)** — bg `rgba(255,196,82,0.06)`, border `1.5px --accent`; alarm dot `wm-pulse-d 1s` + duration mono + `← slide to cancel` centered italic + mic scaled `1.05` with glow `0 0 30px ${accent}60`. **Slide-up-to-lock** affordance floats above-right: 36–40px circle, lock icon, `wm-drift 1.6s` animation, `↑ lock` mono caption.
4. **Locked (hands-free)** — pill bar, lock-tile 32×32 left, voice-bars center, duration mono, **destructive discard 38–40px** (`trash` icon in alarm pill) + **primary send 44–48px** (arrowUp brutal). Sub-caption `hands-free · keep talking`.

### Acts / agent draft card

> Source: `lib-capture-variants.jsx` `ScreenActs` (canonical), `lib-desktop.jsx` `ScreenDesktopHome`.

Distinct compositional unit:
- **Header row**: 34×34 (mobile) / 44×44 (desktop) **square accent tile** with monogram + name + uppercase mono kind tag pill (`↗ check-in`, `◷ reminder`, `⇌ intro`) + percentage. Optional `● now` alarm pill when overdue.
- **Subject line**: mono 11px `--text-70`, bottom-bordered with `1px rgba(255,255,255,0.06)`.
- **Draft body**: mono 11px/1.55 on `rgba(0,0,0,0.3)` inset, `1px rgba(255,255,255,0.05)` border, `border-radius 8`, white-space pre-wrap.
- **Confidence bar**: 38×3 track at `rgba(255,255,255,0.1)`, fill at `--accent`, percentage to the right.
- **Sources line**: mono 9px `--text-30`, prefixed `sourced from:`.
- **Action row**: primary `Send now →` + ghost `skip` / `edit`.
- **Channel chip**: prefixed by glyph (`✉ email`, `◷ calendar`).

### Bottom nav (mobile)

> Source: `lib-screens.jsx` `MobileNav`.

```
[home] [chat] [⬆ mic 52px BIG] [graph] [acts]
```

- Container: `position: absolute, left/right: 16, bottom: 22`, `bg rgba(10,10,10,0.78)`, `backdrop-filter: blur(20px) saturate(140%)`, `1px rgba(255,255,255,0.08)` border, `border-radius: 22`, `padding: 8px 12px`.
- The center mic **lifts** (`top: -16`): `52×52` circle, `--accent` bg, `1.5px #000` border, `3px 3px 0 #000` shadow, mic icon black 22.
- Other slots: icon 20 + mono `9px/1` uppercase label tracked `0.5`. Active = `--accent`; inactive icon = `--text-55`, label = `--text-40`.
- Variant B: same items in a `border-radius: 999` pill for full-bleed surfaces.

### Persistent left rail (desktop)

> Source: `lib-desktop.jsx` `Sidebar`.

- **Width**: `248px`, `border-right: 1px var(--border-soft)`, `bg rgba(255,255,255,0.015)`, `padding: 22px 14px 18px`.
- **Logo row**: 30×30 dark tile + `1px rgba(255,196,82,0.4)` border + mic icon accent + wordmark `wingmic.xyz`.
- **`Hold to capture` CTA**: full-width primary brutal button + trailing `⌘ K` mono chip.
- **Nav rows**: 5 items (`home / chat / graph / acts / search`). Active row: bg `rgba(255,196,82,0.08)`, border `1px rgba(255,196,82,0.3)`, color `--accent`. Badges (e.g., `acts · 5`) rendered as 9.5px mono pill in accent.
- **Pinned-people section** (`◆ pinned · N`): 26px round avatars + name + org subline.
- **Profile footer**: 28px avatar + name + `pro · 1,247 nodes` mono caption + settings cog.

### Code / terminal card

```css
{
  border-radius: 14px;
  overflow: hidden;
  background: #08080d;
  border: 1px solid rgba(255,255,255,0.08);
  box-shadow: 0 20px 50px rgba(0,0,0,0.4);
}
/* header: 10px 16px · 3 traffic-light dots (#ff5f56 / #ffbd2e / #27ca3f, 9–11px, gap 6) · filename mono center · spacer R · border-bottom 1px rgba(255,255,255,0.08) */
/* body: 18px 22px · font: 12.5px/1.75 'JetBrains Mono' */
```

| Syntax | Color |
|---|---|
| keyword | `var(--accent)` `#FFC452` |
| string  | `var(--second)` `#86efac` |
| comment | `rgba(255,255,255,0.35)` |
| default | `rgba(255,255,255,0.85)` |

### Stat block

```jsx
<Stat value="12" label="people met" color={accent} rotate={-2} sub="DevConnect '26" />
```

- Numeral: `Instrument Serif italic 84px / lh 0.85 / ls -0.04em`.
- Label: `mono 11px 500 uppercase / ls 1.8 / mt 8`.
- Sub: `Inter 13px / --text-55 / mt 6`.
- Loop animation: `wm-drift 5–6s ease-in-out` (translateY 0 → -6 → 0).

### Activity row (timestamp ticker)

```
[6px pulse-d dot color] [mono 11px who, color, minw 88] [mono 11px what, --text-40, minw 78] [Inter 13.5px detail, --text-70, flex+ellipsis] [mono 10.5px time, --text-30]
```

Padding `10px 4px`, `border-bottom 1px rgba(255,255,255,0.05)`.

### Loading / skeleton

> Source: `lib-states.jsx` `Skel`. Skeletons match real shape — never spinners alone.

```css
.skel {
  background: linear-gradient(90deg,
    rgba(255,255,255,0.04) 0%,
    rgba(255,255,255,0.10) 50%,
    rgba(255,255,255,0.04) 100%);
  background-size: 200% 100%;
  animation: wm-shimmer 1.6s linear infinite;
}
```

Patterns: person card silhouette (avatar circle + 2 lines + 3 pills) · chat thinking (avatar + 3-dot pulse, sourcing line below) · graph settling (radial SVG with growing-circle node + opacity-pulse satellites) · inline progress (4px bar with shimmer gradient fill) · button sending (inline spinner) · list activity (row of skeletons matching ActivityRow).

### Empty states

```jsx
<EmptyCard
  glyph="◉"
  title="No contacts" italic="yet."
  body="Hold the mic and talk about who you met. We'll do the parsing."
  action={<PrimaryBtn>Start first capture →</PrimaryBtn>}
/>
```

Frame: `bg rgba(255,255,255,0.02)`, `1.5px dashed rgba(255,255,255,0.12)`, `border-radius 18`, `padding 28`. Glyph tile: 48×48 `border-radius 14`, accent-tinted (`rgba(255,196,82,0.08)` bg, `1px rgba(255,196,82,0.3)` border). Title: Inter 800 22px with italic-serif twist. Body: Inter 14/1.5 `--text-55`. One action.

### Modal / sheet / menu / tooltip / toast

- **Modal** (desktop): `bg --bg-raised`, `1px rgba(255,255,255,0.1)`, `border-radius 18`, `padding 22`, `shadow 0 30px 60px rgba(0,0,0,0.5)`. Scrim `rgba(0,0,0,0.55)` + `backdrop-filter: blur(10px)`. Max-width 340. Destructive header tile: 38×38 `rgba(255,107,107,0.12)` + `1px alarm50` border + alarm trash icon.
- **Sheet** (mobile, default): `position: absolute, bottom: 0`, `border-top-radius 28`, same surface as modal, `box-shadow: 0 -10px 30px rgba(0,0,0,0.5)`. Drag handle: `44×4 rgba(255,255,255,0.2)`, centered, mb 16.
- **Menu**: `--bg-raised`, `1px rgba(255,255,255,0.1)`, `border-radius 12`, `padding 6`, `shadow 0 14px 30px rgba(0,0,0,0.5)`. Items: 16px icon + 13px sans label, padding `9px 10px`, hover bg `rgba(255,255,255,0.03)`. Danger items in `--alarm`.
- **Tooltip**: `bg #0a0a0a`, `1px rgba(255,255,255,0.1)`, `border-radius 8`, `padding 8px 11px`, mono 11.5px/1.5 `--text-85`. Inverted triangle: 10×10 rotated 45° with same border.
- **Toast**: `bg #0a0a0a`, `1px ${kind-color}40` border, `border-radius 12`, `shadow 0 14px 30px rgba(0,0,0,0.5)`, min-width 320. 32×32 glyph tile (`success`=check on second, `info`=sparkle on accent, `error`=x on alarm). Mono 12.5px copy + optional sub mono 11.5px `--text-55`. **3 levels: success · info · error.** 4s auto-dismiss; tap to keep.
- **Inline commit toast**: full-pill (`border-radius 999`), accent border, pulse-d dot + mono `→ commit` + sans body + `undo` mono trailing.

### Entity detail pages (shared scaffold)

> Source: `design.md §13` + `lib-capture-variants.jsx` `ScreenPerson` + `lib-entities.jsx` `ScreenCompany` + `ScreenEvent`.

```
[nav row]                       ← back · graph · settings/pin
[hero]                          large glyph + name (italic serif on last word) + eyebrow + sub + warm tag
[primary CTA + ghost CTA]       e.g., Draft check-in → · edit
[stat trio]                     three italic serif numerals (32px on mobile, 44px on desktop) + mono labels
[from your captures]            list of timestamped excerpts (mono time · sans body, quoted, with one accent emphasis)
[follow-ups]                    checkbox row with brutal-accent check + due meta + agent-drafted indicator
[related entities]              avatar/tile rows → other entity pages
[topics / quick links]          EntityTag rows + outbound ↗ links
[open actions / acts]           collapsed acts cards for this entity
```

**Hero glyphs**:
| Entity   | Hero tile | Color |
|---|---|---|
| person   | round avatar 72px, initial Inter 800 black                      | hash of initial across accent/second/third/blue/violet |
| company  | 64×64 `border-radius 14` tile, big letter monogram (Inter 900 28px), `3px 3px 0 rgba(0,0,0,0.3)` shadow | `--info-blue` `#7DD3FC` |
| event    | rotated diamond SVG (`polygon points="32,4 60,32 32,60 4,32"`, 2.5px stroke, inner filled diamond `opacity 0.5`) | `--text-55` (events are quieter) |
| concept  | small `◇` glyph + tag pill row, no hero tile                    | `--info-violet` `#A78BFA` |
| place    | pin glyph in `--second` tile                                     | `--second` `#86efac` |

---

## 7. Animation

> Source: `lib-tokens.jsx` `TokensMotion`. Nine cues. If a behavior isn't here, ship the still — don't invent a new tween.

| Cue          | Duration            | Easing       | Use |
|---|---|---|---|
| `wm-blink`   | 0.7s loop           | step-end     | Caret in input + transcript |
| `wm-pulse-d` | 1.5–1.6s loop       | ease-in-out  | Live status dots (opacity 1 → 0.4 → 1) |
| `wm-pulse-s` | 1.0–1.6s loop       | ease-in-out  | Recording orb · thinking (scale 1 → 1.05 → 1) |
| `wm-drift`   | 5–6s loop           | ease-in-out  | Stat numerals · slide-up-lock float (translateY 0 → -6 → 0) |
| `wm-ring`    | 1.4s loop           | ease-out     | Mic-tap ripple |
| `wm-shimmer` | 1.6–2s loop         | linear       | Skeleton loaders, inline progress fill |
| `wm-rise`    | 0.4s once / 2s loop | ease-out     | Card entry — translateY(20–30px) + opacity 0 → 1 |
| `wm-marquee` | 30–40s loop         | linear       | Logo / testimonial strip |
| `wm-spin`    | 0.8s loop           | linear       | Button spinner |

Button hover: `0.15s ease-out · translate(-1px, -1px) · shadow 4 → 5px`.

---

## 8. Composition rules

1. **Two columns or one.** No three-column body grids. Use a 2-col split for the hero, step rows, and desktop content (`[thread flex] [rail 320]`); single column elsewhere.
2. **One italic serif word per heading**, no more.
3. **Stat blocks come in pairs or trios**, each rotated slightly (`-2°, +1°, -1°`).
4. **Stickers go in the negative space**, not on top of content. Pin them at percentages on the section.
5. **Code blocks lead, prose follows.** 3–6 line snippet first, then explain.
6. **Prefer mono labels over icons** for metadata (`STEP`, `LIVE`, `BETA`). Icons earn their place in nav and primary actions.
7. **Standard opener**: section eyebrow (mono 11px accent uppercase tracked 2px, prefixed `◆`) + heading (Inter 800, italic-serif accent on one word) + lead (Inter 18–19px text-55/70, max 480–580px).
8. **No center-aligned body text.** Headlines can center; body left-aligns.
9. **Density is fine.** A wingmic page should feel like a designer's plotter print, not a wireframe.
10. **No separate "capture" surface.** Any mic press lands in chat — see §12.
11. **Every entity chip is navigable.** Person, company, event, concept, place — all route to their detail page.
12. **Mobile is canonical.** Desktop is the same atoms in a wider layout. If a screen only works at one breakpoint, it isn't done.

---

## 9. Iconography

- **Outline icons only**, `22×22` viewbox, `1.8–2px` stroke, round caps & joins, currentColor. Source set in `lib-shared.jsx Icon`: `mic · send · search · graph · home · acts · person · chat · check · x · lock · arrowUp · arrowR · arrowL · trash · bell · settings · sparkle · bolt · tag · plus · filter · eye · headphones · cog · pin`.
- Filled glyphs reserved for: recording mic icon, traffic-light dots, status indicators, event-diamond hero inner.
- **Typographic glyphs** (terminal-native, not iconic): `↗` check-in · `◷` reminder · `⇌` intro · `◇` step / concept · `›` terminal prompt · `↪` result / sourced-from · `◉` person · `▤` company · `◆` event / eyebrow · `●` live status · `◍` place.
- Avatar initials on a flat bright color tile (`borderRadius 10` square or `50%` round), black 800-weight monogram.
- **No emoji in product chrome.** Outside chrome (slide decks, dev marketing copy), case-by-case at most one per section.

---

## 10. Surfaces map

| Artifact | Bg | Type lead | Signature element |
|---|---|---|---|
| **Component library** (`Wingmic Component Library.html`, source-of-truth) | `#0a0a0a` + warm radials | Inter 800 38px section openers w/ italic serif | Stickers · scribbles · brutalist primary CTAs · design-canvas grid |
| **Product — mobile** (5 × 393×852 frames, see `design/v2/screens.md`) | Same | Inter sans for screens, mono for chrome | Bottom nav w/ lifted mic · pulse-d status · voice bars · sheet/composer |
| **Product — desktop** (4 frames, see `design/v2/screens.md` §desktop) | Same | Same | Persistent 248px left rail + 2-pane content · no bottom nav · sidebar pinned-people |
| **Decks / docs** | Same | Same | Stickers + serif italic accents — go lighter on tape/scribble |
| ~~Homepage v1/v2 · Prototype · Video v6~~ | — | — | superseded — kept under `_stale/` in upstream bundle for reference; in this repo, see `design/homepage-v2.html` for landing reference |

When extending Wingmic into a **new** artifact (a doc, a slide deck, a t-shirt), the floor is: dark warm bg + Inter/Instrument Serif/JetBrains Mono + amber accent + one signature element from §5.

---

## 11. Quick checklist before shipping

- [ ] Body bg has the warm radial overlay (18% / 82%, accent 0.05 / coral 0.035, 55% stop), not pure `#000`.
- [ ] All three font families are loaded (Inter / Instrument Serif italic / JetBrains Mono).
- [ ] At least one heading uses the italic-serif twist.
- [ ] No card has a borderless edge — every elevation has a 1px translucent border.
- [ ] Buttons use hard offset shadows; cards use soft drop shadows. Not mixed.
- [ ] Eyebrows are mono, uppercase, 2px tracked, accent-colored, prefixed `◆`.
- [ ] Stickers exist in negative space, rotated ±2–6°, never over body text.
- [ ] No three-column body grids.
- [ ] No emoji in product chrome.
- [ ] No filler. Every element earns its place.
- [ ] **No separate "capture" surface.** Any mic press lands in chat (§12).
- [ ] **Every entity chip is navigable.** Person, company, event, concept, place all route to an entity page (§13).
- [ ] **Mobile is canonical.** Desktop is the same atoms in a wider layout (§14) — if a screen only works on one breakpoint, it isn't done.
- [ ] Voice bars are phase-driven, not random per frame.
- [ ] Discard is destructive — alarm color, hard offset shadow on the confirm modal.

---

## 12. Product contract — the mic, the chat, the nav

> Resolves: "if you press the mic, does it open a new screen or just record?" One answer for the team to memorize. Source: `lib-logic.jsx` `LogicMicSurface`.

### 12.1 One mic. One surface.

There is **no separate capture screen**. Every mic affordance in wingmic — the nav-center button, the in-thread composer mic, an OS quick-action — lands in the **same place: `Chat`, with the mic already engaged**.

```
[nav mic]      ┐
[composer mic] ├────→ chat · recording ───┐
[OS shortcut]  ┘                            ├── → commit (writes to graph)
                                            └── ↪ answer  (reads from graph)
```

The agent classifies what you said and either creates a commit (new person, edge, follow-up) **or** answers a question. Same input. Same surface. Two outputs.

**Examples that commit:** `"met sarah from acme, she's their rust lead"` · `"had coffee with marcus, he wants to chat monday"`
**Examples that answer:** `"who was the rust person at acme?"` · `"remind me what priya works on"`

### 12.2 Navigation map

Five nav slots. One verb each. Only `capture` mutates state on tap; everything else navigates.

| Slot        | Verb    | Tap behavior |
|---|---|---|
| **home**    | see     | dashboard — today's stats, pending acts, recent commits |
| **chat**    | talk    | full agent thread — text or voice, capture or query |
| **capture** | record  | opens chat with mic engaged · the only nav slot that triggers an action |
| **graph**   | explore | force-directed graph of people / orgs / events / topics |
| **acts**    | approve | agent's queued drafts — check-ins, intros, reminders |

On desktop the bottom nav collapses into a **persistent left rail** with the same five slots plus a top-positioned `Hold to capture` brutalist CTA (`⌘ K` shortcut).

### 12.3 Capture flow — five states

| State | What's onscreen |
|---|---|
| **idle**      | nav-mic resting · `wm-pulse-d 1.6s` outer halo, no rings |
| **recording** | chat opens · transcript streaming · voice bars at accent · slide-up = lock · slide-left = cancel |
| **locked**    | hands-free · bars centered · `✖ discard` (alarm) + `↑ send` (accent brutal) replace the mic |
| **thinking**  | three-dot pulse on agent avatar · sources line streams below |
| **commit / answer** | either a commit card inline (entities + edges + sources) or a streamed answer with cited sources and chips |

Discard is **destructive** — use `--alarm`, `12% alpha` background, hard offset shadow on the confirm modal.

---

## 13. Entity detail pages — a shared template

> Source: `design.md §13` + bundle screens. Every chip in the product (`person`, `company`, `event`, `concept`, `place`) is navigable. They route to a page with the same scaffold so the team builds one layout, not five.

### 13.1 Scaffold

```
[nav row]                       ← back · graph · settings/pin
[hero]                          large glyph + name + eyebrow + sub + tags
[primary CTA]                   one accent button + one ghost
[stat trio]                     three italic serif numerals + mono labels
[from your captures]            list of timestamped excerpts (mono time · sans body)
[related entities]              avatar/tile rows · link to other entity pages
[open actions / follow-ups]     agent-drafted acts attached to this entity
[topics / quick links]          chips + outbound ↗ links
```

### 13.2 Hero glyphs (the identity tile)

See table in §6 → "Entity detail pages".

### 13.3 Routing rules

1. **Anywhere a chip appears, it links to its page.** Chips in chat, chips in person cards, chips in commit toasts — all clickable.
2. **One back stack.** Tapping an entity from chat returns to chat. From graph, returns to graph. Use the platform back affordance, never an in-page "Close".
3. **CTAs are always present.** Even if there's no follow-up, the primary action is `Find warm path →` (graph traversal) or `Draft check-in →`. Never leave the user staring.
4. **Sources are always cited.** Captures that mention the entity render with the mono timestamp + 1-line italic excerpt. No source = no claim.

---

## 14. Responsive — mobile is canonical, desktop is the same atoms

> Mobile-first isn't a slogan. The phone layout is the source. Desktop just adds horizontal room.

### 14.1 Breakpoints

| Name | Width | Layout shift |
|---|---|---|
| **mobile**  | 0–767     | single column, **bottom nav** w/ lifted mic, sheets rise from bottom |
| **tablet**  | 768–1119  | single column w/ wider gutters — still bottom nav |
| **desktop** | 1120+     | **persistent left rail (248px)** + content area, sheets become centered modals |

### 14.2 Nav promotion

| Mobile | → | Desktop |
|---|---|---|
| bottom nav (5 slots, center mic lifted) | → | left rail (logo, big `Hold to capture` CTA, 5 nav rows, pinned-people section, profile footer) |
| nav-center mic, brutalist offset | → | sidebar `Hold to capture` button (same brutalist styling) + `⌘ K` shortcut hint |
| modal sheet up from bottom | → | centered modal w/ 18px radius, same scrim |
| screen `<-` back arrow | → | sidebar nav stays visible, no back needed |

### 14.3 Content scaling

- **Type holds.** Hero stays `clamp(48, 8vw, 110)` for landing; product H1 stays `Inter 900 44–60px`. Don't shrink it on desktop — the negative space carries it.
- **Cards widen, then split.** Single-column lists become 2-column grids only on desktop (≥1120). Never 3-column body grids (§8 rule).
- **Detail → two-pane.** On desktop, `person`/`company`/`event` pages become `[list column 280px] [detail column flex]`. List is the entity directory; detail uses the §13 scaffold.
- **Chat gains an entity rail.** On desktop only, chat is `[thread flex] [entities rail 320px]` — rail surfaces the active entity, extracted chips, and sources. Mobile collapses these into inline pills + agent message footer.
- **Graph gains a detail pane.** On desktop, graph is `[canvas flex] [detail 340px]`. On mobile, tapping a node raises a `border-radius 14` card floating above the bottom nav.

### 14.4 Things that don't change between breakpoints

The atoms. Buttons keep the 4px offset shadow. Pills keep the alpha recipe. Voice bars stay 22 × 3px @ 38px max. The mic orb's seven states are pixel-identical mobile ↔ desktop. **Don't redesign atoms per breakpoint** — if a button needs to be smaller, use the `sm` size, don't make a new one.
