import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Trophy, Swords, Heart, Clock, Sparkles, ChevronRight, Star, Shield, Loader2, RefreshCw } from 'lucide-react';
import { useLevel, useMyLevelRun, useLevelBestScores, useMyProgress } from '@/hooks/useRuneDelveCampaign';
import { useRuneDelveHero } from '@/hooks/useRuneDelveHero';
import { useRuneWallet } from '@/hooks/useRuneShards';
import { useLoadout } from '@/hooks/useLoadout';
import { Confetti } from '@/components/Confetti';
import { ClassBadge } from '@/components/runedelve/ClassBadge';
import { ShardBalance } from '@/components/runedelve/ShardBalance';
import { getClass, levelFromXp, titleForLevel } from '@/lib/runedelve/classConfig';
import { starsFor } from '@/lib/runedelve/levelGenerator';
import { mechanicsForLevel, getMechanic, type MechanicId } from '@/lib/runedelve/mechanics';
import { getBossRule, type BossRuleId } from '@/lib/runedelve/bossRules';
import { secondaryLabel, type SecondaryObjective } from '@/lib/runedelve/layeredGoals';
import { RELIC_BY_ID } from '@/lib/runedelve/relics';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { CountUp } from '@/components/runedelve/fx/CountUp';
import { useRuneDelveSfx } from '@/hooks/useRuneDelveSfx';

