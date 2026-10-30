import { Sparkles, Check } from "lucide-react";
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
import { useSheetSfx } from "@/hooks/useSheetSfx";
import { useRuneDialogFocus } from "./useRuneDialogFocus";
import { RunePager } from "./RunePager";
import "./runeDialogs.css";

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
  const [page, setPage] = useState(0);
  useEffect(() => {
    if (open) setPage(0);
  }, [open, relic?.id]);
  if (!relic) return null;
  const current = clampRank(currentRank);
  const isMax = current >= MAX_RANK;
  const next = Math.min(MAX_RANK, current + 1);
  const cost = isMax ? 0 : rankCost(relic.cost, next);
  const canAfford = shards >= cost;
  const rank = page === 0 ? current : next;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        {...focus}
        side="bottom"
        className="rd-dialog-theme rd-paged-dialog"
      >
        <SheetHeader className="rd-dialog-header">
          <SheetTitle className="rd-title">
            {relic.icon} {relic.name}
          </SheetTitle>
          <SheetDescription>
            {CATEGORY_META[relic.category].label} · Tier {relic.tier} · Rank{" "}
            {current}/{MAX_RANK}
          </SheetDescription>
        </SheetHeader>
        <article className="rd-dialog-body rd-dialog-card" aria-live="polite">
          <p className="rd-dialog-eyebrow">
            {page === 0 ? "Current" : "After upgrade"} · R{rank}
          </p>
          <h3>
            {RANK_EFFECTS[relic.id]
              ? formatEffect(relic.id, effectValue(relic.id, rank))
              : relic.name}
          </h3>
          <p>{describeRelicAtRank(relic, rank)}</p>
          {page === 1 && (
            <p>
              Upgrade R{current} → R{next}: {cost} shards.
            </p>
          )}
        </article>
        <RunePager
          page={page}
          pageCount={isMax ? 1 : 2}
          onPageChange={setPage}
          label="Relic comparison"
        />
        <div className="rd-dialog-actions">
          {isMax ? (
            <button
              type="button"
              className="rd-dialog-secondary"
              onClick={() => onOpenChange(false)}
            >
              <Check size={16} /> Max rank reached · Done
            </button>
          ) : (
            <Button
              className="rd-dialog-primary"
              disabled={!canAfford || pending}
              onClick={onConfirm}
            >
              <Sparkles size={16} />{" "}
              {pending ? "Upgrading…" : `Upgrade to R${next} · ${cost}`}
            </Button>
          )}
          <p className="rd-dialog-balance">
            Balance: {shards} shards
            {!isMax && !canAfford ? ` · Need ${cost - shards} more` : ""}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
