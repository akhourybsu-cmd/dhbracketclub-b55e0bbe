import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DraftPickArtwork } from '@/components/draft/DraftPickArtwork';
import ImagePickerDialog from '@/components/draft/ImagePickerDialog';
import { useItemEnrichments, type ItemEnrichment } from '@/hooks/useItemEnrichments';
import { artworkUrl, detailedArtworkUrl, draftArtworkCandidates, draftArtworkSources } from '@/lib/draft/artwork';

const backend = vi.hoisted(() => ({
  userId: 'alice' as string | null,
  select: vi.fn(), update: vi.fn(), save: vi.fn(),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: backend.userId ? { id: backend.userId } : null }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: () => ({
    select: () => ({ in: () => ({ eq: () => backend.select() }) }),
    update: (payload: unknown) => { backend.update(payload); return { eq: backend.save }; },
  }) },
}));

const enrichment = (id = 'pick-a', candidates = 2): ItemEnrichment => ({
  id: `enrichment-${id}`, item_id: id, item_type: 'draft_pick', category: 'movie',
  normalized_name: 'Arrival', matched_name: 'Arrival',
  image_url: `https://art.example/${id}/full.jpg`, thumbnail_url: `https://art.example/${id}/thumb.jpg`,
  source_provider: 'tmdb', confidence: 0.9, status: 'matched',
  metadata: { year: 2016, image_candidates: Array.from({ length: candidates }, (_, index) => ({
    url: `https://art.example/${id}/alt-${index}.jpg`, thumbnail: `https://art.example/${id}/alt-${index}-thumb.jpg`, source: 'tmdb', label: `Alternative ${index}`,
  })) },
});
function pending<T>() {
  let resolve!: (result: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
function loadArtwork(image: HTMLElement) {
  Object.defineProperties(image, {
    naturalWidth: { configurable: true, value: 640 },
    naturalHeight: { configurable: true, value: 480 },
  });
  fireEvent.load(image);
}
function readyPreview() {
  const image = document.querySelector('.da-image-preview img');
  if (!(image instanceof HTMLImageElement)) throw new Error('The selected image must have a preview');
  loadArtwork(image);
}
beforeEach(() => {
  backend.userId = 'alice';
  vi.clearAllMocks();
  backend.select.mockResolvedValue({ data: [], error: null });
  backend.save.mockResolvedValue({ error: null });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Draft artwork sources', () => {
  it('validates metadata, removes duplicate choices, and retains the selected provider facts', () => {
    const item = enrichment();
    item.metadata.image_candidates = [null, 'bad', { url: 'javascript:alert(1)' }, { url: item.image_url }, ...item.metadata.image_candidates];
    const options = draftArtworkCandidates(item, 'Arrival');
    expect(options).toHaveLength(3);
    expect(options[0]).toEqual({ url: item.image_url, thumbnail: item.thumbnail_url, source: 'tmdb', label: 'Arrival' });
    expect(item.metadata.year).toBe(2016);
    expect(artworkUrl('https://user:password@art.example/image.jpg')).toBeNull();
    expect(artworkUrl('data:text/html,bad')).toBeNull();
    expect(artworkUrl('/images/poster.webp')).toBe('/images/poster.webp');
    expect(artworkUrl('http://127.0.0.1:8099/poster.svg')).toBe('http://127.0.0.1:8099/poster.svg');
  });

  it('uses detailed versions only on established CDNs and preserves signed/custom sources', () => {
    expect(detailedArtworkUrl('https://image.tmdb.org/t/p/w200/poster.jpg')).toContain('/w780/');
    expect(detailedArtworkUrl('https://image.tmdb.org/t/p/w1280/poster.jpg')).toContain('/w1280/');
    expect(detailedArtworkUrl('https://is1-ssl.mzstatic.com/image/100x100bb.jpg')).toContain('/600x600bb.jpg');
    expect(detailedArtworkUrl('https://covers.openlibrary.org/b/id/42-M.jpg')).toContain('42-L.jpg');
    expect(detailedArtworkUrl('https://images.igdb.com/igdb/image/upload/t_thumb/cover.jpg')).toContain('/t_cover_big/');
    expect(detailedArtworkUrl('https://custom.example/w200/poster.jpg?signature=ok')).toBe('https://custom.example/w200/poster.jpg?signature=ok');
    expect(draftArtworkSources(enrichment())).toEqual(['https://art.example/pick-a/thumb.jpg', 'https://art.example/pick-a/full.jpg']);
  });

  it('falls back from the selected thumbnail to its full artwork, then a neutral identity without choosing another search hit', () => {
    const item = enrichment();
    render(<DraftPickArtwork artwork={item} label="Arrival" />);
    const first = screen.getByAltText('Arrival');
    expect(first).toHaveAttribute('src', item.thumbnail_url);
    fireEvent.error(first);
    const full = screen.getByAltText('Arrival');
    expect(full).toHaveAttribute('src', item.image_url);
    fireEvent.error(full);
    expect(screen.getByRole('img', { name: 'Artwork unavailable for Arrival' })).toBeVisible();
    expect(document.querySelector('img')).toBeNull();
  });

  it('resets a failed source when a different pick replaces the artwork', () => {
    const view = render(<DraftPickArtwork artwork={{ image_url: 'https://art.example/one.jpg' }} label="Arrival" />);
    fireEvent.error(screen.getByAltText('Arrival'));
    view.rerender(<DraftPickArtwork artwork={{ image_url: 'https://art.example/one.jpg' }} label="Dune" />);
    const image = screen.getByAltText('Dune');
    loadArtwork(image);
    expect(image.closest('[data-art-state]')).toHaveAttribute('data-art-state', 'ready');
  });

  it('removes the placeholder atomically for contained artwork instead of leaving initials behind transparent or letterboxed pixels', () => {
    render(<DraftPickArtwork artwork={enrichment()} label="Arrival" contain />);
    const image = screen.getByAltText('Arrival');
    expect(image.closest('[data-art-state]')).toHaveAttribute('data-art-state', 'loading');
    expect(document.querySelector('.da-art-fallback')).not.toBeNull();
    loadArtwork(image);
    expect(image.closest('[data-art-state]')).toHaveAttribute('data-art-state', 'ready');
    expect(image.closest('[data-art-fit]')).toHaveAttribute('data-art-fit', 'contain');
    expect(image).toHaveStyle({ visibility: 'visible' });
    expect(document.querySelector('.da-art-fallback')).toBeNull();
  });

  it('recognizes cached loaded artwork before paint without requiring another load event', () => {
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(800);
    vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockReturnValue(1200);
    render(<DraftPickArtwork artwork={enrichment()} label="Arrival" />);
    expect(screen.getByAltText('Arrival').closest('[data-art-state]')).toHaveAttribute('data-art-state', 'ready');
    expect(document.querySelector('.da-art-fallback')).toBeNull();
  });

  it('exhausts cached failed sources without waiting forever for an error event already missed', () => {
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(0);
    vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockReturnValue(0);
    render(<DraftPickArtwork artwork={enrichment()} label="Arrival" />);
    expect(screen.getByRole('img', { name: 'Artwork unavailable for Arrival' }).closest('[data-art-state]')).toHaveAttribute('data-art-state', 'unavailable');
    expect(document.querySelector('img')).toBeNull();
  });

  it('does not mark a fallback ready when an earlier source delivers a late load or error', () => {
    render(<DraftPickArtwork artwork={enrichment()} label="Arrival" />);
    const thumbnail = screen.getByAltText('Arrival');
    fireEvent.error(thumbnail);
    const full = screen.getByAltText('Arrival');
    expect(full).not.toBe(thumbnail);
    loadArtwork(thumbnail);
    fireEvent.error(thumbnail);
    expect(full.closest('[data-art-state]')).toHaveAttribute('data-art-state', 'loading');
    loadArtwork(full);
    expect(full.closest('[data-art-state]')).toHaveAttribute('data-art-state', 'ready');
    expect(document.querySelector('.da-art-fallback')).toBeNull();
  });

  it('uses a valid current thumbnail when the full URL is malformed and retains bounded candidate pages', () => {
    const item = enrichment('huge', 250);
    item.image_url = 'javascript:bad';
    const options = draftArtworkCandidates(item, 'Arrival');
    expect(options[0].url).toBe(item.thumbnail_url);
    expect(options).toHaveLength(121);
    render(<ImagePickerDialog open pickName="Arrival" enrichment={item} onImageSelected={vi.fn()} onOpenChange={vi.fn()} />);
    const choices = screen.getByRole('group', { name: 'Artwork choices' });
    expect(choices.querySelectorAll('button')).toHaveLength(6);
    for (let i = 0; i < 20; i++) fireEvent.click(screen.getByRole('button', { name: 'Next artwork page' }));
    expect(choices.querySelectorAll('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Next artwork page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous artwork page' })).toBeEnabled();
  });
});

describe('Draft image selection', () => {
  it('moves back immediately when refreshed candidates shorten the visible page range', () => {
    const selected = vi.fn(), closed = vi.fn();
    const view = render(<ImagePickerDialog open pickName="Arrival" enrichment={enrichment('pick-a', 30)} onImageSelected={selected} onOpenChange={closed} />);
    const next = screen.getByRole('button', { name: 'Next artwork page' });
    for (let index = 0; index < 5; index++) fireEvent.click(next);
    expect(screen.getByText('31 images · 6/6')).toBeVisible();

    // A provider refresh replaces the candidate list while the same pick stays open.
    view.rerender(<ImagePickerDialog open pickName="Arrival" enrichment={enrichment('pick-a', 13)} onImageSelected={selected} onOpenChange={closed} />);
    expect(screen.getByText('14 images · 3/3')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Previous artwork page' }));
    expect(screen.getByText('14 images · 2/3')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Alternative 5, TMDB' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Previous artwork page' }));
    expect(screen.getByText('14 images · 1/3')).toBeVisible();
    fireEvent.click(next);
    expect(screen.getByText('14 images · 2/3')).toBeVisible();
    expect(backend.update).not.toHaveBeenCalled();
  });

  it('cannot persist artwork until its full preview or same-image fallback actually loads', () => {
    render(<ImagePickerDialog open pickName="Arrival" enrichment={enrichment()} onImageSelected={vi.fn()} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Alternative 0, TMDB' }));
    const confirm = screen.getByRole('button', { name: 'Use selected artwork' });
    expect(confirm).toBeDisabled();
    const previewImage = () => document.querySelector('.da-image-preview img') as HTMLImageElement;
    fireEvent.error(previewImage());
    fireEvent.error(previewImage());
    expect(document.querySelector('.da-image-preview [data-art-state]')).toHaveAttribute('data-art-state', 'unavailable');
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect(backend.update).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Alternative 1, TMDB' }));
    expect(confirm).toBeDisabled();
    readyPreview();
    expect(confirm).toBeEnabled();
  });
  it('pages choices, previews an alternative and writes only the existing image contract', async () => {
    const item = enrichment('pick-a', 13);
    const selected = vi.fn(), closed = vi.fn();
    render(<ImagePickerDialog open pickName="Arrival" enrichment={item} onImageSelected={selected} onOpenChange={closed} />);
    expect(screen.getByRole('group', { name: 'Artwork choices' }).querySelectorAll('button')).toHaveLength(6);
    fireEvent.click(screen.getByRole('button', { name: 'Next artwork page' }));
    fireEvent.click(screen.getByRole('button', { name: 'Alternative 5, TMDB' }));
    readyPreview();
    fireEvent.click(screen.getByRole('button', { name: 'Use selected artwork' }));
    await waitFor(() => expect(selected).toHaveBeenCalledOnce());
    expect(backend.update).toHaveBeenCalledWith({ image_url: 'https://art.example/pick-a/alt-5.jpg', thumbnail_url: 'https://art.example/pick-a/alt-5-thumb.jpg', source_provider: 'tmdb' });
    expect(backend.save).toHaveBeenCalledWith('id', item.id);
    expect(closed).toHaveBeenCalledWith(false);
    expect(item.confidence).toBe(0.9);
    expect(item.metadata.year).toBe(2016);
  });

  it('allows the first valid candidate to replace missing artwork', async () => {
    const item = { ...enrichment(), image_url: null, thumbnail_url: null };
    const selected = vi.fn();
    render(<ImagePickerDialog open pickName="Arrival" enrichment={item} onImageSelected={selected} onOpenChange={vi.fn()} />);
    readyPreview();
    fireEvent.click(screen.getByRole('button', { name: 'Use selected artwork' }));
    await waitFor(() => expect(selected).toHaveBeenCalledWith('https://art.example/pick-a/alt-0.jpg', 'https://art.example/pick-a/alt-0-thumb.jpg'));
  });

  it('does not let an old pending save close or update a newly selected pick', async () => {
    const save = pending<{ error: null }>();
    backend.save.mockReturnValueOnce(save.promise);
    const firstSelected = vi.fn(), nextSelected = vi.fn(), closed = vi.fn();
    const view = render(<ImagePickerDialog open pickName="Arrival" enrichment={enrichment()} onImageSelected={firstSelected} onOpenChange={closed} />);
    fireEvent.click(screen.getByRole('button', { name: 'Alternative 0, TMDB' }));
    readyPreview();
    fireEvent.click(screen.getByRole('button', { name: 'Use selected artwork' }));
    view.rerender(<ImagePickerDialog open pickName="Dune" enrichment={enrichment('pick-b')} onImageSelected={nextSelected} onOpenChange={closed} />);
    await act(async () => save.resolve({ error: null }));
    expect(firstSelected).not.toHaveBeenCalled();
    expect(nextSelected).not.toHaveBeenCalled();
    expect(closed).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Dune' })).toBeVisible();
  });

  it('keeps a failed choice available for retry and rejects duplicate in-flight writes', async () => {
    const save = pending<{ error: { message: string } }>();
    backend.save.mockReturnValueOnce(save.promise);
    render(<ImagePickerDialog open pickName="Arrival" enrichment={enrichment()} onImageSelected={vi.fn()} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Alternative 0, TMDB' }));
    readyPreview();
    const confirm = screen.getByRole('button', { name: 'Use selected artwork' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(backend.update).toHaveBeenCalledOnce();
    await act(async () => save.resolve({ error: { message: 'Offline' } }));
    expect(screen.getByRole('alert')).toHaveTextContent('could not be saved');
    expect(screen.getByRole('button', { name: 'Use selected artwork' })).toBeEnabled();
  });

  it('ignores an old account save and shows a fresh selection for the next account', async () => {
    const save = pending<{ error: null }>();
    backend.save.mockReturnValueOnce(save.promise);
    const selected = vi.fn(), closed = vi.fn();
    const item = enrichment();
    const view = render(<ImagePickerDialog open pickName="Arrival" enrichment={item} onImageSelected={selected} onOpenChange={closed} />);
    fireEvent.click(screen.getByRole('button', { name: 'Alternative 0, TMDB' }));
    readyPreview();
    fireEvent.click(screen.getByRole('button', { name: 'Use selected artwork' }));
    backend.userId = 'blair';
    view.rerender(<ImagePickerDialog open pickName="Arrival" enrichment={item} onImageSelected={selected} onOpenChange={closed} />);
    await act(async () => save.resolve({ error: null }));
    expect(selected).not.toHaveBeenCalled();
    expect(closed).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Use selected artwork' })).toBeDisabled();
  });
});

describe('Draft artwork fetch ownership', () => {
  it('hides previous-room artwork immediately and ignores its late response', async () => {
    const first = pending<{ data: ItemEnrichment[]; error: null }>();
    const second = pending<{ data: ItemEnrichment[]; error: null }>();
    backend.select.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const view = renderHook(({ ids }) => useItemEnrichments(ids, 'draft_pick'), { initialProps: { ids: ['a'] } });
    let firstFetch!: Promise<void>;
    act(() => { firstFetch = view.result.current.fetchEnrichments(); });
    view.rerender({ ids: ['b'] });
    let secondFetch!: Promise<void>;
    act(() => { secondFetch = view.result.current.fetchEnrichments(); });
    await act(async () => { second.resolve({ data: [enrichment('b')], error: null }); await secondFetch; });
    await act(async () => { first.resolve({ data: [enrichment('a')], error: null }); await firstFetch; });
    expect([...view.result.current.enrichments.keys()]).toEqual(['b']);
    expect(view.result.current.loading).toBe(false);
    view.rerender({ ids: [] });
    expect(view.result.current.enrichments.size).toBe(0);
  });

  it('cannot repopulate art from an account that has been replaced', async () => {
    const response = pending<{ data: ItemEnrichment[]; error: null }>();
    backend.select.mockReturnValueOnce(response.promise);
    const view = renderHook(() => useItemEnrichments(['a'], 'draft_pick'));
    let fetch!: Promise<void>;
    act(() => { fetch = view.result.current.fetchEnrichments(); });
    backend.userId = 'blair';
    view.rerender();
    await act(async () => { response.resolve({ data: [enrichment('a')], error: null }); await fetch; });
    expect(view.result.current.enrichments.size).toBe(0);
  });
});
