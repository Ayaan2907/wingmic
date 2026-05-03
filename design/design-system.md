# Wingmic — Design System

> **Source of truth:** `Wingmic Homepage v2.html`
> Use this file as the **default design system for every artifact in this project** — homepage, prototype, video, decks. When in doubt, match the homepage.

The aesthetic is **editorial brutalist + terminal**: warm hand-set type colliding with monospace UI chrome, sticker tape and scribble underlines pinned to a clean dark canvas, a living graph background that hums rather than shouts. It should feel like something a developer made *and* a designer art-directed — not slick SaaS, not generic AI.

---

## 1. Voice & tone

| | |
|---|---|
| Persona | Someone smart who keeps eye contact at a dinner party. Direct, observant, dry. |
| Voice | Lowercase confident. `"your social RAM, on disk"` not `"Powerful AI Memory Platform"`. |
| Headlines | Short imperatives + one italic serif twist per phrase. `"Stop forgetting. Start *building.*"` |
| Body | Tight. ≤ 2 sentences per paragraph in marketing. No filler. |
| Forbidden | Em-dashes-as-pause-everywhere · "powered by" · "cutting-edge" · "seamless" · emoji unless brand requires |
| Numbers | Spell out small ones in body, but **always digits** in stat blocks (`12 people`, `3 names`). |
| Code voice | `wingmic.contacts.search("rust")` — never `WingmicAPI.searchContacts({...})`. Verbs over nouns. |

---

## 2. Color tokens

### Core palette

```css
--bg-page:      #0a0a0a;   /* deep ink, never pure black */
--bg-card:      #08080d;   /* one notch deeper for terminals/code */
--ink:          #f4f1ea;   /* warm off-white — "newspaper", not #fff */
--ink-pure:     #ffffff;   /* reserved for headlines on dark cards */
--accent:       #FFC452;   /* amber — primary brand */
--second:       #86efac;   /* mint — success, secondary accent */
--third:        #FF8FAB;   /* coral pink — tertiary, sticker tape */
--alarm:        #FF6B6B;   /* red — forgetting / urgency */
--info-blue:    #7DD3FC;   /* tag pill, "Acme" / company chips */
--info-violet:  #A78BFA;   /* tag pill, technical entities */
```

### Surfaces (translucent, on `--bg-page`)

```css
--surface-1:    rgba(255,255,255,0.025);   /* card base */
--surface-2:    rgba(255,255,255,0.04);    /* card hover / nested */
--surface-3:    rgba(255,255,255,0.06);    /* input / pill */
--border-soft:  rgba(255,255,255,0.06);
--border-mid:   rgba(255,255,255,0.10);
--border-hard:  rgba(255,255,255,0.15);
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

### Tag-pill recipe

A tag pill takes a base color and uses **20% alpha bg + full color text**:

```css
.tag {
  padding: 3px 8px;
  border-radius: 999px;
  background: ${color}20;   /* hex alpha */
  color: ${color};
  font: 600 10px 'JetBrains Mono', monospace;
}
```

### Page background grain

The page is **not flat black**. Layer two faint warm radials on `#0a0a0a`:

```css
background-image:
  radial-gradient(ellipse at 20% 0%,   rgba(255,196,82,0.04) 0%, transparent 50%),
  radial-gradient(ellipse at 80% 100%, rgba(255,107,107,0.03) 0%, transparent 50%);
```

### Selection

```css
::selection { background: #FFC452; color: #000; }
```

---

## 3. Typography

### Families

| Token | Family | Weights | Use |
|---|---|---|---|
| `--font-sans`  | **Inter** | 400, 500, 600, 700, 800, 900 | Headlines, body, UI |
| `--font-serif` | **Instrument Serif** (italic + roman) | 400 | The editorial counterpoint — italic numerals, single accent words inside headlines |
| `--font-mono`  | **JetBrains Mono** | 400, 500, 600, 700 | Labels, code, timestamps, pills, terminal UI |

```html
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
```

### Body & default

