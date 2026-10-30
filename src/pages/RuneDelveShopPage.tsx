import { Gem, Shield, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useMemo, useRef } from "react";
import { toast } from "sonner";
import { useSoundEffect } from "@/hooks/useSoundEffect";
import { useRuneDelveSfx } from "@/hooks/useRuneDelveSfx";
import { useRuneWallet } from "@/hooks/useRuneShards";
import {
  useRelicCollection,
  usePurchaseRelic,
  usePurchaseRelicUpgrade,
} from "@/hooks/useRelicCollection";
import { useMyProgress } from "@/hooks/useRuneDelveCampaign";
import { useRuneDelveHero } from "@/hooks/useRuneDelveHero";
import {
  RELIC_CATALOG,
  CATEGORY_META,
  tierUnlockedForChapter,
  MAX_RANK,
  type RelicCategory,
  type RelicTier,
  type RelicDef,
} from "@/lib/runedelve/relics";
import { chapterFor } from "@/lib/runedelve/levelGenerator";
import { RelicCard } from "@/components/runedelve/RelicCard";
import { RelicUpgradeSheet } from "@/components/runedelve/RelicUpgradeSheet";
import { ShardBalance } from "@/components/runedelve/ShardBalance";
import { RuneDataState } from "@/components/runedelve/RuneDataState";
import "@/components/runedelve/runeMenus.css";

const TIERS: RelicTier[] = [1, 2, 3];
const CATS: (RelicCategory | "all")[] = [
  "all",
  "offense",
  "mana",
  "survival",
  "board",
  "tempo",
  "objective",
];

