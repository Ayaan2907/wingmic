# Component Library Prototype

_Started 2026-05-25 07:29 UTC_

---

## User

build a prototype app showing all screens using the component lirbary

## Assistant

## Assistant

## Assistant

_[tool: local_ls]_

_[tool: list_files]_

_[tool: local_read]_

_[tool: local_read]_

_[tool: local_read]_

_[tool: local_read]_

_[tool: local_read]_

_[tool: local_read]_

_[tool: local_read]_

_[tool: local_read]_

_[tool: local_read]_

_[tool: update_todos]_

_[tool: local_copy_to_project]_

_[tool: write_file]_

_[tool: write_file]_

_[tool: write_file]_

Now building all the files in parallel:

_[tool: write_file]_

_[tool: write_file]_

_[tool: write_file]_

_[tool: write_file]_

_[tool: write_file]_

Now the main HTML entry point:

_[tool: done]_

_[tool: fork_verifier_agent]_

_[tool: update_todos]_

The prototype is live — **17 screens** across mobile and desktop, all navigable from a single file.

**What's inside:**

| # | Screen | Key interactions |
|---|--------|-----------------|
| 01 | Onboarding | Tap Next → Home |
| 02 | Home | Agent stripe, 3 acts, commit feed |
| 03 | Chat · Resting | Tap chip → response; tap mic → recording |
| 04 | Chat · Recording | Live transcript, slide-up-to-lock, release → response |
| 05 | Chat · Locked | Hands-free bar, voice bars, animated entities extracting |
| 06 | Chat · Response | Embedded person card, draft action |
| 07 | Graph | Interactive SVG nodes, filter chips, selected-node card |
| 08–10 | Person / Company / Event | Full detail scaffolds with stats, captures, related |
| 11 | Acts Inbox | Expandable draft cards with inline body + send |
| 12 | Search | Live highlight marks, filter chips |
| 13 | Settings | Working toggles for mic, transcribe, push |
| D1–D4 | Desktop | Home, Chat+rail, Graph+detail, Person two-pane |

**Navigation:** use the **← → arrows in the top bar**, the **screen picker dropdown**, or **keyboard arrow keys**. Bottom nav and tappable cards route between screens.