```css
body {
  font-family: 'Inter', system-ui, sans-serif;
  color: #f4f1ea;
  -webkit-font-smoothing: antialiased;
}
.mono  { font-family: 'JetBrains Mono', monospace; }
.serif { font-family: 'Instrument Serif', serif; }
```

### Type scale

| Role | Family | Size | Weight | Letter | Line | Notes |
|---|---|---|---|---|---|---|
| **Hero H1** | Inter | `clamp(48px, 8vw, 110px)` | 900 | -0.045em | 0.92 | Compose with one italic serif word inline |
| **Section H2** | Inter | `clamp(40px, 6vw, 72px)` | 800 | -0.035em | 0.95 | |
| **Subsection H3** | Inter | 38px | 800 | -0.025em | 1.05 | |
| **Stat numeral** | Instrument Serif italic | `clamp(80px, 14vw, 180px)` | 400 | -0.04em | 0.85 | The signature element — always italic |
| **Step numeral** | Instrument Serif italic | 100px | 400 | -0.04em | 1 | Inline next to mono "STEP" label |
| **Lead body** | Inter | 18px | 400 | — | 1.55 | `color: var(--text-55)` |
| **Body** | Inter | 17px | 400 | — | 1.6 | `color: var(--text-55)` |
| **Card body** | Inter | 14.5px | 400 | — | 1.55 | `color: var(--text-78)` |
| **UI text** | Inter | 13–13.5px | 500–600 | — | 1.4 | Nav links, buttons |
| **Code / terminal** | JetBrains Mono | 12.5px | 400 | — | 1.75 | |
| **Eyebrow / label** | JetBrains Mono | 11px | 500 | 2px (uppercase) | — | `color: var(--accent)` or `--text-40` |
| **Pill / chip** | JetBrains Mono | 10–11px | 600–700 | 1px | — | Uppercase |
| **Caption** | JetBrains Mono | 10px | 500 | — | — | `color: var(--text-30)` |

### The italic-twist rule

Every major headline gets **one** italic serif word or phrase as its punctuation:

> **Stop forgetting.** *Start building.*
> Plain English. *From anywhere.*
> Drafts the follow-up. *You just send.*

Don't italicize more than one fragment per heading. The serif is a knife, not a font.

---

## 4. Spacing, radii, elevation

### Spacing scale (px)

`4 · 6 · 8 · 10 · 12 · 14 · 16 · 20 · 24 · 28 · 32 · 40 · 48 · 60 · 72 · 96 · 120`

Section vertical rhythm: **`paddingTop: 120, paddingBottom: 60`** for hero; **`80–96`** for inner sections. Container max-width **`1280px`** with **`32px`** horizontal padding.

### Border radius

| Token | Value | Use |
|---|---|---|
| `--r-sm` | 4–6px | Tag chips, micro pills |
| `--r-md` | 8–10px | Buttons, small cards |
| `--r-lg` | 12–14px | Code blocks, content cards |
| `--r-xl` | 16–22px | Hero cards, testimonial cards |
| `--r-2xl` | 36px | Phone bezels |
| `--r-pill` | 999px | Pills, sticker badges, dot indicators |

### Borders

Almost every card has a **1px translucent border**:

```css
border: 1px solid rgba(255,255,255,0.06);   /* default */
border: 1px solid rgba(255,255,255,0.10);   /* hover/emphasis */
border: 1.5px solid ${accent}50;            /* status / live badge */
border: 8px solid #1a1a20;                  /* phone bezel */
```

### Shadow / elevation

| Token | Value | Use |
|---|---|---|
| `--shadow-sticker` | `3px 3px 0 rgba(0,0,0,0.2)` | Sticker badges, soft hard-shadow |
| `--shadow-button`  | `4px 4px 0 #000` | Primary CTAs (brutalist offset, never blurred) |
| `--shadow-card`    | `0 20px 50px rgba(0,0,0,0.4)` | Code blocks, content cards |
| `--shadow-phone`   | `0 30px 60px rgba(0,0,0,0.5), inset 0 0 40px rgba(255,196,82,0.05)` | Phone mocks |
| `--shadow-glow-accent` | `0 0 80px ${accent}15` | Floating elements over the graph |

