import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { RuneCell } from './RuneCell';
import { BOARD_SIZE, type RuneType } from '@/lib/runedelve/dungeonGenerator';
import { cellKey, type Cell } from '@/lib/runedelve/boardEngine';
import { advanceChainSelection, type ChainStepReason } from '@/lib/runedelve/chainControls';
import { useSoundEffect } from '@/hooks/useSoundEffect';
import { cn } from '@/lib/utils';

const RUNE_PREVIEW: Record<RuneType, { glyph: string; label: string; effect: (n: number) => string }> = {
  red: { glyph: '⚔', label: 'Attack', effect: (n) => `${n * 8} dmg` },
  blue: { glyph: '✦', label: 'Mana', effect: (n) => `+${n >= 5 ? 2 : 1} orb${n >= 5 ? 's' : ''}` },
  green: { glyph: '❀', label: 'Heal', effect: (n) => `+${n * 6} HP` },
  gold: { glyph: '◈', label: 'Guard', effect: (n) => `+${1 + Math.floor(n / 3)} shield` },
};

interface Props {
  grid: RuneType[][];
  disabled?: boolean;
  onChainComplete: (chain: Cell[]) => void;
  /** Set of `${r}-${c}` keys that are currently sealed and uninteractable. */
  seals?: Set<string>;
  /** Set of `${r}-${c}` keys that are corrupted (chain-able but costly). */
  corruptedCells?: Set<string>;
  /** Subset of `corruptedCells` that are active spreaders. */
  corruptionSources?: Set<string>;
  /** Eclipsed cells — cannot START a chain, can extend one. */
  eclipsedCells?: Set<string>;
  /** Linked-pair cells — show 🔗 indicator. */
  linkedCells?: Set<string>;
  /** Column index that drifts each turn (Shifting Runes mechanic). -1 = none. */
  shiftingColumn?: number;
  /** Optional per-rune effect override (keyed by RuneType). Rune Delve uses
   *  this to show the current class, mastery, relic-rank, resource-cap, run
   *  modifier, and chain-tier result before the player commits the chain. */
  effectOverride?: Partial<Record<RuneType, (n: number) => string>>;
  /** Treasure cells from the chamber's layout — chaining through them
   *  pays bonus score + shards. Rendered as a gold sparkle overlay. */
  treasureCells?: Set<string>;
  /** Hazard cells from the chamber's layout — chaining through them
   *  costs HP. Rendered as a red glow overlay. */
  hazardCells?: Set<string>;
}

type ControlMode = 'drag' | 'tap';
const CONTROL_MODE_KEY = 'rd-control-mode-v1';

function initialControlMode(): ControlMode {
  if (typeof window === 'undefined') return 'drag';
  try {
    const stored = window.localStorage.getItem(CONTROL_MODE_KEY);
    if (stored === 'drag' || stored === 'tap') return stored;
  } catch { /* storage can be disabled */ }
  return window.matchMedia?.('(pointer: coarse)').matches ? 'tap' : 'drag';
}

const TAP_ERROR: Partial<Record<ChainStepReason, string>> = {
  sealed: 'That rune is sealed',
  'eclipsed-start': '🌑 Eclipsed runes can\'t start a chain',
  'already-selected': 'That rune is already in the chain',
  'not-adjacent': 'Choose a neighboring rune',
  'wrong-rune': 'Keep the chain the same color',
};

function haptic(milliseconds: number) {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  try { navigator.vibrate(milliseconds); } catch { /* haptics are optional */ }
}

