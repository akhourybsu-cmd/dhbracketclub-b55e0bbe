import { Link } from 'react-router-dom';
import { Flame, Trophy, Lock, Sparkles, Check } from 'lucide-react';
import { useRuneDelveHero, useUpdateHero } from '@/hooks/useRuneDelveHero';
import {
  useAllClassProgress,
  useEnsureClassProgress,
  type ClassProgress,
} from '@/hooks/useRuneDelveClassProgress';
import {
  CLASS_LIST,
  getClass,
  levelFromXp,
  titleForLevel,
  titleLadderFor,
  type HeroClass,
} from '@/lib/runedelve/classConfig';
import { MASTERY_TIERS, nextMasteryFor } from '@/lib/runedelve/classMastery';
import { ClassBadge } from '@/components/runedelve/ClassBadge';
import { CharacterPowerPanel } from '@/components/runedelve/CharacterPowerPanel';
import { useLoadout } from '@/hooks/useLoadout';
import { useRelicCollection } from '@/hooks/useRelicCollection';
import { useMyProgress } from '@/hooks/useRuneDelveCampaign';
import { buildCharacterSheet } from '@/lib/runedelve/characterStats';
import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function RuneDelveHeroPage() {
  const { data: hero } = useRuneDelveHero();
  const { data: tracks } = useAllClassProgress();
  const { data: loadout } = useLoadout(hero?.class);
  const { data: ownedRelics } = useRelicCollection();
  const { data: campaignProgress } = useMyProgress(hero?.class);
  const updateHero = useUpdateHero();
  const ensureClass = useEnsureClassProgress();

  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState('');
  const [confirmSwitch, setConfirmSwitch] = useState<HeroClass | null>(null);

  if (!hero) return <div className="h-32 rounded-2xl skeleton-shimmer" />;

  // Active class snapshot is the source of truth for level/XP/title display.
  const trackByClass = new Map<HeroClass, ClassProgress>();
  (tracks ?? []).forEach(t => trackByClass.set(t.class, t));
  const activeTrack = trackByClass.get(hero.class);
  const activeXp = activeTrack?.xp ?? hero.xp;
  const activeLevel = activeTrack?.level ?? hero.level;
  const lvl = levelFromXp(activeXp);
  const xpPct = Math.round((lvl.intoLevel / lvl.needed) * 100);
  const cls = getClass(hero.class);
  const title = activeTrack?.cosmetic_title ?? titleForLevel(activeLevel, hero.class);
  const ladder = titleLadderFor(hero.class);
  const rankById = new Map((ownedRelics ?? []).map(r => [r.relic_id, r.rank ?? 1]));
  const campaignLevel = activeTrack?.highest_unlocked_level
    ?? campaignProgress?.highest_unlocked_level
    ?? 1;
  const characterSheet = buildCharacterSheet({
    cls: hero.class,
    classLevel: activeLevel,
    campaignLevel,
    slots: [loadout?.slot_1, loadout?.slot_2, loadout?.slot_3],
    rankById,
  });

  const saveName = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === hero.hero_name) { setEditingName(false); return; }
    try {
      await updateHero.mutateAsync({ hero_name: trimmed });
      toast.success('Hero renamed');
      setEditingName(false);
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not rename');
    }
  };

  const switchClass = async (next: HeroClass) => {
    if (next === hero.class) { setConfirmSwitch(null); return; }
    try {
      // Make sure the destination class has a saved track (lazy create).
      const track = await ensureClass.mutateAsync(next);
      const equippedTitle = track.cosmetic_title ?? titleForLevel(track.level, next);
      // Hero record now mirrors the new active class's track for legacy reads.
      await updateHero.mutateAsync({
        class: next,
        xp: track.xp,
        level: track.level,
        cosmetic_title: equippedTitle,
      } as any);
      toast.success(`Switched to ${getClass(next).name} · Lv ${track.level}`);
      setConfirmSwitch(null);
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not switch class');
    }
  };

  return (
    <div className="space-y-4 pb-8">

      {/* ── Persistent hero identity ─────────────────────────────────── */}
      <div className="glass-card p-5 text-center">
        <div className="flex justify-center mb-3"><ClassBadge cls={hero.class} size="lg" /></div>
        {editingName ? (
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={hero.hero_name}
            maxLength={24}
            autoFocus
            className="form-input text-center w-full mb-2 px-3"
          />
        ) : (
          <h2 className="rd-title text-2xl tracking-wide break-words text-foreground">{hero.hero_name}</h2>
        )}
        {title && (
          <p className="font-rd-display text-[13px] font-extrabold mt-1 break-words tracking-wide" style={{ color: 'hsl(var(--primary))' }}>
            ✦ {title}
          </p>
        )}
        <p className="text-[10px] font-extrabold text-foreground/75 mt-0.5 uppercase tracking-wider">
          Active · {cls.name} · Lv {activeLevel}
        </p>

        <div className="mt-3">
          <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${xpPct}%` }} />
          </div>
          <p className="text-[10px] font-mono text-foreground/75 mt-1 tabular-nums font-bold">{lvl.intoLevel} / {lvl.needed} XP · this class</p>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4">
          <div><p className="font-mono font-extrabold text-base tabular-nums flex items-center justify-center gap-1"><Flame className="w-3.5 h-3.5 text-gold" />{hero.current_streak}</p><p className="text-[9px] font-bold text-muted-foreground uppercase">Streak</p></div>
          <div><p className="font-mono font-extrabold text-base tabular-nums">{hero.lifetime_runs}</p><p className="text-[9px] font-bold text-muted-foreground uppercase">Lifetime Runs</p></div>
          <div><p className="font-mono font-extrabold text-base tabular-nums">{hero.lifetime_score.toLocaleString()}</p><p className="text-[9px] font-bold text-muted-foreground uppercase">Lifetime Score</p></div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {editingName ? (
            <>
              <button onClick={() => { setEditingName(false); setName(''); }} className="h-9 rounded-lg bg-muted/40 text-[11px] font-bold btn-press">Cancel</button>
              <button onClick={saveName} className="h-9 rounded-lg bg-primary text-primary-foreground text-[11px] font-bold btn-press">Save</button>
            </>
          ) : (
            <button
              onClick={() => { setEditingName(true); setName(hero.hero_name); }}
              className="col-span-2 h-9 rounded-lg bg-muted/40 text-[11px] font-bold btn-press"
            >
              Rename hero
            </button>
          )}
        </div>
      </div>

      {/* Exact, rank-aware snapshot of the values combat will use. */}
      <CharacterPowerPanel sheet={characterSheet} />

      {/* ── Class Masteries — perks unlocked by leveling this class ──── */}
      {(() => {
        const tiers = MASTERY_TIERS[hero.class];
        const unlockedCount = tiers.filter(t => activeLevel >= t.unlockLevel).length;
        const next = nextMasteryFor(hero.class, activeLevel);
        return (
          <div className="glass-card p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-rd-display font-extrabold text-[14px] flex items-center gap-1.5 tracking-wide">
                <Sparkles className="w-3.5 h-3.5 text-primary" /> Class Masteries
              </h3>
              <span className="text-[10px] font-mono font-bold tabular-nums text-muted-foreground">
                {unlockedCount}/{tiers.length}
              </span>
            </div>
            {/* 5-segment progress strip */}
            <div className="flex gap-1">
              {tiers.map(t => {
                const u = activeLevel >= t.unlockLevel;
                return (
                  <div
                    key={t.id}
                    className={cn(
                      'h-1.5 flex-1 rounded-full',
                      u ? 'bg-primary' : 'bg-muted/50',
                    )}
                  />
                );
              })}
            </div>
            {next ? (
              <p className="text-[10px] text-muted-foreground">
                Next: <span className="font-bold text-foreground">{next.name}</span> at Lv {next.unlockLevel}
              </p>
            ) : (
              <p className="text-[10px] font-bold" style={{ color: 'hsl(var(--gold))' }}>
                ✦ All masteries unlocked
              </p>
            )}
            <div className="space-y-1.5 pt-1">
              {tiers.map(t => {
                const u = activeLevel >= t.unlockLevel;
                return (
                  <div
                    key={t.id}
                    className={cn(
                      'flex items-start gap-2 px-2 py-1.5 rounded-lg',
                      u ? 'bg-primary/5 border border-primary/20' : 'opacity-55',
                    )}
                  >
                    <div className="shrink-0 mt-0.5">
                      {u ? <Check className="w-3 h-3 text-primary" /> : <Lock className="w-3 h-3 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-extrabold text-[11px]">T{t.tier} · {t.name}</p>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Lv {t.unlockLevel}</span>
                      </div>
                      <p className="text-[10.5px] text-foreground/80 leading-snug">{t.summary}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── Per-class progression ladder ─────────────────────────────── */}
      <div className="glass-card p-4 space-y-2">
        <h3 className="font-rd-display font-extrabold text-[14px] flex items-center gap-1.5 tracking-wide">
          <Sparkles className="w-3.5 h-3.5 text-primary" /> Class Progression
        </h3>
        <p className="text-[11px] text-foreground/75">
          Each class keeps its own XP, campaign unlocks, best runs, failure help, titles, and relic loadout. A new class starts at Level 1; switching back restores everything.
        </p>
        <div className="space-y-2 mt-1">
          {CLASS_LIST.map(c => {
            const track = trackByClass.get(c.id);
            const isActive = c.id === hero.class;
            const tLevel = track?.level ?? 1;
            const tTitle = track?.cosmetic_title ?? titleForLevel(tLevel, c.id);
            const tXp = track?.xp ?? 0;
            const xpInfo = levelFromXp(tXp);
            const pct = Math.round((xpInfo.intoLevel / xpInfo.needed) * 100);
            const tCampaign = track?.highest_unlocked_level
              ?? (isActive ? campaignProgress?.highest_unlocked_level : 1)
              ?? 1;
            return (
              <button
                key={c.id}
                disabled={isActive || ensureClass.isPending || updateHero.isPending}
                onClick={() => setConfirmSwitch(c.id)}
                className={cn(
                  'w-full text-left rounded-xl p-3 border transition-all btn-press flex items-start gap-3 min-w-0',
                  isActive
                    ? 'bg-primary/10 border-primary/40'
                    : 'bg-muted/20 border-border/40 hover:border-primary/30',
                )}
              >
                <ClassBadge cls={c.id} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="font-extrabold text-[12px]">{c.name}</span>
                    <span className="font-mono text-[10px] font-bold tabular-nums text-muted-foreground">Lv {tLevel}</span>
                    {isActive && (
                      <span className="ml-auto inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider text-primary">
                        <Check className="w-2.5 h-2.5" /> Active
                      </span>
                    )}
                  </div>
                  {tTitle && (
                    <p className="text-[10px] font-bold truncate" style={{ color: 'hsl(var(--primary))' }}>
                      ✦ {tTitle}
                    </p>
                  )}
                  <div className="mt-1 h-1 rounded-full bg-muted/50 overflow-hidden">
                    <div className="h-full bg-primary/70" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[9px] font-mono text-muted-foreground tabular-nums mt-0.5">
                    {xpInfo.intoLevel}/{xpInfo.needed} XP
                    {` · Campaign L${tCampaign}`}
                    {track && track.lifetime_runs > 0 && ` · ${track.lifetime_runs} runs`}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
        <p className="text-[9px] text-muted-foreground italic mt-2 px-0.5">
          Switch class only between levels. Class change is disabled mid-run.
        </p>
      </div>

      {/* ── Title ladder for active class ────────────────────────────── */}
      <div className="glass-card p-4">
        <h3 className="font-rd-display font-extrabold text-[14px] mb-1 flex items-center gap-1.5 tracking-wide">
          <Sparkles className="w-3.5 h-3.5 text-primary" /> {cls.name} Titles
        </h3>
        <p className="text-[11px] text-foreground/75 mb-3">Cosmetic prestige earned at milestone hero levels.</p>
        <div className="space-y-1">
          {ladder.map(({ level, title: t }) => {
            const unlocked = activeLevel >= level;
            const isCurrent = t === title;
            return (
              <div
                key={level}
                className={cn(
                  'flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg',
                  isCurrent && 'bg-primary/10 border border-primary/30',
                  !unlocked && 'opacity-45',
                )}
              >
                <span className="w-8 font-mono text-[10px] font-bold text-muted-foreground tabular-nums">L{level}</span>
                <span className={cn('flex-1 text-[12px] font-bold break-words min-w-0', isCurrent && 'text-primary')}>
                  {t}
                </span>
                {!unlocked ? (
                  <Lock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                ) : isCurrent ? (
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-primary flex-shrink-0">Equipped</span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <Link to="/rune-delve/leaderboard" className="block">
        <div className="glass-card p-3 flex items-center gap-2 btn-press">
          <Trophy className="w-4 h-4 text-gold" />
          <span className="text-xs font-bold flex-1">View campaign leaderboard</span>
          <span className="text-xs text-muted-foreground">→</span>
        </div>
      </Link>

      {/* ── Switch confirm modal ─────────────────────────────────────── */}
      {confirmSwitch && (() => {
        const target = getClass(confirmSwitch);
        const targetTrack = trackByClass.get(confirmSwitch);
        const targetLevel = targetTrack?.level ?? 1;
        const targetCampaign = targetTrack?.highest_unlocked_level ?? 1;
        const fresh = (!targetTrack || targetTrack.xp === 0) && targetCampaign <= 1;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center px-6 backdrop-blur-md bg-background/70 animate-in fade-in"
            onClick={() => setConfirmSwitch(null)}
          >
            <div className="glass-card p-5 max-w-sm w-full space-y-3" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3">
                <ClassBadge cls={confirmSwitch} size="lg" />
                <div className="min-w-0">
                  <p className="font-extrabold text-[15px]">Switch to {target.name}?</p>
                  <p className="text-[11px] text-muted-foreground">
                    {fresh
                      ? 'Fresh class — Lv 1 and Campaign L1.'
                      : `Restores Lv ${targetLevel} · Campaign L${targetCampaign}.`}
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Your <span className="font-bold text-foreground">{cls.name}</span> progress (Lv {activeLevel}) is saved and stays untouched.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button onClick={() => setConfirmSwitch(null)} className="h-10 rounded-lg bg-muted/40 text-xs font-bold btn-press">Cancel</button>
                <button
                  onClick={() => switchClass(confirmSwitch)}
                  disabled={updateHero.isPending || ensureClass.isPending}
                  className="h-10 rounded-lg bg-primary text-primary-foreground text-xs font-bold btn-press disabled:opacity-50"
                >
                  Switch class
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
