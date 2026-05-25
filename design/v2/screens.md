# Wingmic — v2 screens reference

> Synthesized from Claude Design bundle 2026-05-24 (handle: `IeDyiNzPI2mu5WRJRWuuKQ`).
> Each screen below maps to one or more components in the runnable component library at [`design/v2/Wingmic Component Library.html`](./Wingmic%20Component%20Library.html), with source modules at [`design/v2/library/lib-*.jsx`](./library/).
> Mobile is canonical (iPhone 15 Pro frame: **393 × 852**, 8px bezel, 126×36 dynamic island). Desktop variants where the bundle distinguishes are noted under each screen.
> Token references throughout point back to [`design/design-system.md`](../design-system.md) (v2).
> To view the canvas locally: `cd design/v2 && python3 -m http.server 8000` then open `http://localhost:8000/Wingmic%20Component%20Library.html` (see [`design/v2/README.md`](./README.md)).

## Reading order

Screens are ordered along the **canonical user flow**:

`onboarding → home → chat-resting → chat-recording → chat-locked → chat-response → graph → person → company → event → acts → search → settings`

Then **capture variants** (alternates only for the audio-capture surface, the centerpiece): `A · chat-anchored (canonical)` → `B · centered orb` → `C · slide-up sheet`.

Then **desktop layouts**: `desktop-home → desktop-chat → desktop-graph → desktop-person`.

Then **system-logic surfaces** that aren't user screens but live in the library: `logic-mic-surface → logic-nav-map → logic-flow-storyboard`.

---

## Conventions for every screen

- **Frame**: 393 × 852 phone, dynamic island fixed (`top: 11, w: 126, h: 36`, `borderRadius: 999`, black), status bar `9:41` + signal pip + 5G + battery, home indicator `134×5 rgba(255,255,255,0.45)`.
- **Background**: `#0a0a0a` + the warm-radial overlay (see `design-system.md §2 / Page background grain`).
- **Bottom nav** present on top-level screens (home/chat/graph/acts), absent on capture full-screens, sheets, and detail pages — those use a `←` chevron and inherit nav from the parent stack.
- **Topbar pattern** (`MobileTopBar`): `padding 8px 20px 12px`, eyebrow optional, Inter 800 26px title + italic-serif twist + mono `sub` line uppercase tracked 1.2 in `--text-40`. Right side: round 38px chrome buttons.
- **Bottom-nav active screen tag** in the diagrams below uses `[nav: <slot>]`.

---

# Mobile screens

## 1. Onboarding

**Source**: `lib-screens.jsx ScreenOnboarding`

The first-run welcome. Centered on a single screen (one of three onboarding steps; progress bar shows step 1/3). Anchored by the large idle MicOrb (140px) surrounded by 6 satellite color-coded dots (the entity palette in miniature) and a faint accent radial halo. The brand promise lives in the headline below.

### Layout (mobile)

```
┌───────────────────────────────────────┐
│ [v0.1 beta sticker, rotated -4°, TR]  │
│ ◆ welcome                              │
│                                        │
│             ●                          │
│        ╱         ╲                     │
│       ●   [Mic ]   ●                   │
│        ╲   140    ╱                    │
│             ●                          │
│                                        │
│ your social RAM,                       │
│ on disk.   ← italic serif accent       │
│                                        │
│ Hold the mic. Talk like a human.       │
│ Wingmic builds the graph behind         │
│ every person you meet.                 │
│                                        │
│ ━━ ─── ───                             │ ← progress dots (22×4)
│ [ Next — give mic access → ]           │ ← primary brutal full-width
│   skip · I'll explore first            │ ← ghost mono
└───────────────────────────────────────┘
```

### Composition (which lib-* atoms)

- `MicOrb` (`lib-voice.jsx`) at `size=140, state="idle"` + a manual accent-radial halo behind.
- `Sticker` (`lib-shared.jsx`) — top-right, `v0.1 beta`, rotated -4°.
- Eyebrow (`◆ welcome`) — design-system §6 convention.
- Headline — Inter 900 44px with `<i>` Instrument Serif accent.
- Primary brutal CTA full-width (44px hit, `4px 4px 0 #000`).
- Ghost button below in mono.

### Interactions

- Tap `Next` → request mic permission (OS prompt). Then advances to step 2 (not in bundle — flag for design pass).
- Tap `skip` → enters the app at `home` with mic state idle.

### Token usage

`--accent`, `--text-55`, `--shadow-button`, `--r-md`, satellite dots use `[accent, second, third, blue, violet, accent]`.

### vs v0.1.1 plan

The v0.1.1 hosted-capture plan does not currently spec an onboarding flow. This screen is **new in v2** — flag for product before shipping.

---

## 2. Home / dashboard

**Source**: `lib-screens.jsx ScreenHome`

The morning briefing. Stat trio (people / acts / commits), agent stripe ("wingmic read your graph 06:12 · 3 drafts pending"), today's pending acts (3 inline mini-cards each with Send), and a recent-commits ActivityRow list.

### Layout (mobile)

```
┌───────────────────────────────────────┐
│ today ·               [🔍] [M avatar]  │
│ MON · OCT 21                           │
│                                        │
│  12     3      4                       │
│  ╱     ╱      ╲                        │  ← serif italic 56px,
│ ppl   acts    commits                  │     rotated -2°/+1°/-1°
│                                        │
│ ┌─────────────────────────────────┐    │
│ │● wingmic · read your graph 06:12│ →  │  ← agent stripe (glow card)
│ └─────────────────────────────────┘    │
│                                        │
│ ◆ ACTS · PENDING       see all →      │
│ ┌─ ☐ ↗ check-in · 92% ──────── send →│
│ │ [S] Sarah Chen                       │
│ │     7d since DevConnect · you owe…  │
│ └──────────────────────────────────────┘
│ [Marcus reminder card]                 │
│ [Priya→Deepak intro card]              │
│                                        │
│ ◆ RECENT COMMITS                       │
│ ●sarah_chen   commit  met @ DevConn… 14:32
│ ●marcus_riv… enriched sightglass · 9am 15:10
│ ●priya_sharma commit  diarization…   16:45
│                                        │
│   hold the mic. talk like a human.    │
│                                        │
│ [home] [chat] [⬆ MIC] [graph] [acts]   │ ← MobileNav active=home
└───────────────────────────────────────┘
```

### Composition

- `MobileTopBar` — title `today` + italic `·`, sub `mon · oct 21`, right = search chrome button + 38px Avatar.
- **Stat trio** — inline serif italic 56px (smaller than the `--serif-numeral` 84px because mobile), accent / second / third, rotated `-2°/+1°/-1°`.
- **Agent stripe** — gradient (`linear-gradient(90deg, accent10, transparent)`), `1px accent30` border, `border-radius 12`, pulse-d dot.
- **Acts mini-cards** — Avatar square 36 + kind pill (mono 9.5px tracked) + name + 1-line `why` + primary brutal "send →" 11px.
- **Recent commits** — `ActivityRow` × 3 inside a default card.
- `MobileNav active="home"`.

### Interactions

- Search button → search screen.
- `send →` per act → fires the action (no confirm; Acts inbox is where edit happens).
- Tap any act → expands into Acts inbox detail.

### Token usage

`--accent / --second / --third`, `--surface-1`, `--border-acc` on the agent stripe and on the Sarah card, `wm-pulse-d`.

### vs v0.1.1 plan

