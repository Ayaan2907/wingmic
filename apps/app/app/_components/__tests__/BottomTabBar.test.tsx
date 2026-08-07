// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CaptureOrb, ORB_HINT_STORAGE_KEY } from '../BottomTabBar';

const beginCapture = vi.fn();
const recorder = {
  status: 'idle' as const,
  duration: 0,
  level: Array(22).fill(0),
  audioBlob: null,
  error: null,
  start: vi.fn(),
  stop: vi.fn(),
  discard: vi.fn(),
  lock: vi.fn(),
  setCancelArmed: vi.fn(),
  setLockArmed: vi.fn(),
  reset: vi.fn(),
  supported: true,
};

afterEach(() => {
  cleanup();
  localStorage.clear();
  beginCapture.mockClear();
});

describe('CaptureOrb first-run hint', () => {
  it('shows tap to talk until the orb is tapped, then persists dismiss', () => {
    render(
      <CaptureOrb
        isActive={false}
        label="capture"
        recorder={recorder}
        beginCapture={beginCapture}
      />,
    );
    expect(screen.getByTestId('orb-hint').textContent).toMatch(/tap to talk/i);

    fireEvent.click(screen.getByRole('button', { name: /record voice memo/i }));
    expect(localStorage.getItem(ORB_HINT_STORAGE_KEY)).toBe('1');
    expect(screen.queryByTestId('orb-hint')).toBeNull();
  });

  it('does not show the hint after it was dismissed in a prior session', () => {
    localStorage.setItem(ORB_HINT_STORAGE_KEY, '1');
    render(
      <CaptureOrb
        isActive={false}
        label="capture"
        recorder={recorder}
        beginCapture={beginCapture}
      />,
    );
    expect(screen.queryByTestId('orb-hint')).toBeNull();
  });
});
