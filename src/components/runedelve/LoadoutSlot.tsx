import { Lock, Plus, X } from "lucide-react";
import type { RelicDef } from "@/lib/runedelve/relics";
import { CATEGORY_META } from "@/lib/runedelve/relics";
import { cn } from "@/lib/utils";
import { RelicGlyph } from "./RelicGlyph";
import "./runeMenus.css";

interface Props {
  relic: RelicDef | null;
  locked?: boolean;
  unlockHint?: string; // e.g. "Reach Lv 25"
  /** Optional rank (1..5) for the equipped relic. */
  rank?: number;
  onClick?: () => void;
  onClear?: () => void;
  disabled?: boolean;
  slotNumber?: number;
}

export function LoadoutSlot({
  relic,
  locked,
  unlockHint,
  rank,
  onClick,
  onClear,
  disabled,
  slotNumber,
}: Props) {
  if (locked) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 p-3 flex flex-col items-center justify-center text-center min-h-[88px] opacity-80 bg-muted/15">
        <Lock className="w-4 h-4 text-foreground/60 mb-1" />
        <p className="text-[11px] font-extrabold text-foreground/75">
          {unlockHint ?? "Locked"}
        </p>
      </div>
    );
  }
  if (!relic) {
    return (
      <button
        type="button"
        disabled={disabled || !onClick}
        onClick={onClick}
        aria-label="Choose a relic for this empty slot"
        aria-description={slotNumber ? `Slot ${slotNumber}` : undefined}
        className="w-full rounded-xl border border-dashed border-border/70 p-3 flex flex-col items-center justify-center text-center min-h-[88px] btn-press hover:border-primary/40 transition-colors bg-muted/10"
      >
        <Plus className="w-4 h-4 text-foreground/60 mb-1" />
        <p className="text-[11px] font-extrabold text-foreground/75">
          {slotNumber ? `Slot ${slotNumber} · Empty` : "Empty slot"}
        </p>
      </button>
    );
  }
  const cat = CATEGORY_META[relic.category];
  const tierToken =
    relic.tier === 1 ? "--primary" : relic.tier === 2 ? "--accent" : "--gold";
  return (
    <div
      className={cn(
        "relative rounded-xl border p-3 flex flex-col items-center justify-center text-center min-h-[88px]",
      )}
      style={{
        background: `linear-gradient(135deg, hsl(var(${tierToken}) / .1), hsl(var(--card)))`,
        borderColor: `hsl(var(${tierToken}) / .4)`,
      }}
    >
      {onClear && (
        <button
          onClick={onClear}
          aria-label={`Unequip ${relic.name}`}
          type="button"
          disabled={disabled}
          className="absolute top-0 right-0 w-11 h-11 rounded-full bg-background/60 flex items-center justify-center hover:bg-destructive/30 btn-press z-10 disabled:opacity-50"
        >
          <X className="w-3 h-3" />
        </button>
      )}
      <button
        type="button"
        className="rd-loadout-slot-choice w-full min-h-11 flex flex-col items-center justify-center rounded-lg"
        aria-label={`Choose a replacement for ${relic.name}${slotNumber ? ` in slot ${slotNumber}` : ""}`}
        onClick={onClick}
        disabled={disabled || !onClick}
      >
        <div className="relative">
          <RelicGlyph
            relic={relic}
            className="!h-11 !w-11 !rounded-xl mb-2 [&>svg]:!h-6 [&>svg]:!w-6"
          />
          {rank != null && rank > 1 && (
            <span
              className="absolute -top-2 -right-3 min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-extrabold flex items-center justify-center tabular-nums shadow-sm"
              style={{
                background: "hsl(var(--gold))",
                color: "hsl(var(--background))",
              }}
            >
              R{rank}
            </span>
          )}
        </div>
        <p
          className="font-extrabold text-[12px] leading-tight line-clamp-2 break-words w-full px-1 text-foreground"
          title={relic.name}
        >
          {relic.name}
        </p>
      </button>
      <p className="text-[10px] font-bold text-foreground/65 mt-0.5">
        {cat.label}
      </p>
    </div>
  );
}