v0.1.1 implementation focuses on `chat-thread + push-to-talk` (chat surface). A dashboard like this **does not exist in v0.1.1a/b**. Treat as v0.2+ direction.

---

## 3. Chat — resting

**Source**: `lib-screens.jsx ScreenChatResting`

The default state when you open Chat. Shows a welcome agent message ("Morning. Ask me anything — who you met, what was said, who to thread. Or just hold the mic and tell me about a new contact.") and three suggested-query chips. Composer at the bottom (pill with `+`, `ask wingmic…` placeholder, brutal 44px mic right). Caption below the composer: `hold to talk · tap to type`.

### Layout (mobile)

```
┌───────────────────────────────────────┐
│ [W] wingmic           [graph] [⚙]      │
│     ● reading 1,247 nodes              │
├───────────────────────────────────────┤
│ — TODAY · 14:30 —                      │
│ [W] Morning. Ask me anything — who    │
│     you met, what was said, who to    │
│     thread. Or just hold the mic…     │
│     09:00                              │
│                                        │
│     ↪ TRY                              │
│     ⟦ who was the rust person at acme?⟧│
│     ⟦ remind me of last week's coffee⟧ │
│     ⟦ who should I introduce to priya?⟧│
│                                        │
│                                        │
│ ┌────────────────────────────────────┐│
│ │ [+]  ask wingmic…           [🎤]  ││  ← composer · resting
│ └────────────────────────────────────┘│
│       hold to talk · tap to type       │
└───────────────────────────────────────┘
```

### Composition

- `ChatHeader` (defined in `lib-screens.jsx`) — Avatar square `W`, status row with pulse dot + `reading 1,247 nodes`, two chrome buttons (graph + settings).
- `MsgAgent` body with italic-serif accent inline (`Ask me anything`).
- Suggested chips — `border-radius 999`, `rgba(255,255,255,0.03)` bg, `rgba(255,255,255,0.08)` border, sans 13px.
- Composer pill with `+` icon button + placeholder + brutal mic.

### Interactions

- Tap any chip → fills composer, ready to send.
- Hold mic → transitions to `chat-recording`.
- Tap mic → transitions to `chat-recording` (one-tap-start; chat-anchored capture per `lib-logic.jsx`).
- Tap composer placeholder area → keyboard up; mic swaps to send icon when typed (per `lib-voice.jsx` composer typing state).

### Token usage

`--accent` (avatar, italic word, mic, focus ring), `--surface-2`, `--border-mid`, mono caption `--text-30`, `wm-pulse-d`.

### vs v0.1.1 plan

This **matches** the v0.1.1 hosted-capture direction (chat thread + push-to-talk composer). Use as the reference visual.

---

## 4. Chat — recording (push to talk)

**Source**: `lib-screens.jsx ScreenChatRecording`

Held mic. The thread dims to `opacity 0.4`. A floating live-transcript card overlays the bottom with the accent border and a pulsing alarm dot + `RECORDING` + duration. Voice bars below the transcript. The recording mic floats bottom-right (`88px MicOrb state=recording`) with two affordances: **slide-up-to-lock** (a 44px floating circle above the mic with `wm-drift` animation and `↑ LOCK` caption) and **slide-left-to-cancel** (a `←` chevron + italic `slide to cancel` to the left).

### Layout (mobile)

```
┌───────────────────────────────────────┐
│ [W] wingmic                            │
│     ● · recording                      │
├───────────────────────────────────────┤
│ — TODAY —                              │  ← dimmed thread (opacity 0.4)
│ [W] Morning. Ask me anything.          │
│                                        │
│ ┌──────────────────── glow ───────────┐│  ← live transcript card
│ │● RECORDING               0:12      ││     bg rgba(255,196,82,0.06)
│ │ met sarah from acme at devconnect, ││     border 1px accent50
│ │ she's their rust lead. need to send││
│ │ her my edge-reload repo ▌          ││
│ │ ▍▎▌▊▆▍▌▊▍▎▍▆▌▌                    ││  ← VoiceBars active 28×20
│ └────────────────────────────────────┘│
│                                        │
│                              ┌────┐    │
│                              │ 🔒 │    │  ← slide-up-to-lock affordance
│                              └────┘    │     (44px, wm-drift, ↑ LOCK below)
│                              ↑ LOCK    │
│  ← slide to cancel                     │
│                              [ Mic ]   │  ← MicOrb 88, state=recording
└───────────────────────────────────────┘
```

### Composition

- `ChatHeader status="recording"`.
- Dimmed thread (opacity 0.4) for spatial continuity.
- **Live transcript card**: `padding 16, border-radius 16, bg rgba(255,196,82,0.06), 1px accent50, backdrop-filter: blur(20px)`. Header row: alarm-red 8px pulse dot + mono `RECORDING` accent + duration `mono 16px accent`. Body: Inter 15/1.55 ink with blink caret. Footer: `VoiceBars active count=28 height=20`.
- **Slide-up-lock affordance**: 44px circle, accent tint (`rgba(255,196,82,0.12)` bg, `1.5px accent80` border), lock icon 16 accent, `wm-drift 1.4s`. Mono caption below: `↑ LOCK`.
- **Slide-left-to-cancel hint**: `arrowL` icon 16 `--text-55` + italic sans 13px `--text-55`.
- **Recording orb**: `MicOrb size=88 state="recording"` bottom-right.

### Interactions

- Release finger → if upward drag reached threshold (slide-up): → `chat-locked`. Else → `chat-thinking → chat-response` (commit or answer).
- Swipe left → cancels, transcript discards, returns to `chat-resting`.

### Token usage

`--accent`, `--alarm` (pulse dot only), `--surface-3`, `--border-acc`, `wm-pulse-s` on orb rings, `wm-pulse-d` on alarm dot, `wm-blink` caret, `wm-drift` on lock circle.

### vs v0.1.1 plan

v0.1.1 spec includes push-to-talk; **slide-up-to-lock and slide-left-to-cancel are v2 extensions**. The transcript-card-above-mic pattern is also a v2 visual upgrade. Flag both for implementation.

---

## 5. Chat — locked (hands-free)

**Source**: `lib-screens.jsx ScreenChatLocked`

After slide-up-lock. Hands-free recording. The thread is no longer dimmed — it scrolls naturally as the transcript grows. A "transcript · live" card pinned at the top of the active conversation shows the rolling capture. Below it, an `↪ EXTRACTING…` label followed by `EntityTag` chips populating as entities resolve (sarah chen, acme corp, DevConnect, edge config, priya sharma, `+ 2 more…`).

Bottom bar: pill with **lock tile · voice bars · duration · discard · send**. Caption below: `hands-free · keep talking`.

### Layout (mobile)

```
┌───────────────────────────────────────┐
│ [W] wingmic       ● · recording        │
├───────────────────────────────────────┤
│ ┌── ◆ TRANSCRIPT · LIVE      0:42 ──┐│
│ │ met sarah from acme at devconnect,││
│ │ she's their rust lead. discussed  ││
│ │ edge config strategies for hot…   ││
│ │ … need to thread them ▌            ││
│ └────────────────────────────────────┘│
│                                        │
│ ↪ EXTRACTING…                          │
│ [◉sarah chen] [▤acme corp] [◆DevConn…]│  ← EntityTag row
│ [◇edge config] [◉priya sharma] [+2…]  │
│                                        │
│                                        │
│ ┌───────────────────────────────────┐ │
│ │ 🔒  ▎▎▍▌▊▌▎▍▎▌  0:42  [🗑] [↑]   │ │ ← locked composer pill
│ └───────────────────────────────────┘ │   1.5px accent80 border
│         HANDS-FREE · KEEP TALKING      │
└───────────────────────────────────────┘
```

