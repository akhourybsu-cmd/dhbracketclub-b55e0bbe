import { Sparkles, ArrowRight, Check } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  type RelicDef,
  CATEGORY_META,
  MAX_RANK,
  RANK_EFFECTS,
  rankCost,
  effectValue,
  clampRank,
  describeRelicAtRank,
} from "@/lib/runedelve/relics";
import { cn } from "@/lib/utils";
import { useSheetSfx } from "@/hooks/useSheetSfx";
import { useRuneDialogFocus } from "./useRuneDialogFocus";
import { RelicGlyph } from "./RelicGlyph";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  relic: RelicDef | null;
  currentRank: number;
  shards: number;
  pending?: boolean;
  onConfirm: () => void;
}

const FORMAT_RULES: Record<string, (v: number) => string> = {
  ember_edge: (v) => `×${v.toFixed(2)}`,
  crimson_tide: (v) => `×${v.toFixed(2)}`,
  executioners_mark: (v) => `×${v.toFixed(2)}`,
  desperate_surge: (v) => `×${v.toFixed(2)}`,
  momentum: (v) => `×${v.toFixed(2)}`,
  shrine_ward: (v) => `×${v.toFixed(2)}`,
  wanderers_compass: (v) => `×${v.toFixed(2)}`,
  cracked_crown: (v) => `×${v.toFixed(2)}`,
  verdant_heart: (v) => `${v.toFixed(1)}× length`,
  aether_spark: (v) => `${Math.round(v)} mana`,
  sapphire_flow: (v) => `+${Math.round(v)} mana`,
  first_light: (v) => `${Math.round(v)} free use${v > 1 ? "s" : ""}`,
  iron_resolve: (v) => `${Math.round(v)} turn${v > 1 ? "s" : ""}`,
  bloodbond: (v) => `${Math.round(v)} HP`,
  last_stand: (v) => `${Math.round(v)} use${v > 1 ? "s" : ""}`,
  bulwark: (v) => `+${Math.round(v)} turn${v > 1 ? "s" : ""}`,
  keysight: (v) => `${Math.round(v)} seal${v > 1 ? "s" : ""}`,
  cleansing_touch: (v) => `${Math.round(v)} clear${v > 1 ? "s" : ""}`,
  quickstep: (v) => `+${Math.round(v)} length`,
  foresight: (v) => `${Math.round(v)} turn${v > 1 ? "s" : ""}`,
  // New relics
  mirror_shard: (v) => `×${v.toFixed(2)}`,
  brambleward: (v) => `×${v.toFixed(2)}`,
  vampiric_sigil: (v) => `${Math.round(v * 100)}% lifesteal`,
  rune_echo: (v) => `${Math.round(v * 100)}% echo`,
  foreseers_lens: (v) => `+${Math.round(v)} turn${v > 1 ? "s" : ""}`,
  void_pact: (v) => `×${v.toFixed(2)}`,
  phoenix_heart: (v) => `${Math.round(v * 100)}% HP revive`,
};

function formatEffect(relicId: string, value: number): string {
  const fn = FORMAT_RULES[relicId];
  return fn ? fn(value) : String(value);
}

