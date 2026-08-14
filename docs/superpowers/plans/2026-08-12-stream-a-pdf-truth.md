# Stream A — PDF truth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make chat/home/desktop match the PDF feel: two-sided history after refresh, live rails, soft empty, discoverable imports, no topic 404 / dead chat tab.

**Architecture:** Prefetch joins interactions → entities/facts/acts by `sourceInteractionId` into a `GraphResult`-shaped payload for `seedMessages`. Rails read the live thread / entity list. Soft empty from #88 lands first.

**Tech Stack:** Next.js App Router, Drizzle/libSQL, tRPC, existing `ChatThread` / `AgentReply` primitives.

## Global Constraints

- Conventional Commits; no AI co-author trailer; brand voice lowercase.
- One PR for Stream A (focused); Streams B–G separate PRs.
- No `design/**` edits; no eval fixture edits; append-only migrations only.
- Tests for new code paths; gate `bun run typecheck && bun run lint && bun run test`.

---

## File map

| File | Role |
|---|---|
| `apps/app/app/chat/page.tsx` | Prefetch extraction payload with transcripts |
| `apps/app/app/chat/_components/types.ts` | Extend `ChatInitialItem` with optional `graphResult` |
| `apps/app/app/_components/CaptureProvider.tsx` | `seedMessages` copies hydrated `graphResult` |
| `apps/app/app/chat/_components/ChatThread.tsx` | Soft empty agent reply (#88) |
| `apps/app/app/chat/_components/ChatEntityRail.tsx` | Live entities from thread messages |
| `apps/app/app/person/[id]/_components/PersonListRail.tsx` | Live people list |
| `apps/app/app/_components/BottomTabBar.tsx` / AppShell | Chat tab `activeFor` |
| `apps/app/app/graph/` | Guard topic open (no `/topic/[id]`) |
| `apps/app/app/__tests__/HomeClient.tsx` + HomeClient | Stats/links + imports CTA |
| `apps/app/app/settings/` | Keep imports link; add home entry |

---

### Task 1: Soft empty from #88

- [ ] Cherry-pick or merge `cursor/memo-soft-empty-d0df` onto Stream A branch
- [ ] Resolve conflicts; keep tests green

### Task 2: Hydrate chat history

- [ ] Failing test: seeded `initialThread` with extraction shows agent reply / chips
- [ ] `loadInitialThread` loads entity facts/topics/acts for each interaction id
- [ ] Reconstruct `GraphResult`-compatible shape; pass through `seedMessages`
- [ ] Soft empty still shows for empty extract on hydrate
- [ ] Commit

### Task 3: Live desktop rails

- [ ] `ChatEntityRail` reads committed messages’ entities (no mocks)
- [ ] `PersonListRail` queries user’s people (or props from page)
- [ ] Tests: no fixture names when empty; names appear when data present
- [ ] Commit

### Task 4: Polish

- [ ] Fix `/chat` active tab → chat (not capture)
- [ ] Graph: hide/disable open for topic nodes
- [ ] Home: people/acts/commits-oriented stats if cheap; recent → chat; imports CTA
- [ ] Commit

### Task 5: Verify + PR

- [ ] `bun run typecheck && bun run lint && bun run test`
- [ ] Push `cursor/stream-a-pdf-truth-d0df`; PR → staging
