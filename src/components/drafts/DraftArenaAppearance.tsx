import { Check, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { DRAFT_ARENA_PALETTES, useDraftArenaPalette } from '@/hooks/useDraftArenaPalette';

export function DraftArenaAppearance() {
  const { palette, setPalette } = useDraftArenaPalette();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="da-hud-action h-11 w-11 shrink-0 btn-press"
          aria-label="Draft Arena color palette"
          title="Draft Arena color palette"
        >
          <Palette className="h-[18px] w-[18px]" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="da-appearance-panel w-[min(19rem,calc(100vw-1rem))] p-2.5">
        <div className="px-1.5 pb-2">
          <p className="dl-display text-sm font-bold">Arena palette</p>
          <p className="text-[11px] text-muted-foreground">Your choice works in light and dark mode.</p>
        </div>
        <DraftArenaPaletteList />
      </PopoverContent>
    </Popover>
  );
}

export function DraftArenaPaletteList({ onSelect }: { onSelect?: () => void }) {
  const { palette, setPalette } = useDraftArenaPalette();

  return (
    <div className="grid gap-1" role="radiogroup" aria-label="Draft Arena palette">
      {DRAFT_ARENA_PALETTES.map((option) => {
        const selected = option.id === palette;
        return (
          <Button
            key={option.id}
            type="button"
            variant="ghost"
            role="radio"
            aria-checked={selected}
            onClick={() => {
              setPalette(option.id);
              onSelect?.();
            }}
            className={cn('da-appearance-option h-11 justify-start px-2.5', selected && 'is-selected')}
          >
            <span className={cn('da-palette-swatch', option.swatchClass)} aria-hidden />
            <span className="min-w-0 flex-1 text-left text-xs font-bold">{option.label}</span>
            {selected && <Check className="h-4 w-4 text-primary" aria-hidden />}
          </Button>
        );
      })}
    </div>
  );
}