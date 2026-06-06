// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { ActCard, type PendingAct } from '../ActCard';

afterEach(cleanup);

const ACT: PendingAct = {
  kind: 'check-in', glyph: '↗', name: 'Sarah Chen',
  why: '7d since devconnect', conf: 92, accent: 'amber', color: '#FFC452',
};

describe('ActCard', () => {
  it('renders the act name, kind, confidence and why', () => {
    render(<ActCard act={ACT} />);
    expect(screen.getByText('Sarah Chen')).toBeTruthy();
    expect(screen.getByText(/check-in/i)).toBeTruthy();
    expect(screen.getByText(/7d since devconnect/i)).toBeTruthy();
  });

  it('the send CTA is disabled (coming soon · v0.3)', () => {
    render(<ActCard act={ACT} />);
    const btn = screen.getByRole('button', { name: /send/i });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });
});
