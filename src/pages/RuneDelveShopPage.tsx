import { Gem, Shield } from "lucide-react";
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
import { RunePager } from "@/components/runedelve/RunePager";
import { useRuneViewport } from "@/hooks/useRuneViewport";
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
  const viewport = useRuneViewport();
  const [page, setPage] = useState(0);
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

  const pageSize = viewport.landscape
    ? 2
    : viewport.short
      ? 1
      : viewport.width >= 700
        ? 6
        : 2;
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  return (
    <div className="rd-screen rd-menu-page rd-fit-menu rd-shop-page">
      <div className="rd-menu-heading">
        <h1 className="rd-title">Relic Forge</h1>
        <Link to="/rune-delve/armory" className="rd-menu-link">
          <Shield size={14} /> Armory
        </Link>
      </div>
      <div className="rd-shop-workspace">
        <aside className="rd-shop-filters" aria-label="Relic filters">
          <div className="rd-menu-surface rd-forge-ledger">
            <div>
              <span className="rd-menu-note">Rune shards</span>
              <ShardBalance shards={shards} />
            </div>
            <span className="rd-menu-note">
              <strong className="text-foreground">
                {ownedMap.size}/{RELIC_CATALOG.length}
              </strong>{" "}
              collected
            </span>
          </div>
          <div className="rd-shop-filter-controls">
            <label className="sr-only" htmlFor="rd-relic-tier">
              Relic tier
            </label>
            <select
              id="rd-relic-tier"
              value={tier}
              onChange={(event) => {
                setTier(Number(event.target.value) as RelicTier);
                setPage(0);
              }}
            >
              {TIERS.map((t) => (
                <option key={t} value={t}>
                  Tier {t}
                  {!tierUnlockedForChapter(t, currentChapter)
                    ? " · Locked"
                    : ""}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="rd-relic-category">
              Relic category
            </label>
            <select
              id="rd-relic-category"
              value={cat}
              onChange={(event) => {
                setCat(event.target.value as typeof cat);
                setPage(0);
              }}
            >
              {CATS.map((c) => (
                <option key={c} value={c}>
                  {c === "all" ? "All relics" : CATEGORY_META[c].label}
                </option>
              ))}
            </select>
          </div>
          <p className="rd-menu-note">
            {unlockedTier
              ? "Unlock. Upgrade. Build your edge."
              : `Unlocks in Chapter ${tier}`}
          </p>
        </aside>
        <section
          className="rd-page-stack rd-shop-collection"
          aria-label="Relic catalog"
        >
          {visible.length ? (
            <div
              className="rd-relic-grid rd-fit-relic-grid"
              data-rows={pageSize > 3 ? 2 : 1}
              data-cols={pageSize === 6 ? 3 : pageSize === 1 ? 1 : 2}
              key={`${tier}-${cat}`}
            >
              {visible
                .slice(currentPage * pageSize, (currentPage + 1) * pageSize)
                .map((relic) => {
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
          ) : (
            <div className="rd-menu-surface rd-empty-collection">
              <Gem className="h-7 w-7 text-primary" />
              <p className="rd-menu-note">
                No relics in this category and tier.
              </p>
            </div>
          )}
          <RunePager
            page={currentPage}
            pageCount={pageCount}
            onPageChange={setPage}
            label="Relics"
          />
        </section>
      </div>
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
