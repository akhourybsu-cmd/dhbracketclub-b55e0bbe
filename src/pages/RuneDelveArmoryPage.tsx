import { Link } from "react-router-dom";
import { ArrowRight, Shield, ShoppingBag, Sparkles } from "lucide-react";
import { useState, useMemo, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useRuneDelveHero } from "@/hooks/useRuneDelveHero";
import { useRuneWallet, useUnlockSlot } from "@/hooks/useRuneShards";
import { useRelicCollection } from "@/hooks/useRelicCollection";
import { useLoadout, useUpdateLoadout } from "@/hooks/useLoadout";
import {
  slotsForClassLevels,
  THIRD_SLOT_UNLOCK_LEVEL,
} from "@/lib/runedelve/shardEconomy";
import { useAllClassProgress } from "@/hooks/useRuneDelveClassProgress";
import {
  CLASS_LIST,
  getClass,
  type HeroClass,
} from "@/lib/runedelve/classConfig";
import { RELIC_BY_ID, RELIC_CATALOG } from "@/lib/runedelve/relics";
import { RuneHeroArt } from "@/components/runedelve/RuneArtwork";
import { LoadoutSlot } from "@/components/runedelve/LoadoutSlot";
import { RelicCard } from "@/components/runedelve/RelicCard";
import { ShardBalance } from "@/components/runedelve/ShardBalance";
import { useRuneDelveSfx } from "@/hooks/useRuneDelveSfx";
import { useMyProgress } from "@/hooks/useRuneDelveCampaign";
import { buildCharacterSheet } from "@/lib/runedelve/characterStats";
import { RuneBuildPages } from "@/components/runedelve/RuneBuildPages";
import { RunePager } from "@/components/runedelve/RunePager";
import { useRuneViewport } from "@/hooks/useRuneViewport";
import { RuneDataState } from "@/components/runedelve/RuneDataState";
import "@/components/runedelve/runeMenus.css";