export default function RuneDelveShopPage() {
  const walletQuery = useRuneWallet();
  const ownedQuery = useRelicCollection();
  const heroQuery = useRuneDelveHero();
  const { data: wallet } = walletQuery;
  const { data: owned } = ownedQuery;
  const { data: hero } = heroQuery;
  const progressQuery = useMyProgress(hero?.class);
  const { data: progress } = progressQuery;
  const purchase = usePurchaseRelic();
  const upgrade = usePurchaseRelicUpgrade();
  const sfx = useSoundEffect();
  const { play: rdSfx } = useRuneDelveSfx();
  const [tier, setTier] = useState<RelicTier>(1);
  const [cat, setCat] = useState<RelicCategory | "all">("all");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [upgradeRelic, setUpgradeRelic] = useState<RelicDef | null>(null);
  const pendingRef = useRef(false);
  const ownedMap = useMemo(
    () => new Map((owned ?? []).map((o) => [o.relic_id, o.rank ?? 1])),
    [owned],
  );
  const shards = wallet?.shards ?? 0;
  const currentChapter = chapterFor(progress?.highest_unlocked_level ?? 1);
  const unlockedTier = tierUnlockedForChapter(tier, currentChapter);
  const visible = useMemo(
    () =>
      RELIC_CATALOG.filter(
        (r) => r.tier === tier && (cat === "all" || r.category === cat),
      ).sort((a, b) => a.cost - b.cost),
    [tier, cat],
  );

  async function buy(relic: RelicDef) {
    if (pendingRef.current || ownedMap.has(relic.id) || !unlockedTier) return;
    if (shards < relic.cost) {
      toast(`Need ${relic.cost - shards} more shards`);
      return;
    }
    pendingRef.current = true;
    setPendingId(relic.id);
    try {
      await purchase.mutateAsync({
        relic_id: relic.id,
        level: progress?.highest_unlocked_level ?? 1,
      });
      sfx.play("achievement");
      rdSfx("relic.equip");
      toast.success(`${relic.name} unlocked`, {
        description: "Ready to equip in the Armory.",
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not complete purchase. Try again.",
      );
    } finally {
      pendingRef.current = false;
      setPendingId(null);
    }
  }
  async function confirmUpgrade() {
    if (!upgradeRelic || pendingRef.current) return;
    const expectedRank = ownedMap.get(upgradeRelic.id) ?? 1;
    if (expectedRank >= MAX_RANK) return;
    pendingRef.current = true;
    setPendingId(upgradeRelic.id);
    try {
      await upgrade.mutateAsync({
        relic_id: upgradeRelic.id,
        expected_rank: expectedRank,
      });
      sfx.play("success");
      rdSfx("levelup.fanfare");
      toast.success(`${upgradeRelic.name} · Rank ${expectedRank + 1}`);
      setUpgradeRelic(null);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not upgrade relic. Try again.",
      );
    } finally {
      pendingRef.current = false;
      setPendingId(null);
    }
  }
  const queries = [walletQuery, ownedQuery, heroQuery, progressQuery];
  if (queries.some((q) => q.isError))
    return (
      <RuneDataState
        error
        onRetry={() => queries.forEach((q) => void q.refetch())}
      />
    );
  if (!hero || queries.some((q) => q.isLoading))
    return (
      <RuneDataState onRetry={() => queries.forEach((q) => void q.refetch())} />
    );

  return (
    <div className="space-y-4 pb-5">
      <div className="rd-menu-heading">
        <h1 className="rd-title">Relic Forge</h1>
        <Link to="/rune-delve/armory" className="rd-menu-link">
          <Shield className="h-4 w-4" /> Armory
        </Link>
      </div>
      <div className="rd-menu-surface flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
            Rune shards
          </p>
          <ShardBalance shards={shards} />
        </div>
        <span className="text-[11px] text-muted-foreground text-right">
          <strong className="block text-base text-foreground">
            {ownedMap.size}
            <span className="text-muted-foreground text-[11px]">
              /{RELIC_CATALOG.length}
            </span>
          </strong>
          relics collected
        </span>
      </div>
      <div
        role="tablist"
        aria-label="Relic tier"
        className="rd-menu-tabs grid-cols-3"
      >
        {TIERS.map((t) => (
          <button
            type="button"
            role="tab"
            aria-selected={tier === t}
            key={t}
            onClick={() => setTier(t)}
            className="flex items-center justify-center gap-1.5"
          >
            {!tierUnlockedForChapter(t, currentChapter) && (
              <Lock className="h-3 w-3" />
            )}{" "}
            Tier {t}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3 justify-between">
        <p className="rd-menu-note">
          {unlockedTier
            ? "Unlock. Upgrade. Build your edge."
            : `Unlocks in Chapter ${tier}`}
        </p>
        <label className="sr-only" htmlFor="rd-relic-category">
          Relic category
        </label>
        <select
          id="rd-relic-category"
          value={cat}
          onChange={(e) => setCat(e.target.value as typeof cat)}
          className="min-h-11 max-w-[48%] min-w-0 rounded-xl border border-border/60 bg-card px-3 text-[11px] font-bold"
        >
          {CATS.map((c) => (
            <option key={c} value={c}>
              {c === "all" ? "All relics" : CATEGORY_META[c].label}
            </option>
          ))}
        </select>
      </div>
      <div className="rd-relic-grid" key={`${tier}-${cat}`}>
        {visible.map((relic) => {
          const alreadyOwned = ownedMap.has(relic.id);
          return (
            <RelicCard
              key={relic.id}
              relic={relic}
              shards={shards}
              rank={ownedMap.get(relic.id)}
              state={
                !unlockedTier && !alreadyOwned
                  ? "locked-tier"
                  : alreadyOwned
                    ? "owned"
                    : shards >= relic.cost
                      ? "affordable"
                      : "unaffordable"
              }
              disabled={!!pendingId}
              onClick={() =>
                alreadyOwned ? setUpgradeRelic(relic) : void buy(relic)
              }
            />
          );
        })}
      </div>
      {!visible.length && (
        <div className="rd-menu-surface text-center py-8">
          <Gem className="mx-auto h-7 w-7 text-primary mb-3" />
          <p className="rd-menu-note">No relics in this category and tier.</p>
        </div>
      )}
      <RelicUpgradeSheet
        open={!!upgradeRelic}
        relic={upgradeRelic}
        currentRank={upgradeRelic ? (ownedMap.get(upgradeRelic.id) ?? 1) : 1}
        shards={shards}
        pending={!!pendingId}
        onConfirm={() => void confirmUpgrade()}
        onOpenChange={(open) => {
          if (!open && !pendingRef.current) setUpgradeRelic(null);
        }}
      />
    </div>
  );
}
