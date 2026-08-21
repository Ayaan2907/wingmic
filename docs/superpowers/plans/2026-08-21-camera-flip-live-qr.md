# Camera Flip and Live QR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add camera flip and always-on live QR confirm to the chat camera overlay, keeping the frozen JPEG plus the decoded value on the same attachment.

**Architecture:** Extract `BarcodeDetector` into `readQr.ts`. `CameraCapture` polls the live video, freezes on the first code, and confirms. `attachFiles` / `compressImageFile` accept an optional `qrText` override so the live value wins.

**Tech Stack:** Next.js App Router client overlay, `getUserMedia`, `BarcodeDetector`, Vitest + Testing Library jsdom.

## Global Constraints

- One change: camera overlay + attachment QR override only.
- No new dependencies. No `jsQR`.
- Brand copy lowercase. No AI vocabulary.
- `BarcodeDetector` only; missing API is silent.
- Poll ≤ 320ms. Confirm before attach.
- Tests with new code. `bun --filter @wingmic/app test` for touched files, then typecheck.

---

## File map

| File | Role |
|---|---|
| `apps/app/lib/chat/readQr.ts` | `readQrFromFile` / `readQrFromVideo` |
| `apps/app/lib/chat/__tests__/readQr.test.ts` | Detector present / missing / empty |
| `apps/app/lib/chat/compressImage.ts` | Use `readQrFromFile`; optional override |
| `apps/app/app/chat/_components/CameraCapture.tsx` | Flip, poll, confirm sheet |
| `apps/app/app/chat/_components/__tests__/CameraCapture.test.tsx` | Flip + confirm cases |
| `apps/app/app/_components/CaptureProvider.tsx` | `attachFiles(files, { qrText })` |
| `apps/app/app/chat/ChatClient.tsx` | Pass live `qrText` into `attachFiles` |

---

### Task 1: QR primitive

- [ ] Write `readQr.test.ts` covering missing Detector, trimmed `rawValue`, empty ignored.
- [ ] Run it; confirm fail.
- [ ] Add `readQr.ts`. Point `compressImage.ts` at `readQrFromFile`. Allow `compressImageFile(file, { qrText })` to skip/override detect.
- [ ] Run `bun --filter @wingmic/app test -- lib/chat/__tests__/readQr.test.ts`. Pass.
- [ ] Commit `feat(chat): share barcode detector for live and still qr`.

### Task 2: Overlay flip + confirm

- [ ] Extend `CameraCapture.test.tsx` for two-camera flip, one-camera hide, live confirm, use this, retake, missing Detector.
- [ ] Run; confirm fail.
- [ ] Implement facing toggle, 320ms poll, confirm sheet, cancelled-safe `onCapture(file, qrText)`.
- [ ] Wire `ChatClient` `onCapture` to `attachFiles([file], { qrText })`.
- [ ] Run CameraCapture + ChatClient camera tests. Pass.
- [ ] Commit `feat(chat): flip camera and confirm live qr`.

### Task 3: Attachment override

- [ ] If Task 2 already wired `attachFiles`, add a ChatClient or provider assertion that live `qrText` is kept on the pending attachment even when still-detect returns null. Else write that test now.
- [ ] Implement override in `attachFiles` / `compressImageFile`.
- [ ] Run `bun --filter @wingmic/app test -- app/chat/_components/__tests__/CameraCapture.test.tsx app/chat/__tests__/ChatClient.test.tsx lib/chat/__tests__/readQr.test.ts` and `bun --filter @wingmic/app typecheck`.
- [ ] Commit if anything remains; otherwise skip empty commit.

## Verification

```
bun --filter @wingmic/app test -- app/chat/_components/__tests__/CameraCapture.test.tsx app/chat/__tests__/ChatClient.test.tsx lib/chat/__tests__/readQr.test.ts
bun --filter @wingmic/app typecheck
```

Manual: open camera, flip if two cameras exist, point at a QR, confirm `use this`, composer shows `qr ready`.