export default function RuneDelveArmoryPage() {
  const heroQuery = useRuneDelveHero();
  const walletQuery = useRuneWallet();
  const collectionQuery = useRelicCollection();
  const tracksQuery = useAllClassProgress();
  const { data: hero } = heroQuery;
  const { data: wallet } = walletQuery;
  const { data: owned } = collectionQuery;
  const { data: tracks } = tracksQuery;
  const updateLoadout = useUpdateLoadout();
  const unlockSlot = useUnlockSlot();
  const { play: rdSfx } = useRuneDelveSfx();
  const [activeClass, setActiveClass] = useState<HeroClass | null>(null);
  const [view, setView] = useState<"loadout" | "relics" | "stats">("loadout");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const viewport = useRuneViewport();
  const [page, setPage] = useState(0);
  const cls = activeClass ?? hero?.class ?? "warrior";
  const loadoutQuery = useLoadout(cls);
  const { data: loadout } = loadoutQuery;
  const { data: campaignProgress } = useMyProgress(cls);

  const maxClassLevel = Math.max(
    hero?.level ?? 1,
    ...(tracks ?? []).map((t) => t.level),
  );
  const desiredSlots = slotsForClassLevels(maxClassLevel);
  useEffect(() => {
    if (
      !wallet ||
      desiredSlots <= wallet.slots_unlocked ||
      unlockSlot.isPending ||
      unlockSlot.isError
    )
      return;
    unlockSlot.mutate(desiredSlots, {
      onSuccess: () => toast.success("Third relic slot unlocked"),
    });
  }, [wallet, desiredSlots, unlockSlot]);

  const slotsUnlocked = wallet?.slots_unlocked ?? 2;
  const ownedIds = useMemo(
    () => new Set((owned ?? []).map((o) => o.relic_id)),
    [owned],
  );
  const rankById = useMemo(
    () => new Map((owned ?? []).map((o) => [o.relic_id, o.rank ?? 1])),
    [owned],
  );
  const ownedRelics = useMemo(
    () => RELIC_CATALOG.filter((r) => ownedIds.has(r.id)),
    [ownedIds],
  );
  const equipped = [
    loadout?.slot_1 ?? null,
    loadout?.slot_2 ?? null,
    loadout?.slot_3 ?? null,
  ];
  const classTrack = tracks?.find((t) => t.class === cls);
  const characterSheet = buildCharacterSheet({
    cls,
    classLevel: classTrack?.level ?? (hero?.class === cls ? hero.level : 1),
    campaignLevel:
      classTrack?.highest_unlocked_level ??
      campaignProgress?.highest_unlocked_level ??
      1,
    slots: equipped,
    rankById,
  });
  const save = async (slots: (string | null)[]) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await updateLoadout.mutateAsync({
        cls,
        slot_1: slots[0] ?? null,
        slot_2: slots[1] ?? null,
        slot_3: slots[2] ?? null,
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update loadout",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const equip = async (relicId: string) => {
    if (savingRef.current) return;
    if (equipped.includes(relicId)) {
      rdSfx("ui.tap");
      await save(equipped.map((s) => (s === relicId ? null : s)));
      return;
    }
    const firstEmpty = equipped.findIndex(
      (s, i) => s === null && i < slotsUnlocked,
    );
    if (firstEmpty === -1) {
      rdSfx("rune.invalid");
      toast("Remove a relic from your loadout to make room.");
      return;
    }
    const next = [...equipped];
    next[firstEmpty] = relicId;
    rdSfx("relic.equip");
    await save(next);
  };
  const queries = [heroQuery, walletQuery, collectionQuery, loadoutQuery];
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
  const pageCount = Math.max(1, Math.ceil(ownedRelics.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  return (
    <div
      className="rd-screen rd-menu-page rd-fit-menu rd-armory-page"
      data-class={cls}
    >
      <div className="rd-menu-heading">
        <h1 className="rd-title">Armory</h1>
        <label className="sr-only" htmlFor="rd-armory-class">
          Loadout class
        </label>
        <select
          id="rd-armory-class"
          aria-label="Loadout class"
          value={cls}
          disabled={saving}
          onChange={(event) => {
            setActiveClass(event.target.value as HeroClass);
            setPage(0);
          }}
          className="rd-class-select"
        >
          {CLASS_LIST.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <Link to="/rune-delve/shop" className="rd-menu-link">
          <ShoppingBag size={14} /> Shop
        </Link>
      </div>
      <div
        role="tablist"
        aria-label="Armory view"
        className="rd-menu-tabs rd-fit-tabs grid-cols-3"
      >
        <button
          type="button"
          role="tab"
          aria-selected={view === "loadout"}
          onClick={() => setView("loadout")}
        >
          Loadout
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "relics"}
          onClick={() => setView("relics")}
        >
          Collection · {ownedRelics.length}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "stats"}
          onClick={() => setView("stats")}
        >
          Combat stats
        </button>
      </div>
      <div className="rd-fit-content">
        {view === "loadout" ? (
          <div className="rd-loadout-view">
            <section
              className="rd-menu-surface rd-loadout-display space-y-3"
              aria-label={`${getClass(cls).name} loadout`}
            >
              <RuneHeroArt cls={cls} className="rd-active-armory-art" />
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-extrabold flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />{" "}
                  {getClass(cls).name} loadout
                </h2>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {equipped.filter((s, i) => s && i < slotsUnlocked).length}/
                  {slotsUnlocked}
                </span>
              </div>
              <div className="rd-loadout-slots grid grid-cols-3 gap-2">
                {[0, 1, 2].map((i) => {
                  const relic = equipped[i]
                    ? (RELIC_BY_ID[equipped[i]!] ?? null)
                    : null;
                  return (
                    <LoadoutSlot
                      key={i}
                      relic={relic}
                      rank={relic ? rankById.get(relic.id) : undefined}
                      locked={i >= slotsUnlocked}
                      disabled={saving}
                      unlockHint={`Class Lv ${THIRD_SLOT_UNLOCK_LEVEL}`}
                      onClick={() => {
                        setView("relics");
                        setPage(0);
                      }}
                      onClear={
                        relic
                          ? () => {
                              const next = [...equipped];
                              next[i] = null;
                              void save(next);
                            }
                          : undefined
                      }
                    />
                  );
                })}
              </div>
              {saving && (
                <p className="rd-menu-note" role="status">
                  Saving loadout…
                </p>
              )}
            </section>
            <button
              type="button"
              className="rd-menu-link"
              onClick={() => setView("relics")}
            >
              Choose relics <ArrowRight size={14} />
            </button>
            <Link to="/rune-delve/shop" className="rd-menu-link">
              <ShardBalance shards={wallet?.shards ?? 0} />
              <span className="ml-auto">Upgrade</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        ) : view === "stats" ? (
          <RuneBuildPages key={cls} sheet={characterSheet} />
        ) : (
          <section
            className="rd-page-stack rd-owned-relics"
            aria-label="Owned relic collection"
          >
            {ownedRelics.length ? (
              <div
                className="rd-relic-grid rd-fit-relic-grid"
                data-rows={pageSize > 3 ? 2 : 1}
                data-cols={pageSize === 6 ? 3 : pageSize === 1 ? 1 : 2}
              >
                {ownedRelics
                  .slice(currentPage * pageSize, (currentPage + 1) * pageSize)
                  .map((relic) => (
                    <RelicCard
                      key={relic.id}
                      relic={relic}
                      intent="equip"
                      state={equipped.includes(relic.id) ? "equipped" : "owned"}
                      rank={rankById.get(relic.id)}
                      disabled={saving}
                      onClick={() => void equip(relic.id)}
                    />
                  ))}
              </div>
            ) : (
              <div className="rd-menu-surface rd-empty-collection">
                <Sparkles className="h-7 w-7 text-primary" />
                <h2 className="font-extrabold">Your first build starts here</h2>
                <p className="rd-menu-note">
                  Find relics in the dungeon or unlock them with shards.
                </p>
                <Link to="/rune-delve/shop" className="rd-menu-link">
                  Browse relics <ArrowRight size={14} />
                </Link>
              </div>
            )}
            <RunePager
              page={currentPage}
              pageCount={pageCount}
              onPageChange={setPage}
              label="Relics"
            />
          </section>
        )}
      </div>
    </div>
  );
}