**Rule:** Buttons and stickers use **hard offset shadows** (no blur). Cards and surfaces use **soft drop shadows**. Never mix.

---

## 5. Signature elements

These are the bits that make Wingmic look like Wingmic. Use them sparingly and on purpose.

### Sticker badges

Small uppercase mono pills, rotated, with a hard offset shadow. Used as floating annotations on the page (`OPEN BETA`, `voice-first`, `MIT @ GA`).

```jsx
<Sticker color={accent} rotate={-4} x="6%" y="32%">v0.1 BETA</Sticker>
```

```css
{
  padding: 5px 10px;            /* lg: 10px 16px */
  border-radius: 999px;
  background: ${color};
  color: #0a0a0a;
  font: 700 10px/1 'JetBrains Mono';   /* lg: 13px */
  letter-spacing: 1px;
  text-transform: uppercase;
  box-shadow: 3px 3px 0 rgba(0,0,0,0.2);
  transform: rotate(${-6 to 6}deg);
}
```

### Scribble underline

A hand-drawn SVG line under a single key word in marketing copy. Inline SVG, not a font:

```css
.scribble {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 12'%3E%3Cpath d='M2 8 Q50 2 100 7 T198 6' stroke='%23FFC452' stroke-width='3' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
  background-position: bottom left;
  background-repeat: no-repeat;
  background-size: 100% 0.3em;
  padding-bottom: 0.2em;
}
```

### Tape strip

A short dashed/translucent rectangle pinned at an angle near a card edge. Decorative only.

```css
.tape {
  position: absolute;
  background: rgba(255,196,82,0.18);
  border: 1px dashed rgba(255,196,82,0.4);
  width: 90px; height: 18px;
}
```

### 48px grid background

For "developer / blueprint" sections only. Not on every page.

```css
.grid-bg {
  background-image:
    linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
  background-size: 48px 48px;
}
```

### Card rotation rhythm

When you have a row of cards (testimonials, feature tiles), give them a tiny alternating rotation so the row breathes. Never more than **±0.5°** for content cards.

```js
transform: i % 3 === 0 ? 'rotate(-0.4deg)' : i % 3 === 1 ? 'rotate(0.5deg)' : 'rotate(0deg)';
```

Stickers and pinned annotations can rotate **±2° to ±6°**. Never rotate body text or buttons.

### Live graph background

A canvas-rendered force graph (60 nodes, ≤160px connection radius, 0.65 alpha, palette = [accent, second, third, white]). Lives behind the hero, dimmed to ~25% in z-stack.

Tunable density (`density={1}` standard, `0.5` for embedded sections).

---

## 6. Components

### Primary button

Brutalist hard-shadow, amber on ink. **Always with a 1.5px black border** so it doesn't dissolve on the dark page.

```css
{
  padding: 15px 26px;
  border-radius: 10px;
  background: var(--accent);
  color: #000;
  font: 700 15px 'Inter';
  border: 1.5px solid #000;
  box-shadow: 4px 4px 0 #000;
}
:hover { transform: translate(-1px, -1px); box-shadow: 5px 5px 0 #000; }
```

### Ghost button

```css
{
  padding: 15px 26px;
  border-radius: 10px;
  background: transparent;
  color: #fff;
  font: 600 15px 'Inter';
  border: 1.5px solid rgba(255,255,255,0.25);
}
```

### Mini icon button (terminal chrome)

The 9px traffic-light dots used on code/terminal cards: `#ff5f56 / #ffbd2e / #27ca3f`, in a `gap: 6px` row, top-left of a `08080d` card with a `border-bottom: 1px rgba(255,255,255,0.08)` divider.

### Code / terminal card

```css
{
  border-radius: 14px;
  overflow: hidden;
  background: #08080d;
  border: 1px solid rgba(255,255,255,0.08);
  box-shadow: 0 20px 50px rgba(0,0,0,0.4);
}
/* header: 10px 16px, traffic lights L, filename mono center, spacer R */
/* body: 18px 22px, font: 12.5px/1.75 'JetBrains Mono' */
```

Syntax color tokens (matched in homepage code blocks):

