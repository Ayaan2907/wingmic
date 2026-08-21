// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GraphCanvasControls } from '../GraphCanvasControls';

afterEach(() => cleanup());

describe('GraphCanvasControls', () => {
  it('fires zoom, reset, fullscreen, and spacing callbacks', () => {
    const onZoomIn = vi.fn();
    const onZoomOut = vi.fn();
    const onReset = vi.fn();
    const onFullscreen = vi.fn();
    const onSpacingChange = vi.fn();

    render(
      <GraphCanvasControls
        spacing="normal"
        onSpacingChange={onSpacingChange}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onReset={onReset}
        onFullscreen={onFullscreen}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'zoom in' }));
    fireEvent.click(screen.getByRole('button', { name: 'zoom out' }));
    fireEvent.click(screen.getByRole('button', { name: 'reset layout' }));
    fireEvent.click(screen.getByRole('button', { name: 'fullscreen graph' }));
    fireEvent.click(screen.getByRole('button', { name: 'wide' }));

    expect(onZoomIn).toHaveBeenCalledOnce();
    expect(onZoomOut).toHaveBeenCalledOnce();
    expect(onReset).toHaveBeenCalledOnce();
    expect(onFullscreen).toHaveBeenCalledOnce();
    expect(onSpacingChange).toHaveBeenCalledWith('wide');
  });
});
