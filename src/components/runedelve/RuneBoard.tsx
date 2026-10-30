import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { RuneCell } from "./RuneCell";
import { RuneSigil } from "./RuneSigil";
import { BOARD_SIZE, type RuneType } from "@/lib/runedelve/dungeonGenerator";
import { cellKey, type Cell } from "@/lib/runedelve/boardEngine";
import {
  advanceChainSelection,
  type ChainStepReason,
} from "@/lib/runedelve/chainControls";
import { useSoundEffect } from "@/hooks/useSoundEffect";
import { cn } from "@/lib/utils";
import { Check, Hand, MousePointer2, RotateCcw } from "lucide-react";
import "./runeBattle.css";

const RUNE_PREVIEW: Record<
  RuneType,
  { label: string; effect: (n: number) => string }
> = {
  red: { label: "Attack", effect: (n) => `${n * 8} dmg` },
  blue: {
    label: "Mana",
    effect: (n) => `+${n >= 5 ? 2 : 1} orb${n >= 5 ? "s" : ""}`,
  },
  green: { label: "Heal", effect: (n) => `+${n * 6} HP` },
  gold: {
    label: "Guard",
    effect: (n) => `+${1 + Math.floor(n / 3)} shield`,
  },
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

type ControlMode = "drag" | "tap";
const CONTROL_MODE_KEY = "rd-control-mode-v1";

function initialMotionEnabled() {
  return (
    typeof document !== "undefined" &&
    !document.hidden &&
    !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

interface CastFeedback {
  id: number;
  type: RuneType;
  cells: Cell[];
}

function initialControlMode(): ControlMode {
  if (typeof window === "undefined") return "drag";
  try {
    const stored = window.localStorage.getItem(CONTROL_MODE_KEY);
    if (stored === "drag" || stored === "tap") return stored;
  } catch {
    /* storage can be disabled */
  }
  return window.matchMedia?.("(pointer: coarse)").matches ? "tap" : "drag";
}

const TAP_ERROR: Partial<Record<ChainStepReason, string>> = {
  sealed: "That rune is sealed",
  "eclipsed-start": "Eclipsed runes can't start a chain",
  "already-selected": "That rune is already in the chain",
  "not-adjacent": "Choose a neighboring rune",
  "wrong-rune": "Keep the chain the same color",
};

function haptic(milliseconds: number) {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(milliseconds);
  } catch {
    /* haptics are optional */
  }
}

// Device-aware rune board with drag, tap, and keyboard chain selection.
export function RuneBoard({
  grid,
  disabled,
  onChainComplete,
  seals,
  corruptedCells,
  corruptionSources,
  eclipsedCells,
  linkedCells,
  shiftingColumn,
  effectOverride,
  treasureCells,
  hazardCells,
}: Props) {
  const [chain, setChain] = useState<Cell[]>([]);
  const chainRef = useRef<Cell[]>([]);
  const [controlMode, setControlMode] =
    useState<ControlMode>(initialControlMode);
  const draggingRef = useRef(false);
  const [motionEnabled, setMotionEnabled] = useState(initialMotionEnabled);
  const [castFeedback, setCastFeedback] = useState<CastFeedback | null>(null);
  const [refillVersions, setRefillVersions] = useState<Record<string, number>>(
    {},
  );
  const castVersion = useRef(0);
  const { play } = useSoundEffect();

  const chainSet = useMemo(() => new Set(chain.map(cellKey)), [chain]);
  const chainType = chain.length ? grid[chain[0].r]?.[chain[0].c] : null;

  const updateChain = useCallback((next: Cell[]) => {
    chainRef.current = next;
    setChain(next);
  }, []);

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const syncMotion = () => {
      const enabled = !document.hidden && !query?.matches;
      setMotionEnabled(enabled);
      if (!enabled) setCastFeedback(null);
    };
    syncMotion();
    document.addEventListener("visibilitychange", syncMotion);
    query?.addEventListener?.("change", syncMotion);
    return () => {
      document.removeEventListener("visibilitychange", syncMotion);
      query?.removeEventListener?.("change", syncMotion);
    };
  }, []);

  useEffect(() => {
    if (!castFeedback) return;
    const timer = window.setTimeout(() => setCastFeedback(null), 620);
    return () => window.clearTimeout(timer);
  }, [castFeedback]);

  const chooseControlMode = (mode: ControlMode) => {
    draggingRef.current = false;
    updateChain([]);
    setControlMode(mode);
    try {
      window.localStorage.setItem(CONTROL_MODE_KEY, mode);
    } catch {
      /* optional preference */
    }
  };

  const tryAddCell = useCallback(
    (target: Cell, announceInvalid = false) => {
      if (disabled) return;
      const result = advanceChainSelection(
        grid,
        chainRef.current,
        target,
        seals,
        eclipsedCells,
      );
      if (!result.changed) {
        if (announceInvalid && result.reason && TAP_ERROR[result.reason]) {
          toast(TAP_ERROR[result.reason], { duration: 1100 });
        }
        return;
      }
      haptic(12);
      play("tap");
      updateChain(result.chain);
    },
    [disabled, grid, play, seals, eclipsedCells, updateChain],
  );

  const cellFromPoint = (x: number, y: number): Cell | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    if (!el) return null;
    const node = el.closest("[data-rune-cell]") as HTMLElement | null;
    if (!node) return null;
    const r = Number(node.dataset.r);
    const c = Number(node.dataset.c);
    if (Number.isNaN(r) || Number.isNaN(c)) return null;
    return { r, c };
  };

  const handlePointerDown =
    (r: number, c: number) => (e: React.PointerEvent) => {
      if (disabled || controlMode !== "drag") return;
      e.preventDefault();
      draggingRef.current = true;
      // Do NOT setPointerCapture — capturing on the first cell prevents
      // pointermove from reporting the correct elementFromPoint for sibling cells on iOS.
      updateChain([]);
      tryAddCell({ r, c }, true);
    };

  const handleCellClick =
    (r: number, c: number) => (e: React.MouseEvent<HTMLButtonElement>) => {
      // Pointer clicks belong to Tap mode. Keyboard activation always works and
      // switches to Tap so the selected chain remains visible and resolvable.
      if (controlMode !== "tap" && e.detail !== 0) return;
      if (controlMode !== "tap") chooseControlMode("tap");
      tryAddCell({ r, c }, true);
    };

  const resolveSelectedChain = useCallback(() => {
    if (disabled) return;
    const selected = chainRef.current;
    if (selected.length < 3) {
      toast("Connect 3 or more matching runes", { duration: 1300 });
      return;
    }
    // Commit from an event handler. React can replay state updater functions;
    // keeping gameplay outside them prevents a chain resolving twice.
    updateChain([]);
    if (motionEnabled) {
      const version = ++castVersion.current;
      setCastFeedback({
        id: version,
        type: grid[selected[0].r][selected[0].c],
        cells: selected,
      });
      setRefillVersions((previous) => {
        const next = { ...previous };
        for (const cell of selected) next[cellKey(cell)] = version;
        return next;
      });
    }
    haptic(25);
    play("success");
    onChainComplete(selected);
  }, [disabled, grid, motionEnabled, onChainComplete, play, updateChain]);

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
      if (chainRef.current.length >= 3) resolveSelectedChain();
      else updateChain([]);
    };
    const handleCancel = () => {
      draggingRef.current = false;
      updateChain([]);
    };
    window.addEventListener("pointermove", handleMove, { passive: true });
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleCancel);
    window.addEventListener("blur", handleCancel);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleCancel);
      window.removeEventListener("blur", handleCancel);
    };
  }, [disabled, resolveSelectedChain, tryAddCell, updateChain]);

  useEffect(() => {
    draggingRef.current = false;
    updateChain([]);
  }, [disabled, grid, updateChain]);

  return (
    <div
      className="rd-rune-board w-full flex flex-col items-center"
      data-motion={motionEnabled ? "full" : "reduced"}
    >
      <p className="sr-only">
        Connect 3 or more matching runes. Diagonals count.
      </p>
      <div
        className={cn(
          "rd-play-board rd-interactive-board w-full p-2 rounded-2xl select-none rd-board-frame",
        )}
        style={{
          touchAction: controlMode === "drag" ? "none" : "pan-y",
        }}
      >
        <div
          className="grid relative"
          style={{
            gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
            gap: "var(--rd-rune-gap, clamp(5px, 1.5vw, 8px))",
            justifyContent: "center",
          }}
        >
          {chain.length > 1 && (
            <svg
              className="rd-chain-energy"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden
            >
              {(["halo", "thread", "core"] as const).map((layer) => (
                <polyline
                  key={layer}
                  className={`rd-chain-energy-${layer}`}
                  points={chain
                    .map(
                      (cell) => `${(cell.c + 0.5) * 20},${(cell.r + 0.5) * 20}`,
                    )
                    .join(" ")}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
            </svg>
          )}
          {castFeedback && (
            <div
              key={castFeedback.id}
              className="rd-rune-cast"
              data-cast-fx="true"
              aria-hidden="true"
            >
              {castFeedback.cells.map((cell) => (
                <span
                  key={cellKey(cell)}
                  className="rd-cast-fragment"
                  style={{ gridColumn: cell.c + 1, gridRow: cell.r + 1 }}
                >
                  <RuneSigil type={castFeedback.type} />
                </span>
              ))}
            </div>
          )}
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
                  refillVersion={refillVersions[k]}
                  motionEnabled={motionEnabled}
                  selected={isSel}
                  selectionOrder={
                    isSel
                      ? chain.findIndex(
                          (cell) => cell.r === r && cell.c === c,
                        ) + 1
                      : undefined
                  }
                  sealed={isSealed}
                  corrupted={isCorrupted}
                  corruptionSource={isSource}
                  eclipsed={isEclipsed}
                  linked={isLinked}
                  shifting={isShifting}
                  treasure={isTreasure}
                  hazard={isHazard}
                  disabled={disabled}
                  touchAction={controlMode === "drag" ? "none" : "pan-y"}
                  onPointerDown={handlePointerDown(r, c)}
                  onClick={handleCellClick(r, c)}
                />
              );
            }),
          )}
        </div>
      </div>
      <div
        className="rd-chain-command rd-play-board"
        aria-live="polite"
        aria-atomic="true"
      >
        <div
          role="group"
          aria-label="Rune controls"
          className="rd-input-switch"
        >
          {(["drag", "tap"] as const).map((mode) => {
            const Icon = mode === "drag" ? MousePointer2 : Hand;
            return (
              <button
                key={mode}
                type="button"
                aria-pressed={controlMode === mode}
                onClick={() => chooseControlMode(mode)}
                title={`${mode === "drag" ? "Drag" : "Tap"} to connect runes`}
                className={cn(
                  "rd-input-button",
                  controlMode === mode && "is-active",
                )}
              >
                <Icon size={14} aria-hidden />{" "}
                <span>{mode === "drag" ? "Drag" : "Tap"}</span>
              </button>
            );
          })}
        </div>
        <div className="rd-chain-preview">
          <span className="rd-chain-count" data-ready={chain.length >= 3}>
            {chain.length || <RuneSigil type="blue" />}
          </span>
          <div>
            <span className="rd-chain-label">
              {chainType ? RUNE_PREVIEW[chainType].label : "Choose your runes"}
            </span>
            <strong>
              {chainType
                ? chain.length >= 3
                  ? (
                      effectOverride?.[chainType] ??
                      RUNE_PREVIEW[chainType].effect
                    )(chain.length)
                  : `${3 - chain.length} more to connect`
                : controlMode === "tap"
                  ? "Tap a matching path"
                  : "Drag a matching path"}
            </strong>
          </div>
        </div>
        {controlMode === "tap" ? (
          <>
            <button
              type="button"
              onClick={() => updateChain([])}
              disabled={!chain.length || disabled}
              aria-label="Clear selected runes"
              className="rd-chain-clear"
            >
              <RotateCcw size={17} aria-hidden />
            </button>
            <button
              type="button"
              onClick={resolveSelectedChain}
              disabled={chain.length < 3 || disabled}
              className="rd-chain-resolve"
            >
              <Check size={17} aria-hidden /> Cast
            </button>
          </>
        ) : (
          <span className="rd-chain-release">
            {chain.length >= 3 ? "Release to cast" : "3+ to cast"}
          </span>
        )}
      </div>
    </div>
  );
}