### Composition

- `ChatHeader status="recording"`.
- **Transcript card**: default surface (`surface-1`, `border-soft`), but with the live-eyebrow `◆ TRANSCRIPT · LIVE` + accent duration. Caret still blinks.
- **EntityTag row**: extracting label + chips (people = accent, company = blue, event = grey, concept = violet). Trailing `+ N more…` chip uses `1px dashed rgba(255,255,255,0.12)` border + `--text-40`.
- **Locked composer**: `padding 10, border-radius 999, bg rgba(20,20,22,0.85), backdrop-filter: blur(20px), 1.5px accent80`. Contents L→R: 36px **lock tile** (accent border, tinted bg), **flex-center VoiceBars** (count 18, height 26, accent), **mono 13px accent duration**, **38px destructive discard** (alarm pill), **44px primary send** (brutal accent arrowUp).

### Interactions

- Tap discard → modal confirm (see `lib-states.jsx StatesModal` — destructive variant).
- Tap send → commits transcript, transitions to `chat-thinking → chat-response`.
- Keep talking → transcript scrolls; the user can also re-enter the gestures by tapping the lock tile (slide-up no longer relevant).

### Token usage

`--accent`, `--alarm` (discard), `--surface-3`, `--border-acc` strong (`accent80`), `--shadow-button` on send, `wm-blink` caret.

### vs v0.1.1 plan

`hands-free locked recording` is a v2 enhancement not in v0.1.1. The transcript-card-with-live-entity-extraction is also new. Defer to v0.2 unless prioritised.

---

## 6. Chat — agent response

**Source**: `lib-screens.jsx ScreenChatResponse`

After release. Shows: the user's question as an amber brutal bubble, then an agent reply that names the person (with the answer in `--text-85`), then an embedded **person card** floating with `glow` shadow + tag pills + arrow-right chrome button, then two suggested actions (`Draft follow-up →` primary pill + `open card` ghost). Composer is back to its resting state.

### Layout (mobile)

```
┌───────────────────────────────────────┐
│ [W] wingmic        ● just now          │
├───────────────────────────────────────┤
│ — TODAY · 14:30 —                      │
│                                        │
│             ┌──────────────────────┐  │
│             │ who was the rust     │  │ ← MsgYou (amber brutal)
│             │ person at acme?      │  │   shadow 3×3
│             └──────────────────────┘  │
│                              14:32     │
│                                        │
│ [W] Sarah Chen — Rust Lead at Acme.   │  ← MsgAgent
│     You met at DevConnect on Oct 14.  │
│     She talked edge-config + hot-     │
│     reloading and you said you'd      │
│     send your edge-reload repo.       │
│     ↪ sourced from: voice note 14:32 │
│                · 3 commits             │
│                                        │
│  ╔═════════════ glow card ═══════════╗│
│  ║ [Sarah avatar 42]                 ║│ ← embedded person card
│  ║ Sarah Chen                  →    ║│   border-acc30, glow shadow
│  ║ Rust Lead · Acme Corp             ║│
│  ║ #engineering #rust ◐ follow-up    ║│ ← Pill row
│  ╚═══════════════════════════════════╝│
│                                        │
│  [ Draft follow-up → ]  ⟦ open card ⟧│ ← suggested actions
│                                        │
│ ┌────────────────────────────────────┐│
│ │ [+]  ask wingmic…           [🎤]  ││ ← composer resting
│ └────────────────────────────────────┘│
└───────────────────────────────────────┘
```

### Composition

- `ChatHeader status="responded"`.
- `MsgYou` brutal amber.
- `MsgAgent` with inline color-coded entities (`Sarah Chen` accent, `Acme` blue, `DevConnect` `--text-40`, `edge-reload` mono accent). Sources line in mono `--text-30`.
- **Embedded person card** — left-indented `38px` to align with agent message; `surface-1 + border-acc30 + 0 0 40px accent10 glow`. Avatar 42 round + name + role + arrow chrome + Pill row.
- **Action row** — primary pill `Draft follow-up →` + ghost pill `open card`.

### Interactions

- Tap person-card body or `→` → `person` detail screen.
- Tap `Draft follow-up →` → routes to Acts inbox with that draft expanded.
- Tap any inline entity word (sarah, acme, devconnect) → entity detail.

### Token usage

`--accent`, `--info-blue`, `--shadow-glow`, `--border-acc`, pill recipe (color `1f / 40`).

### vs v0.1.1 plan

The chat-response surface aligns with v0.1.1's chat-thread direction. The **embedded entity card** with glow shadow is a v2 enhancement to make answers feel grounded.

---

## 7. Graph

**Source**: `lib-capture-variants.jsx ScreenGraph` (+ `GraphCanvas`)

Force-directed visual of your network. Header: eyebrow `◆ GRAPH` + Inter 800 26px `everyone you know` (italic `you know`) + breakdown sub (`12 people · 5 orgs · 3 events`). Filter chips row: `◉ people, ▤ orgs, ◆ events, ◇ topics, ☆ warm` (on/off state via colored vs grey fill). SVG graph below with **You** as a self-pulsing accent center node, people as filled circles, **companies as squares**, **events as outlined diamonds**. A floating selected-node card pinned above the bottom nav shows the active selection's preview with `→` to detail.

### Layout (mobile)

```
┌───────────────────────────────────────┐
│ ◆ GRAPH                          [🔍] │
│ everyone you know                      │
│ 12 ppl · 5 orgs · 3 events             │
│                                        │
│ [◉people on] [▤orgs on] [◆events on]  │ ← filter chips, scrollable row
│ [◇topics off] [☆warm off]              │
│                                        │
│        ◇ DevConnect                    │
│             │                          │
│   ●Sarah  ●Jordan      ●Marcus         │
│      │      │   ╲   ╱     │            │
│      ▢Acme  ●You ────── ▢Dataweave    │
│              ╱   ╲                     │
│        ●Alex     ●Priya                │
│                    │                   │
│                  ▢NeuralPath           │
│                                        │
│  ╔═══════════════════════════════════╗│
│  ║ [S]  Sarah Chen  ◐ WARM       → ║│ ← selected-node card
│  ║      Rust Lead · Acme · 5 edges  ║│   bg rgba(10,10,10,0.9) + glow
│  ╚═══════════════════════════════════╝│
│ [home] [chat] [⬆ MIC] [graph•] [acts] │
└───────────────────────────────────────┘
```

### Composition

- Top: eyebrow + Inter 800 26px header (italic on `you know`) + colored mono breakdown (numbers in `--accent / --info-blue / --text-55`).
- **Filter chips**: horizontally scrollable. Selected = `${c}1f` bg + `${c}40` border + color text. Unselected = `surface-1 + border-soft + --text-40`.
- **GraphCanvas SVG**: ~360×460 viewport, `radialGradient` background centered. Edges: `accent50` if connected to `you`, else `rgba(255,255,255,0.12)`. Nodes: filled circle (person), filled square (company, `rx 2`), outlined diamond (event, 1.5px stroke). The `you` node has an animated outer ring (`r → r+6 → r` over 3s, opacity 0.25 → 0.05 → 0.25). Labels = mono 9px `rgba(255,255,255,0.6)` below each node, except `You` which gets a black 11px label inside the accent disc.
- **Selected-node card**: pinned above nav, `position: absolute, bottom: 110`, glassy `rgba(10,10,10,0.9)` + `backdrop-filter`, `1px accent40` border, `--shadow-card + --shadow-glow`. Avatar 40 + name + warm pill + role + 32px brutal `→` chrome to detail.
- `MobileNav active="graph"`.

