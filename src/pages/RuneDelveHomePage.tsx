import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, Trophy, Flame, ChevronRight, Swords, BookOpen, Map, ShoppingBag, Shield, Calendar, Target, ChevronDown, Wrench, HelpCircle, ScrollText, History as HistoryIcon, User as UserIcon, Gem, Lock } from 'lucide-react';
import { dailyChamberFor, hasPlayedDailyChamber } from '@/lib/runedelve/dailyChamber';
import { getLayoutIdForLevel } from '@/lib/runedelve/chamberAssignment';
import { getLayout } from '@/lib/runedelve/runeLayouts';
import { getClassTrials, classTrialProgressCount } from '@/lib/runedelve/classTrials';
import { Check } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useRuneDelveHero, useEnsureHero } from '@/hooks/useRuneDelveHero';
import { useAllClassProgress } from '@/hooks/useRuneDelveClassProgress';
import { useMyProgress, useCampaignLeaderboard } from '@/hooks/useRuneDelveCampaign';
import { useRuneWallet } from '@/hooks/useRuneShards';
import { useLoadout } from '@/hooks/useLoadout';
import { CLASS_LIST, getClass, levelFromXp, titleForLevel, type HeroClass } from '@/lib/runedelve/classConfig';
import { chapterFor, chapterMeta } from '@/lib/runedelve/levelGenerator';
import { getLayoutForLevel } from '@/lib/runedelve/chamberAssignment';
import { ContinueDelveBanner } from '@/components/runedelve/ContinueDelveBanner';
import { ClassBadge } from '@/components/runedelve/ClassBadge';
import { ShardBalance } from '@/components/runedelve/ShardBalance';
import { RELIC_BY_ID } from '@/lib/runedelve/relics';
import { HowToPlaySheet } from '@/components/runedelve/HowToPlaySheet';
import { CodexSheet } from '@/components/runedelve/CodexSheet';
import { useTodayDaily, useMyDailyRun, useMyDailyStreak } from '@/hooks/useDailyChallenge';
import { getDailyModifier } from '@/lib/runedelve/dailyModifiers';
import { useQuestSummary } from '@/hooks/useQuests';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useAmbientMusic } from '@/hooks/useAmbientMusic';

const HELP_SEEN_KEY = 'rune_delve_seen_help_v2';

