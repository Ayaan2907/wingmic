// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { ActCard, type PendingAct } from '../ActCard';

afterEach(cleanup);

const ACT: PendingAct = {
  kind: 'memo',
  glyph: '✎',
  name: 'Ada Lovelace',
  why: '7d since meetup',
  conf: 92,
  accent: 'amber',
  color: '#FFC452',
  actionKind: 'todo',
  channel: 'memo',
  subject: 'memo · Ada',
  body: 'Ada asked for the rust deck at Analytical Engines.',
};

describe('ActCard', () => {
  it('renders the act name, kind, confidence and draft without edit', () => {
    render(<ActCard act={ACT} />);
    expect(screen.getByText('Ada Lovelace')).toBeTruthy();
    expect(screen.getByText(/memo/i)).toBeTruthy();
    expect(screen.getByTestId('act-subject').textContent).toMatch(/memo · Ada/);
    expect(screen.getByTestId('act-body').textContent).toMatch(/rust deck/);
    expect(screen.queryByTestId('act-edit')).toBeNull();
  });

  it('disables send when there is no draft id', () => {
    render(<ActCard act={ACT} />);
    const btn = screen.getByRole('button', { name: /mark done/i });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('enables send and invokes onSent for memo drafts with an id', () => {
    const onSent = vi.fn();
    render(
      <ActCard
        act={{ ...ACT, id: 'act_todo', actionKind: 'todo', channel: 'memo', body: 'ship the note' }}
        onSent={onSent}
      />,
    );
    const btn = screen.getByRole('button', { name: /mark done/i });
    expect((btn as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(btn);
    expect(onSent).toHaveBeenCalledWith('act_todo');
  });

  it('shows an inline edit error when save returns false', async () => {
    const onSaveEdit = vi.fn(async () => false);
    render(
      <ActCard
        act={{ ...ACT, id: 'act_edit', actionKind: 'todo', body: 'ship the note' }}
        onSaveEdit={onSaveEdit}
      />,
    );
    fireEvent.click(screen.getByTestId('act-edit-toggle'));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(await screen.findByTestId('act-edit-error')).toBeTruthy();
    expect(screen.getByTestId('act-edit')).toBeTruthy();
  });

  it('copies a linkedin note and opens the profile without marking sent', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const open = vi.fn();
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    vi.stubGlobal('open', open);
    const onSent = vi.fn();
    render(
      <ActCard
        act={{
          ...ACT,
          id: 'act_li',
          actionKind: 'email',
          channel: 'linkedin',
          kind: 'linkedin',
          targetLinkedin: 'https://www.linkedin.com/in/ada',
          body: 'hey Ada — rust at the booth',
        }}
        onSent={onSent}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /copy note/i }));
    expect(writeText).toHaveBeenCalledWith('hey Ada — rust at the booth');
    expect(open).toHaveBeenCalled();
    expect(onSent).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
