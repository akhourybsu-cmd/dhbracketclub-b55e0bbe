import { useId } from 'react';
import { Check, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { DRAFT_ARENA_PALETTES, useDraftArenaPalette } from '@/hooks/useDraftArenaPalette';

export function DraftArenaAppearance() {
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
      <PopoverContent align="end" sideOffset={8} collisionPadding={8}
        aria-label="Arena palette"
        className="da-appearance-panel z-[90] w-[min(19rem,calc(100vw-1rem))] overflow-y-auto overscroll-contain p-2.5"
        style={{ maxHeight: 'min(var(--radix-popover-content-available-height, 100dvh), calc(var(--da-viewport-height, 100dvh) - 1rem))' }}>
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
  const listId = useId();

  return (
    <div className="grid gap-1" role="radiogroup" aria-label="Draft Arena palette">
      {DRAFT_ARENA_PALETTES.map((option, index) => {
        const selected = option.id === palette;
        return (
          <Button
            key={option.id}
            id={`${listId}-${option.id}`}
            type="button"
            variant="ghost"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onKeyDown={(event) => {
              const length = DRAFT_ARENA_PALETTES.length;
              const next = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? (index + 1) % length
                : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? (index - 1 + length) % length
                  : event.key === 'Home' ? 0 : event.key === 'End' ? length - 1 : null;
              if (next === null) return;
              event.preventDefault();
              const choice = DRAFT_ARENA_PALETTES[next];
              setPalette(choice.id);
              document.getElementById(`${listId}-${choice.id}`)?.focus();
              onSelect?.();
            }}
            onClick={() => {
              setPalette(option.id);
              onSelect?.();
            }}
            className={cn('da-appearance-option h-auto min-h-11 w-full justify-start px-2.5 py-2', selected && 'is-selected')}
          >
            <span className={cn('da-palette-swatch shrink-0', option.swatchClass)} aria-hidden />
            <span className="min-w-0 flex-1 whitespace-normal break-words text-left text-xs font-bold leading-snug">{option.label}</span>
            {selected && <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />}
          </Button>
        );
      })}
    </div>
  );
}