| Token | Color |
|---|---|
| keyword | `var(--accent)` `#FFC452` |
| string | `var(--second)` `#86efac` |
| comment | `rgba(255,255,255,0.35)` |
| default | `rgba(255,255,255,0.85)` |

### Stat block

Italic serif numeral over a mono uppercase label. Drift-up animation, tiny rotation.

```jsx
<StatBlock value="12" label="people met" color={accent} rotate={-2} sub="One night." />
```

### Step section (How-it-works row)

Two-column row, alternating `side="L"` / `side="R"`. Left column: huge italic serif step number (`100px`) + mono `STEP` label, then `38px` H3 and `17px` body capped at 460px. Right column: visual (phone, code block, graph).

### Testimonial card

```css
{
  width: 360px;
  padding: 22px;
  background: rgba(255,255,255,0.025);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 16px;
  transform: rotate(±0.5deg);  /* alternating */
}
/* opening italic quote: serif italic 28px accent */
/* body: 14.5px/1.55 rgba(255,255,255,0.78) */
/* avatar: 32px square (radius 10), gradient accent → coral, initial in 13px black 800 */
/* role: 10.5px mono rgba(255,255,255,0.4) */
```

Use as a horizontal **marquee** for social proof: duplicate the list and animate `translateX` from `0` to `-50%` over ~40s linearly.

### Phone mock (homepage hero)

```
width: 280, height: 560
border-radius: 36
background: #0a0a10
border: 8px solid #1a1a20
box-shadow: 0 30px 60px rgba(0,0,0,0.5), inset 0 0 40px rgba(255,196,82,0.05)
notch: 24px tall #1a1a20 with 60×14 #0a0a10 inner pill
home indicator: 100×4 rgba(255,255,255,0.2) at the bottom
```

For the **prototype** (which uses a more iOS-accurate frame), keep these proportions and the `#08080d` interior, but use a 44px corner radius and a 126×36 dynamic island instead of a notch.

### Voice-bar visualizer

22 vertical bars, 3px wide, 2px radius, gap 3px, height range 4–38px. Active = accent, idle = `rgba(255,255,255,0.2)`, transition `height 0.12s ease-out`. Drive heights from a phase counter, not random per-frame, so it feels musical.

### Tag pill (entity chips)

Color-coded by entity type. Always **20%-alpha background, full-color text**. People = accent. Companies = `#7DD3FC`. Concepts/topics = `#A78BFA`. Events = `#666`.

### Activity row (timestamp ticker)

```
[6px pulse-d dot, accent] [mono 11px who, accent, minw 90] [mono 11px what, text-40, minw 90] [14px detail, text-70, ellipsis] [mono 10px timestamp, text-30]
```

Used in the "live activity" homepage strip and the prototype's commit log.

### Acts / agent draft card (prototype + scene 7 of video)

Distinct compositional unit:
- **Header row:** 22×22 accent square with monogram + name/timestamp + uppercase mono kind tag (`↗ check-in`, `◷ reminder`, `⇌ intro`).
- **Subject line:** mono 10px rgba(255,255,255,0.45), bottom-bordered.
- **Draft body:** mono 10.5–11.5px on `rgba(0,0,0,0.3)` inset, white-space pre-wrap, blink cursor while typing.
- **Confidence bar:** 40×3 track at `rgba(255,255,255,0.1)`, fill at accent, % to the right.
- **Sources line:** mono 9.5px, 0.3 alpha, prefixed `sourced from:`.
- **Action row:** primary "Send now →" + ghost "edit" / "skip".

---

## 7. Animation

| Cue | Duration | Easing | Use |
|---|---|---|---|
| `blink` | 0.7s loop | step | Caret in input + capture transcript |
| `pulse-d` (opacity 1→0.4→1) | 1.5s loop | ease-in-out | Live status dots |
| `pulse` (scale 1→1.05→1) | 1–1.6s loop | ease-in-out | "thinking" indicators, recording orb |
| `drift-up` (translateY 0→-6→0) | 5–6s loop | ease-in-out | Stat numerals, sticker badges |
| `marquee` | 30–40s loop | linear | Testimonial / logo strips |
| `spin-slow` | varies | linear | Orbital ring around recording orb |
| `shake` | 0.4s | ease | Error states |
| Card entry | 0.5s | ease-out | translateY(20-30px) + opacity 0→1 |
| Button hover | 0.15s | ease-out | translate(-1px, -1px) + shadow 4→5px |

