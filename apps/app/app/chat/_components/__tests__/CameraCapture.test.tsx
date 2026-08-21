// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CameraCapture } from '../CameraCapture';

const { snapshotVideoToJpegMock } = vi.hoisted(() => ({
  snapshotVideoToJpegMock: vi.fn(),
}));

vi.mock('@/lib/chat/captureCamera', () => ({
  snapshotVideoToJpeg: snapshotVideoToJpegMock,
}));

describe('CameraCapture', () => {
  beforeEach(() => {
    snapshotVideoToJpegMock.mockReset();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => ({
          getTracks: () => [{ stop: vi.fn() }],
        })),
      },
    });
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it('keeps snap disabled until the video is ready', async () => {
    render(<CameraCapture onCapture={() => {}} onCancel={() => {}} />);
    const snap = screen.getByRole('button', { name: 'snap' }) as HTMLButtonElement;
    expect(snap.disabled).toBe(true);

    fireEvent.canPlay(screen.getByTestId('camera-video'));
    expect(snap.disabled).toBe(false);
  });

  it('does not capture after cancellation during JPEG encoding', async () => {
    let resolveSnapshot!: (file: File) => void;
    snapshotVideoToJpegMock.mockReturnValue(
      new Promise<File>((resolve) => {
        resolveSnapshot = resolve;
      }),
    );
    const onCapture = vi.fn();
    const onCancel = vi.fn();
    render(<CameraCapture onCapture={onCapture} onCancel={onCancel} />);
    fireEvent.canPlay(screen.getByTestId('camera-video'));
    fireEvent.click(screen.getByRole('button', { name: 'snap' }));
    await waitFor(() => expect(snapshotVideoToJpegMock).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'cancel' }));
    resolveSnapshot(new File(['jpeg'], 'capture.jpg', { type: 'image/jpeg' }));
    await Promise.resolve();

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCapture).not.toHaveBeenCalled();
  });
});
