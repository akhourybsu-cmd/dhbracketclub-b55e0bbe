// Rune Delve — Dungeon Path Preview tile
//
// Specialized variant of the level-map cell that swaps the bare numeric
// square for a chamber-shaped tile. Uses the existing RuneLayoutPreview as
// the visual core; renders the level number + difficulty + chamber tag in
// a stacked layout. Designed to slot into the level grid without changing
// the page's overall density.

import { Link } from "react-router-dom";
import { Lock, Check, Crown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { RuneLayoutPreview } from "./RuneLayoutPreview";
import type { RuneLayout } from "@/lib/runedelve/runeLayouts";

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
  // Rune Delve tile uses warm torchlit stone — explicitly different from
  // Nexus's cold-card tactical tile. All states share a stone-mortar base;
  // the differentiator is the inner gradient + border treatment.
  const baseStyle: React.CSSProperties = {
    background: "linear-gradient(160deg, hsl(22 32% 12%), hsl(20 38% 6%))",
    borderColor: "hsl(30 35% 22%)",
    borderWidth: "1px",
    borderStyle: "solid",
  };

  if (!isUnlocked) {
    baseStyle.background =
      "linear-gradient(160deg, hsl(22 20% 10%), hsl(20 22% 5%))";
    baseStyle.borderColor = "hsl(30 18% 18%)";
    baseStyle.opacity = 1; // we use a wrapper opacity instead
  } else if (isCleared) {
    baseStyle.background =
      "radial-gradient(ellipse 80% 90% at 50% 0%, hsl(140 50% 22% / 0.45), transparent 70%), linear-gradient(160deg, hsl(22 32% 12%), hsl(20 38% 6%))";
    baseStyle.borderColor = "hsl(140 60% 40%)";
    baseStyle.boxShadow =
      "0 0 10px -4px hsl(140 70% 35% / 0.4), inset 0 1px 0 hsl(140 50% 50% / 0.15)";
  } else if (isMilestone) {
    baseStyle.background =
      "radial-gradient(ellipse 80% 90% at 50% 0%, hsl(45 100% 50% / 0.18), transparent 70%), linear-gradient(160deg, hsl(28 45% 16%), hsl(22 50% 8%))";
    baseStyle.borderColor = "hsl(45 95% 55% / 0.7)";
    baseStyle.boxShadow =
      "0 0 16px -4px hsl(40 100% 50% / 0.5), inset 0 1px 0 hsl(45 100% 70% / 0.2)";
  } else if (isCurrent) {
    baseStyle.background = `radial-gradient(ellipse 80% 90% at 50% 0%, hsl(${layout.preview.accent} / 0.22), transparent 70%), linear-gradient(160deg, hsl(28 38% 14%), hsl(20 42% 7%))`;
    baseStyle.borderColor = `hsl(${layout.preview.accent} / 0.6)`;
    baseStyle.boxShadow = `0 0 18px -4px hsl(28 90% 45% / 0.5), inset 0 1px 0 hsl(40 70% 60% / 0.18)`;
  } else {
    baseStyle.background = `radial-gradient(ellipse 80% 90% at 50% 0%, hsl(${layout.preview.accent} / 0.10), transparent 70%), linear-gradient(160deg, hsl(22 30% 11%), hsl(20 35% 6%))`;
    baseStyle.borderColor = `hsl(${layout.preview.accent} / 0.3)`;
    baseStyle.boxShadow = "inset 0 1px 0 hsl(40 60% 50% / 0.06)";
  }

  const tileClass = cn(
    "relative aspect-square rounded-xl p-1.5 flex flex-col items-center justify-between btn-press overflow-hidden w-full",
    !isUnlocked && "opacity-40 cursor-not-allowed",
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

      {/* Current-level pulse ring */}
      {isCurrent && (
        <span
          className="absolute inset-0 rounded-xl pointer-events-none animate-pulse"
          style={{
            boxShadow: `inset 0 0 0 1.5px hsl(${layout.preview.accent} / 0.7)`,
          }}
        />
      )}

      {/* Layout preview at the top */}
      <div className="mt-1 flex-shrink-0 opacity-90">
        <RuneLayoutPreview layout={layout} size="sm" pulse={isCurrent} />
      </div>

      {/* Level number + tier dots */}
      <div className="flex flex-col items-center mt-auto">
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
      aria-label={label}
    >
      {content}
    </button>
  );
}
