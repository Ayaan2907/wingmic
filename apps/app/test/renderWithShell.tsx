import { render } from '@testing-library/react';
import * as React from 'react';
import { CaptureProvider } from '@/app/_components/CaptureProvider';
import { AppShell } from '@/app/_components/AppShell';

// Mount a screen the way production does: inside CaptureProvider + AppShell,
// so the capture orb (now owned by the shell, not the screen) is present for
// orb-dependent behavioral tests. Caller must mock next/navigation's usePathname.
export function renderWithShell(ui: React.ReactNode) {
  return render(
    <CaptureProvider>
      <AppShell>{ui}</AppShell>
    </CaptureProvider>,
  );
}
