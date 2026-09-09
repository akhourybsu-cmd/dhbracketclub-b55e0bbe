import { cn } from '@/lib/utils';
import type { RuneType } from '@/lib/runedelve/dungeonGenerator';

const RUNE_META: Record<RuneType, { glyph: string; color: string; glow: string; label: string }> = {
  red:   { glyph: '⚔', color: 'hsl(0 75% 58%)',   glow: 'hsl(0 75% 58% / 0.4)',   label: 'Attack' },
  blue:  { glyph: '✦', color: 'hsl(215 75% 60%)', glow: 'hsl(215 75% 60% / 0.4)', label: 'Mana' },
  green: { glyph: '❀', color: 'hsl(140 60% 50%)', glow: 'hsl(140 60% 50% / 0.4)', label: 'Heal' },
  gold:  { glyph: '◈', color: 'hsl(45 90% 56%)',  glow: 'hsl(45 90% 56% / 0.45)', label: 'Guard' },
};

interface Props {
  type: RuneType;
  selected?: boolean;
  invalid?: boolean;
  /** When true, this cell is sealed — uninteractable until broken. */
  sealed?: boolean;
  /** Corrupted overlay — chain-able but costs HP. */
  corrupted?: boolean;
  /** Source of corruption (spreads each turn). Implies corrupted. */
  corruptionSource?: boolean;
  /** Eclipse Tiles — dimmed, can't START a chain (extends ok). */
  eclipsed?: boolean;
  /** Linked Pairs — shows a chain icon overlay. */
  linked?: boolean;
  /** Shifting Runes — column drifts down each turn. */
  shifting?: boolean;
  /** Chamber-layout TREASURE cell — chain through for bonus score
   *  + shards. Persists across the run (board property, not tile). */
  treasure?: boolean;
  /** Chamber-layout HAZARD cell — chaining through costs HP.
   *  Persists across the run (board property, not tile). */
  hazard?: boolean;
  size?: number;
  onPointerDown?: (e: React.PointerEvent) => void;
  onPointerEnter?: (e: React.PointerEvent) => void;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  touchAction?: 'none' | 'pan-y';
  dataR: number;
  dataC: number;
}

