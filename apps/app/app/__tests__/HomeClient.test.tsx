// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import HomeClient, { type HomeInitialData } from '../HomeClient';

const sampleData: HomeInitialData = {
  todayCount: 3,
  weekCount: 12,
  pendingActs: 0,
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

describe('HomeClient', () => {
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

  it('renders the acts empty-state with the v0.3 copy', () => {
    render(<HomeClient userName="ayaan" initialData={sampleData} />);
    const empty = screen.getByTestId('home-acts-empty');
    expect(empty.textContent).toContain('the acts agent arrives v0.3');
  });

  it('renders bottom nav with home active', () => {
    render(<HomeClient userName="ayaan" initialData={sampleData} />);
    const nav = screen.getByLabelText('primary');
    expect(nav).toBeTruthy();
    // home tab should carry aria-current=page; other tabs should not.
    const homeLink = nav.querySelector('a[href="/"]');
    expect(homeLink?.getAttribute('aria-current')).toBe('page');
    expect(nav.textContent?.toLowerCase()).toContain('home');
    expect(nav.textContent?.toLowerCase()).toContain('chat');
    expect(nav.textContent?.toLowerCase()).toContain('capture');
    expect(nav.textContent?.toLowerCase()).toContain('graph');
    expect(nav.textContent?.toLowerCase()).toContain('acts');
  });

  it('shows an empty-state row when there are no recent commits', () => {
    render(<HomeClient userName={null} initialData={emptyData} />);
    expect(screen.getByTestId('home-activity-empty').textContent).toMatch(/hold the mic/);
  });
});