export default function RuneDelveHomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  // Subtle fantasy ambient bed — only mounts on the home screen, fades out
  // automatically when the user navigates away. Off by default; user opts
  // in via Sound Settings (Profile → Sound & Haptics → Music).
  useAmbientMusic({ enabled: true, volume: 0.05, fadeInSec: 3.5, fadeOutSec: 1.2 });
  const { data: hero, isLoading: heroLoading } = useRuneDelveHero();
  const { data: classTracks } = useAllClassProgress();
  const { data: progress } = useMyProgress(hero?.class);
  const { data: leaderboard } = useCampaignLeaderboard();
  const { data: wallet } = useRuneWallet();
  const { data: loadout } = useLoadout(hero?.class);
  const ensureHero = useEnsureHero();
  const [picking, setPicking] = useState<HeroClass | null>(null);
  const [heroName, setHeroName] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const [codexOpen, setCodexOpen] = useState(false);
  const today = useTodayDaily();
  const { data: myDailyRun } = useMyDailyRun();
  const { data: dailyStreak } = useMyDailyStreak();
  const questSummary = useQuestSummary();

  // First-visit auto-open of help sheet.
  useEffect(() => {
    if (!hero) return;
    try {
      if (!localStorage.getItem(HELP_SEEN_KEY)) {
        setHelpOpen(true);
        localStorage.setItem(HELP_SEEN_KEY, '1');
      }
    } catch {}
  }, [hero]);

  // First-time hero creation: name + class
  if (!heroLoading && user && !hero) {
    const trimmed = heroName.trim();
    const canBegin = !!picking && trimmed.length >= 2 && !ensureHero.isPending;
    return (
      <div className="space-y-5 pb-8">
        <div className="text-center space-y-2">
          <h1 className="rd-title page-header-title flex items-center gap-2 justify-center text-2xl">
            <Sparkles className="w-5 h-5 text-primary" /> Forge your hero
          </h1>
          <p className="text-xs text-foreground/80 px-4">Name your champion and choose a class. Your hero persists across the entire campaign.</p>
        </div>

        <div className="glass-card p-4 space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Hero name</label>
          <input
            value={heroName}
            onChange={e => setHeroName(e.target.value)}
            placeholder="e.g. Thalia Stormvein"
            maxLength={24}
            autoFocus
            className="form-input w-full px-3 text-base font-bold"
          />
          <p className="text-[10px] text-muted-foreground">{trimmed.length}/24 · You can rename later.</p>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1">Choose a class</p>
          <div className="grid grid-cols-1 gap-2.5">
            {CLASS_LIST.map(c => (
              <button
                key={c.id}
                onClick={() => setPicking(c.id)}
                className={cn(
                  'glass-card p-4 text-left flex items-center gap-3 btn-press',
                  picking === c.id && 'border-primary/50',
                )}
                style={picking === c.id ? { boxShadow: 'var(--shadow-glow)' } : undefined}
              >
                <ClassBadge cls={c.id} size="lg" />
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold text-[14px]">{c.name} <span className="text-xs">{c.emoji}</span></p>
                  <p className="text-[11px] text-muted-foreground">{c.passive}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: `hsl(var(--${c.color}))` }}>
                    ⚡ {c.abilityName}: {c.abilityDesc}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <button
          disabled={!canBegin}
          onClick={async () => {
            if (!picking || trimmed.length < 2) return;
            await ensureHero.mutateAsync({ cls: picking, hero_name: trimmed });
          }}
          className="w-full h-12 rounded-xl font-extrabold text-sm btn-press disabled:opacity-50"
          style={{
            background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-glow)))',
            color: 'white',
            boxShadow: 'var(--shadow-glow)',
          }}
        >
          {ensureHero.isPending ? 'Summoning…' : trimmed.length < 2 ? 'Name your hero' : !picking ? 'Pick a class' : `Begin ${trimmed}'s journey`}
        </button>
      </div>
    );
  }

  if (heroLoading || !hero || !progress) {
    return (
      <div className="space-y-3">
        <div className="h-32 rounded-2xl skeleton-shimmer" />
        <div className="h-24 rounded-2xl skeleton-shimmer" />
      </div>
    );
  }

  const cls = getClass(hero.class);
  const activeTrack = (classTracks ?? []).find(t => t.class === hero.class);
  const activeXp = activeTrack?.xp ?? hero.xp;
  const activeLevel = activeTrack?.level ?? hero.level;
  const activeTitle = activeTrack?.cosmetic_title ?? hero.cosmetic_title ?? titleForLevel(activeLevel, hero.class);
  const lvl = levelFromXp(activeXp);
  const xpPct = Math.round((lvl.intoLevel / lvl.needed) * 100);
  const currentLevel = progress.highest_unlocked_level;
  const chapter = chapterFor(currentLevel);
  const chapMeta = chapterMeta(chapter);
  const chapterStart = (chapter - 1) * 50 + 1;
  const chapterEnd = chapter * 50;
  const completedInChapter = Math.max(0, Math.min(50, progress.highest_completed_level - chapterStart + 1));
  const chapterPct = Math.round((completedInChapter / 50) * 100);
  const sortedBoard = leaderboard ?? [];
  const myRank = sortedBoard.find(l => l.user_id === user?.id)?.rank;
  const top3 = sortedBoard.slice(0, 3);
  // Friend comparison teaser — closest player ahead of you (if any).
  const ahead = sortedBoard.find(
    l => l.user_id !== user?.id && l.highest_completed_level > (progress.highest_completed_level ?? 0),
  );
  const aheadGap = ahead ? ahead.highest_completed_level - (progress.highest_completed_level ?? 0) : 0;

  // Resolve the chamber layout for the player's current level so the Continue
  // affordance reads as "I'm about to enter this specific chamber" rather
  // than a generic "L24" tile.
  const currentLayout = getLayoutForLevel(currentLevel);

  return (
    <div className="space-y-4 pb-8">
      {/* Continue Delve — the chamber-shaped resume affordance */}
      <ContinueDelveBanner
        layout={currentLayout}
        levelNumber={currentLevel}
        chapterNumber={chapter}
        chapterName={chapMeta.name}
        chapterSubtitle={chapMeta.subtitle}
        cleared={completedInChapter}
        total={50}
        heroName={hero.hero_name}
      />

      {/* TODAY — daily ritual: Daily Challenge + Quests, side-by-side compact */}
      <Section label="Today" />
      <div className="grid grid-cols-2 gap-2">
        {(() => {
          const playedToday = !!myDailyRun;
          const stars = myDailyRun?.stars ?? 0;
          return (
            <Link to="/rune-delve/daily" className="block">
              <div
                className="glass-card p-3 btn-press h-full flex flex-col"
                style={{
                  background: 'linear-gradient(135deg, hsl(var(--accent) / 0.14), hsl(var(--gold) / 0.08))',
                  borderColor: 'hsl(var(--accent) / 0.35)',
                }}
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Calendar className="w-3.5 h-3.5 text-accent" />
                  <span className="font-rd-display text-[10px] font-extrabold tracking-[0.16em] text-accent uppercase">Daily</span>
                  <ChevronRight className="w-3.5 h-3.5 ml-auto text-accent/70" />
                </div>
                <p className="text-[11px] font-extrabold text-foreground leading-tight">
                  {playedToday ? `Done ${'⭐'.repeat(stars) || '—'}` : 'Fresh trial'}
                </p>
                <p className="text-[10px] font-extrabold text-foreground/70 mt-0.5 flex items-center gap-1">
                  <Flame className="w-3 h-3 text-gold" />
                  {dailyStreak?.current_streak ?? 0}-day · 2-min arena
                </p>
              </div>
            </Link>
          );
        })()}

        <Link to="/rune-delve/quests" className="block">
          <div
            className="glass-card p-3 btn-press h-full flex flex-col"
            style={{
              background: 'linear-gradient(135deg, hsl(var(--primary) / 0.10), hsl(var(--accent) / 0.08))',
              borderColor: 'hsl(var(--primary) / 0.25)',
            }}
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <Target className="w-3.5 h-3.5 text-primary" />
              <span className="font-rd-display text-[10px] font-extrabold tracking-[0.16em] text-primary uppercase">Quests</span>
              <ChevronRight className="w-3.5 h-3.5 ml-auto text-primary/70" />
            </div>
            <p className="text-[11px] font-extrabold text-foreground leading-tight">
              {questSummary.claimable > 0 ? `${questSummary.claimable} ready` : `${questSummary.total} active`}
            </p>
            <p className="text-[10px] font-extrabold text-foreground/70 mt-0.5">
              {questSummary.claimable > 0 ? 'Tap to claim 💎' : 'Daily + weekly'}
            </p>
          </div>
        </Link>
      </div>

      {/* DAILY CHAMBER (R4) — campaign-mode daily challenge with a
          deterministic level + locked modifier. Sits below the
          Daily/Quests grid since it's a fresh hook, not a slot in
          the existing Today rotation. */}
      {(() => {
        const cap = progress.highest_unlocked_level;
        const daily = dailyChamberFor(new Date(), cap);
        const played = user?.id ? hasPlayedDailyChamber(user.id, daily.date) : false;
        const layout = getLayout(getLayoutIdForLevel(daily.levelNumber));
        const mod = daily.modifier;
        return (
          <Link
            to={`/rune-delve/play/${daily.levelNumber}?dailyMod=${mod.id}`}
            className="block btn-press"
            aria-label={`Daily Chamber — Level ${daily.levelNumber} with ${mod.name}`}
          >
            <div
              className="rounded-2xl p-3.5 relative overflow-hidden"
              style={{
                background: `linear-gradient(135deg, hsl(${mod.accent} / 0.14), hsl(${mod.accent} / 0.04) 60%, hsl(var(--card) / 0.7))`,
                border: `1px solid hsl(${mod.accent} / ${played ? 0.25 : 0.42})`,
                boxShadow: played ? undefined : `0 0 22px -8px hsl(${mod.accent} / 0.35)`,
              }}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <Gem className="w-3.5 h-3.5" style={{ color: `hsl(${mod.accent})` }} />
                <span
                  className="font-rd-display text-[10px] font-extrabold tracking-[0.18em] uppercase"
                  style={{ color: `hsl(${mod.accent})` }}
                >
                  Daily Chamber
                </span>
                <div className="ml-auto flex items-center gap-1.5">
                  {played && (
                    <span
                      className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-[1px] rounded-full"
                      style={{
                        background: 'hsl(var(--muted) / 0.5)',
                        color: 'hsl(var(--muted-foreground))',
                      }}
                    >
                      <Lock className="w-2.5 h-2.5" /> Played
                    </span>
                  )}
                  <ChevronRight className="w-3.5 h-3.5" style={{ color: `hsl(${mod.accent} / 0.7)` }} />
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                  style={{
                    background: `linear-gradient(135deg, hsl(${mod.accent} / 0.28), hsl(${mod.accent} / 0.08))`,
                    border: `1px solid hsl(${mod.accent} / 0.4)`,
                    color: `hsl(${mod.accent})`,
                  }}
                  aria-hidden
                >
                  {mod.glyph}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-extrabold tracking-tight leading-tight">
                    Level {daily.levelNumber}
                    {layout && <span className="text-foreground/55 font-bold"> · {layout.name}</span>}
                  </p>
                  <p
                    className="text-[11px] font-extrabold leading-tight mt-0.5"
                    style={{ color: `hsl(${mod.accent})` }}
                  >
                    {mod.name}
                  </p>
                  <p className="text-[10.5px] text-foreground/70 leading-snug mt-1 line-clamp-2">
                    {mod.description}
                  </p>
                </div>
              </div>
            </div>
          </Link>
        );
      })()}

      {/* CLASS TRIALS (R6) — lifetime per-class achievement chain.
          Each class has 4 trials that unlock a cosmetic title. Progress
          is derived live from hero + progress stats (no schema work)
          so future stat-tracking additions can layer cleanly. */}
      {(() => {
        const stats = {
          lifetimeRuns: hero.lifetime_runs ?? 0,
          bestStreak: hero.best_streak ?? 0,
          lifetimeScore: hero.lifetime_score ?? 0,
          highestUnlockedLevel: progress.highest_unlocked_level,
        };
        const trials = getClassTrials(hero.class);
        const { done, total } = classTrialProgressCount(hero.class, stats);
        return (
          <div className="glass-card p-3.5">
            <div className="flex items-center gap-1.5 mb-2.5">
              <Trophy className="w-3.5 h-3.5 text-gold" />
              <span className="font-rd-display text-[10px] font-extrabold tracking-[0.18em] uppercase text-gold">
                Class Trials
              </span>
              <span className="ml-auto text-[10px] font-extrabold tabular-nums text-foreground/70">
                {done} / {total}
              </span>
            </div>
            <div className="space-y-1.5">
              {trials.map(t => {
                const { progress: p, target } = t.evaluate(stats);
                const isDone = p >= target;
                const pct = Math.min(100, Math.round((p / target) * 100));
                return (
                  <div
                    key={t.id}
                    className={`rounded-lg p-2.5 ${isDone ? 'bg-gold/8 border border-gold/35' : 'bg-muted/20 border border-border/25'}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {isDone ? (
                        <Check className="w-3 h-3 flex-shrink-0 text-gold" strokeWidth={3} />
                      ) : (
                        <span className="w-3 h-3 rounded-full border-[1.5px] border-muted-foreground/40 flex-shrink-0" aria-hidden />
                      )}
                      <p className={`text-[11.5px] font-extrabold tracking-tight leading-none truncate ${isDone ? 'text-gold' : 'text-foreground/85'}`}>
                        {t.title}
                      </p>
                      <span className="ml-auto text-[9px] font-bold tabular-nums text-muted-foreground/55 flex-shrink-0">
                        {isDone ? '✓' : `${p.toLocaleString()}/${target.toLocaleString()}`}
                      </span>
                    </div>
                    {/* Subtle progress bar — shown when in-progress only;
                        completed rows already read as done via the icon. */}
                    {!isDone && (
                      <div className="h-1 rounded-full bg-foreground/8 overflow-hidden">
                        <div
                          className="h-full bg-gold/55 transition-[width]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                    <p className={`text-[10px] leading-snug mt-1 ${isDone ? 'text-foreground/70' : 'text-muted-foreground/60'}`}>
                      {t.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Hero snapshot */}
      <Link to="/rune-delve/hero" className="block">
        <div className="glass-card p-4 flex items-center gap-3 btn-press">
          <ClassBadge cls={hero.class} size="lg" />
          <div className="flex-1 min-w-0">
            <p className="font-rd-display font-extrabold text-[15px] truncate tracking-wide">{hero.hero_name}</p>
            {activeTitle && (
              <p className="text-[10px] font-extrabold text-primary truncate">
                ✦ {activeTitle}
              </p>
            )}
            <p className="text-[10px] text-foreground/75 font-extrabold mt-0.5">{cls.name} · Lv {activeLevel}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] font-extrabold text-foreground/75">Lv {activeLevel}</span>
              <div className="flex-1 h-1.5 rounded-full bg-muted/50 overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${xpPct}%` }} />
              </div>
              <span className="text-[10px] font-mono text-foreground/70 tabular-nums">{lvl.intoLevel}/{lvl.needed}</span>
            </div>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="flex items-center gap-1 text-[10px] font-extrabold text-foreground/80">
                <Flame className="w-3 h-3" style={{ color: 'hsl(var(--gold))' }} /> {hero.current_streak}-day streak
              </span>
              <span className="text-[10px] text-foreground/70">· {progress.total_levels_cleared} cleared</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-foreground/60" />
        </div>
      </Link>

      {/* Campaign leaderboard preview */}
      <Link to="/rune-delve/leaderboard" className="block">
        <div className="glass-card p-4 btn-press">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-rd-display font-extrabold text-[14px] flex items-center gap-1.5 tracking-wide"><Trophy className="w-3.5 h-3.5 text-gold" /> Campaign Leaders</h3>
            {myRank && <span className="text-[10px] font-extrabold text-foreground/75">You: #{myRank}</span>}
          </div>
          {ahead && (
            <div className="mb-2 px-2.5 py-1.5 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-between gap-2">
              <span className="text-[11px] font-extrabold text-accent truncate">
                {aheadGap === 1 ? '1 level' : `${aheadGap} levels`} behind {ahead.hero?.hero_name ?? ahead.profile.display_name ?? 'a rival'}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-accent shrink-0" />
            </div>
          )}
          {top3.length === 0 ? (
            <p className="text-[11px] text-center text-foreground/75 py-2">Be the first to delve.</p>
          ) : (
            <div className="space-y-1.5">
              {top3.map((r) => (
                <div key={r.id} className="flex items-center gap-2.5 text-[12px]">
                  <span className="w-5 font-mono font-extrabold text-foreground/75">#{r.rank}</span>
                  {r.hero?.class && <ClassBadge cls={r.hero.class as HeroClass} size="sm" />}
                  <span className="font-rd-display flex-1 truncate font-extrabold tracking-wide">{r.hero?.hero_name ?? r.profile.display_name}</span>
                  <span className="font-mono font-extrabold tabular-nums" style={{ color: 'hsl(var(--gold))' }}>L{r.highest_completed_level}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Link>

      {/* Gear & Progression group */}
      <Section label="Explore" />
      <HomeGroup id="gear" icon={<Wrench className="w-3.5 h-3.5 text-primary" />} label="Gear & Progression">
        {loadout && (() => {
          const equipped = [loadout.slot_1, loadout.slot_2, loadout.slot_3].filter(Boolean) as string[];
          return (
            <GroupRow
              to="/rune-delve/armory"
              icon={<Shield className="w-4 h-4 text-primary" />}
              label="Active Loadout"
              detail={equipped.length === 0 ? 'No relics equipped' : equipped.map(id => RELIC_BY_ID[id]?.name ?? '?').join(' · ')}
            />
          );
        })()}
        <GroupRow to="/rune-delve/shop" icon={<ShoppingBag className="w-4 h-4 text-primary" />} label="Shop" />
        <GroupRow to="/rune-delve/armory" icon={<Shield className="w-4 h-4 text-primary" />} label="Armory" />
        <GroupRow to="/rune-delve/bestiary" icon={<BookOpen className="w-4 h-4 text-primary" />} label="Bestiary" />
        <GroupRow to="/rune-delve/history" icon={<HistoryIcon className="w-4 h-4 text-primary" />} label="History" />
        <GroupRow to="/rune-delve/hero" icon={<UserIcon className="w-4 h-4 text-primary" />} label="Hero details" />
      </HomeGroup>

      {/* Help & Reference group */}
      <Section label="Reference" />
      <HomeGroup id="help" icon={<HelpCircle className="w-3.5 h-3.5 text-accent" />} label="Help & Reference">
        <GroupRow onClick={() => setHelpOpen(true)} icon={<BookOpen className="w-4 h-4 text-primary" />} label="How to Play" />
        <GroupRow onClick={() => setCodexOpen(true)} icon={<ScrollText className="w-4 h-4 text-accent" />} label="Codex" />
      </HomeGroup>

      <HowToPlaySheet open={helpOpen} onOpenChange={setHelpOpen} heroClass={hero.class} />
      <CodexSheet open={codexOpen} onOpenChange={setCodexOpen} />
    </div>
  );
}

/** Tiny uppercase eyebrow + thin divider, used to break the home into sections. */
function Section({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 pt-1 px-1">
      <span className="text-[9px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground">{label}</span>
      <div className="flex-1 h-px bg-border/60" />
    </div>
  );
}

/** Collapsible group with localStorage-persisted open state. */
function HomeGroup({ id, icon, label, children }: { id: string; icon: React.ReactNode; label: string; children: React.ReactNode }) {
  const storageKey = `rd_home_group_${id}`;
  const [open, setOpen] = useState<boolean>(() => {
    try { return localStorage.getItem(storageKey) === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(storageKey, open ? '1' : '0'); } catch {}
  }, [open, storageKey]);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="glass-card overflow-hidden">
        <CollapsibleTrigger className="w-full p-3 flex items-center gap-2 btn-press">
          {icon}
          <span className="font-rd-display text-[12px] font-extrabold tracking-wide flex-1 text-left">{label}</span>
          <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border/40 divide-y divide-border/30">
            {children}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

/** Single list row inside a HomeGroup. Acts as Link when `to` is set, button when `onClick` is set. */
function GroupRow({ to, onClick, icon, label, detail }: { to?: string; onClick?: () => void; icon: React.ReactNode; label: string; detail?: string }) {
  const inner = (
    <div className="w-full px-3 py-2.5 flex items-center gap-3 btn-press text-left">
      <div className="shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-extrabold leading-tight">{label}</p>
        {detail && <p className="text-[10px] text-muted-foreground truncate mt-0.5">{detail}</p>}
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
    </div>
  );
  if (to) return <Link to={to} className="block">{inner}</Link>;
  return <button type="button" onClick={onClick} className="w-full block">{inner}</button>;
}
