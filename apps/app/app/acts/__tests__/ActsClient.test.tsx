// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { ActsClient } from '../ActsClient';

afterEach(cleanup);

describe('ActsClient', () => {
  it('shows the v0.3 preview banner', () => {
    render(<ActsClient />);
    expect(screen.getByText(/v0\.3/i)).toBeTruthy();
  });

  it('renders seeded draft cards with every send CTA disabled', () => {
    render(<ActsClient />);
    const sends = screen.getAllByRole('button', { name: /send/i });
    expect(sends.length).toBeGreaterThanOrEqual(3);
    sends.forEach((b) => expect((b as HTMLButtonElement).disabled).toBe(true));
  });
});
