# wingmic — launch ad · 30s

A 30-second vertical (1080 × 1920) launch ad. Built as an animated HTML page that you can drop into Canva two ways:

## option 1 — image sequence (simplest)

Drop the 30 PNGs in `frames/` straight onto your Canva timeline.

- Each frame is `1080 × 1920` (9:16 — IG Reels / TikTok / YouTube Shorts).
- Set each frame's display duration to **1 second** → you get exactly 30s of video.
- Order is `01-frame.png … 30-frame.png` (sequential).
- Add audio in Canva — see the soundtrack notes below.

For a smoother result, you can render finer frames (every 0.5s or 0.25s) on request — ask and I'll regenerate.

## option 2 — screen-record the HTML

This captures the actual real-time motion (typing animation, voice bars, ring pulses) — feels more alive than the slideshow.

1. Open `Wingmic Launch Ad.html` in Chrome.
2. Press **`Home`** (or the `↺` button) to reset playhead to 0.
3. Press **space** to pause, **space again** to start.
4. Resize the window to a tall portrait, e.g. ~540 × 960 (it scales to fit).
5. Screen-record the page area only (QuickTime → File → New Screen Recording → drag-select the canvas; or use Loom/CleanShot).
6. The clip auto-loops at 30s — stop recording at the loop.
7. Import the MP4 into Canva.

To hide the playback bar before recording, open DevTools console and run:
```js
document.body.classList.add('clean');
```

## scene timeline

| t (s)   | scene       | beat |
|---------|-------------|------|
| 0.0 – 3.5  | **title**    | wordmark + tagline "your social RAM, on disk." |
| 3.5 – 8.0  | **human**    | founder photo + DevConnect '26 sticker + "you meet 12 people in one night" |
| 8.0 – 14.5 | **capture**  | phone mockup · hold mic · live transcript types out |
| 14.5 – 20.0| **graph**    | nodes wire up · entity chips fly in |
| 20.0 – 25.0| **act**      | next-morning agent draft · 92% confidence · Send tapped · commit toast |
| 25.0 – 30.0| **close**    | wordmark · "Stop forgetting. Start *building.*" · CTA |

## soundtrack notes (add in Canva)

The ad is silent — designed to read on its own + with audio. Suggested sound design:

- **0 – 3.5s** — soft synth pad swell, single warm chime when wordmark lands
- **3.5 – 8.0s** — distant crowd / conversation ambience (a "party" mood) under the photo; gentle filter sweep into the next scene
- **8.0 – 14.5s** — phone interface click + low subtle "thinking" hum; faint typing/keyboard ticks synchronized with the transcript
- **14.5 – 20.0s** — short tonal "ping" each time a graph node connects (one per node)
- **20.0 – 25.0s** — soft notification chime when draft appears; one decisive tap sound when Send is pressed; quick affirmative chime + UI toast slide
- **25.0 – 30.0s** — synth pad resolves; final warm chime on logo lockup

Royalty-free libraries that fit the aesthetic: Epidemic Sound's "minimal tech" and "underscore" categories; Artlist's "electronic / ambient" → "warm pulse" — anything tempo-free, low-BPM, no vocal drop. Avoid generic "tech corporate" — too sterile for the brand.

## what to label the export in Canva

- **Aspect**: 9:16 vertical (1080 × 1920)
- **Suggested filename**: `wingmic-launch-ad-30s-v1.mp4`
- **Captions**: bake in mono subtitles for the agent-draft scene if posting to mute-default platforms (Reels, TikTok)

## the file paths, for reference

```
ad/
├── README.md                  ← this file
├── Wingmic Launch Ad.html     ← (in project root) the playable animation
├── animations.jsx             ← starter engine
├── assets/
│   ├── founder.jpg            ← your photo
│   └── mark.svg               ← wingmic mark
└── frames/                    ← 30 × 1080×1920 PNG frames for slideshow
    ├── 01-frame.png
    ├── …
    └── 30-frame.png
```
