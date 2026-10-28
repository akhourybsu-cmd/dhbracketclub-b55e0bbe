import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Check, ImageIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { ItemEnrichment } from '@/hooks/useItemEnrichments';

interface ImageCandidate {
  url: string;
  thumbnail: string;
  source: string;
  label: string;
}

interface ImagePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pickName: string;
  enrichment: ItemEnrichment;
  onImageSelected: (imageUrl: string, thumbnailUrl: string) => void;
}

export default function ImagePickerDialog({
  open,
  onOpenChange,
  pickName,
  enrichment,
  onImageSelected,
}: ImagePickerDialogProps) {
  const candidates: ImageCandidate[] = (enrichment.metadata?.image_candidates as ImageCandidate[]) || [];
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Build full list: current image + candidates (deduplicated)
  const allOptions: ImageCandidate[] = [];
  const seen = new Set<string>();

  if (enrichment.image_url) {
    const current: ImageCandidate = {
      url: enrichment.image_url,
      thumbnail: enrichment.thumbnail_url || enrichment.image_url,
      source: enrichment.source_provider || 'current',
      label: 'Current',
    };
    allOptions.push(current);
    seen.add(current.url);
  }

  for (const c of candidates) {
    if (!seen.has(c.url)) {
      allOptions.push(c);
      seen.add(c.url);
    }
  }

  const handleConfirm = async () => {
    if (!selectedUrl) return;
    const chosen = allOptions.find(o => o.url === selectedUrl);
    if (!chosen) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('item_enrichments')
        .update({
          image_url: chosen.url,
          thumbnail_url: chosen.thumbnail,
          source_provider: chosen.source,
        })
        .eq('id', enrichment.id);

      if (error) throw error;
      onImageSelected(chosen.url, chosen.thumbnail);
      onOpenChange(false);
      toast.success('Image updated');
    } catch (err: any) {
      toast.error('Failed to update image');
    } finally {
      setSaving(false);
      setSelectedUrl(null);
    }
  };

  if (allOptions.length <= 1) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">{pickName}</DialogTitle>
            <DialogDescription>No alternative images available for this pick.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setSelectedUrl(null); }}>
      <DialogContent className="max-w-sm max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Choose image for "{pickName}"</DialogTitle>
          <DialogDescription className="text-xs">Tap an image to select it, then confirm.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2 mt-2">
          {allOptions.map((opt, idx) => {
            const isSelected = selectedUrl === opt.url;
            const isCurrent = idx === 0 && enrichment.image_url === opt.url && !selectedUrl;
            return (
              <button
                key={opt.url}
                onClick={() => setSelectedUrl(opt.url)}
                className={cn(
                  "relative aspect-square rounded-lg overflow-hidden border-2 transition-all",
                  isSelected ? "border-primary ring-2 ring-primary/30" : "border-border/30 hover:border-border",
                  isCurrent && !selectedUrl && "border-primary/40"
                )}
              >
                <img
                  src={opt.thumbnail}
                  alt={opt.label}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                {isSelected && (
                  <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                    <Check className="w-6 h-6 text-primary" />
                  </div>
                )}
                {isCurrent && !selectedUrl && (
                  <div className="absolute top-1 left-1 px-1 py-0.5 bg-background/80 rounded text-[9.5px] font-bold text-foreground">
                    Current
                  </div>
                )}
                <div className="absolute bottom-0 inset-x-0 bg-background/70 px-1 py-0.5">
                  <span className="text-[9.5px] font-medium text-foreground/80 truncate block">{opt.source}</span>
                </div>
              </button>
            );
          })}
        </div>

        <Button
          onClick={handleConfirm}
          disabled={!selectedUrl || saving}
          className="w-full mt-3 rounded-xl font-bold"
        >
          {saving ? 'Saving…' : 'Use This Image'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
