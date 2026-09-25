import { render } from '@testing-library/react';
import * as React from 'react';
import { EventSessionProvider } from '@/app/_components/EventSessionProvider';
import { CaptureProvider } from '@/app/_components/CaptureProvider';
import { AppShell } from '@/app/_components/AppShell';

// Mount a screen the way production does: inside EventSessionProvider (the
// global current-event session) → CaptureProvider → AppShell, mirroring
// layout.tsx, so the capture orb and the session chip are present for
// orb- and chip-dependent behavioral tests. Caller must mock
// next/navigation's usePathname.
export function renderWithShell(ui: React.ReactNode) {
  return render(
    <EventSessionProvider>
      <CaptureProvider>
        <AppShell>{ui}</AppShell>
      </CaptureProvider>
    </EventSessionProvider>,
  );
}
