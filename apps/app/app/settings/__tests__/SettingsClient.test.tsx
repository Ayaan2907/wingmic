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

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={typeof href === 'string' ? href : String(href)} {...rest}>
      {children}
    </a>
  ),
}));

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

function renderSettings(over: Partial<Settings> = {}) {
  const data = fixture(over);
  getData = data;
  return render(
    <SettingsClient
      email="a@example.com"
      initialSettings={data}
    />,
  );
}

describe('SettingsClient', () => {
  beforeEach(() => {
    getData = fixture();
    mutateSpy.mockClear();
  });
  afterEach(() => cleanup());

  it('renders the audio-retention radios with the current value checked', () => {
    renderSettings({ audioRetentionMode: '7d' });
    const seven = screen.getByRole('radio', { name: /7d|7 days/i }) as HTMLInputElement;
    expect(seven.checked).toBe(true);
    const day = screen.getByRole('radio', { name: /24h|24 hours/i }) as HTMLInputElement;
    expect(day.checked).toBe(false);
  });

  it('selecting a different retention option fires update with that enum value', () => {
    renderSettings({ audioRetentionMode: '24h' });
    fireEvent.click(screen.getByRole('radio', { name: /forever/i }));
    expect(mutateSpy).toHaveBeenCalledWith({ audioRetentionMode: 'forever' });
  });

  it('renders the account email (read-only) and the about section', () => {
    renderSettings();
    expect(screen.getByText(/account/i)).toBeTruthy();
    expect(screen.getByText('a@example.com')).toBeTruthy();
    expect(screen.getByText(/about/i)).toBeTruthy();
  });

  it('blurring the linker model override persists the trimmed-as-typed value', () => {
    renderSettings();
    const input = screen.getByPlaceholderText('default model') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'claude-haiku' } });
    fireEvent.blur(input);
    expect(mutateSpy).toHaveBeenCalledWith({ linkerModelOverride: 'claude-haiku' });
  });

  it('blurring an emptied linker model override persists null (clears the row)', () => {
    renderSettings({ linkerModelOverride: 'claude-haiku' });
    const input = screen.getByPlaceholderText('default model') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(mutateSpy).toHaveBeenCalledWith({ linkerModelOverride: null });
  });

  it('blurring the preferred mic device id persists the value', () => {
    renderSettings();
    const input = screen.getByPlaceholderText('default') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'mic-abc123' } });
    fireEvent.blur(input);
    expect(mutateSpy).toHaveBeenCalledWith({ preferredMicDeviceId: 'mic-abc123' });
  });

  it('blurring a valid asr language (>= 2 chars) persists the trimmed value', () => {
    renderSettings();
    const input = screen.getByPlaceholderText('en-US') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '  fr-FR  ' } });
    fireEvent.blur(input);
    expect(mutateSpy).toHaveBeenCalledWith({ asrLanguage: 'fr-FR' });
  });

  it('blurring an asr language under the 2-char minimum does NOT persist', () => {
    renderSettings();
    const input = screen.getByPlaceholderText('en-US') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'x' } });
    fireEvent.blur(input);
    expect(mutateSpy).not.toHaveBeenCalled();
  });
});
