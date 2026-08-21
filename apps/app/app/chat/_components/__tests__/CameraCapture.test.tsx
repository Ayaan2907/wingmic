// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CameraCapture } from '../CameraCapture';

const { snapshotVideoToJpegMock, readQrFromVideoMock } = vi.hoisted(() => ({
  snapshotVideoToJpegMock: vi.fn(),
  readQrFromVideoMock: vi.fn(),
}));

vi.mock('@/lib/chat/captureCamera', () => ({
  snapshotVideoToJpeg: snapshotVideoToJpegMock,
}));

vi.mock('@/lib/chat/readQr', () => ({
  readQrFromVideo: readQrFromVideoMock,
}));

function stubMedia(videoInputCount: number) {
  const devices = Array.from({ length: videoInputCount }, (_, i) => ({
    deviceId: `cam-${i}`,
    kind: 'videoinput' as const,
  }));
  const getUserMedia = vi.fn(async () => ({
    getTracks: () => [{ stop: vi.fn() }],
  }));
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia,
      enumerateDevices: vi.fn(async () => devices),
    },
  });
  return getUserMedia;
}

describe('CameraCapture', () => {
  beforeEach(() => {
    snapshotVideoToJpegMock.mockReset();
    snapshotVideoToJpegMock.mockResolvedValue(
      new File(['jpeg'], 'capture.jpg', { type: 'image/jpeg' }),
    );
    readQrFromVideoMock.mockReset();
    readQrFromVideoMock.mockResolvedValue(null);
    stubMedia(2);
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    HTMLMediaElement.prototype.pause = vi.fn();
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

  it('shows switch camera when two video inputs exist', async () => {
    render(<CameraCapture onCapture={() => {}} onCancel={() => {}} />);
    expect(await screen.findByRole('button', { name: 'switch camera' })).toBeTruthy();
  });

  it('hides switch camera when only one video input exists', async () => {
    stubMedia(1);
    render(<CameraCapture onCapture={() => {}} onCancel={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('camera-video')).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'switch camera' })).toBeNull();
  });

  it('flips facingMode on switch camera', async () => {
    const getUserMedia = stubMedia(2);
    render(<CameraCapture onCapture={() => {}} onCancel={() => {}} />);
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));
    expect(getUserMedia).toHaveBeenCalledWith({
      audio: false,
      video: { facingMode: { ideal: 'environment' } },
    });

    fireEvent.click(await screen.findByRole('button', { name: 'switch camera' }));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
    expect(getUserMedia).toHaveBeenCalledWith({
      audio: false,
      video: { facingMode: { ideal: 'user' } },
    });
  });

  it('pauses on a live qr and attaches the frozen photo plus the value', async () => {
    readQrFromVideoMock.mockResolvedValue('https://lu.ma/ethdenver');
    const onCapture = vi.fn();
    render(<CameraCapture onCapture={onCapture} onCancel={() => {}} />);
    fireEvent.canPlay(screen.getByTestId('camera-video'));

    expect((await screen.findByTestId('camera-qr-value')).textContent).toBe(
      'https://lu.ma/ethdenver',
    );
    expect((screen.getByRole('button', { name: 'snap' }) as HTMLButtonElement).disabled).toBe(
      true,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'use this' }));
    });
    expect(onCapture).toHaveBeenCalledTimes(1);
    expect(onCapture.mock.calls[0]?.[1]).toBe('https://lu.ma/ethdenver');
    expect(onCapture.mock.calls[0]?.[0]).toBeInstanceOf(File);
  });

  it('retake hides the qr confirm and does not capture', async () => {
    readQrFromVideoMock
      .mockResolvedValueOnce('https://lu.ma/ethdenver')
      .mockResolvedValue(null);
    const onCapture = vi.fn();
    render(<CameraCapture onCapture={onCapture} onCancel={() => {}} />);
    fireEvent.canPlay(screen.getByTestId('camera-video'));
    await screen.findByTestId('camera-qr-value');

    fireEvent.click(screen.getByRole('button', { name: 'retake' }));
    await waitFor(() => expect(screen.queryByTestId('camera-qr-value')).toBeNull());
    expect(onCapture).not.toHaveBeenCalled();
  });

  it('still snaps when live qr detection is unavailable', async () => {
    readQrFromVideoMock.mockResolvedValue(null);
    const onCapture = vi.fn();
    render(<CameraCapture onCapture={onCapture} onCancel={() => {}} />);
    fireEvent.canPlay(screen.getByTestId('camera-video'));
    fireEvent.click(screen.getByRole('button', { name: 'snap' }));
    await waitFor(() => expect(onCapture).toHaveBeenCalledTimes(1));
    expect(onCapture.mock.calls[0]?.[1]).toBeUndefined();
  });
});