### Interactions

- Tap a node → selected-node card updates.
- Tap selected-node card → detail screen (person / company / event).
- Tap filter chip → toggles entity type visibility.
- Tap top-right search → search screen.

### Token usage

`--accent`, `--info-blue`, `--info-violet`, `--second`, `--third`, `--text-40`, `wm-pulse-s` (you-ring), graph edge colors.

### vs v0.1.1 plan

Graph view is **post-v0.1.1** (it lives in the recall wedge). v2 is the visual target for whenever graph lands.

---

## 8. Person detail

**Source**: `lib-capture-variants.jsx ScreenPerson`

The canonical entity-detail scaffold instantiated for a person. Nav row → hero (72px round avatar + `◉ PERSON` + warm tag + Inter 800 24px name + role + tag pills) → CTAs (`Draft check-in →` primary + `edit` ghost) → stat trio (5 edges / 3 commits / 7d since) → `from your captures` excerpt card with quoted body + one accent emphasis + mono code keyword → `follow-ups` checkbox card with brutal-check + due meta + agent-drafted badge → `related` rows linking to other entity pages.

### Layout (mobile)

```
┌───────────────────────────────────────┐
│ [←]                       [graph] [⚙] │
│                                        │
│ [Sarah 72]  ◉ PERSON ◐WARM            │
│             Sarah Chen                 │
│             Rust Lead · Acme Corp      │
│                                        │
│ #engineering #rust ◐ follow-up #hot…   │
│                                        │
│ [ Draft check-in → ]      ⟦ edit ⟧    │
│                                        │
│        5         3          7d         │ ← stat trio serif italic 32px
│      edges    commits    since         │
│                                        │
│ ◆ FROM YOUR CAPTURES                   │
│ ┌────────────────────────────────────┐│
│ │ 14:32 · OCT 14 · DEVCONNECT  0:42 ││
│ │ "She's their rust lead. Talked    ││
│ │ edge-config + hot-reloading. I    ││
│ │ said I'd send her my edge-reload  ││
│ │ repo."                             ││
│ └────────────────────────────────────┘│
│                                        │
│ ◆ FOLLOW-UPS                           │
│ ┌── ☑ Send github.com/me/edge-reload ─┐│
│ │   due · tomorrow · drafted          ││
│ └────────────────────────────────────┘│
│                                        │
│ ◆ RELATED                              │
│ [M] Marcus Rivera   co-attended Dev… →│
│ [▢A] Acme Corp      works at          →│
│ [P] Priya Sharma    overlapping topic →│
│                                        │
│ [home] [chat] [⬆ MIC] [graph•] [acts] │
└───────────────────────────────────────┘
```

### Composition

