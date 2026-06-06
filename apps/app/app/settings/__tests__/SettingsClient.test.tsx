// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// ── Mutable mock state (set per-test) ───────────────────────────────────
type Settings = {
  audioRetentionMode: '24h' | '7d' | 'forever' | 'never';
  linkerModelOverride: string | null;
  preferredMicDeviceId: string | null;
  asrLanguage: string;
  acknowledgedPrivacy: boolean;
};

let getData: Settings | undefined;
const mutateSpy = vi.fn();

vi.mock('@/lib/trpc/client', () => ({
  trpc: {
    settings: {
      get: { useQuery: () => ({ data: getData, isLoading: getData === undefined }) },
      update: { useMutation: () => ({ mutate: mutateSpy, isPending: false }) },
    },
  },
}));

import SettingsClient from '../SettingsClient';

function fixture(over: Partial<Settings> = {}): Settings {
  return {
    audioRetentionMode: '24h',
    linkerModelOverride: null,
    preferredMicDeviceId: null,
    asrLanguage: 'en-US',
    acknowledgedPrivacy: false,
    ...over,
  };
}

describe('SettingsClient', () => {
  beforeEach(() => {
    getData = fixture();
    mutateSpy.mockClear();
  });
  afterEach(() => cleanup());

  it('renders the audio-retention radios with the current value checked', () => {
    getData = fixture({ audioRetentionMode: '7d' });
    render(<SettingsClient email="a@example.com" />);
    const seven = screen.getByRole('radio', { name: /7d|7 days/i }) as HTMLInputElement;
    expect(seven.checked).toBe(true);
    const day = screen.getByRole('radio', { name: /24h|24 hours/i }) as HTMLInputElement;
    expect(day.checked).toBe(false);
  });

  it('selecting a different retention option fires update with that enum value', () => {
    getData = fixture({ audioRetentionMode: '24h' });
    render(<SettingsClient email="a@example.com" />);
    fireEvent.click(screen.getByRole('radio', { name: /forever/i }));
    expect(mutateSpy).toHaveBeenCalledWith({ audioRetentionMode: 'forever' });
  });

  it('renders the account email (read-only) and the about section', () => {
    render(<SettingsClient email="a@example.com" />);
    expect(screen.getByText(/account/i)).toBeTruthy();
    expect(screen.getByText('a@example.com')).toBeTruthy();
    expect(screen.getByText(/about/i)).toBeTruthy();
  });
});
