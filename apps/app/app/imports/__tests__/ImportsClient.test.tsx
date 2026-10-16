// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react';
import { IMPORT_MAX_BYTES } from '@/lib/imports';
import * as importsLib from '@/lib/imports';
import { LINKEDIN_DATA_EXPORT_URL } from '../ImportsClient';

const upsertMutate = vi.fn();
const undoMutate = vi.fn();
const resolveMutate = vi.fn();
const previewRefetch = vi.fn();

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
  isError: false,
  isFetching: false,
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
          data: previewState.isError ? undefined : previewState.data,
          isFetching: previewState.isFetching,
          isError: previewState.isError,
          refetch: previewRefetch,
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
      undoBatch: {
        useMutation: (opts?: { onSuccess?: (r: unknown) => void }) => ({
          mutate: (input: unknown) => {
            undoMutate(input);
            opts?.onSuccess?.({ removed: 1, importSource: 'linkedin:batch' });
          },
          isPending: false,
        }),
      },
      resolveAmbiguousImport: {
        useMutation: () => ({
          mutate: resolveMutate,
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
  undoMutate.mockClear();
  resolveMutate.mockClear();
  previewRefetch.mockClear();
  previewState.data = {
    rows: [],
    ambiguousCount: 0,
    matchCount: 0,
    newCount: 1,
  };
  previewState.isError = false;
  previewState.isFetching = false;
  vi.restoreAllMocks();
});

describe('ImportsClient', () => {
  beforeEach(() => {
    upsertMutate.mockClear();
    previewRefetch.mockClear();
  });

  it('shows empty tip and LinkedIn export deep link', () => {
    render(<ImportsClient />);
    expect(screen.getByTestId('imports-empty').textContent).toMatch(/linkedin/i);
    const link = screen.getByTestId('imports-linkedin-export') as HTMLAnchorElement;
    expect(link.href).toBe(LINKEDIN_DATA_EXPORT_URL);
    expect(link.textContent).toMatch(/email/i);
  });

  it('auto-imports a csv without a confirm step', async () => {
    render(<ImportsClient />);
    const input = screen.getByTestId('imports-file-input') as HTMLInputElement;
    const csv = csvFor(['Ada Lovelace']);
    const file = new File([csv], 'Connections.csv', { type: 'text/csv' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(upsertMutate).toHaveBeenCalled();
    });
    const arg = upsertMutate.mock.calls[0]![0] as {
      kind: string;
      contacts: Array<{ name: string }>;
    };
    expect(arg.kind).toBe('linkedin');
    expect(arg.contacts[0]!.name).toBe('Ada Lovelace');
    expect(screen.queryByTestId('imports-commit')).toBeNull();

    await waitFor(() => {
      expect(screen.getByTestId('imports-result').textContent).toMatch(/added 1/i);
      expect(screen.getByTestId('imports-toast').textContent).toMatch(/added 1, merged 0/i);
    });
  });

  it('reads zip bytes and auto-imports parsed contacts', async () => {
    const normalizeSpy = vi.spyOn(importsLib, 'normalizeContactsFromFile');
    normalizeSpy.mockReturnValue({
      kind: 'linkedin',
      contacts: [{ name: 'Grace Hopper', email: null, linkedinUrl: null, company: null, role: null }],
    });
    const arrayBuffer = vi
      .spyOn(File.prototype, 'arrayBuffer')
      .mockResolvedValue(new Uint8Array([1, 2, 3]).buffer);

    render(<ImportsClient />);
    const file = new File([new Uint8Array([1, 2, 3])], 'export.zip', {
      type: 'application/zip',
    });
    const input = screen.getByTestId('imports-file-input') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(normalizeSpy).toHaveBeenCalledWith({
        filename: 'export.zip',
        bytes: expect.any(Uint8Array),
      });
      expect(upsertMutate).toHaveBeenCalled();
    });
    normalizeSpy.mockRestore();
    arrayBuffer.mockRestore();
  });

  it('rejects files with more than 1000 contacts before import', async () => {
    render(<ImportsClient />);
    const input = screen.getByTestId('imports-file-input') as HTMLInputElement;
    const names = Array.from({ length: 1001 }, (_, i) => `Person ${i}`);
    const file = new File([csvFor(names)], 'Connections.csv', { type: 'text/csv' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByTestId('imports-error').textContent).toMatch(/too many contacts/i);
    });
    expect(upsertMutate).not.toHaveBeenCalled();
  });

  it('rejects oversized files by byte size before reading', async () => {
    const textSpy = vi.spyOn(File.prototype, 'text');
    const arrayBufferSpy = vi.spyOn(File.prototype, 'arrayBuffer');
    render(<ImportsClient />);
    const input = screen.getByTestId('imports-file-input') as HTMLInputElement;
    const big = new File([new Uint8Array(IMPORT_MAX_BYTES + 1)], 'huge.csv', {
      type: 'text/csv',
    });
    fireEvent.change(input, { target: { files: [big] } });
    await waitFor(() => {
      expect(screen.getByTestId('imports-error').textContent).toMatch(/file too large/i);
    });
    expect(textSpy).not.toHaveBeenCalled();
    expect(arrayBufferSpy).not.toHaveBeenCalled();
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

    await act(async () => {
      fireEvent.change(input, { target: { files: [slowFile] } });
    });
    await act(async () => {
      fireEvent.change(input, { target: { files: [fastFile] } });
    });

    await waitFor(() => {
      expect(upsertMutate).toHaveBeenCalled();
    });
    const arg = upsertMutate.mock.calls.at(-1)![0] as {
      contacts: Array<{ name: string }>;
    };
    expect(arg.contacts[0]!.name).toBe('Grace Hopper');

    resolveSlow!(csvFor(['Ada Lovelace']));
    await new Promise((r) => setTimeout(r, 50));
    expect(upsertMutate).toHaveBeenCalledTimes(1);
  });

  it('shows preview error with retry and does not auto-import', async () => {
    previewState.isError = true;
    render(<ImportsClient />);
    const input = screen.getByTestId('imports-file-input') as HTMLInputElement;
    const csv = csvFor(['Ada Lovelace']);
    fireEvent.change(input, {
      target: { files: [new File([csv], 'Connections.csv', { type: 'text/csv' })] },
    });

    await waitFor(() => {
      expect(screen.getByTestId('imports-preview-error')).toBeTruthy();
    });
    expect(upsertMutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('imports-preview-retry'));
    expect(previewRefetch).toHaveBeenCalled();
  });

  it('imports ambiguous rows without blocking and shows post-import review', async () => {
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
      expect(upsertMutate).toHaveBeenCalled();
    });
    expect(upsertMutate.mock.calls[0]![0]).not.toHaveProperty('resolutions');

    await waitFor(() => {
      expect(screen.getByTestId('imports-conflicts').textContent).toMatch(
        /judgement call/i,
      );
    });
  });

  it('wires undo from the toast', async () => {
    render(<ImportsClient />);
    const input = screen.getByTestId('imports-file-input') as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [new File([csvFor(['Ada Lovelace'])], 'Connections.csv', { type: 'text/csv' })],
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId('imports-undo')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('imports-undo'));
    expect(undoMutate).toHaveBeenCalledWith({ kind: 'linkedin', batchId: 'batch' });
    await waitFor(() => {
      expect(screen.getByTestId('imports-undone')).toBeTruthy();
    });
  });

  it('merges a post-import ambiguous pick via resolveAmbiguousImport', async () => {
    previewState.data = {
      rows: [
        {
          index: 0,
          status: 'ambiguous',
          contactName: 'Ada Byron',
          entityId: null,
          candidates: [{ entityId: 'ent-a', name: 'Ada Lovelace', reasons: ['email'] }],
        },
      ],
      ambiguousCount: 1,
      matchCount: 0,
      newCount: 0,
    };

    render(<ImportsClient />);
    const input = screen.getByTestId('imports-file-input') as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [new File([csvFor(['Ada Byron'])], 'Connections.csv', { type: 'text/csv' })],
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId('imports-conflict-select-0')).toBeTruthy();
    });
    fireEvent.change(screen.getByTestId('imports-conflict-select-0'), {
      target: { value: 'ent-a' },
    });
    expect(resolveMutate).toHaveBeenCalledWith({
      createdEntityId: 'e1',
      targetEntityId: 'ent-a',
    });
  });
});
