# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js 15 App Router, Bun 1.3, Turborepo monorepo. Styling via Tailwind 3 + `@wingmic/design-tokens`. DB: Drizzle + libSQL/Turso. Auth: BetterAuth magic link. Hosting: Railway (apps/app).

## Users

Developers, founders, and conference-goers who lose connections after meeting many people in a short span. They attend hackathons, conferences, dinners, meetups; they want to capture context without typing — speak 10–30s after a conversation, then later ask "who was the rust person at acme?" and get matches in <500ms.

Primary usage scene: post-meeting capture on mobile, NL recall on desktop or mobile, entity detail browsing.

## Product Purpose

Voice-first networking memory app. User speaks after meeting someone; LLM extracts persons, companies, events, topics, follow-up actions into a graph. NL recall returns matches in <500ms. Success = reliable capture, fast recall, trustworthy entity graph.

## Positioning

"Your social RAM, on disk" — persistent storage for conversational memory with graph-native recall, not a generic CRM or note app.

## Operating Context

- Post-conversation capture via mic in /chat (one mic, one surface)
- NL recall search at /recall
- Entity detail pages for person, company, event, topic
- Graph visualization at /graph
- Acts agent for follow-ups at /acts
- Contact imports at /imports
- Settings and onboarding flows

## Capabilities and Constraints

- Voice capture commits to chat thread
- Magic-link auth (Resend or console fallback in dev)
- Optional AssemblyAI transcription, OpenRouter for extraction/embeddings
- MIT open source; no secrets in repo
- 44px minimum touch targets for nav chrome

## Brand Commitments

- Editorial brutalist + terminal aesthetic
- Warm dark `#0a0a0a` canvas, amber `#FFC452` accent
- Inter sans, JetBrains Mono chrome, Instrument Serif italic (one word per heading)
- Lowercase confident voice; no AI vocabulary ("delve", "robust", "seamless", "powerful", "cutting-edge")
- Hard offset shadows on buttons; soft drops on cards
- Source of truth: `design/design-system.md`, `design/v2/screens.md`

## Evidence on Hand

- Design system at `design/design-system.md` (v2, 2026-05-24)
- Component library reference at `design/v2/screens.md`
- No fabricated testimonials or metrics

## Product Principles

1. One mic, one surface — capture always lands in chat
2. Sources cited; trust through transparency
3. Scanability over decoration in app UI (Operate mode)
4. Primitives over wrapper components
5. Fast recall (<500ms target) beats feature breadth

## Accessibility & Inclusion

- 44px minimum hit targets for nav chrome and icon buttons
- Voice as primary input minimizes typing
- Push-to-talk with slide-to-cancel and slide-up-to-lock
- Reduced-motion specifics not yet fully specified in design system