export default function RuneDelveResultsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { levelNumber: levelParam } = useParams<{ levelNumber: string }>();
  const levelNumber = Math.max(1, parseInt(levelParam ?? '1', 10) || 1);

  const { data: level } = useLevel(levelNumber);
  const { data: hero } = useRuneDelveHero();
  const { data: run, isLoading: runLoading, isFetching: runFetching, refetch: refetchRun } = useMyLevelRun(level?.id, levelNumber, hero?.class);
  const { data: progress } = useMyProgress(hero?.class);
  const { data: topRuns } = useLevelBestScores(level?.id);
  const { data: wallet } = useRuneWallet();
  const { data: loadout } = useLoadout(hero?.class);
  const [showConfetti, setShowConfetti] = useState(false);
  const [graceElapsed, setGraceElapsed] = useState(false);
  // Improvement flags handed off from the Play page via sessionStorage so the
  // Results page can show "New fastest clear" / "New longest chain" chips
  // even though the merged DB row no longer reveals what changed this run.
  const [improvements, setImprovements] = useState<{
    wasNewBest: boolean;
    improvedChain: boolean;
    improvedTurns: boolean;
    improvedHp: boolean;
    firstClear: boolean;
    turnsUsed: number;
    longestChain: number;
    hpRemaining: number;
  } | null>(null);

  // Belt-and-suspenders: nuke any stale cached `null` for this level on mount,
  // and reset the short "loading grace" window so the empty state never flashes
  // before the post-submit retry has a chance to land.
  useEffect(() => {
    if (!level?.id || level.id.startsWith('transient-') || !hero?.class) return;
    queryClient.invalidateQueries({ queryKey: ['rune-delve-level-run', level.id] });
    queryClient.invalidateQueries({ queryKey: ['rune-delve-progress'] });
    setGraceElapsed(false);
    const t = setTimeout(() => setGraceElapsed(true), 1800);
    // Pull (and consume) the improvement payload — only if it's recent.
    try {
      const key = `rd-improvements-${hero.class}-${levelNumber}`;
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.ts && Date.now() - parsed.ts < 60_000) {
          setImprovements(parsed);
        }
        sessionStorage.removeItem(key);
      }
    } catch { /* sessionStorage may be unavailable */ }
    return () => clearTimeout(t);
  }, [level?.id, queryClient, levelNumber, hero?.class]);

  const { play: rdSfx } = useRuneDelveSfx();

  useEffect(() => {
    if (run?.dungeon_cleared) {
      setShowConfetti(true);
      rdSfx('victory');
      const t = setTimeout(() => setShowConfetti(false), 2500);
      return () => clearTimeout(t);
    } else if (run && !run.dungeon_cleared) {
      rdSfx('defeat');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.dungeon_cleared]);

  // If the level row is still "transient" (not seeded in DB by an admin yet),
  // useMyLevelRun is disabled and runLoading stays true forever — leaving the
  // user stuck on a spinner. Detect that and skip straight to the empty state.
  const isTransientLevel = !!level?.id && level.id.startsWith('transient-');
  if (!run || !level) {
    const showSpinner = !isTransientLevel && (!graceElapsed || runLoading || runFetching);
    return (
      <div className="space-y-4 pb-8">
        <div className="glass-card p-8 flex flex-col items-center text-center gap-3">
          {showSpinner ? (
            <>
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
              <p className="text-xs text-muted-foreground font-medium">Loading your run…</p>
            </>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'hsl(var(--muted) / 0.4)' }}>
                <RefreshCw className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-extrabold">Hmm — we couldn't find that run yet</p>
                <p className="text-[11px] text-muted-foreground max-w-[260px]">
                  Sometimes the save takes an extra moment to land. Tap refresh, or head back to the level map.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 w-full max-w-xs pt-1">
                <button
                  onClick={() => {
                    setGraceElapsed(false);
                    queryClient.invalidateQueries({ queryKey: ['rune-delve-level-run'] });
                    refetchRun();
                    setTimeout(() => setGraceElapsed(true), 1800);
                  }}
                  className="h-10 rounded-xl text-xs font-bold btn-press flex items-center justify-center gap-1.5"
                  style={{
                    background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-glow)))',
                    color: 'white',
                  }}
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </button>
                <Link
                  to="/rune-delve/levels"
                  className="h-10 rounded-xl bg-muted/40 flex items-center justify-center text-xs font-bold btn-press gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Level Map
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  const stars = starsFor(run.score, levelNumber, run.dungeon_cleared);

  // Near-miss signal: failed runs that chewed through ≥60% of total enemy HP
  // get a soft nudge to try a different relic. Pure QoL — no balance impact.
  const totalEnemyHp = Array.isArray(level.enemy_config)
    ? (level.enemy_config as Array<{ maxHp?: number; hp?: number }>)
        .reduce((sum, e) => sum + (e.maxHp ?? e.hp ?? 0), 0)
    : 0;
  const damageRatio = totalEnemyHp > 0 ? run.total_damage / totalEnemyHp : 0;
  const showNearMiss = !run.dungeon_cleared && damageRatio >= 0.6;
  const stats = [
    { label: 'Damage', value: run.total_damage, icon: Swords },
    { label: 'Defeated', value: run.enemies_defeated, icon: Trophy },
    { label: 'HP Left', value: run.hp_remaining, icon: Heart },
    { label: 'Turns Used', value: run.turns_used, icon: Clock },
    { label: 'Longest Chain', value: run.longest_chain, icon: Sparkles },
    { label: 'XP Earned', value: run.xp_earned, icon: Sparkles },
  ];

  const outcome = run.dungeon_cleared
    ? { label: `Level ${levelNumber} Cleared`, emoji: '🏆', accent: 'gold' as const }
    : run.hp_remaining <= 0
      ? { label: 'Defeated', emoji: '💀', accent: 'destructive' as const }
      : { label: 'Out of Turns', emoji: '⏳', accent: 'muted' as const };

  const headerBg = outcome.accent === 'gold'
    ? 'linear-gradient(160deg, hsl(var(--gold) / 0.15), hsl(var(--gold) / 0.04))'
    : outcome.accent === 'destructive'
      ? 'linear-gradient(160deg, hsl(var(--destructive) / 0.14), hsl(var(--destructive) / 0.04))'
      : 'linear-gradient(160deg, hsl(var(--primary) / 0.10), hsl(var(--accent) / 0.04))';
  const headerBorder = outcome.accent === 'gold'
    ? 'hsl(var(--gold) / 0.3)'
    : outcome.accent === 'destructive'
      ? 'hsl(var(--destructive) / 0.35)'
      : undefined;

  const nextLevel = levelNumber + 1;
  const nextUnlocked = (progress?.highest_unlocked_level ?? 1) >= nextLevel;

  const equippedRelics = loadout
    ? [loadout.slot_1, loadout.slot_2, loadout.slot_3]
        .map(id => (id ? RELIC_BY_ID[id] : null))
        .filter(Boolean)
    : [];

  return (
    <div className="space-y-4 pb-8">
      <Confetti active={showConfetti} />
      <div className="flex items-center justify-between">
        <Link to="/rune-delve/shop" aria-label="Open shop">
          <ShardBalance shards={wallet?.shards ?? 0} />
        </Link>
      </div>

      <div className="glass-card p-6 text-center" style={{ background: headerBg, borderColor: headerBorder }}>
        {hero && (
          <div className="space-y-1 mb-2">
            <div className="flex items-center justify-center gap-2">
              <ClassBadge cls={hero.class} size="sm" />
              <p className="font-rd-display text-[13px] font-extrabold truncate max-w-[200px] tracking-wide">{hero.hero_name}</p>
              <span className="text-[10px] font-extrabold text-foreground/75">Lv {levelFromXp(hero.xp).level} {getClass(hero.class).name}</span>
            </div>
            {(hero.cosmetic_title ?? titleForLevel(levelFromXp(hero.xp).level, hero.class)) && (
              <p className="text-[10px] font-extrabold text-primary">
                ✦ {hero.cosmetic_title ?? titleForLevel(levelFromXp(hero.xp).level, hero.class)}
              </p>
            )}
          </div>
        )}
        <p className="text-3xl mb-1">{outcome.emoji}</p>
        <p className="rd-title text-[14px] font-extrabold uppercase tracking-[0.18em] text-foreground/90 mb-1">{outcome.label}</p>
        <CountUp
          value={run.score}
          duration={1100}
          delay={250}
          format={(n) => n.toLocaleString()}
          className="font-mono text-4xl font-extrabold tabular-nums mb-2 inline-block"
          style={{ color: 'hsl(var(--gold))' }}
        />
        {run.dungeon_cleared && (
          <div className="flex items-center justify-center gap-1 mt-2">
            {[1,2,3].map(s => (
              <StarReveal
                key={s}
                index={s}
                lit={s <= stars}
                onLit={() => rdSfx('star.earned', { index: s - 1 })}
              />
            ))}
          </div>
        )}
        <div className="mt-3 flex items-center justify-center gap-2 text-[11px] font-extrabold">
          <Link to="/rune-delve/shop" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors hover:opacity-90"
            style={{ background: 'hsl(var(--primary) / 0.14)', color: 'hsl(var(--primary))' }}>
            💠 Spend shards in the Shop
          </Link>
        </div>
      </div>

      {showNearMiss && (
        <div
          className="glass-card p-3 flex items-start gap-2.5"
          style={{ background: 'hsl(var(--gold) / 0.10)', borderColor: 'hsl(var(--gold) / 0.3)' }}
        >
          <Sparkles className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'hsl(var(--gold))' }} />
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold" style={{ color: 'hsl(var(--gold))' }}>
              So close — try a different relic
            </p>
            <p className="text-[10px] text-muted-foreground">
              You burned through {Math.round(damageRatio * 100)}% of their HP. Swap a relic in the Armory for an edge.
            </p>
          </div>
        </div>
      )}

      {/* Personal Best Tracker — replay-aware stats. Always visible so the
          player sees their cumulative progress, not just this attempt. */}
      <div className="glass-card p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-[12px] flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5" style={{ color: 'hsl(var(--gold))' }} /> {hero ? `${getClass(hero.class).name} Best` : 'Class Best'}
          </h3>
          {(run as any).attempts > 1 && (
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
              {(run as any).clears ?? 0}/{(run as any).attempts ?? 1} clears
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg p-2 text-center" style={{ background: 'hsl(var(--gold) / 0.08)' }}>
            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Best Score</p>
            <p className="font-mono text-[13px] font-extrabold tabular-nums" style={{ color: 'hsl(var(--gold))' }}>
              {run.score.toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg p-2 text-center bg-muted/30">
            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Best Chain</p>
            <p className="font-mono text-[13px] font-extrabold tabular-nums">{run.longest_chain}</p>
          </div>
          <div className="rounded-lg p-2 text-center bg-muted/30">
            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Fastest Clear</p>
            <p className="font-mono text-[13px] font-extrabold tabular-nums">
              {(run as any).best_turns_used != null ? `${(run as any).best_turns_used}t` : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Secondary-improvement chips — celebrate replay progress that didn't
          beat the high score but still improved a meaningful stat. */}
      {improvements && !improvements.wasNewBest && (improvements.firstClear || improvements.improvedTurns || improvements.improvedChain || improvements.improvedHp) && (
        <div className="flex flex-wrap gap-1.5">
          {improvements.firstClear && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold"
              style={{ background: 'hsl(var(--gold) / 0.18)', color: 'hsl(var(--gold))' }}>
              🏆 First Clear!
            </span>
          )}
          {improvements.improvedTurns && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-primary/15 text-primary">
              ⚡ New fastest clear — {improvements.turnsUsed}t
            </span>
          )}
          {improvements.improvedChain && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-primary/15 text-primary">
              🔗 New longest chain — {improvements.longestChain}
            </span>
          )}
          {improvements.improvedHp && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-success/15 text-success">
              ❤️ New best HP left — {improvements.hpRemaining}
            </span>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 rd-stagger">
        {stats.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="glass-card p-3 flex items-center gap-2.5">
              <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{s.label}</p>
                <CountUp value={s.value} duration={750} delay={400} className="font-mono text-sm font-extrabold tabular-nums" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Active loadout chip — reminds the player what was equipped this run */}
      {hero && equippedRelics.length > 0 && (
        <Link to="/rune-delve/armory" className="block">
          <div className="glass-card p-3 btn-press flex items-center gap-2.5">
            <Shield className="w-4 h-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Loadout · {getClass(hero.class).name}</p>
              <p className="text-[11px] font-extrabold truncate">
                {equippedRelics.map(r => `${r!.icon} ${r!.name}`).join(' · ')}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </div>
        </Link>
      )}

      {/* Mechanic recap — what was active on this level */}
      {(() => {
        const mods = (level.modifiers ?? {}) as {
          mechanics?: MechanicId[];
          secondary_objective?: SecondaryObjective | null;
          boss_rule?: BossRuleId | null;
        };
        const mechs = mods.mechanics?.length ? mods.mechanics : mechanicsForLevel(levelNumber);
        const secondary = mods.secondary_objective ?? null;
        const bossRule = mods.boss_rule ?? null;
        if (!mechs.length && !secondary && !bossRule) return null;
        const recapTitle = run.dungeon_cleared ? 'This level featured' : 'What you faced';
        const secondaryWasMet = secondary
          ? (secondary.type === 'min_hp' ? run.hp_remaining >= secondary.target
            : secondary.type === 'min_chain' ? run.longest_chain >= secondary.target
            : run.turns_used <= secondary.target)
          : false;
        return (
          <div className="glass-card p-3 space-y-2">
            <h3 className="font-bold text-[12px] flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-primary" /> {recapTitle}</h3>
            <div className="flex flex-wrap gap-1.5">
              {mechs.map(id => {
                const m = getMechanic(id);
                return (
                  <span key={id} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted/40 text-[10px] font-bold">
                    <span>{m.icon}</span>{m.name}
                  </span>
                );
              })}
              {bossRule && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold"
                  style={{ background: 'hsl(var(--destructive) / 0.18)', color: 'hsl(var(--destructive))' }}>
                  👑 {getBossRule(bossRule).label}
                </span>
              )}
            </div>
            {secondary && (
              <p className="text-[11px] text-muted-foreground">
                <span className="font-bold text-foreground">Bonus goal:</span> {secondaryLabel(secondary)}
                {run.dungeon_cleared && secondaryWasMet && (
                  <span className="ml-1.5 font-extrabold" style={{ color: 'hsl(var(--gold))' }}>+250</span>
                )}
              </p>
            )}
          </div>
        );
      })()}

      {/* Top scores for this level */}
      {topRuns && topRuns.length > 0 && (
        <div className="glass-card p-3">
          <h3 className="font-bold text-[12px] mb-2 flex items-center gap-1.5"><Trophy className="w-3.5 h-3.5 text-gold" /> Top scores · Level {levelNumber}</h3>
          <div className="space-y-1.5">
            {topRuns.slice(0, 5).map((r: any) => (
              <div key={r.id} className="flex items-center gap-2 text-[11px]">
                <span className="w-4 font-mono font-bold text-muted-foreground">#{r.rank}</span>
                <span className="flex-1 truncate font-semibold">{r.hero?.hero_name ?? 'Hero'}</span>
                <span className="font-mono font-bold tabular-nums" style={{ color: 'hsl(var(--gold))' }}>{r.score.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action bar */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => navigate(`/rune-delve/play/${levelNumber}`)}
          className="h-11 rounded-xl bg-muted/40 flex items-center justify-center text-xs font-bold btn-press"
        >
          Retry
        </button>
        {run.dungeon_cleared && nextUnlocked ? (
          <button
            onClick={() => navigate(`/rune-delve/play/${nextLevel}`)}
            className="h-11 rounded-xl font-extrabold text-xs btn-press flex items-center justify-center gap-1.5"
            style={{
              background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-glow)))',
              color: 'white',
              boxShadow: 'var(--shadow-glow)',
            }}
          >
            Next Level <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <Link to="/rune-delve/levels" className="h-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center text-xs font-bold btn-press gap-1.5">
            Level Map
          </Link>
        )}
      </div>
    </div>
  );
}

/** Animated star reveal — pops + fires a chime callback when its delay hits. */
function StarReveal({ index, lit, onLit }: { index: number; lit: boolean; onLit: () => void }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => {
      setShown(true);
      if (lit) onLit();
    }, 1200 + index * 220);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, lit]);
  return (
    <Star
      className={cn(
        'w-7 h-7 transition-all duration-300',
        lit ? 'fill-current' : 'opacity-30',
        shown ? 'scale-100 opacity-100' : 'scale-0 opacity-0',
      )}
      style={{
        color: 'hsl(var(--gold))',
        filter: lit && shown ? 'drop-shadow(0 0 8px hsl(var(--gold) / 0.7))' : undefined,
      }}
    />
  );
}
