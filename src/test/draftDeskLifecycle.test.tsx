import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { PersonalDraftDesk } from '@/components/draft/PersonalDraftDesk';
import type { DraftDeskItem } from '@/hooks/useDraftDesk';

const backend = vi.hoisted(() => ({ read: vi.fn(), insert: vi.fn(), save: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      if (table !== 'draft_desk_items') throw new Error(`Unexpected table: ${table}`);
      return {
        select: () => {
          const filters: Record<string, unknown> = {};
          const query = {
            eq: (column: string, value: unknown) => { filters[column] = value; return query; },
            order: () => query,
            then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => backend.read(filters).then(resolve, reject),
          };
          return query;
        },
        insert: (payload: unknown) => {
          backend.insert(payload);
          return { select: () => ({ single: () => backend.save() }) };
        },
      };
    },
  },
}));

function pending<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
type ReadResult = { data: DraftDeskItem[]; error: null };
type SaveResult = { data: DraftDeskItem | null; error: Error | null };
function idea(id: string, userId: string, draftId: string): DraftDeskItem {
  return {
    id, user_id: userId, draft_id: draftId, title: id, notes: null,
    position: 0, is_favorite: false, is_on_deck: false,
    created_at: '2026-10-31T00:00:00Z', updated_at: '2026-10-31T00:00:00Z',
  };
}
const taken = new Set<string>();
beforeEach(() => {
  vi.clearAllMocks();
  backend.read.mockResolvedValue({ data: [], error: null });
  backend.save.mockResolvedValue({ data: null, error: null });
});
afterEach(cleanup);

