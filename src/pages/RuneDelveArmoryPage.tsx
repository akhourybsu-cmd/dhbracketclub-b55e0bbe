import { Link } from 'react-router-dom';
import { ArrowLeft, Sparkles, ShoppingBag } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { useRuneDelveHero } from '@/hooks/useRuneDelveHero';
import { useRuneWallet, useUnlockSlot } from '@/hooks/useRuneShards';
import { useRelicCollection } from '@/hooks/useRelicCollection';
import { useLoadout, useUpdateLoadout } from '@/hooks/useLoadout';
import { slotsForClassLevels, THIRD_SLOT_UNLOCK_LEVEL } from '@/lib/runedelve/shardEconomy';
import { useAllClassProgress } from '@/hooks/useRuneDelveClassProgress';
import { CLASS_LIST, getClass, type HeroClass } from '@/lib/runedelve/classConfig';
import { RELIC_BY_ID, RELIC_CATALOG, type RelicDef } from '@/lib/runedelve/relics';
import { ClassBadge } from '@/components/runedelve/ClassBadge';
import { LoadoutSlot } from '@/components/runedelve/LoadoutSlot';
import { RelicCard } from '@/components/runedelve/RelicCard';
import { ShardBalance } from '@/components/runedelve/ShardBalance';
import { cn } from '@/lib/utils';
import { useRuneDelveSfx } from '@/hooks/useRuneDelveSfx';
import { useMyProgress } from '@/hooks/useRuneDelveCampaign';
import { buildCharacterSheet } from '@/lib/runedelve/characterStats';
import { CharacterPowerPanel } from '@/components/runedelve/CharacterPowerPanel';

