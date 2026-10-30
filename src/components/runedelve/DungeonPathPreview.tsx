// Rune Delve — Dungeon Path Preview tile
//
// Specialized variant of the level-map cell that swaps the bare numeric
// square for a chamber-shaped tile. Uses the existing RuneLayoutPreview as
// the visual core; renders the level number + difficulty + chamber tag in
// a stacked layout. Designed to slot into the level grid without changing
// the page's overall density.

import { Link } from "react-router-dom";
import type { CSSProperties } from "react";
import { Lock, Check, Crown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { RuneLayoutPreview } from "./RuneLayoutPreview";
import type { RuneLayout } from "@/lib/runedelve/runeLayouts";
import "./runeMenus.css";

interface Props {
  levelNumber: number;
  layout: RuneLayout;
  /** 1–5 stars from the existing difficultyTierFor() helper. */
  tier: number;
  isUnlocked: boolean;
  isCleared: boolean;
  isCurrent: boolean;
  isMilestone: boolean;
  isOpener: boolean;
  /** Optional emoji icon for the introduced mechanic on this level. */
  mechanicIcon?: string;
  mechanicLabel?: string;
  introducesMechanic?: boolean;
  /** Optional secondary objective / boss-rule corner glyph. */
  cornerGlyph?: string | null;
  onSelect?: () => void;
}

export function DungeonPathPreview({
  levelNumber,
  layout,
  tier,
  isUnlocked,
  isCleared,
  isCurrent,
  isMilestone,
  isOpener,
  mechanicIcon,
  mechanicLabel,
  introducesMechanic,
  cornerGlyph,
  onSelect,
}: Props) {
  const state = !isUnlocked
    ? "locked"
    : isCleared
      ? "cleared"
      : isCurrent
        ? "current"
        : isMilestone
          ? "milestone"
          : "open";
  const baseStyle = { "--path-accent": layout.preview.accent } as CSSProperties;
  const tileClass = cn(
    "rd-path-tile relative aspect-square p-1.5 flex flex-col items-center justify-between w-full",
    !isUnlocked && "cursor-not-allowed",
  );
  const label = `Level ${levelNumber} · ${layout.name}${!isUnlocked ? " (locked)" : ""}${isMilestone ? " (milestone)" : ""}`;
  const content = (
    <>
      {/* Status icons */}
      {!isUnlocked && (
        <Lock className="w-3 h-3 text-muted-foreground absolute top-1 right-1" />
      )}
      {isCleared && (
        <Check
          className="w-3 h-3 absolute top-1 right-1"
          style={{ color: "hsl(var(--success))" }}
        />
      )}
      {isMilestone && !isCleared && isUnlocked && (
        <Crown
          className="w-3 h-3 absolute top-1 right-1"
          style={{ color: "hsl(var(--gold))" }}
        />
      )}
      {isOpener && isUnlocked && !mechanicIcon && (
        <Sparkles
          className="w-3 h-3 absolute top-1 left-1"
          style={{ color: "hsl(var(--accent))" }}
        />
      )}

      {/* Mechanic glyph */}
      {mechanicIcon && isUnlocked && (
        <span
          className="absolute top-0.5 left-0.5 inline-flex items-center justify-center w-4 h-4 rounded-md bg-background/70 border border-primary/30 text-[10px] leading-none"
          title={mechanicLabel}
          aria-label={`Mechanic: ${mechanicLabel}`}
        >
          {mechanicIcon}
        </span>
      )}
      {introducesMechanic && isUnlocked && (
        <span className="absolute -top-1 -left-1 px-1 py-px rounded-sm text-[7px] font-extrabold uppercase tracking-wider bg-primary text-primary-foreground shadow z-10">
          New
        </span>
      )}

      {/* Current chamber engraving */}
      {isCurrent && (
        <span
          className="rd-path-current"
          aria-hidden="true"
        />
      )}

      {/* Layout preview at the top */}
      <div className="rd-path-layout">
        <RuneLayoutPreview layout={layout} size="sm" />
      </div>

      {/* Level number + tier dots */}
      <div className="rd-path-number flex flex-col items-center mt-auto">
        <span
          className={cn(
            "rd-title text-[15px] font-extrabold tabular-nums leading-none",
            isCurrent && "text-primary",
            isMilestone && !isCleared && isUnlocked && "text-gold",
          )}
        >
          {levelNumber}
        </span>
        <div className="flex gap-0.5 mt-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <span
              key={i}
              className="w-1 h-1 rounded-full"
              style={{
                background:
                  i < tier ? "hsl(var(--gold))" : "hsl(var(--muted) / 0.5)",
              }}
            />
          ))}
        </div>
      </div>

      {cornerGlyph && isUnlocked && (
        <span
          className="absolute bottom-0.5 right-0.5 text-[10px] leading-none"
          aria-hidden
        >
          {cornerGlyph}
        </span>
      )}
    </>
  );

  return isUnlocked && !onSelect ? (
    <Link
      to={`/rune-delve/play/${levelNumber}`}
      className={tileClass}
      style={baseStyle}
      data-state={state}
      aria-label={label}
    >
      {content}
    </Link>
  ) : (
    <button
      type="button"
      disabled={!isUnlocked}
      onClick={onSelect}
      className={tileClass}
      style={baseStyle}
      data-state={state}
      aria-label={label}
    >
      {content}
    </button>
  );
}