- Nav row with back arrow and contextual chrome (`graph` + `settings/pin`).
- Hero: Avatar 72 + eyebrow row (`◉ PERSON` mono accent + warm `4×4` rounded badge) + Inter 800 24px name + mono role.
- Pill row (sans pills + one accent follow-up).
- Primary brutal `Draft check-in →` + ghost `edit`.
- Stat trio (smaller than home's: 32px serif italic).
- `From your captures` card: timestamp eyebrow + duration + quoted body with `<span color=accent>` emphasis and `<span mono accent>` keyword.
- `Follow-ups` card: 22px accent-filled `check` square + sans 13px label + mono 11px meta.
- `Related` rows: small avatar (round person / square company) + name + relation.
- `MobileNav active="graph"` (entity pages don't have their own slot).

### Interactions

- Tap related row → routes to that entity.
- Tap `Draft check-in →` → routes to Acts with new draft expanded for this person.
- Tap topbar `graph` → opens graph with this node selected.

### Token usage

`--accent` (avatar hash, italic-twist on hero), `--surface-1`, `--border-soft`, `--text-85` (quoted body).

### vs v0.1.1 plan

Person detail is **post-v0.1.1**. Builds on the entity-resolution work already in `packages/extractor` (`hybrid.ts`).

---

## 9. Company detail

**Source**: `lib-entities.jsx ScreenCompany`

Same scaffold as Person but with the **company hero tile** (64×64 rounded-square `border-radius 14`, big `Inter 900 28px` monogram, hard offset shadow, `--info-blue` color). Sub line shows industry/size/HQ (`infra · 240 staff · sf`). Quick-links row beneath hero (`↗ acme.com`, `↗ careers`, `↗ blog`). CTAs: `Find warm path →` primary + `draft intro` ghost. Stat trio: `3 you know / 7 commits / 5d last touch`.

Then sections: **people you know · N** (each row links to person detail, with a "warm" badge if you have a follow-up open), **from your captures · N** (ActivityRow-style ticker of mentions), **topics discussed** (EntityTag concept row), **open actions** (single accent card with send icon tile + label + chevron).

### Layout (mobile)

```
┌───────────────────────────────────────┐
│ [←]                       [graph] [📌]│
│                                        │
│ [▢A 64]   ▤ COMPANY                   │  ← blue square tile
│           Acme Corp                    │     (italic-serif "Corp")
│           infra · 240 staff · sf       │
│                                        │
│ ↗ acme.com  ↗ careers  ↗ blog          │
│                                        │
│ [ Find warm path → ]   ⟦ draft intro ⟧│
│                                        │
│        3         7          5d         │
│   you know   commits    last touch     │
│                                        │
│ ◆ PEOPLE YOU KNOW · 3                  │
│ [S] Sarah Chen WARM  Rust Lead · 7d → │
│ [T] Tomás López      Eng Manager     →│
│ [Y] Yuki Tanaka      PM (intros…)    →│
│                                        │
│ ◆ FROM YOUR CAPTURES · 4               │
│ ●sarah_chen  their rust lead… oct 14   │
│ ●marcus_riv  "acme's sqlite…"  oct 14  │
│ ●agent       inferred · notify oct 16  │
│                                        │
│ ◆ TOPICS DISCUSSED                     │
│ [◇edge config] [◇hot reloading]        │
│ [◇notify-rs] [◇sqlite WAL]             │
│                                        │
│ ◆ OPEN ACTIONS                         │
│ [▢send] Send edge-reload repo · Sarah →│
│         via you · drafted              │
│                                        │
│ [home] [chat] [⬆ MIC] [graph•] [acts] │
└───────────────────────────────────────┘
```

### Composition

- Hero tile: `64×64 rounded-14 --info-blue, Inter 900 28px black monogram, 3×3 hard shadow`.
- Quick-link pills: `bg surface-2, border border-mid, mono 11.5px, ↗ prefix`.
- Open-action card: tinted accent surface (`rgba(255,196,82,0.06) + border-acc40`), 32px square accent-tinted tile with send icon, sans 12.5px title, mono 10.5px meta, chevron.
- `MobileNav active="graph"`.

### Interactions

- Quick-link pill → external in-app browser.
- Person row → person detail.
- Topic chip → concept page (currently mapped to a search-by-topic in v2).
- Open-action card → Acts inbox.

### Token usage

`--info-blue` (hero, eyebrow), `--accent` (warm badge, open-action), `--text-55` (sub).

### vs v0.1.1 plan

Company detail is **new in v2**. Depends on the company entity being a resolvable type in the extractor (already true: see `packages/extractor/src/schema.ts`).

---

## 10. Event detail

**Source**: `lib-entities.jsx ScreenEvent`

Hero uses the **rotated diamond glyph** (64×64 SVG, 2.5px `--text-55` stroke, inner filled diamond `--text-40` at 0.5 opacity). Sub line: date · location · duration (`oct 14 · sf · 2 days`). Mono pills: `◷ 8 days ago` + `● live recap`. CTAs: `Generate recap →` primary + `check-ins` ghost. Stat trio: `4 people met / 12 commits / 7 topics`.

Sections: **people you met · N** (avatar + role/event + timestamp `14:32 day 1`), **topics raised** (EntityTag concept row), **timeline** (mono-ticker: `09:00 d1 opening keynote sat in row 4 with priya` etc.), **acts from this event · N** (mini-cards with kind glyph + name · why + brutal `send →`).

### Layout (mobile)

```
┌───────────────────────────────────────┐
│ [←]                              [⚙]  │
│                                        │
│ ╱╲              ◆ EVENT                │
│╱  ╲             DevConnect '26         │
│╲  ╱             oct 14 · sf · 2 days   │
│ ╲╱  ← diamond                          │
│                                        │
│ ⟦◷ 8 DAYS AGO⟧ ⟦● LIVE RECAP⟧         │
│                                        │
│ [ Generate recap → ]    ⟦ check-ins ⟧ │
│                                        │
│       4          12          7         │
│   people met   commits    topics       │
│                                        │
│ ◆ PEOPLE YOU MET · 4                   │
│ [S] Sarah Chen      Acme · Rust  14:32d1
│ [M] Marcus Rivera   Dataweave    15:10d1
│ [P] Priya Sharma    NeuralPath   16:45d1
│ [A] Alex Novak      Stripe       11:08d2
│                                        │
│ ◆ TOPICS RAISED                        │
│ [◇edge config] [◇hot reloading]…       │
│                                        │
│ ◆ TIMELINE                             │
│ 09:00 d1  opening keynote  sat in row…│
│ 14:32 d1  → sarah_chen     rust lead… │
│ 15:10 d1  → marcus_rivera  cto…       │
│ 16:45 d1  → priya_sharma   voice ML…  │
│ 11:08 d2  → alex_novak     webhook…   │
│                                        │
│ ◆ ACTS FROM THIS EVENT · 3             │
│ [▢S] ↗CHECK-IN  Sarah · send edge…  send →
│ [▢M] ⇌INTRO     Marcus → Priya       send →
│ [▢P] ◷REMIND    Priya · diarization  send →
│                                        │
│ [home] [chat] [⬆ MIC] [graph•] [acts] │
└───────────────────────────────────────┘
```

### Composition

- Hero diamond: SVG polygon outline + inner filled polygon.
- Eyebrow `◆ EVENT` + Inter 800 24px title (italic-serif on `'26`).
- Stat trio variant: 32px serif italic, colors `accent / second / violet`.
- Timeline: mono-only row, no avatars; time `--text-40 minw 60`, who `--accent minw 100`, body `--text-70 ellipsis`.
- Acts-from-event: mini Acts cards (smaller than the Home variant; 30px square tile, 10px kind pill, brutal `send →`).

### Interactions

- Person row → person detail (with breadcrumb back to event).
- Topic chip → concept page.
- Generate recap → opens a sheet (modal on desktop) with the agent's draft event summary.
- `send →` on an act → fires the action.

### Token usage

`--text-55` (event color), `--accent / --second / --violet` per stat, `--shadow-button` on send.

### vs v0.1.1 plan

Event detail is **new in v2**. Depends on event entity being a first-class type — currently the extractor surfaces events as edges; v2 design needs an event resolver before this lands.

---

## 11. Acts inbox

**Source**: `lib-capture-variants.jsx ScreenActs`

The agent's queue of drafts awaiting human approval. Header: eyebrow `◆ ACTS` + Inter 800 28px `drafts awaiting you` (italic on `awaiting you`) + mono sub `agent_drafts // 5 pending · 12 sent`. Agent stripe again ("wingmic read your graph at 06:12 · drafted 5 actions"). Filter chips: `Pending · 5` (selected white-fill) | `Sent · 12` | `All`.

**First card expanded** with full draft body, sources, and primary `Send now →` / ghost `skip`. Subsequent cards collapsed (kind pill + confidence% + name + one-line why + `+` expand).

### Layout (mobile)

```
┌───────────────────────────────────────┐
│ ◆ ACTS                                 │
│ drafts awaiting you.                   │
│ agent_drafts // 5 pending · 12 sent    │
│                                        │
│ ● wingmic read your graph at 06:12     │
│   · drafted 5 actions                  │
│                                        │
│ [Pending · 5] ⟦Sent · 12⟧ ⟦All⟧        │ ← filter chips
│                                        │
│ ┌─ EXPANDED ───────────── accent border │
│ │ [▢S] ↗CHECK-IN  ●NOW             −  │
│ │      Sarah Chen                     │
│ │      7d since DevConnect — you      │
│ │      promised her the repo.         │
│ ├─────────────────────────────────────│
│ │ ✉ EMAIL  CONF ▆▆▆▆▆ 92%             │
│ │ Subject: The edge-config repo I…   │
│ │ DRAFT · EMAIL              ✎ edit  │
│ │ ┌─────────────────────────────────┐│
│ │ │Hey Sarah — Great meeting you at││ ← draft body
│ │ │DevConnect last week. As promised│   inset bg
│ │ │…                                ││
│ │ └─────────────────────────────────┘│
│ │ sourced from: voice note 14:32 ·…  │
│ │ [ Send now → ]              ⟦skip⟧│
│ └─────────────────────────────────────┘
│                                        │
│ [▢M] ◷REMINDER · 88%  Marcus Rivera  +│ ← collapsed
│      Coffee Mon · no invite sent.     │
│                                        │
│ [▢P] ⇌INTRO · 74%  Priya → Deepak    +│
│      Both work on voice + MCP.        │
│                                        │
│ [▢J] ↗CHECK-IN · 95%  Jordan Kim     +│
│      You said you'd send self-host…   │
│                                        │
│ [home] [chat] [⬆ MIC] [graph] [acts•] │
└───────────────────────────────────────┘
```

### Composition

- Header + agent stripe + filter chips (`#fff` selected on `#000`).
- **Expanded card**: outer `1px accent` border, inner sections separated by `1px dashed rgba(255,255,255,0.06)`. Kind+overdue pills (`accent18/30` and `alarm18/30`). Channel + confidence inline. Inset draft body (`bg rgba(0,0,0,0.3)`, `1px rgba(255,255,255,0.05)`, mono 11px/1.55 `--text-85` pre-wrap). Action row.
- **Collapsed cards**: default surface, kind pill + percentage + name + 1-line why, `+` expand glyph.
- `MobileNav active="acts"`.

### Interactions

- `+` → expands inline.
- `Send now →` → fires (mailto/calendar/slack per channel), moves card to Sent filter.
- `skip` → archives.
- `✎ edit` → opens text editor inline.

### Token usage

`--accent` (border, kind, brutal CTA), `--alarm` (overdue), `--info-blue / violet / second` per kind.

### vs v0.1.1 plan

Acts is the v0.3 wedge (per CLAUDE.md). v2 design defines the visual target — implementation deferred.

---

## 12. Search results

**Source**: `lib-capture-variants.jsx ScreenSearch`

Triggered from the search chrome button (home topbar, graph topbar, or `⌘ K` on desktop). Header: back chevron + focused search field (`accent50` border, search icon accent, mono caret blinking, `×` clear). Result-type filter chips: `all · N | people · N | commits · N | orgs · N`. Then **top match** (highlighted person card with `<mark>`-highlighted matches against accent40 background) and **from your captures · N** (ActivityRow-like commit cards with mark-highlighted body text).

### Layout (mobile)

```
┌───────────────────────────────────────┐
│ [←]  ┌─ 🔍 rust at acme ▌    × ─┐    │
│      └───────────────────────────┘    │
│                                        │
│ [all · 8] ⟦people · 3⟧ ⟦commits · 4⟧ │
│ ⟦orgs · 1⟧                              │
│                                        │
│ ◆ TOP MATCH                            │
│ ┌── glow card ─────────────────────┐  │
│ │ [Sarah] ⟨Rust⟩ Lead at ⟨Acme⟩ →│  │ ← mark hl on Rust + Acme
│ │         Sarah Chen · 5 edges     │  │
│ └──────────────────────────────────┘  │
│                                        │
│ ◆ FROM YOUR CAPTURES · 4               │
│ sarah_chen          14:32 · oct 14     │
│ discussed edge-config for hot reloading│
│ in ⟨Rust⟩                              │
│                                        │
│ marcus_rivera       15:10 · oct 14     │
│ curious about ⟨Rust⟩ vs SQLite at      │
│ ⟨Acme⟩ — coffee Monday                 │
│                                        │
│ jordan_kim          09:14 · oct 18     │
│ wants self-host eval, knows their      │
│ ⟨Rust⟩ eng team                        │
│                                        │
│ [home•] [chat] [⬆ MIC] [graph] [acts] │
└───────────────────────────────────────┘
```

### Composition

- Search field: same as `lib-atoms.jsx FieldFrame` focused variant but with `border-radius 12` (not 10), `accent50` border, accent search icon.
- Filter chips: white-fill selected, `surface-2 + border-soft` unselected.
- **Top match card**: `glow` tone (`rgba(255,196,82,0.06) + accent40 border + 0 0 40px accent08 shadow`). `<mark>` styled `bg accent40, color ink, padding 0 3px, border-radius 3`.
- **Capture matches**: default cards, mono 10.5px accent who, mono 9.5px `--text-30` time, sans 13px/1.5 `--text-85` body with `<mark>` highlights.
- `MobileNav active="home"` (search inherits home's tab).

### Interactions

- Tap top match → person detail.
- Tap any capture row → opens that capture in context (chat thread scrolled to that time).
- Tap `×` → clears, returns to chat.

### Token usage

`--accent`, `--border-acc`, `wm-blink` (caret), `<mark>` accent40.

### vs v0.1.1 plan

Search is part of the recall wedge — touched by v0.1.1 but the **filter-chip result categorisation** is a v2 visual upgrade.

---

## 13. Settings

**Source**: `lib-capture-variants.jsx ScreenSettings`

Profile card on top (`Morgan Lee` + email + plan + edit), then **four sections** of rows grouped in default surface cards: `◆ CAPTURE` (mic access toggle, hands-free shortcut, lock after, on-device transcribe toggle), `◆ AGENT` (morning sweep, push notifications, confidence threshold), `◆ INTEGRATIONS` (Gmail connected, Google Calendar connected, Slack connect →), `data` (export graph JSON, erase all data destructive).

Each row: 32×32 tile (accent-tinted or alarm-tinted for danger) + sans 14.5px label + value mono 12px on right OR a toggle (38×22 pill, amber when on with black puck, grey when off with white puck). Footer line: `wingmic v0.1 · the social RAM you carry`, italic mono.

### Layout (mobile)

```
┌───────────────────────────────────────┐
│ ◆ SETTINGS                             │
│ your setup.                            │
│                                        │
│ ┌─ [Morgan 48] Morgan Lee     [edit] ─┐
│ │  morgan@wingmic.xyz · plan · pro    │
│ └─────────────────────────────────────┘
│                                        │
│ ◆ CAPTURE                              │
│ ┌─────────────────────────────────────┐
│ │ [🎤] Microphone access         [●__]│ ← toggle on
│ │ [🎧] Hands-free shortcut    Hold ⌘ │
│ │ [🔒] Lock after              3 sec  │
│ │ [⚡] On-device transcribe      [●__]│
│ └─────────────────────────────────────┘
│                                        │
│ ◆ AGENT                                │
│ ┌─────────────────────────────────────┐
│ │ [✦] Morning sweep            06:12  │
│ │ [🔔] Push when draft ready    [●__] │
│ │ [▾] Confidence threshold       70%  │
│ └─────────────────────────────────────┘
│                                        │
│ ◆ INTEGRATIONS                         │
│ ┌─────────────────────────────────────┐
│ │ [✉] Gmail               connected   │
│ │ [⚙] Google Calendar     connected   │
│ │ [💬] Slack              connect →   │
│ └─────────────────────────────────────┘
│                                        │
│ DATA                                   │
│ ┌─────────────────────────────────────┐
│ │ [▦] Export graph (JSON)         →   │
│ │ [🗑] Erase all data            →   │ ← danger alarm color
│ └─────────────────────────────────────┘
│                                        │
│   wingmic v0.1 · the social RAM…       │
│                                        │
│ [home•] [chat] [⬆ MIC] [graph] [acts] │
└───────────────────────────────────────┘
```

### Composition

- `SettingsRow` component: tile + label + value/toggle. Toggle: 38×22 pill, accent bg when on with black puck, grey bg when off with white puck, `transition all 0.2s ease-out`.
- Section eyebrow: mono 10.5px accent 2px-tracked (the danger section uses mono `--text-40` instead, lowercase "data").
- Footer caption: mono 11px `--text-30` italic, centered.

### Interactions

- Toggles → fire immediately; no save button.
- Value rows → navigate to a detail pane (e.g., shortcut chooser, confidence slider).
- Erase data → destructive confirm modal (see `lib-states.jsx StatesModal`).

### Token usage

`--accent` (eyebrows, tiles), `--alarm` (danger row, danger tile), `--surface-1`, `--border-soft`.

### vs v0.1.1 plan

Settings is a post-v0.1.1 addition. Microphone access + on-device transcribe rows align with the iOS Safari SpeechRecognition work (`#4` in CLAUDE.md current blockers).

---

# Capture variants

> The bundle's brief asked for "1 main + alternates only for the audio capture (the centerpiece)" (chat2 questions_v2). All three live in the library; variant A is canonical.

## V-A. Capture · chat-anchored (canonical, default)

**Source**: `lib-capture-variants.jsx CaptureVariantA`

The capture flow that lives inside the chat surface — same as `chat-recording` above, with a `variant A · default` sticker pinned top-right. The recording mic and slide-up-lock affordance sit inline with the composer (not as a floating bottom-right orb). This is the default.

### Layout (mobile · brief)

Same as `chat-recording` but:
- Bottom composer pill is `bg rgba(255,196,82,0.08)` + `1.5px accent`, with alarm dot + duration + center-aligned `← slide to cancel` italic + brutal 46px mic scaled `1.05` with `0 0 30px accent60` glow.
- Slide-up-lock floats above-right at `bottom: 110%, right: 14`.

### Token usage

Identical to `chat-recording` — this is the canonical screen, just labelled as variant A.

### vs v0.1.1 plan

This **is** the v0.1.1 push-to-talk vision. The visual detailing (alarm dot color, scale 1.05, glow halo, slide-up-lock affordance) extends what's already planned.

---

## V-B. Capture · centered orb (alternate)

**Source**: `lib-capture-variants.jsx CaptureVariantB`

Full-screen takeover. A centered 180px MicOrb in `recording` state with the editorial twist: above the orb sits the top status row (`× close | ● RECORDING duration`), below the orb sits an Instrument Serif italic 22px accent caption (`say what's worth keeping.`) + mono `↪ transcribing locally · on-device`. A floating transcript card sits above the bottom controls (discard | hold caption | send). The transcript reads live as you talk.

### Layout (mobile)

```
┌───────────────────────────────────────┐
│ [variant B · orb sticker, +3°, TR]    │
│ [×]            ● RECORDING       0:12 │
│                                        │
│                                        │
│            ╱─────╲                     │
│           ╱       ╲                    │
│          │  ┌───┐  │                   │ ← MicOrb 180 recording
│          │  │🎤 │  │                   │   with rings + halo
│          │  └───┘  │                   │
│           ╲       ╱                    │
│            ╲─────╱                     │
│                                        │
│       say what's worth keeping.        │ ← italic serif accent
│       ↪ TRANSCRIBING LOCALLY           │
│                                        │
│  ┌────────────────────────────────┐   │
│  │ met sarah from acme, rust lead. │   │ ← floating transcript
│  │ discussed edge-config for hot   │   │
│  │ reloading ▌                     │   │
│  └────────────────────────────────┘   │
│                                        │
│  [🗑 56]      HOLD ORB · OR USE   [↑56]│ ← discard | hint | send
│              BUTTONS                   │
└───────────────────────────────────────┘
```

### Composition

- `MicOrb size=180 state="recording"` centered.
- Centered italic-serif accent caption + mono uppercase sub.
- Floating transcript card: `surface-2 + border-soft + backdrop-filter: blur(20px)`.
- Bottom controls: large 56px circular destructive (alarm-tinted) + 56px primary brutal.
- No bottom nav — capture is full-screen.

### Interactions

- Hold orb anywhere → record.
- Discard / send → exit back to previous screen (chat).
- `×` top-left → cancel.

### Token usage

`--accent`, `--alarm`, `--font-serif` italic (caption), `wm-pulse-s` (rings).

### vs v0.1.1 plan

Alternate path — present in v2 as an exploration. Not in scope for v0.1.1.

---

## V-C. Capture · slide-up sheet (alternate)

**Source**: `lib-capture-variants.jsx CaptureVariantC`

The home screen stays partially visible behind a dim scrim (`rgba(0,0,0,0.55) + backdrop-filter: blur(6px)`). A bottom sheet rises (`64% of viewport height`, `border-top-radius 28`, `--bg-raised`) with the eyebrow `◆ QUICK CAPTURE` + Inter 800 22px `who you just met` (italic on `just met`) + duration in top-right. Below: live transcript card (accent-bordered) with VoiceBars. Then `↪ LIVE ENTITIES` row of EntityTag chips populating in real-time. Bottom row: 50×50 destructive square + flex-fill primary brutal `Save commit →`. Caption: `swipe down to dismiss`.

### Layout (mobile)

```
┌───────────────────────────────────────┐
│ today (dimmed)                         │
│ MON · OCT 21                           │
│ 12  3                                  │ ← faint, opacity 0.35
│ ppl acts                               │
│                                        │
│ ═════════ scrim ═══════════════════   │
│ [variant C · sheet sticker, -3°, TL]   │
│                                        │
│        ── drag handle ──               │
│ ◆ QUICK CAPTURE              0:12      │
│ who you just met.                      │
│                                        │
│ ┌── accent border ──────────────────┐ │
│ │ met sarah from acme, rust lead.   │ │
│ │ discussed edge-config for hot     │ │
│ │ reloading ▌                       │ │
│ │ ▎▌▊▍▌▎▍▌▎▍▌▎▍▌                   │ │
│ └────────────────────────────────────┘│
│                                        │
│ ↪ LIVE ENTITIES                        │
│ [◉sarah chen] [▤acme] [◇edge-config]   │
│                                        │
│ [🗑 50] [    Save commit →            ]│ ← square discard + flex CTA
│         swipe down to dismiss          │
└───────────────────────────────────────┘
```

### Composition

- Dim background = the home screen at `opacity 0.35` + scrim.
- Sheet container: `bg --bg-raised, 1px rgba(255,255,255,0.1), border-top-radius 28, padding 20 22 30, shadow 0 -10px 30px rgba(0,0,0,0.6)`.
- Drag handle: `44×4 rgba(255,255,255,0.2)` centered.
- Header: eyebrow + Inter 800 22px italic-twist title.
- Transcript card: `surface-2 + 1px accent40`.
- Entity chips: EntityTag row.
- Action row: square 50×50 destructive (alarm-tinted with trash icon) + flex-1 primary brutal `Save commit →` with arrow.

### Interactions

- Drag handle down → dismiss, return to home.
- Save → commits, dismisses, toast slides up.

### Token usage

`--bg-raised`, `--accent`, `--alarm`, `--shadow-button`.

### vs v0.1.1 plan

Alternate path. Not currently planned.

---

# Desktop screens

> Desktop is mobile's atoms in a wider layout. The persistent left rail (`Sidebar`, 248px) replaces bottom nav.

## D-1. Desktop · home

**Source**: `lib-desktop.jsx ScreenDesktopHome`

DesktopFrame (macOS-window chrome: traffic lights left, centered URL pill `wingmic.xyz/app` with green status dot, padding). Sidebar (left rail) + main content area with `28px 36px` padding.

Main: eyebrow `◆ TODAY · MON · OCT 21` + Inter 900 44px `morning, morgan.` (italic on `morgan`) + lead Inter 15 + a `graph synced` status chip top-right. Then **stat quartet** (4 serif italic 84px stats, each rotated, with sub captions). Then **2-column body**: left = Acts queue (full-size cards, 44px square avatar tile, kind+channel+conf, name Inter 700 15px, why Inter 12.5px, Send + edit buttons stacked right), right = Graph preview card (200px-height SVG) + Recent commits ActivityRow card.

### Layout (desktop, schematic)

```
┌────── DesktopFrame ───────────────────────────────────────────┐
│ ● ● ●   wingmic.xyz/app                                        │
├──────┬─────────────────────────────────────────────────────────┤
│      │ ◆ TODAY · MON · OCT 21          [● graph synced]        │
│ Side │ morning, morgan.                                         │
│ bar  │ The agent did its sweep at 06:12. Five drafts waiting.   │
│ 248  │                                                          │
│      │  12       3      4      92%                              │
│ [Mic]│  people   acts   today  recall                           │
│      │                                                          │
│ home │ ┌── ACTS · PENDING · 1.4fr ──┐  ┌── GRAPH PREVIEW ──┐   │
│ chat │ │ [▢S] ↗CHECK-IN  92%        │  │   [SVG graph 200] │   │
│ grph │ │      Sarah Chen   [send→]  │  │                   │   │
│ acts5│ │      Acme · Rust  [edit]   │  └───────────────────┘   │
│ srch │ │      why…                  │  ┌── RECENT COMMITS ─┐   │
│      │ │                            │  │ ●sarah_chen … 14:32│   │
│ ◆PIN │ │ [▢M] reminder ...          │  │ ●marcus_riv … 15:10│   │
│ Sarah│ │ [▢P] intro …               │  │ ●priya_sharma 16:45│   │
│ …    │ └────────────────────────────┘  │ ●agent … 06:12     │   │
│      │                                  └───────────────────┘   │
│ [Mor]│                                                          │
└──────┴─────────────────────────────────────────────────────────┘
```

### Composition

- `DesktopFrame` (window chrome) + `Sidebar active="home"`.
- 4-stat row (4th stat `92% recall` is desktop-only).
- 2-column grid `1.4fr 1fr` (matches §14 — never 3-col).
- Acts cards are the **larger desktop variant** (44px avatar, channel chip inline, stacked button group).
- Graph preview is a static SVG snapshot of `GraphCanvas` at 360×200.

### Token usage

Same atoms; layout is the only new thing.

### vs v0.1.1 plan

Desktop layouts are post-v0.1.1.

---

## D-2. Desktop · chat (+ entity rail)

**Source**: `lib-desktop.jsx ScreenDesktopChat`

Three columns inside DesktopFrame: `Sidebar 248 | thread flex | entity rail 320`. Thread is the same chat-response surface but wider (`max-width 460–520` per bubble). The composer pill stretches across the thread column (positioned absolute against sidebar/rail), with the placeholder `ask wingmic, or hold the mic to capture a new contact…` + trailing `⌘ K` chip + brutal mic.

Right rail surfaces:
- `◆ IN THIS THREAD` eyebrow,
- **Active person card** (accent-tinted, avatar 42 + name + role + tag pills),
- `EXTRACTED` list of EntityTag chips (one per line — vertical layout, easier to scan),
- `SOURCES` list of source cards (`↪ voice note · 14:32`, `commit · oct 14`, `follow-up · open`).

### Token usage

Adds `border-left/right: 1px var(--border-soft)` to mark the rails.

### vs v0.1.1 plan

Post-v0.1.1.

---

## D-3. Desktop · graph (+ detail pane)

**Source**: `lib-desktop.jsx ScreenDesktopGraph`

DesktopFrame + Sidebar + 2-pane: `canvas flex | detail 340`. Canvas is full-bleed force graph SVG (800×540 viewport) with overlay toolbar (filter chips top-left, `⌘ F` search top-right, zoom controls bottom-right). Detail pane: `◉ SELECTED` eyebrow + 64px avatar + name (Inter 800 22) + warm badge + role + pill row + **CTA row** (`Draft check-in →` primary + `open` ghost) + `◆ EDGES · N` list with relation pills (`works_at`, `met_at`, `knows`, `discussed`, `owes`) + `◆ LAST SEEN` card.

### Token usage

Edge pills use `--accent` tinted background (`accent15`), `mono 9.5px 700` text.

### vs v0.1.1 plan

Post-v0.1.1.

---

## D-4. Desktop · person (two-pane)

**Source**: `lib-desktop.jsx ScreenDesktopPerson`

DesktopFrame + Sidebar + 2-pane: `list 280 | detail flex`. List is the directory of people (filter at top + scrollable rows with avatar + name + sub, active row highlighted with `accent08 bg + accent40 border`). Detail uses the same §13 scaffold as mobile person, but wider and with 2-column body inside (`1.5fr 1fr`): left = captures + follow-ups, right = stat trio + related.

### Token usage

Active list-row treatment matches Sidebar nav active state.

### vs v0.1.1 plan

Post-v0.1.1.

---

# System-logic surfaces (canvas, not screens)

> Live in `Wingmic Component Library.html §00`. They explain the contract, not the UI per se. Included here because the team will reference them.

## L-1. Logic · one mic, one surface

**Source**: `lib-logic.jsx LogicMicSurface`

Decision callout (accent-tinted, `1px accent40 border`, `accent` corner tag `answers: Ayaan`). Body: "The chat page *is* the capture page." Diagram shows three mic sources (nav · composer · OS) → arrows → single accent funnel `chat · recording` → italic-serif `then` → two branches (`→ commit` green and `↪ answer` blue). Example phrases below in two boxes.

## L-2. Logic · navigation map

**Source**: `lib-logic.jsx LogicNavMap`

5-tile grid (`home / chat / capture / graph / acts`). The `capture` tile is highlighted (`bg accent10 + 1.5px accent border + glow 40px accent20`) with a `50%`-radius accent disc instead of the rounded square the others have. Below: 4 numbered rules with serif italic 28px numerals.

## L-3. Logic · flow storyboard

**Source**: `lib-logic.jsx LogicFlowStoryboard`

4-step horizontal storyboard: `01 invitation (idle MicOrb)` → `02 recording (recording MicOrb + 0:12 live)` → `03 thinking (thinking MicOrb)` → `04 branches (done MicOrb + commit/answer chips)`. Each step is a default card with serif italic step numeral + mono label. Closes with a coral-pink (`--third`) tinted "simplification" callout explaining the old capture screen has been collapsed.

---

# Source-file map (quick reference)

| Screen / surface | File | Function |
|---|---|---|
| Onboarding | `lib-screens.jsx` | `ScreenOnboarding` |
| Home | `lib-screens.jsx` | `ScreenHome` |
| Chat resting | `lib-screens.jsx` | `ScreenChatResting` |
| Chat recording | `lib-screens.jsx` | `ScreenChatRecording` |
| Chat locked | `lib-screens.jsx` | `ScreenChatLocked` |
| Chat response | `lib-screens.jsx` | `ScreenChatResponse` |
| Graph | `lib-capture-variants.jsx` | `ScreenGraph` + `GraphCanvas` |
| Person detail | `lib-capture-variants.jsx` | `ScreenPerson` |
| Company detail | `lib-entities.jsx` | `ScreenCompany` |
| Event detail | `lib-entities.jsx` | `ScreenEvent` |
| Acts inbox | `lib-capture-variants.jsx` | `ScreenActs` |
| Search | `lib-capture-variants.jsx` | `ScreenSearch` |
| Settings | `lib-capture-variants.jsx` | `ScreenSettings` |
| Capture A · chat-anchored | `lib-capture-variants.jsx` | `CaptureVariantA` |
| Capture B · orb | `lib-capture-variants.jsx` | `CaptureVariantB` |
| Capture C · sheet | `lib-capture-variants.jsx` | `CaptureVariantC` |
| Desktop home | `lib-desktop.jsx` | `ScreenDesktopHome` |
| Desktop chat | `lib-desktop.jsx` | `ScreenDesktopChat` |
| Desktop graph | `lib-desktop.jsx` | `ScreenDesktopGraph` |
| Desktop person | `lib-desktop.jsx` | `ScreenDesktopPerson` |
| Logic · mic surface | `lib-logic.jsx` | `LogicMicSurface` |
| Logic · nav map | `lib-logic.jsx` | `LogicNavMap` |
| Logic · flow storyboard | `lib-logic.jsx` | `LogicFlowStoryboard` |
