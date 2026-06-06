// CaptureClient — re-export shim (PR β₁-A).
//
// The canonical surface is now apps/app/app/chat/ChatClient.tsx. This
// file exists only so apps/app/app/capture/page.tsx keeps rendering
// during β₁-A. β₁-B replaces /capture/page.tsx with a redirect to
// /chat?armRecord=1 and deletes both this shim and the capture page.

export { default } from '@/app/chat/ChatClient';