export default function RuneDelveArmoryPage() {
  const { data: hero } = useRuneDelveHero();
  const { data: wallet } = useRuneWallet();
  const { data: owned } = useRelicCollection();
  const { data: tracks } = useAllClassProgress();
  const updateLoadout = useUpdateLoadout();
  const unlockSlot = useUnlockSlot();
  const { play: rdSfx } = useRuneDelveSfx();

  // Backfill: if the player has already crossed the class-level threshold
  // (e.g. from prior campaign runs before slot unlock was wired into endless),
  // open the 3rd slot the next time they visit the Armory.
  useEffect(() => {
    if (!wallet || !tracks) return;
    const maxClassLevel = Math.max(
      hero?.level ?? 1,
      ...tracks.map(t => t.level),
    );
    const desired = slotsForClassLevels(maxClassLevel);
    if (desired > (wallet.slots_unlocked ?? 2)) {
      unlockSlot.mutate(desired, {
        onSuccess: () => {
          toast.success('🔓 3rd Relic Slot Unlocked!', {
            description: `Class Lv ${THIRD_SLOT_UNLOCK_LEVEL} reached`,
            duration: 5500,
          });
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet?.slots_unlocked, tracks?.length, hero?.level]);

  const [activeClass, setActiveClass] = useState<HeroClass | null>(null);
  const cls = activeClass ?? hero?.class ?? 'warrior';
  const { data: loadout } = useLoadout(cls);
  const { data: campaignProgress } = useMyProgress(cls);

  const slotsUnlocked = wallet?.slots_unlocked ?? 2;
  const ownedIds = useMemo(() => new Set((owned ?? []).map(o => o.relic_id)), [owned]);
  const rankById = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of owned ?? []) m.set(o.relic_id, o.rank ?? 1);
    return m;
  }, [owned]);
  const ownedRelics = useMemo(
    () => RELIC_CATALOG.filter(r => ownedIds.has(r.id)),
    [ownedIds],
  );

  const equipped: (string | null)[] = [
    loadout?.slot_1 ?? null,
    loadout?.slot_2 ?? null,
    loadout?.slot_3 ?? null,
  ];
  const classTrack = tracks?.find(t => t.class === cls);
  const characterSheet = buildCharacterSheet({
    cls,
    classLevel: classTrack?.level ?? (hero?.class === cls ? hero.level : 1),
    campaignLevel: classTrack?.highest_unlocked_level ?? campaignProgress?.highest_unlocked_level ?? 1,
    slots: equipped,
    rankById,
  });

  const equip = async (relicId: string) => {
    if (equipped.includes(relicId)) {
      // already equipped — unequip
      const newSlots = equipped.map(s => s === relicId ? null : s);
      rdSfx('ui.tap');
      await save(newSlots);
      return;
    }
    const firstEmpty = equipped.findIndex((s, i) => s === null && i < slotsUnlocked);
    if (firstEmpty === -1) {
      rdSfx('rune.invalid');
      toast.error('All slots are full — tap an equipped relic to unequip first.');
      return;
    }
    const newSlots = [...equipped];
    newSlots[firstEmpty] = relicId;
    rdSfx('relic.equip');
    await save(newSlots);
  };

  const unequip = async (slotIdx: number) => {
    const newSlots = [...equipped];
    newSlots[slotIdx] = null;
    await save(newSlots);
  };

  const save = async (slots: (string | null)[]) => {
    try {
      await updateLoadout.mutateAsync({
        cls,
        slot_1: slots[0] ?? null,
        slot_2: slots[1] ?? null,
        slot_3: slots[2] ?? null,
      });
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not update loadout');
    }
  };

  if (!hero) return <div className="h-32 rounded-2xl skeleton-shimmer" />;

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center justify-between">
        <ShardBalance shards={wallet?.shards ?? 0} />
      </div>

      <div className="text-center space-y-1">
        <h1 className="rd-title page-header-title flex items-center justify-center gap-2 text-2xl">
          <Sparkles className="w-5 h-5 text-primary" /> Armory
        </h1>
        <p className="text-[12px] font-semibold text-foreground/80">Equip relics per class. Tap an owned relic to equip or unequip.</p>
      </div>

      {/* Class tabs — per-class loadouts */}
      <div className="grid grid-cols-4 gap-1.5">
        {CLASS_LIST.map(c => {
          const track = tracks?.find(t => t.class === c.id);
          const isActive = c.id === cls;
          const isHeroClass = c.id === hero.class;
          return (
            <button
              key={c.id}
              onClick={() => setActiveClass(c.id)}
              className={cn(
                'h-14 rounded-lg flex flex-col items-center justify-center gap-0.5 btn-press text-[11px] font-extrabold transition-colors',
                isActive
                  ? 'bg-primary/25 border border-primary/60 text-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.3)]'
                  : 'bg-muted/30 border border-border/40 text-foreground/95',
              )}
            >
              <ClassBadge cls={c.id} size="sm" />
              <span className="leading-none">{c.name}{isHeroClass && ' ●'}</span>
            </button>
          );
        })}
      </div>

      {/* Active class loadout */}
      <div className="glass-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-rd-display font-extrabold text-[15px] text-foreground tracking-wide">{getClass(cls).name} loadout</h3>
          <span className="text-[11px] font-extrabold tabular-nums text-foreground/85">{equipped.filter((s, i) => s && i < slotsUnlocked).length}/{slotsUnlocked} slots</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map(i => {
            const slotRelic: RelicDef | null = equipped[i] ? RELIC_BY_ID[equipped[i] as string] ?? null : null;
            const locked = i >= slotsUnlocked;
            return (
              <LoadoutSlot
                key={i}
                relic={slotRelic}
                locked={locked}
                unlockHint={locked ? `Lv ${THIRD_SLOT_UNLOCK_LEVEL} unlock` : undefined}
                onClear={slotRelic ? () => unequip(i) : undefined}
              />
            );
          })}
        </div>
        {slotsUnlocked < 3 && (
          <p className="text-[11px] font-semibold text-foreground/80 text-center italic">
            Reach class level {THIRD_SLOT_UNLOCK_LEVEL} in any class to unlock the 3rd relic slot.
          </p>
        )}
      </div>

      {/* Live min-max preview: updates as relics are equipped or removed. */}
      <CharacterPowerPanel sheet={characterSheet} compact />
      <p className="-mt-2 px-1 text-[10px] text-muted-foreground text-center">
        Stats update with this loadout. Switch your active class on the <Link to="/rune-delve/hero" className="font-bold text-primary">Hero screen</Link> for its complete effect ledger.
      </p>

      {/* Owned relics */}
      <div className="space-y-2">
        <h3 className="font-rd-display text-[12px] font-extrabold uppercase tracking-[0.18em] text-foreground/90 px-1">
          Your relics ({ownedRelics.length})
        </h3>
        {ownedRelics.length === 0 ? (
          <Link to="/rune-delve/shop" className="block">
            <div className="glass-card p-5 text-center btn-press">
              <ShoppingBag className="w-6 h-6 mx-auto mb-2 text-primary" />
              <p className="rd-title text-[15px] font-extrabold mb-1 text-foreground">No relics yet</p>
              <p className="text-[12px] font-semibold text-foreground/90 mb-2">Visit the Shop to spend Rune Shards on your first relic.</p>
              <span className="text-[12px] font-extrabold text-primary">Go to Shop →</span>
            </div>
          </Link>
        ) : (
          <div className="space-y-2 rd-stagger" key={`owned-${cls}`}>
            {ownedRelics.map(r => {
              const isEquipped = equipped.includes(r.id);
              return (
                <RelicCard
                  key={r.id}
                  relic={r}
                  state={isEquipped ? 'equipped' : 'owned'}
                  rank={rankById.get(r.id) ?? 1}
                  onClick={() => equip(r.id)}
                />
              );
            })}
            {/* Upgrade discoverability — Armory only equips; ranks are bought in the Shop. */}
            <Link
              to="/rune-delve/shop"
              className="mt-1 flex items-center gap-2.5 rounded-xl border p-3 btn-press"
              style={{
                background: 'linear-gradient(135deg, hsl(var(--gold) / 0.08), hsl(var(--card)))',
                borderColor: 'hsl(var(--gold) / 0.35)',
              }}
            >
              <span
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[15px]"
                style={{ background: 'hsl(var(--gold) / 0.18)', color: 'hsl(var(--gold))' }}
                aria-hidden
              >
                ⬆️
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-extrabold text-foreground leading-tight">Want stronger relics?</p>
                <p className="text-[11px] text-foreground/75 leading-snug">Upgrade ranks in the Shop — tap any owned relic there.</p>
              </div>
              <span className="text-[11px] font-extrabold" style={{ color: 'hsl(var(--gold))' }}>Shop →</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