export function RuneCell({ type, selected, invalid, sealed, corrupted, corruptionSource, eclipsed, linked, shifting, treasure, hazard, size, onPointerDown, onPointerEnter, onClick, disabled, touchAction = 'none', dataR, dataC }: Props) {
  const meta = RUNE_META[type];
  return (
    <button
      type="button"
      data-rune-cell={sealed ? undefined : true}
      data-r={dataR}
      data-c={dataC}
      onPointerDown={sealed ? undefined : onPointerDown}
      onPointerEnter={sealed ? undefined : onPointerEnter}
      onClick={sealed ? undefined : onClick}
      disabled={disabled || sealed}
      aria-pressed={selected}
      className={cn(
        'relative flex appearance-none items-center justify-center rounded-xl select-none transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        !selected && !sealed && 'rd-tile',
        selected && 'scale-110 z-10 border',
        invalid && 'opacity-50',
        sealed && 'rd-tile-sealed',
        corrupted && !sealed && 'rd-tile-corrupted',
        eclipsed && !sealed && 'opacity-60',
        shifting && !sealed && 'ring-1 ring-inset ring-primary/40',
      )}
      style={{
        width: size ?? '100%',
        height: size ?? 'auto',
        aspectRatio: '1 / 1',
        ...(selected
          ? {
              background: `radial-gradient(circle at 50% 40%, ${meta.color}, ${meta.color} 60%, transparent 100%)`,
              borderColor: meta.color,
              boxShadow: `0 0 22px ${meta.glow}, inset 0 0 10px rgba(255,255,255,0.18)`,
            }
          : {}),
        touchAction,
        cursor: sealed ? 'not-allowed' : undefined,
      }}
      aria-label={
        sealed ? `Sealed ${meta.label} rune`
        : corruptionSource ? `Corruption source on ${meta.label} rune`
        : corrupted ? `Corrupted ${meta.label} rune`
        : eclipsed ? `Eclipsed ${meta.label} rune (cannot start chain)`
        : linked ? `Linked ${meta.label} rune`
        : `${meta.label} rune`
      }
    >
      {sealed ? (
        // Sealed state: show the lock prominently, dim the underlying glyph.
        <>
          <span
            className="absolute inset-0 flex items-center justify-center text-2xl opacity-25"
            style={{ color: meta.color }}
            aria-hidden
          >
            {meta.glyph}
          </span>
          <span className="relative text-xl leading-none" aria-hidden>🔒</span>
        </>
      ) : (
        <>
          {/* V3 — carved-glyph treatment. The `rd-rune-glyph` class
              layers a multi-shadow text effect that reads as an
              inscription. Selected runes already get a special
              bright-on-color treatment via the wrapper background;
              the rune-glow CSS variable here drives the elemental
              halo when the tile is at rest. */}
          <span
            className={cn('text-2xl font-extrabold leading-none', !selected && 'rd-rune-glyph')}
            style={{
              color: selected ? '#fff' : meta.color,
              textShadow: selected ? '0 1px 4px rgba(0,0,0,0.5)' : undefined,
              // Element-specific halo color. Empty/undefined for
              // selected (the wrapper background does the work).
              '--rune-glow': selected ? undefined : meta.glow,
            } as React.CSSProperties & { '--rune-glow'?: string }}
          >
            {meta.glyph}
          </span>
          {corrupted && (
            <span
              className={cn(
                'absolute pointer-events-none leading-none',
                corruptionSource ? 'top-0.5 right-0.5 text-[13px]' : 'top-0.5 right-0.5 text-[10px] opacity-80',
              )}
              aria-hidden
            >
              {corruptionSource ? '☠️' : '🦠'}
            </span>
          )}
          {linked && !corrupted && (
            <span className="absolute top-0.5 right-0.5 text-[10px] opacity-90 leading-none pointer-events-none" aria-hidden>🔗</span>
          )}
          {eclipsed && !corrupted && !linked && (
            <span className="absolute top-0.5 right-0.5 text-[10px] opacity-90 leading-none pointer-events-none" aria-hidden>🌑</span>
          )}
          {shifting && !corrupted && (
            <span className="absolute bottom-0.5 right-0.5 text-[9px] opacity-70 leading-none pointer-events-none" aria-hidden>🌬️</span>
          )}
        </>
      )}

      {/* Chamber-layout overlays — board properties, independent of
          the tile's rune type or mechanical state. Rendered as a thin
          inset ring + a small corner marker so they don't collide
          with the existing top-right tile-state icons (corrupted,
          linked, eclipsed) which live on the RUNE. */}
      {treasure && (
        <>
          <span
            aria-hidden
            className="absolute inset-0 rounded-xl pointer-events-none rd-tile-treasure"
            style={{
              boxShadow: 'inset 0 0 0 1.5px hsl(45 95% 60% / 0.6), inset 0 0 12px hsl(45 95% 60% / 0.2)',
            }}
          />
          <span className="absolute bottom-0.5 left-0.5 text-[10px] leading-none pointer-events-none" aria-hidden>✨</span>
        </>
      )}
      {hazard && !treasure && (
        <>
          <span
            aria-hidden
            className="absolute inset-0 rounded-xl pointer-events-none rd-tile-hazard"
            style={{
              boxShadow: 'inset 0 0 0 1.5px hsl(0 75% 58% / 0.55), inset 0 0 10px hsl(0 75% 58% / 0.18)',
            }}
          />
          <span className="absolute bottom-0.5 left-0.5 text-[10px] leading-none pointer-events-none" aria-hidden>⚠️</span>
        </>
      )}
    </button>
  );
}
