import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, ImageIcon, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DraftPickArtwork, type DraftArtworkState } from './DraftPickArtwork';
import { artworkProviderLabel, artworkUrl, draftArtworkCandidates } from '@/lib/draft/artwork';
import type { ItemEnrichment } from '@/hooks/useItemEnrichments';

interface ImagePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pickName: string;
  enrichment: ItemEnrichment;
  onImageSelected: (imageUrl: string, thumbnailUrl: string) => void;
}

const PAGE_SIZE = 6;

export default function ImagePickerDialog(props: ImagePickerDialogProps) {
  const { user } = useAuth();
  // A closed/replaced pick owns no presentation callbacks from its old save.
  return <ImagePickerSession key={`${user?.id ?? 'guest'}:${props.enrichment.id}:${props.pickName}:${props.open ? 'open' : 'closed'}`} {...props} canEdit={!!user?.id} />;
}

function ImagePickerSession({ open, onOpenChange, pickName, enrichment, onImageSelected, canEdit }: ImagePickerDialogProps & { canEdit: boolean }) {
  const options = useMemo(() => draftArtworkCandidates(enrichment, pickName), [enrichment, pickName]);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const active = useRef(true);
  const pending = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  const currentUrl = artworkUrl(enrichment.image_url) ?? artworkUrl(enrichment.thumbnail_url);
  const current = options.find((option) => option.url === currentUrl);
  const selected = options.find((option) => option.url === selectedUrl) ?? current ?? options[0];
  const pageCount = Math.max(1, Math.ceil(options.length / PAGE_SIZE));
  const visiblePage = Math.min(page, pageCount - 1);
  const [preview, setPreview] = useState<{ url: string | null; state: DraftArtworkState }>({ url: null, state: 'loading' });
  const selectedUrlForPreview = selected?.url ?? null;
  const previewChanged = useCallback((state: DraftArtworkState) => {
    setPreview({ url: selectedUrlForPreview, state });
  }, [selectedUrlForPreview]);
  const previewState = preview.url === selectedUrlForPreview ? preview.state : 'loading';
  const canSave = !!selected && selected.url !== currentUrl && previewState === 'ready';

  const confirm = async () => {
    if (!selected || !canSave || !canEdit || pending.current) return;
    pending.current = true;
    setSaving(true);
    setSaveError('');
    try {
      const { error } = await supabase.from('item_enrichments').update({
        image_url: selected.url,
        thumbnail_url: selected.thumbnail,
        source_provider: selected.source,
      }).eq('id', enrichment.id);
      if (error) throw error;
      if (!active.current) return;
      onImageSelected(selected.url, selected.thumbnail);
      onOpenChange(false);
      toast.success('Artwork updated');
    } catch {
      if (active.current) setSaveError('Artwork could not be saved. Try again.');
    } finally {
      pending.current = false;
      if (active.current) setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="da-appearance-panel da-lounge da-arena-dialog da-image-dialog">
        <DialogHeader className="da-image-heading pr-8 text-left">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-primary">Pick artwork</p>
          <DialogTitle className="da-image-title dl-display break-words text-xl" title={pickName}>{pickName}</DialogTitle>
          <DialogDescription className="text-xs">Choose the image that represents your pick.</DialogDescription>
        </DialogHeader>
        <div className="da-image-preview relative overflow-hidden rounded-xl border border-border/60 bg-background/50">
          {selected ? <DraftPickArtwork key={selected.url} artwork={{ image_url: selected.url, thumbnail_url: selected.thumbnail }} label={selected.label} detail contain eager onStateChange={previewChanged} /> : <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground"><ImageIcon aria-hidden="true" /><span className="text-xs">No artwork available</span></div>}
          {selected && <span className="da-image-source absolute bottom-2 left-2 max-w-[calc(100%-1rem)] truncate rounded-lg bg-background/90 px-2 py-1 text-[10px] font-semibold text-foreground" title={artworkProviderLabel(selected.source)}>{previewState === 'unavailable' ? 'Image unavailable · Choose another' : artworkProviderLabel(selected.source)}</span>}
        </div>
        {options.length > 0 ? <div className="da-image-candidates" role="group" aria-label="Artwork choices">
          {options.slice(visiblePage * PAGE_SIZE, (visiblePage + 1) * PAGE_SIZE).map((option, index) => {
            const isSelected = selected?.url === option.url;
            const isCurrent = current?.url === option.url;
            return <button
              key={option.url}
              type="button"
              className={cn('da-image-candidate relative overflow-hidden rounded-lg border-2 text-left', isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-border/60')}
              aria-label={`${option.label}, ${artworkProviderLabel(option.source)}${isCurrent ? ', current image' : ''}`}
              aria-pressed={isSelected}
              disabled={saving}
              onClick={() => { setSelectedUrl(option.url); setSaveError(''); }}
            >
              <DraftPickArtwork artwork={{ image_url: option.url, thumbnail_url: option.thumbnail }} label={option.label} />
              <span className="da-image-choice-label absolute inset-x-0 bottom-0 truncate bg-background/90 px-1 py-1 text-[9px] font-bold" title={`${option.label} · ${artworkProviderLabel(option.source)}`}>{isCurrent ? 'Current' : `${visiblePage * PAGE_SIZE + index + 1} · ${artworkProviderLabel(option.source)}`}</span>
              {isSelected && <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="h-3 w-3" aria-hidden="true" /></span>}
            </button>;
          })}
        </div> : <p className="text-center text-xs text-muted-foreground">Artwork appears here when a source finds a match.</p>}
        <div className="da-image-page-controls flex items-center justify-between gap-2" aria-label="Artwork pages">
          <Button type="button" variant="ghost" className="h-11 w-11 p-0" aria-label="Previous artwork page" disabled={visiblePage === 0 || saving} onClick={() => setPage((value) => Math.max(0, value - 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-[10px] font-bold tabular-nums text-muted-foreground">{options.length} {options.length === 1 ? 'image' : 'images'} · {visiblePage + 1}/{pageCount}</span>
          <Button type="button" variant="ghost" className="h-11 w-11 p-0" aria-label="Next artwork page" disabled={visiblePage + 1 >= pageCount || saving} onClick={() => setPage((value) => value + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        {saveError && <p className="text-xs text-destructive" role="alert">{saveError}</p>}
        <Button type="button" className="da-image-confirm min-h-11 w-full rounded-xl font-extrabold" disabled={!canSave || !canEdit || saving} onClick={() => void confirm()}>
          {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />Saving artwork…</> : currentUrl && selected?.url === currentUrl && options.length <= 1 ? 'Current artwork' : 'Use selected artwork'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
