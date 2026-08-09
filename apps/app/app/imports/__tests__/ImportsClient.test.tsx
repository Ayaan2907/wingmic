// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

const upsertMutate = vi.fn();

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={typeof href === 'string' ? href : String(href)} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/trpc/client', () => ({
  trpc: {
    imports: {
      upsertBatch: {
        useMutation: (opts?: { onSuccess?: (r: unknown) => void }) => ({
          mutate: (input: unknown) => {
            upsertMutate(input);
            opts?.onSuccess?.({
              created: 1,
              matched: 0,
              total: 1,
              batchId: 'batch',
              importSource: 'linkedin:batch',
              skipped: 0,
              entityIds: ['e1'],
            });
          },
          isPending: false,
        }),
      },
    },
  },
}));

import { ImportsClient } from '../ImportsClient';

afterEach(() => {
  cleanup();
  upsertMutate.mockClear();
});

describe('ImportsClient', () => {
  beforeEach(() => {
    upsertMutate.mockClear();
  });

  it('shows empty tip before a file is chosen', () => {
    render(<ImportsClient />);
    expect(screen.getByTestId('imports-empty').textContent).toMatch(/linkedin/i);
  });

  it('parses a csv file and commits via upsertBatch', async () => {
    render(<ImportsClient />);
    const input = screen.getByTestId('imports-file-input') as HTMLInputElement;
    const csv = `First Name,Last Name,URL,Email Address,Company,Position,Connected On
Ada,Lovelace,https://www.linkedin.com/in/ada,ada@example.com,Engines,Math,01 Jan 2024
`;
    const file = new File([csv], 'Connections.csv', { type: 'text/csv' });
    await waitFor(() => {
      fireEvent.change(input, { target: { files: [file] } });
    });
    await waitFor(() => {
      expect(screen.getByTestId('imports-preview').textContent).toContain('Ada Lovelace');
    });
    fireEvent.click(screen.getByTestId('imports-commit'));
    expect(upsertMutate).toHaveBeenCalled();
    const arg = upsertMutate.mock.calls[0]![0] as {
      kind: string;
      contacts: Array<{ name: string }>;
    };
    expect(arg.kind).toBe('linkedin');
    expect(arg.contacts[0]!.name).toBe('Ada Lovelace');
    await waitFor(() => {
      expect(screen.getByTestId('imports-result').textContent).toMatch(/import complete/i);
    });
  });
});
