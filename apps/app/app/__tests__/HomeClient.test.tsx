// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react';

type ActsListState = {
  data: { acts: Array<Record<string, unknown>> } | undefined;
  isLoading: boolean;
};

let listState: ActsListState = { data: undefined, isLoading: false };
const markSentMutate = vi.fn();
const invalidateMock = vi.fn();

vi.mock('@/lib/trpc/client', () => ({
  trpc: {
    acts: {
      list: {
        useQuery: () => listState,
      },
      markSent: {
        useMutation: () => ({ mutate: markSentMutate, isPending: false }),
      },
    },
    useUtils: () => ({
      acts: { list: { invalidate: invalidateMock } },
    }),
  },
}));

import HomeClient, { type HomeInitialData } from '../HomeClient';

const sampleData: HomeInitialData = {
  todayCount: 3,
  weekCount: 12,
  pendingActs: 2,
  recent: [
    {
      id: 'int_1',
      capturedAt: new Date('2026-05-26T14:30:00Z').toISOString(),
      transcriptPreview: 'met sarah chen at devconnect, rust + voice infra',
      entityCount: 4,
    },
    {
      id: 'int_2',
      capturedAt: new Date('2026-05-26T10:15:00Z').toISOString(),
      transcriptPreview: 'priya knows compiler internals, wants intro to marcus',
      entityCount: 2,
    },
  ],
};

const emptyData: HomeInitialData = {
  todayCount: 0,
  weekCount: 0,
  pendingActs: 0,
  recent: [],
};

const sampleAct = {
  id: 'act_1',
  kind: 'email',
  glyph: '↗',
  name: 'Ada Lovelace',
  why: 'send the deck · tomorrow',
  conf: 88,
  accent: 'amber' as const,
  color: '#FFC452',
  actionKind: 'email' as const,
  subject: null,
  whenHint: 'tomorrow',
  body: 'send the deck',
  status: 'drafted',
  createdAt: new Date(),
};

describe('HomeClient', () => {
  beforeEach(() => {
    listState = { data: { acts: [sampleAct] }, isLoading: false };
    markSentMutate.mockClear();
    invalidateMock.mockClear();
  });
  afterEach(() => {
    cleanup();
  });

  it('renders header with user name and stat numerals', () => {
    render(<HomeClient userName="ayaan" initialData={sampleData} />);
    expect(screen.getByText(/home · ayaan/)).toBeTruthy();
    const stats = screen.getByTestId('home-stats');
    expect(stats.textContent).toContain('3');
    expect(stats.textContent).toContain('12');
    expect(stats.textContent?.toLowerCase()).toContain('today');
    expect(stats.textContent?.toLowerCase()).toContain('this week');
  });

  it('renders activity list with transcript previews + entity-count badges', () => {
    render(<HomeClient userName="ayaan" initialData={sampleData} />);
    const list = screen.getByTestId('home-activity');
    expect(list.textContent).toContain('met sarah chen');
    expect(list.textContent).toContain('priya knows compiler internals');
    expect(list.textContent).toContain('4');
    expect(list.textContent).toContain('2');
  });

  it('renders the agent stripe with live draft count', () => {
    render(<HomeClient userName="ayaan" initialData={sampleData} />);
    const stripe = screen.getByTestId('home-agent-stripe');
    expect(stripe.textContent).toContain('wingmic');
    expect(stripe.textContent).toContain('1 draft pending');
  });

  it('renders live act cards with enabled send CTAs', () => {
    render(<HomeClient userName="ayaan" initialData={sampleData} />);
    const acts = screen.getByTestId('home-acts');
    expect(acts.textContent).toContain('Ada Lovelace');
    expect(acts.textContent?.toLowerCase()).not.toContain('v0.3');
    const sendButtons = within(acts).getAllByRole('button', { name: /send/i });
    expect(sendButtons).toHaveLength(1);
    expect((sendButtons[0] as HTMLButtonElement).disabled).toBe(false);
  });

  it('marks an act sent when the send CTA is clicked', () => {
    render(<HomeClient userName="ayaan" initialData={sampleData} />);
    const acts = screen.getByTestId('home-acts');
    const send = within(acts).getByRole('button', { name: /send/i });
    fireEvent.click(send);
    expect(markSentMutate).toHaveBeenCalledWith({ id: 'act_1' });
  });

  it('shows an empty-state row when there are no recent commits', () => {
    listState = { data: { acts: [] }, isLoading: false };
    render(<HomeClient userName={null} initialData={emptyData} />);
    expect(screen.getByTestId('home-activity-empty').textContent).toMatch(/tap the mic/);
    expect(screen.getByTestId('home-acts-empty').textContent).toMatch(/no drafts yet/);
  });
});
