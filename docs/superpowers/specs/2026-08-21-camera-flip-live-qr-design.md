# Camera flip and live QR confirm

**Date:** 2026-08-21 · **Status:** locked · **Base:** `cursor/chat-in-thread-cards-17c5`  
**Slice:** capture camera overlay only. Later slices (capture-time person choose, topic tightness, search tightness, entity edit) stay out.

## Why

The live camera overlay only snaps. Rear camera is assumed. QR is read after the file is compressed, so the user never sees or confirms a code while the camera is open.

## Lock

- Always listen for QR on the live preview. No scan toggle. No second scanner app.
- Keep a pause: when a code hits, freeze that frame (that freeze is the photo), show the decoded value, wait.
- `use this` closes the camera and attaches the frozen JPEG plus the QR text on the same pending attachment.
- `retake` unfreezes and keeps listening. `cancel` still drops the overlay.
- Snap without a code still takes a normal photo. `compressImageFile` may still recover a QR from that still.
- Flip camera: `environment` ↔ `user`. Hide the control when `enumerateDevices` reports fewer than two `videoinput`s, or when enumerate is missing.
- Live detect uses Chromium `BarcodeDetector` only. Missing API → camera still works; live listen is silent. No `jsQR` in this slice.
- Poll at most every 320ms. First attempt after `canPlay`. Stop polling while confirm is open, while encoding, and on unmount.
- First non-empty `rawValue` wins. Empty values are ignored.
- Copy stays lowercase: `cancel`, `retake`, `use this`. Flip control `aria-label="switch camera"`. Confirm value `data-testid="camera-qr-value"`.
- 44px hit targets on flip / confirm buttons.

## Data flow

1. `CameraCapture` owns stream, facing, poll, and confirm state.
2. Live hit → `snapshotVideoToJpeg(video)` + detected string → confirm sheet.
3. `onCapture(file, qrText)` → `attachFiles([file], { qrText })`.
4. `compressImageFile` still compresses. Provided `qrText` wins over a second detect.
5. Commit path unchanged: `transcriptWithQr` already appends `pendingAttachment.qrText`.

## Errors

- No `getUserMedia` / permission denied: existing `camera unavailable`.
- Snap or freeze encode fail: existing `couldnt take that photo`; stay in overlay.
- Flip `getUserMedia` fail: keep the current stream; do not blank a working preview.
- Confirm `use this` after unmount/cancel: ignored (existing cancelledRef).

## Tests

- Snap stays disabled until `canPlay`.
- Cancel during encode does not call `onCapture`.
- Flip visible with two video inputs; hidden with one.
- Flip restarts `getUserMedia` with the opposite `facingMode`.
- Live detect opens confirm with the decoded value and a frozen file.
- `use this` calls `onCapture(file, qrText)`.
- `retake` hides confirm and does not call `onCapture`.
- No `BarcodeDetector`: overlay still snaps.

## Not in this slice

jsQR fallback, flash, zoom, capture-time person choose, topic sanitizing, search score cutoff, entity field edit.
