// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { ActCard, type PendingAct } from '../ActCard';

afterEach(cleanup);

const ACT: PendingAct = {
  kind: 'check-in',
  glyph: '↗',
  name: 'Ada Lovelace',
  why: '7d since meetup',
  conf: 92,
  accent: 'amber',
  color: '#FFC452',
};

describe('ActCard', () => {
  it('renders the act name, kind, confidence and why', () => {
    render(<ActCard act={ACT} />);
    expect(screen.getByText('Ada Lovelace')).toBeTruthy();
    expect(screen.getByText(/check-in/i)).toBeTruthy();
    expect(screen.getByText(/7d since meetup/i)).toBeTruthy();
  });

  it('disables send when there is no draft id', () => {
    render(<ActCard act={ACT} />);
    const btn = screen.getByRole('button', { name: /send/i });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('enables send and invokes onSent for todo drafts with an id', () => {
    const onSent = vi.fn();
    render(
      <ActCard
        act={{ ...ACT, id: 'act_todo', actionKind: 'todo', body: 'ship the note' }}
        onSent={onSent}
      />,
    );
    const btn = screen.getByRole('button', { name: /send/i });
    expect((btn as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(btn);
    expect(onSent).toHaveBeenCalledWith('act_todo');
  });
});
