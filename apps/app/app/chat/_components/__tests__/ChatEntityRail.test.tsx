// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { ChatEntityRail } from '../ChatEntityRail';
import type { ThreadMessage } from '../types';

const messagesRef: { current: ThreadMessage[] } = { current: [] };

vi.mock('@/app/_components/CaptureProvider', () => ({
  useCapture: () => ({
    messages: messagesRef.current,
  }),
}));

afterEach(() => {
  cleanup();
  messagesRef.current = [];
});

describe('ChatEntityRail', () => {
  it('shows empty cue when the thread has no extractions', () => {
    messagesRef.current = [];
    render(<ChatEntityRail />);
    expect(screen.getByTestId('chat-entity-rail').getAttribute('data-empty')).toBe('true');
    expect(screen.getByTestId('chat-entity-rail').className).toContain('desktop-pane');
    expect(screen.getByText(/commit a memo/i)).toBeTruthy();
    expect(screen.queryByText(/sarah chen/i)).toBeNull();
  });

  it('lists people from committed graphResult payloads', () => {
    messagesRef.current = [
      {
        id: 'm1',
        status: 'committed',
        audioBlob: null,
        transcript: 'met ada',
        duration: 0,
        transcribeMs: null,
        commitMs: null,
        graphResult: {
          extracted: {
            persons: [
              {
                name: 'Ada Lovelace',
                role: 'math',
                companyHint: 'Analytical',
                topics: ['engines'],
              },
            ],
            companies: [{ name: 'Analytical' }],
            events: [],
            topics: ['engines'],
            actions: [{ kind: 'email', body: 'send notes', whenHint: null }],
          },
          newEntities: 1,
          matchedEntities: 0,
          interactionId: 'ix1',
          entityIds: ['en_ada'],
        },
        error: null,
        createdAt: new Date(),
        transcribingStartedAt: null,
        fromPaste: false,
      },
    ];
    render(<ChatEntityRail />);
    expect(screen.getAllByText('Ada Lovelace').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/analytical/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/engines/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/sarah chen/i)).toBeNull();
  });
});
