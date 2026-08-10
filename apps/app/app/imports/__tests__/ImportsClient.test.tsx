// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

const upsertMutate = vi.fn();

const previewState = vi.hoisted(() => ({
  data: {
    rows: [] as Array<{
      index: number;
      status: 'new' | 'match' | 'ambiguous';
      contactName: string;
      entityId: string | null;
      candidates: Array<{
        entityId: string;
        name: string;
        reasons: Array<'email' | 'linkedin' | 'name'>;
      }>;
    }>,
    ambiguousCount: 0,
    matchCount: 0,
    newCount: 1,
  },
}));

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
      previewBatch: {
        useQuery: () => ({
          data: previewState.data,
          isFetching: false,
          isError: false,
        }),
      },
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

function csvFor(names: string[]): string {
  const header =
    'First Name,Last Name,URL,Email Address,Company,Position,Connected On';
  const rows = names.map((n, i) => {
    const [first, ...rest] = n.split(' ');
    const last = rest.join(' ') || 'X';
    return `${first},${last},https://www.linkedin.com/in/${first!.toLowerCase()}-${i},,Acme,Eng,01 Jan 2024`;
  });
  return `${header}\n${rows.join('\n')}\n`;
}

afterEach(() => {
  cleanup();
  upsertMutate.mockClear();
  previewState.data = {
    rows: [],
    ambiguousCount: 0,
    matchCount: 0,
    newCount: 1,
  };
  vi.restoreAllMocks();
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
    const csv = csvFor(['Ada Lovelace']);
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

  it('rejects files with more than 1000 contacts before commit', async () => {
    render(<ImportsClient />);
    const input = screen.getByTestId('imports-file-input') as HTMLInputElement;
    const names = Array.from({ length: 1001 }, (_, i) => `Person ${i}`);
    const file = new File([csvFor(names)], 'Connections.csv', { type: 'text/csv' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByTestId('imports-error').textContent).toMatch(/too many contacts/i);
    });
    expect(screen.queryByTestId('imports-commit')).toBeNull();
    expect(upsertMutate).not.toHaveBeenCalled();
  });

  it('ignores a stale parse when a newer file is selected', async () => {
    let resolveSlow: ((v: string) => void) | null = null;
    const slowText = new Promise<string>((resolve) => {
      resolveSlow = resolve;
    });

    const originalText = File.prototype.text;
    let call = 0;
    vi.spyOn(File.prototype, 'text').mockImplementation(function (this: File) {
      call += 1;
      if (call === 1) return slowText;
      return originalText.call(this);
    });

    render(<ImportsClient />);
    const input = screen.getByTestId('imports-file-input') as HTMLInputElement;

    const slowFile = new File(['slow'], 'slow.csv', { type: 'text/csv' });
    const fastCsv = csvFor(['Grace Hopper']);
    const fastFile = new File([fastCsv], 'Connections.csv', { type: 'text/csv' });

    fireEvent.change(input, { target: { files: [slowFile] } });
    fireEvent.change(input, { target: { files: [fastFile] } });

    await waitFor(() => {
      expect(screen.getByTestId('imports-preview').textContent).toContain('Grace Hopper');
    });

    resolveSlow!(csvFor(['Ada Lovelace']));
    // Stale slow parse must not replace the newer preview.
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.getByTestId('imports-preview').textContent).toContain('Grace Hopper');
    expect(screen.getByTestId('imports-preview').textContent).not.toContain('Ada Lovelace');
  });

  it('shows a selector for ambiguous matches and passes the chosen entityId', async () => {
    previewState.data = {
      rows: [
        {
          index: 0,
          status: 'ambiguous',
          contactName: 'Ada Byron',
          entityId: null,
          candidates: [
            { entityId: 'ent-a', name: 'Ada Lovelace', reasons: ['email'] },
            { entityId: 'ent-b', name: 'Lord Byron', reasons: ['linkedin'] },
          ],
        },
      ],
      ambiguousCount: 1,
      matchCount: 0,
      newCount: 0,
    };

    render(<ImportsClient />);
    const input = screen.getByTestId('imports-file-input') as HTMLInputElement;
    const csv = `First Name,Last Name,URL,Email Address,Company,Position,Connected On
Ada,Byron,https://www.linkedin.com/in/byron,ada@example.com,,,01 Jan 2024
`;
    fireEvent.change(input, {
      target: { files: [new File([csv], 'Connections.csv', { type: 'text/csv' })] },
    });

    await waitFor(() => {
      expect(screen.getByTestId('imports-conflicts')).toBeTruthy();
    });
    const select = screen.getByTestId('imports-conflict-select-0') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'ent-a' } });
    fireEvent.click(screen.getByTestId('imports-commit'));

    expect(upsertMutate).toHaveBeenCalled();
    const arg = upsertMutate.mock.calls[0]![0] as {
      resolutions: Array<{ index: number; entityId: string | null }>;
    };
    expect(arg.resolutions).toEqual([{ index: 0, entityId: 'ent-a' }]);
  });
});
