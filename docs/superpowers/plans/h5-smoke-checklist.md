# H5 — manual smoke checklist

operator-facing checklist for the v0.1.1 hosted-capture end-to-end smoke.
run after deploy to verify the full pipeline (ASR → hybrid extractor →
embeddings → recall) on a real 60s voice memo.

## prep

- [ ] `apps/app` deployed to railway with `OPENROUTER_API_KEY`,
      `OPENAI_API_KEY`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` set
- [ ] signed in via magic link on a fresh browser session
- [ ] devtools network tab open, recording

## record (60s voice memo)

- [ ] click record, talk for ~60s about a fake post-meeting memo
- [ ] script: *"just had coffee with priya from cloudflare, she runs
      the workers data platform team, we talked about durable objects
      and edge sqlite, she's interested in our extraction pipeline,
      gotta send her the github link tomorrow afternoon. also met
      marcus at the rust meetup, solo founder shipping ai dev tools,
      ping him next week about a coffee."*
- [ ] click stop

## acceptance — pipeline

- [ ] **ASR**: transcribe endpoint returns within **10s** for 60s audio
      (check network tab `/api/transcribe` timing)
- [ ] transcript is visible in the UI and roughly matches what you said
- [ ] **hybrid extractor** returns within ~5s after ASR completes
- [ ] extracted entities show **≥1 person** (priya or marcus)
- [ ] extracted entities show **≥1 company** (cloudflare)
- [ ] at least one action is captured (the github link send-off)
- [ ] no console errors in devtools

## acceptance — recall

- [ ] navigate to recall
- [ ] query: *"who works on edge sqlite at cloudflare?"*
- [ ] **priya** is in the top 3 results
- [ ] cosine score on the match is **> 0.6** (visible in result metadata
      or via `bun run db:studio` on `embeddings` table)
- [ ] click the match → person detail page renders with topics + actions

## if any check fails

- capture the network tab HAR + console log
- file under wedge label `wedge:capture` or `wedge:recall`
- tag `@ayaan` in the issue with the failing step number above

## sign-off

- [ ] operator initials + date: __________________
- [ ] commit SHA tested against: __________________