For motion-graphics work (video), the `animations.jsx` starter is the right primitive — same vocabulary (`fadeIn`, `pop`, `easeOut`, drift loops). The video also lives by these timings.

---

## 8. Composition rules

1. **Two columns or one.** No three-column body grids. Use a 2-col split for the hero and step rows; full-bleed single column for everything else.
2. **One italic serif word per heading**, no more. (See voice rule above.)
3. **Stat blocks come in pairs or trios**, each rotated slightly differently (`-2°, +1°, -1°` style).
4. **Stickers go in the negative space**, not on top of content. Pin them at percentages on the section, not in the flow.
5. **Code blocks lead, prose follows.** When introducing the API, show a 3–6 line snippet first, then explain.
6. **Prefer mono labels over icons** for metadata (`STEP`, `LIVE`, `BETA`). Icons earn their place in nav and primary actions only.
7. **Section eyebrow + heading + lead** is the standard opener:
    ```
    eyebrow:   mono 11px accent uppercase tracked 2px
    heading:   inter 800 ~60px italic-serif accent on one word
    lead:      inter 18px text-55, max 480px
    ```
8. **No center-aligned body text.** Headlines can center; body left-aligns.
9. **Density is fine.** A wingmic page should feel like a designer's plotter print, not a wireframe. Pack the negative space with stickers, scribbles, mini stat blocks — but **never** with informational filler.

---

## 9. Iconography

- **Outline icons only**, 22×22 viewbox, 2px stroke, round caps & joins, currentColor.
- Filled glyphs reserved for: the recording mic icon, traffic-light dots, status indicators.
- The Acts kind glyphs are **typographic, not iconic**: `↗` check-in, `◷` reminder, `⇌` intro, `◇` step marker, `›` terminal prompt, `↪` result arrow. Lean into these — they're cheaper than icons and feel terminal-native.
- Avatar initials (capture / dashboard / acts) on a flat bright color square (`borderRadius: 10`), black 800-weight monogram.
- Never use emoji in product chrome. Outside chrome (slide decks, dev marketing copy), case-by-case at most one per section.

---

## 10. Surfaces map (where each artifact uses what)

| Artifact | Bg | Type lead | Signature element |
|---|---|---|---|
| **Homepage** (`Wingmic Homepage v2.html`) | `#0a0a0a` + warm radials | Inter 110px hero w/ italic serif | Stickers, scribble, live graph, marquee |
| **Prototype** (`Wingmic Prototype.html`) | `#050510` (Tweakable) | Inter sans for screens, mono for chrome | Pulse dots, accent ring on capture, agent reasoning trace |
| **Video** (`Wingmic Video v6.html`) | `#0a0a0a` | Same scale, all fonts | Step numeral cards, draft notification card |
| **Decks / docs** | Same as homepage | Same | Stickers + serif italic accents — go lighter on tape/scribble |

When extending Wingmic into a **new** artifact (a doc, a slide deck, a t-shirt), the floor is: dark warm bg + Inter/Instrument Serif/JetBrains Mono + amber accent + one signature element from §5.

---

## 11. Quick checklist before shipping

- [ ] Body bg has the warm radial overlay, not pure `#000`.
- [ ] All three font families are loaded.
- [ ] At least one heading uses the italic-serif twist.
- [ ] No card has a borderless edge — every elevation has a 1px translucent border.
- [ ] Buttons use hard offset shadows; cards use soft drop shadows. Not mixed.
- [ ] Eyebrows are mono, uppercase, 2px tracked, accent-colored.
- [ ] Stickers exist in negative space, rotated ±2–6°, never over text.
- [ ] No three-column body grids.
- [ ] No emoji in product chrome.
- [ ] No filler. Every element earns its place.