export function RelicUpgradeSheet({
  open,
  onOpenChange,
  relic,
  currentRank,
  shards,
  pending,
  onConfirm,
}: Props) {
  useSheetSfx(open);
  const focus = useRuneDialogFocus();
  // Reset internal animation state every time the sheet opens
  const [mountedKey, setMountedKey] = useState(0);
  useEffect(() => {
    if (open) setMountedKey((k) => k + 1);
  }, [open, relic?.id]);

  if (!relic) return null;
  const cur = clampRank(currentRank);
  const next = Math.min(MAX_RANK, cur + 1);
  const isMax = cur >= MAX_RANK;
  const cost = isMax ? 0 : rankCost(relic.cost, next);
  const canAfford = shards >= cost;
  const cat = CATEGORY_META[relic.category];

  const hasEffectTable = !!RANK_EFFECTS[relic.id];
  const curVal = hasEffectTable ? effectValue(relic.id, cur) : null;
  const nextVal = hasEffectTable && !isMax ? effectValue(relic.id, next) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        {...focus}
        side="bottom"
        className="rd-dialog-theme rounded-t-3xl border-t border-border/60 px-5 pt-5 pb-7 max-h-[88dvh] overflow-y-auto sm:mx-auto sm:max-w-lg"
      >
        <div key={mountedKey} className="animate-fade-in">
          <SheetHeader className="text-left">
            <div className="flex items-start gap-3">
              <div className="relative shrink-0" aria-hidden>
                <RelicGlyph relic={relic} />
                {cur > 1 && (
                  <span
                    className="absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] px-1 rounded-full text-[10px] font-extrabold flex items-center justify-center tabular-nums"
                    style={{
                      background: "hsl(var(--gold))",
                      color: "hsl(var(--background))",
                      boxShadow: "0 2px 10px hsl(var(--gold) / 0.55)",
                    }}
                  >
                    R{cur}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <SheetTitle className="rd-title text-[18px] font-extrabold tracking-wide leading-tight">
                  {relic.name}
                </SheetTitle>
                <SheetDescription className="text-[12px] mt-0.5">
                  {cat.emoji} {cat.label} · Tier {relic.tier}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <p className="text-[12px] text-foreground/85 leading-snug mt-3">
            {describeRelicAtRank(relic, cur)}
          </p>

          {/* Rank dots */}
          <div className="mt-4 flex items-center gap-1.5">
            {Array.from({ length: MAX_RANK }).map((_, i) => {
              const r = i + 1;
              const filled = r <= cur;
              const isNext = !isMax && r === next;
              return (
                <span
                  key={r}
                  className={cn(
                    "h-3 rounded-full transition-all duration-300",
                    filled
                      ? "w-6"
                      : isNext
                        ? "w-3 animate-pulse"
                        : "w-3 bg-muted/50",
                  )}
                  style={
                    filled
                      ? {
                          background: "hsl(var(--gold))",
                          boxShadow: "0 0 8px hsl(var(--gold) / 0.5)",
                        }
                      : isNext
                        ? {
                            background: "hsl(var(--gold) / 0.25)",
                            boxShadow: "0 0 0 2px hsl(var(--gold) / 0.4)",
                          }
                        : undefined
                  }
                  aria-hidden
                />
              );
            })}
            <span className="ml-2 text-[11px] font-extrabold text-foreground/80 tabular-nums">
              R{cur}/{MAX_RANK}
            </span>
          </div>

          {/* Effect delta */}
          {hasEffectTable && (
            <div
              className="mt-4 rounded-2xl border p-4 transition-colors"
              style={{
                background:
                  "linear-gradient(135deg, hsl(var(--card) / 0.9), hsl(var(--muted) / 0.2))",
                borderColor: isMax
                  ? "hsl(var(--border) / 0.5)"
                  : "hsl(var(--gold) / 0.25)",
              }}
            >
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground mb-2">
                Effect
              </p>
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-muted-foreground">
                    Current · R{cur}
                  </p>
                  <p className="rd-title text-[18px] font-extrabold tabular-nums text-foreground leading-tight">
                    {formatEffect(relic.id, curVal!)}
                  </p>
                </div>
                <ArrowRight
                  className={cn(
                    "w-5 h-5 shrink-0 transition-transform",
                    isMax ? "opacity-30" : "text-gold animate-pulse",
                  )}
                />
                <div className="flex-1 min-w-0 text-right">
                  <p className="text-[10px] text-muted-foreground">
                    {isMax ? "Maxed" : `Next · R${next}`}
                  </p>
                  <p
                    className={cn(
                      "rd-title text-[18px] font-extrabold tabular-nums leading-tight",
                      isMax ? "text-muted-foreground" : "text-gold",
                    )}
                    style={
                      !isMax
                        ? { textShadow: "0 0 14px hsl(var(--gold) / 0.45)" }
                        : undefined
                    }
                  >
                    {isMax ? "—" : formatEffect(relic.id, nextVal!)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="mt-5 space-y-2">
            {isMax ? (
              <div className="rounded-xl border border-gold/40 bg-gold/10 p-3 flex items-center justify-center gap-2">
                <Check className="w-4 h-4 text-gold" />
                <p className="text-[13px] font-extrabold text-gold">
                  Max rank reached
                </p>
              </div>
            ) : (
              <>
                <Button
                  onClick={onConfirm}
                  disabled={!canAfford || pending}
                  className={cn(
                    "w-full h-12 rounded-xl text-[14px] font-extrabold gap-2 transition-all",
                    canAfford &&
                      !pending &&
                      "hover:scale-[1.01] active:scale-[0.99]",
                  )}
                  style={
                    canAfford
                      ? {
                          background:
                            "linear-gradient(135deg, hsl(var(--gold)), hsl(45 95% 60%))",
                          color: "hsl(var(--background))",
                          boxShadow: "0 4px 20px hsl(var(--gold) / 0.35)",
                        }
                      : undefined
                  }
                  variant={canAfford ? "default" : "secondary"}
                >
                  <Sparkles
                    className={cn("w-4 h-4", pending && "animate-spin")}
                  />
                  {pending ? "Upgrading…" : `Upgrade to R${next} · ${cost}`}
                </Button>
                {!canAfford && (
                  <p className="text-center text-[11px] font-bold text-destructive">
                    Need {cost - shards} more shards
                  </p>
                )}
                <p className="text-center text-[10px] text-muted-foreground">
                  Your balance:{" "}
                  <span className="tabular-nums font-bold">{shards}</span> ✦
                </p>
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
