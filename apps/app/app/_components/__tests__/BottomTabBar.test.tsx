// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CaptureOrb } from '../BottomTabBar';

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
  beginCapture.mockClear();
  recorder.stop.mockClear();
});

describe('CaptureOrb', () => {
  it('does not render a tap-to-talk teaching bubble', () => {
    render(
      <CaptureOrb
        isActive={false}
        label="capture"
        recorder={recorder}
        beginCapture={beginCapture}
      />,
    );
    expect(screen.queryByTestId('orb-hint')).toBeNull();
    expect(screen.queryByText(/tap to talk/i)).toBeNull();
  });

  it('taps idle to begin capture', () => {
    render(
      <CaptureOrb
        isActive={false}
        label="capture"
        recorder={recorder}
        beginCapture={beginCapture}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /record voice memo/i }));
    expect(beginCapture).toHaveBeenCalled();
  });

  it('taps recording to stop', () => {
    render(
      <CaptureOrb
        isActive={false}
        label="capture"
        recorder={{ ...recorder, status: 'recording' }}
        beginCapture={beginCapture}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /recording/i }));
    expect(recorder.stop).toHaveBeenCalled();
    expect(beginCapture).not.toHaveBeenCalled();
  });
});