// Device-aware rune board with drag, tap, and keyboard chain selection.
export function RuneBoard({ grid, disabled, onChainComplete, seals, corruptedCells, corruptionSources, eclipsedCells, linkedCells, shiftingColumn, effectOverride, treasureCells, hazardCells }: Props) {
  const [chain, setChain] = useState<Cell[]>([]);
  const [controlMode, setControlMode] = useState<ControlMode>(initialControlMode);
  const draggingRef = useRef(false);
  const { play } = useSoundEffect();

  const chainSet = useMemo(() => new Set(chain.map(cellKey)), [chain]);
  const chainType = chain.length ? grid[chain[0].r]?.[chain[0].c] : null;

  const chooseControlMode = (mode: ControlMode) => {
    draggingRef.current = false;
    setChain([]);
    setControlMode(mode);
    try { window.localStorage.setItem(CONTROL_MODE_KEY, mode); } catch { /* optional preference */ }
  };

  const tryAddCell = useCallback((target: Cell, announceInvalid = false) => {
    if (disabled) return;
    setChain(prev => {
      const result = advanceChainSelection(grid, prev, target, seals, eclipsedCells);
      if (!result.changed) {
        if (announceInvalid && result.reason && TAP_ERROR[result.reason]) {
          toast(TAP_ERROR[result.reason], { duration: 1100 });
        }
        return prev;
      }
      haptic(12);
      play('tap');
      return result.chain;
    });
  }, [disabled, grid, play, seals, eclipsedCells]);

  const cellFromPoint = (x: number, y: number): Cell | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    if (!el) return null;
    const node = el.closest('[data-rune-cell]') as HTMLElement | null;
    if (!node) return null;
    const r = Number(node.dataset.r);
    const c = Number(node.dataset.c);
    if (Number.isNaN(r) || Number.isNaN(c)) return null;
    return { r, c };
  };

  const handlePointerDown = (r: number, c: number) => (e: React.PointerEvent) => {
    if (disabled || controlMode !== 'drag') return;
    e.preventDefault();
    draggingRef.current = true;
    // Do NOT setPointerCapture — capturing on the first cell prevents
    // pointermove from reporting the correct elementFromPoint for sibling cells on iOS.
    setChain([]);
    tryAddCell({ r, c }, true);
  };

  const handleCellClick = (r: number, c: number) => (e: React.MouseEvent<HTMLButtonElement>) => {
    // Pointer clicks belong to Tap mode. Keyboard activation always works and
    // switches to Tap so the selected chain remains visible and resolvable.
    if (controlMode !== 'tap' && e.detail !== 0) return;
    if (controlMode !== 'tap') chooseControlMode('tap');
    tryAddCell({ r, c }, true);
  };

  const resolveSelectedChain = useCallback(() => {
    if (chain.length < 3) {
      toast('Need 3+ runes to chain', { duration: 1300 });
      return;
    }
    haptic(25);
    play('success');
    onChainComplete(chain);
    setChain([]);
  }, [chain, onChainComplete, play]);

  // Use document-level move so dragging across cells works reliably on iOS Safari.
  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (!draggingRef.current || disabled) return;
      const cell = cellFromPoint(e.clientX, e.clientY);
      if (cell) tryAddCell(cell);
    };
    const handleUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      setChain(prev => {
        if (prev.length >= 3) {
          haptic(25);
          play('success');
          onChainComplete(prev);
        } else if (prev.length > 0) {
          toast('Need 3+ runes to chain', { duration: 1500 });
        }
        return [];
      });
    };
    window.addEventListener('pointermove', handleMove, { passive: true });
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [disabled, onChainComplete, play, tryAddCell]);

  useEffect(() => {
    if (!disabled) return;
    draggingRef.current = false;
    setChain([]);
  }, [disabled]);

  return (
    <div className="w-full flex flex-col items-center">
      <div className="rd-play-board w-full mb-1.5 flex items-center justify-between gap-2 px-0.5">
        <p className="text-[10px] font-bold text-foreground/65 truncate">
          Chain 3+ matching runes
        </p>
        <div
          role="group"
          aria-label="Rune controls"
          className="shrink-0 inline-flex items-center rounded-lg border border-foreground/15 bg-background/45 p-0.5"
        >
          {(['drag', 'tap'] as const).map(mode => (
            <button
              key={mode}
              type="button"
              aria-pressed={controlMode === mode}
              onClick={() => chooseControlMode(mode)}
              className={cn(
                'h-6 px-2 rounded-md text-[9px] font-extrabold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                controlMode === mode
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-foreground/60 hover:text-foreground',
              )}
            >
              {mode === 'drag' ? 'Drag' : 'Tap'}
            </button>
          ))}
        </div>
      </div>
      <div
        className={cn(
          'rd-play-board w-full p-2 rounded-2xl select-none rd-board-frame',
        )}
        style={{
          touchAction: controlMode === 'drag' ? 'none' : 'pan-y',
        }}
      >
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
            gap: 'clamp(5px, 1.5vw, 8px)',
            justifyContent: 'center',
          }}
        >
          {grid.map((row, r) =>
            row.map((rune, c) => {
              const isSel = chainSet.has(`${r}-${c}`);
              const k = `${r}-${c}`;
              const isSealed = seals?.has(k) ?? false;
              const isCorrupted = corruptedCells?.has(k) ?? false;
              const isSource = corruptionSources?.has(k) ?? false;
              const isEclipsed = eclipsedCells?.has(k) ?? false;
              const isLinked = linkedCells?.has(k) ?? false;
              const isShifting = (shiftingColumn ?? -1) === c;
              const isTreasure = treasureCells?.has(k) ?? false;
              const isHazard = hazardCells?.has(k) ?? false;
              return (
                <RuneCell
                  key={`${r}-${c}`}
                  dataR={r}
                  dataC={c}
                  type={rune}
                  selected={isSel}
                  sealed={isSealed}
                  corrupted={isCorrupted}
                  corruptionSource={isSource}
                  eclipsed={isEclipsed}
                  linked={isLinked}
                  shifting={isShifting}
                  treasure={isTreasure}
                  hazard={isHazard}
                  disabled={disabled}
                  touchAction={controlMode === 'drag' ? 'none' : 'pan-y'}
                  onPointerDown={handlePointerDown(r, c)}
                  onClick={handleCellClick(r, c)}
                />
              );
            })
          )}
        </div>
      </div>
      {chain.length > 0 && chainType && (
        <div className="rd-play-board mt-2 min-h-8 w-full flex items-center justify-center gap-2 text-[12px] font-bold tabular-nums">
          <span className="text-base">{RUNE_PREVIEW[chainType].glyph}</span>
          <span>{RUNE_PREVIEW[chainType].label}</span>
          <span className="text-muted-foreground">·</span>
          <span className={cn(chain.length >= 3 ? 'text-primary' : 'text-muted-foreground')}>
            {chain.length >= 3
              ? (effectOverride?.[chainType] ?? RUNE_PREVIEW[chainType].effect)(chain.length)
              : `${chain.length}/3`}
          </span>
          {controlMode === 'tap' && (
            <>
              <button
                type="button"
                onClick={resolveSelectedChain}
                disabled={chain.length < 3}
                className="ml-auto h-8 px-3 rounded-lg bg-primary text-primary-foreground text-[10px] font-extrabold uppercase tracking-wide disabled:opacity-40 btn-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Resolve
              </button>
              <button
                type="button"
                onClick={() => setChain([])}
                aria-label="Clear selected runes"
                className="h-8 px-2 rounded-lg border border-foreground/15 text-[10px] font-extrabold text-foreground/65 btn-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Clear
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
