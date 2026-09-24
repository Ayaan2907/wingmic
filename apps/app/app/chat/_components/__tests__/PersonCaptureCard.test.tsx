// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { PersonCaptureCard } from '../PersonCaptureCard';

// React 19 leaves a scheduler immediate pending after act() flushes; if the
// jsdom environment tears down first, the callback crashes the fork with
// `window is not defined` (a CI-only unhandled error). Draining inside the
// living environment keeps the run deterministic.
async function drainScheduler() {
  await act(async () => {});
}

describe('PersonCaptureCard', () => {
  it('renders name, company, topics, and promised hint', async () => {
    const onPhoto = vi.fn();
    render(
      <PersonCaptureCard
        person={{
          name: 'Sara Chen',
          role: 'rust lead',
          companyHint: 'Acme',
          topics: ['rust', 'compilers'],
        }}
        href="/person/e1"
        action={{ kind: 'email', body: 'send the deck', whenHint: 'monday' }}
        onPhoto={onPhoto}
      />,
    );

    expect(screen.getByRole('link', { name: 'Sara Chen' }).getAttribute('href')).toBe(
      '/person/e1',
    );
    expect(screen.getByText('Acme')).toBeTruthy();
    expect(screen.getByText('rust')).toBeTruthy();
    expect(screen.getByText('send the deck')).toBeTruthy();
    expect(screen.getByText('promised monday')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'add photo for Sara Chen' }));
    expect(onPhoto).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'correct Sara Chen' })).toBeNull();
    await drainScheduler();
  });

  it('renders every person as its own card, not a dump CTA', async () => {
    const { rerender } = render(
      <PersonCaptureCard
        person={{ name: 'Priya Mehta', role: 'hiring', companyHint: 'Linear', topics: [] }}
        href="/person/e2"
        onPhoto={() => {}}
      />,
    );
    expect(screen.queryByRole('button', { name: /draft follow-up/i })).toBeNull();
    rerender(
      <PersonCaptureCard
        person={{ name: 'Marcus Kim', role: null, companyHint: 'Stripe', topics: ['deck'] }}
        href="/person/e3"
        onPhoto={() => {}}
      />,
    );
    expect(screen.getByText('Marcus Kim')).toBeTruthy();
    await drainScheduler();
  });
});
