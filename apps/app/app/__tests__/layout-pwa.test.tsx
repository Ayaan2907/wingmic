// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

// The layout module initializes Next font helpers and mounts app providers;
// none of that import graph is relevant to the metadata/viewport exports.
vi.mock('next/font/google', () => ({
  Inter: () => ({ variable: '--font-inter' }),
  Instrument_Serif: () => ({ variable: '--font-instrument' }),
  JetBrains_Mono: () => ({ variable: '--font-jetbrains' }),
}));
vi.mock('@/lib/trpc/client', () => ({ TRPCProvider: () => null }));
vi.mock('../_components/CaptureProvider', () => ({ CaptureProvider: () => null }));
vi.mock('../_components/AppShell', () => ({ AppShell: () => null }));
vi.mock('../_components/RecordingOverlay', () => ({ RecordingOverlay: () => null }));
vi.mock('../globals.css', () => ({}));

// eslint-disable-next-line import/first
import { metadata, viewport } from '../layout';

describe('root layout PWA metadata (AC1)', () => {
  it('links the webmanifest so the app is installable', () => {
    expect(metadata.manifest).toBe('/manifest.webmanifest');
  });

  it('declares the apple touch icon so iOS installs get the real mark', () => {
    const icons = metadata.icons;
    if (!icons || Array.isArray(icons) || typeof icons === 'string') {
      throw new Error('metadata.icons should describe specific icon files');
    }
    expect('apple' in icons ? icons.apple : undefined).toBe('/apple-touch-icon.png');
  });

  it('keeps the existing theme color and no-index robots', () => {
    expect(viewport.themeColor).toBe('#0a0a0a');
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it('sets viewportFit cover so safe-area insets engage on notched devices', () => {
    expect(viewport.viewportFit).toBe('cover');
  });
});