describe('Private draft desk session ownership', () => {
  it.each(['draft', 'account'] as const)('clears the form and ignores an old refresh after a %s change', async (scope) => {
    const oldRead = pending<ReadResult>(), currentRead = pending<ReadResult>();
    backend.read.mockImplementationOnce(() => oldRead.promise).mockImplementationOnce(() => currentRead.promise);
    const view = render(<PersonalDraftDesk draftId="draft-a" userId="alice" taken={taken} />);
    await waitFor(() => expect(backend.read).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByPlaceholderText('Save an idea…'), { target: { value: 'Private old idea' } });
    fireEvent.change(screen.getByPlaceholderText('Private note (optional)'), { target: { value: 'Private old note' } });

    const userId = scope === 'account' ? 'bob' : 'alice';
    const draftId = scope === 'draft' ? 'draft-b' : 'draft-a';
    view.rerender(<PersonalDraftDesk draftId={draftId} userId={userId} taken={taken} />);
    expect(screen.getByPlaceholderText('Save an idea…')).toHaveValue('');
    expect(screen.getByPlaceholderText('Private note (optional)')).toHaveValue('');
    await waitFor(() => expect(backend.read).toHaveBeenCalledTimes(2));
    await act(async () => { currentRead.resolve({ data: [idea('Current private idea', userId, draftId)], error: null }); });
    expect(screen.getByText('Current private idea')).toBeVisible();
    await act(async () => { oldRead.resolve({ data: [idea('Old private idea', 'alice', 'draft-a')], error: null }); });
    expect(screen.queryByText('Old private idea')).not.toBeInTheDocument();
    expect(screen.getByText('Current private idea')).toBeVisible();
  });

  it.each(['success', 'failure'] as const)('keeps the new private desk isolated from an old save %s', async (outcome) => {
    backend.read.mockResolvedValueOnce({ data: [idea('Alice saved idea', 'alice', 'draft-a')], error: null })
      .mockResolvedValueOnce({ data: [idea('Bob saved idea', 'bob', 'draft-b')], error: null });
    const saving = pending<SaveResult>();
    backend.save.mockImplementationOnce(() => saving.promise);
    const view = render(<PersonalDraftDesk draftId="draft-a" userId="alice" taken={taken} />);
    expect(await screen.findByText('Alice saved idea')).toBeVisible();
    fireEvent.change(screen.getByPlaceholderText('Save an idea…'), { target: { value: 'Alice pending idea' } });
    fireEvent.change(screen.getByPlaceholderText('Private note (optional)'), { target: { value: 'Alice pending note' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add idea' }));
    await waitFor(() => expect(backend.insert).toHaveBeenCalledTimes(1));
    expect(backend.insert).toHaveBeenCalledWith(expect.objectContaining({
      draft_id: 'draft-a', user_id: 'alice', title: 'Alice pending idea', notes: 'Alice pending note',
    }));

    view.rerender(<PersonalDraftDesk draftId="draft-b" userId="bob" taken={taken} />);
    expect(screen.queryByText('Alice saved idea')).not.toBeInTheDocument();
    expect(screen.queryByText('Alice pending idea')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Save an idea…')).toHaveValue('');
    expect(await screen.findByText('Bob saved idea')).toBeVisible();
    fireEvent.change(screen.getByPlaceholderText('Save an idea…'), { target: { value: 'Bob next idea' } });
    fireEvent.change(screen.getByPlaceholderText('Private note (optional)'), { target: { value: 'Bob next note' } });
    await act(async () => {
      saving.resolve({
        data: outcome === 'success' ? idea('Alice pending idea', 'alice', 'draft-a') : null,
        error: outcome === 'failure' ? new Error('Old account save failed') : null,
      });
    });
    expect(screen.getByPlaceholderText('Save an idea…')).toHaveValue('Bob next idea');
    expect(screen.getByPlaceholderText('Private note (optional)')).toHaveValue('Bob next note');
    expect(screen.queryByText('Alice pending idea')).not.toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('still confirms a save in the active session and clears its completed form', async () => {
    const saved = idea('Current idea', 'alice', 'draft-a');
    backend.save.mockResolvedValueOnce({ data: saved, error: null });
    render(<PersonalDraftDesk draftId="draft-a" userId="alice" taken={taken} />);
    await waitFor(() => expect(backend.read).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByPlaceholderText('Save an idea…'), { target: { value: 'Current idea' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add idea' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Added to your desk'));
    expect(screen.getByPlaceholderText('Save an idea…')).toHaveValue('');
    expect(screen.getByText('Current idea')).toBeVisible();
  });

  it('commits repeated Enter and click triggers only once while the idea is saving', async () => {
    const saving = pending<SaveResult>();
    backend.save.mockImplementationOnce(() => saving.promise);
    render(<PersonalDraftDesk draftId="draft-a" userId="alice" taken={taken} />);
    expect(await screen.findByText('Keep your next move ready here.')).toBeVisible();
    const title = screen.getByPlaceholderText('Save an idea…');
    const notes = screen.getByPlaceholderText('Private note (optional)');
    const add = screen.getByRole('button', { name: 'Add idea' });
    fireEvent.change(title, { target: { value: 'One pending idea' } });
    fireEvent.change(notes, { target: { value: 'The original note' } });
    act(() => {
      fireEvent.keyDown(title, { key: 'Enter' });
      fireEvent.keyDown(title, { key: 'Enter' });
      fireEvent.click(add);
    });
    expect(backend.insert).toHaveBeenCalledTimes(1);
    expect(backend.insert).toHaveBeenCalledWith(expect.objectContaining({ title: 'One pending idea', notes: 'The original note' }));
    expect(title).toBeDisabled();
    expect(notes).toBeDisabled();
    expect(add).toBeDisabled();
    expect(add).toHaveAttribute('aria-busy', 'true');
    await act(async () => { saving.resolve({ data: idea('One pending idea', 'alice', 'draft-a'), error: null }); });
    expect(backend.insert).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(title).not.toBeDisabled();
    expect(notes).not.toBeDisabled();
    expect(title).toHaveValue('');
    expect(notes).toHaveValue('');
    expect(add).toHaveAttribute('aria-busy', 'false');
    expect(screen.getByText('One pending idea')).toBeVisible();
  });

  it('releases the save guard after failure and retains the idea for a deliberate retry', async () => {
    const saving = pending<SaveResult>();
    backend.save.mockImplementationOnce(() => saving.promise)
      .mockResolvedValueOnce({ data: idea('Retry this idea', 'alice', 'draft-a'), error: null });
    render(<PersonalDraftDesk draftId="draft-a" userId="alice" taken={taken} />);
    expect(await screen.findByText('Keep your next move ready here.')).toBeVisible();
    const title = screen.getByPlaceholderText('Save an idea…');
    const notes = screen.getByPlaceholderText('Private note (optional)');
    const add = screen.getByRole('button', { name: 'Add idea' });
    fireEvent.change(title, { target: { value: 'Retry this idea' } });
    fireEvent.change(notes, { target: { value: 'Retain this note' } });
    fireEvent.click(add);
    await act(async () => { saving.resolve({ data: null, error: new Error('Connection interrupted') }); });
    expect(title).not.toBeDisabled();
    expect(notes).not.toBeDisabled();
    expect(add).not.toBeDisabled();
    expect(title).toHaveValue('Retry this idea');
    expect(notes).toHaveValue('Retain this note');
    expect(toast.error).toHaveBeenCalledWith('Connection interrupted');
    fireEvent.click(add);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Added to your desk'));
    expect(backend.insert).toHaveBeenCalledTimes(2);
    expect(title).toHaveValue('');
    expect(notes).toHaveValue('');
  });
});
