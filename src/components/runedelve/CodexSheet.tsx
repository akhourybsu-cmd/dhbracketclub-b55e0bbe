import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MECHANIC_LIST, MECHANICS } from '@/lib/runedelve/mechanics';
import { DAILY_MODIFIER_LIST, getDailyModifier } from '@/lib/runedelve/dailyModifiers';
import { MASTERY_TIERS, MASTERY_UNLOCK_LEVELS, nextMasteryFor, type MasteryTier } from '@/lib/runedelve/classMastery';
import { useTodayDaily, useMyDailyStreak } from '@/hooks/useDailyChallenge';
import { useRuneDelveHero } from '@/hooks/useRuneDelveHero';
import { useAllClassProgress } from '@/hooks/useRuneDelveClassProgress';
import { useMyProgress } from '@/hooks/useRuneDelveCampaign';
import { getClass, type HeroClass } from '@/lib/runedelve/classConfig';
import { ClassBadge } from './ClassBadge';
import { RELIC_CATALOG } from '@/lib/runedelve/relics';
import { Lock, Flame, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSheetSfx } from '@/hooks/useSheetSfx';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: 'mechanics' | 'daily' | 'masteries' | 'relics';
}

export function CodexSheet({ open, onOpenChange, defaultTab = 'mechanics' }: Props) {
  useSheetSfx(open);
  const { data: hero } = useRuneDelveHero();
  const { data: progress } = useMyProgress(hero?.class);
  const { data: classTracks } = useAllClassProgress();
  const today = useTodayDaily();
  const { data: streak } = useMyDailyStreak();

  const currentLevel = progress?.highest_unlocked_level ?? 1;
  const heroClass: HeroClass = hero?.class ?? 'warrior';
  const classLevel = (classTracks ?? []).find(t => t.class === heroClass)?.level ?? 1;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[92vh] rounded-t-3xl p-0 flex flex-col">
        <SheetHeader className="px-5 pt-5 pb-2 text-left shrink-0">
          <SheetTitle className="text-xl font-extrabold tracking-tight flex items-center gap-2">
            <span>📖</span> Codex
          </SheetTitle>
          <p className="text-[11px] text-muted-foreground">Everything you need to know about the runes, runs, and rewards.</p>
        </SheetHeader>
        <Tabs defaultValue={defaultTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-5 grid grid-cols-4 h-9 shrink-0">
            <TabsTrigger value="mechanics" className="text-[11px] font-bold">Mechanics</TabsTrigger>
            <TabsTrigger value="daily" className="text-[11px] font-bold">Daily</TabsTrigger>
            <TabsTrigger value="masteries" className="text-[11px] font-bold">Masteries</TabsTrigger>
            <TabsTrigger value="relics" className="text-[11px] font-bold">Relics</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-3">
            <div className="px-5 pb-10">
              {/* MECHANICS */}
              <TabsContent value="mechanics" className="mt-0 space-y-2.5">
                {MECHANIC_LIST.map(m => {
                  const unlocked = currentLevel >= m.introLevel;
                  return (
                    <div
                      key={m.id}
                      className={cn(
                        'glass-card p-3 flex gap-3 items-start',
                        !unlocked && 'opacity-60',
                      )}
                    >
                      <div className="text-2xl shrink-0 leading-none mt-0.5" aria-hidden>{m.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-rd-display font-extrabold text-[13px]">{m.name}</p>
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-muted text-muted-foreground">{m.family}</span>
                          {!unlocked && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-muted-foreground">
                              <Lock className="w-3 h-3" /> L{m.introLevel}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-foreground/80 leading-snug mt-1">{m.oneLiner}</p>
                      </div>
                    </div>
                  );
                })}
                <p className="text-[10px] text-muted-foreground text-center pt-2">
                  Mechanics introduce solo for 3 levels, then mix into deeper runs.
                </p>
              </TabsContent>

              {/* DAILY — Endless Survival */}
              <TabsContent value="daily" className="mt-0 space-y-3">
                <div className="glass-card p-4" style={{
                  background: 'linear-gradient(160deg, hsl(var(--gold) / 0.12), hsl(var(--primary) / 0.08))',
                  borderColor: 'hsl(var(--gold) / 0.25)',
                }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/70">Today · {today.dateStr}</p>
                  <p className="font-rd-display text-lg font-extrabold mt-0.5">Endless Survival</p>
                  <p className="text-[11px] text-foreground/75 mt-1">{today.timeLimitSec / 60}-minute timed arena · Kill as many as you can.</p>
                </div>

                <div className="rounded-xl border border-primary/25 bg-primary/5 p-3 text-[11px] text-foreground/85 leading-snug">
                  <p className="font-extrabold text-primary mb-1.5">How it works</p>
                  <ul className="space-y-0.5">
                    <li>• You have 2 minutes. No turn limit.</li>
                    <li>• Enemies spawn continuously and ramp every 20s.</li>
                    <li>• Run ends when timer hits 0 or HP reaches 0.</li>
                    <li>• Stronger relics + masteries → faster kills → bigger rewards.</li>
                  </ul>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <StreakStat label="Current" value={streak?.current_streak ?? 0} icon={<Flame className="w-3 h-3" />} />
                  <StreakStat label="Best" value={streak?.best_streak ?? 0} />
                  <StreakStat label="Lifetime" value={streak?.lifetime_clears ?? 0} />
                </div>

                <div className="rounded-xl border border-primary/25 bg-primary/5 p-3 text-[11px] text-foreground/85 leading-snug">
                  <p className="font-extrabold text-primary mb-1">Reward Ladder (kills)</p>
                  <ul className="space-y-0.5">
                    <li>• 0–4 → 25 shards</li>
                    <li>• 5–9 → 75 shards · ★</li>
                    <li>• 10–14 → 150 shards</li>
                    <li>• 15–19 → 250 shards · ★★</li>
                    <li>• 20–29 → 400 shards</li>
                    <li>• 25+ → ★★★</li>
                    <li>• 30+ → 600 shards · 🏆 Endless Conqueror</li>
                    <li>• 50+ → 900 shards · 🏆 Eternal</li>
                  </ul>
                </div>
              </TabsContent>

              {/* MASTERIES */}
              <TabsContent value="masteries" className="mt-0 space-y-3">
                <div className="glass-card p-3 flex items-center gap-3">
                  <ClassBadge cls={heroClass} size="lg" />
                  <div className="flex-1 min-w-0">
                    <p className="font-rd-display font-extrabold text-[14px]">{getClass(heroClass).name}</p>
                    <p className="text-[10px] text-muted-foreground">Class Level {classLevel} · Masteries unlock by leveling this class.</p>
                  </div>
                </div>

                {(() => {
                  const next = nextMasteryFor(heroClass, classLevel);
                  if (!next) return (
                    <div className="rounded-xl border border-gold/30 bg-gold/5 p-3 text-[11px] text-center font-extrabold" style={{ color: 'hsl(var(--gold))' }}>
                      All masteries unlocked. ✨
                    </div>
                  );
                  const pct = Math.min(100, Math.round((classLevel / next.unlockLevel) * 100));
                  return (
                    <div className="glass-card p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[11px] font-bold">Next: <span className="text-primary">{next.name}</span></p>
                        <p className="text-[10px] font-mono text-muted-foreground">Lv {classLevel}/{next.unlockLevel}</p>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })()}

                <div className="space-y-2">
                  {MASTERY_TIERS[heroClass].map(tier => (
                    <MasteryRow key={tier.id} tier={tier} classLevel={classLevel} />
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground text-center pt-2">
                  Tiers unlock at Lv {Object.values(MASTERY_UNLOCK_LEVELS).join(', ')}.
                </p>
              </TabsContent>

              {/* RELICS */}
              <TabsContent value="relics" className="mt-0 space-y-2">
                {RELIC_CATALOG.map(r => (
                  <div key={r.id} className="glass-card p-3 flex items-center gap-3">
                    <div className="text-xl shrink-0" aria-hidden>{r.icon ?? '✦'}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-extrabold text-[12px] truncate">{r.name}</p>
                      <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2">{r.description}</p>
                    </div>
                  </div>
                ))}
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function StreakStat({ label, value, icon }: { label: string; value: number; icon?: React.ReactNode }) {
  return (
    <div className="glass-card p-2.5 text-center">
      <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1 justify-center">
        {icon}{label}
      </p>
      <p className="font-mono font-extrabold text-base tabular-nums" style={{ color: 'hsl(var(--gold))' }}>{value}</p>
    </div>
  );
}

function MasteryRow({ tier, classLevel }: { tier: MasteryTier; classLevel: number }) {
  const unlocked = classLevel >= tier.unlockLevel;
  return (
    <div className={cn('glass-card p-3 flex items-start gap-3', !unlocked && 'opacity-60')}>
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-extrabold text-sm"
        style={{
          background: unlocked
            ? 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-glow)))'
            : 'hsl(var(--muted))',
          color: unlocked ? 'white' : 'hsl(var(--muted-foreground))',
        }}
      >
        {unlocked ? <Sparkles className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-extrabold text-[12px]">T{tier.tier} · {tier.name}</p>
          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Lv {tier.unlockLevel}</span>
        </div>
        <p className="text-[11px] text-foreground/80 leading-snug mt-0.5">{tier.summary}</p>
      </div>
    </div>
  );
}
