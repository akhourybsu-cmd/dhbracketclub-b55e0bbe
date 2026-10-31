import { useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Trophy, Crown, Award, Flame, Target, Zap, Timer, TrendingUp,
  Sparkles, Medal, Loader2, RefreshCw, ChevronRight, ChevronDown,
  Gem, BarChart3, Users,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { useCountUp } from '@/lib/draft/animations';
import { useDraftStatsHub } from '@/hooks/useDraftStatsHub';
import { formatSeasonTitle } from '@/hooks/useDraftSeasons';
import {
  filterDatasetByScope,
  countDraftComposition,
  computeUserAggregate,
  computePickQuality,
  computeTiming,
  computeCareerPulse,
  computeLongestStreak,
  computeTopicTendencies,
  computeLeaderboard,
  computeFunAwards,
  computeIdentityProfile,
  computeAchievements,
  fmtDuration,
  displayName,
  type ScopeKey,
  type LeaderMetric,
} from '@/lib/draft/statsAggregators';
import { Archive } from 'lucide-react';
import AchievementsPanel from './AchievementsPanel';

function Counter({ value, decimals = 0, suffix = '' }: { value: number; decimals?: number; suffix?: string }) {
  const animated = useCountUp(value);
  return <span>{decimals > 0 ? animated.toFixed(decimals) : Math.round(animated).toLocaleString()}{suffix}</span>;
}

function UserAvatar({ name, url, size = 28 }: { name: string; url: string | null; size?: number }) {
  return (
    <Avatar style={{ width: size, height: size }}>
      {url && <AvatarImage src={url} alt={name} />}
      <AvatarFallback className="text-[10px] font-bold">{Array.from(name.trim()).slice(0, 2).join('').toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}

function SectionLabel({ icon: Icon, children, accent }: { icon: any; children: React.ReactNode; accent?: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-2 mt-1 px-0.5">
      <Icon className="w-3.5 h-3.5" style={{ color: accent || 'hsl(var(--gold))' }} />
      <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/80">{children}</span>
    </div>
  );
}

/* ─── Scope bar ───
   Seasons first (chronological), then the special "Misc" chip if
   the user actually has misc drafts, with "All-Time" leading. The
   composition row below shows the breakdown — "X seasoned · Y misc"
   — so users can see at a glance which bucket their drafts fall into.
*/
function ScopeBar({ scope, onScope, seasons, composition }: {
  scope: ScopeKey;
  onScope: (s: ScopeKey) => void;
  seasons: { id: string; name: string }[];
  composition: { seasoned: number; misc: number; total: number };
}) {
  const hasMisc = composition.misc > 0;
  return (
    <div className="mb-3">
      <div className="-mx-1 px-1 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 min-w-max pb-1">
          <button
            onClick={() => onScope('all')}
            className={cn('px-3 h-11 min-w-11 rounded-full text-[11px] font-bold whitespace-nowrap transition-colors btn-press border',
              scope === 'all'
                ? 'bg-gold/20 text-gold border-gold/40'
                : 'bg-muted/30 text-muted-foreground border-border/30')}>
            All-Time
          </button>
          {seasons.map(s => (
            <button key={s.id} onClick={() => onScope(s.id)} title={s.name}
              className={cn('px-3 h-11 min-w-11 max-w-52 truncate rounded-full text-[11px] font-bold whitespace-nowrap transition-colors btn-press border',
                scope === s.id
                  ? 'bg-gold/20 text-gold border-gold/40'
                  : 'bg-muted/30 text-muted-foreground border-border/30')}>
              {s.name}
            </button>
          ))}
          {/* Misc chip is conditionally rendered — only appears once
              the user actually has a draft outside any season. A
              neutral/grey treatment (not gold) so it visually
              separates from the season chips. */}
          {hasMisc && (
            <button
              onClick={() => onScope('misc')}
              className={cn('px-3 h-11 min-w-11 rounded-full text-[11px] font-bold whitespace-nowrap transition-colors btn-press border inline-flex items-center gap-1.5',
                scope === 'misc'
                  ? 'bg-foreground/12 text-foreground border-foreground/30'
                  : 'bg-muted/30 text-muted-foreground border-border/30')}>
              <Archive className="w-3 h-3" />
              Misc
            </button>
          )}
        </div>
      </div>

      {/* Composition row — shows the seasoned/misc split so the user
          knows exactly what's behind each scope. Hidden when the user
          has no drafts (initial state) since the number would be 0/0. */}
      {composition.total > 0 && (
        <p className="text-[10px] text-muted-foreground/65 font-medium mt-1.5 px-1 tabular-nums">
          <span className="font-bold text-foreground/70">{composition.total}</span> total ·{' '}
          <span className="font-bold" style={{ color: 'hsl(var(--gold) / 0.85)' }}>{composition.seasoned}</span> in seasons
          {hasMisc && (
            <>
              {' · '}
              <span className="font-bold text-foreground/70">{composition.misc}</span> misc
            </>
          )}
        </p>
      )}
    </div>
  );
}

/* ─── Hero identity card ─── */
function HeroIdentity({ identity, agg, totalPoints }: { identity: { title: string; blurb: string }; agg: ReturnType<typeof computeUserAggregate>; totalPoints: number }) {
  if (!agg) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="relative rounded-2xl overflow-hidden p-5"
        style={{
          background: 'linear-gradient(135deg, hsl(var(--gold) / 0.18), hsl(var(--gold) / 0.04) 50%, transparent), linear-gradient(180deg, hsl(160 35% 7% / 0.92), hsl(160 50% 4% / 0.95))',
          border: '1px solid hsl(var(--gold) / 0.25)',
          boxShadow: '0 10px 40px -10px hsl(var(--gold) / 0.35)',
        }}>
        <div className="absolute -top-4 -right-4 text-[120px] leading-none opacity-[0.06] select-none pointer-events-none" aria-hidden>★</div>
        <div className="relative z-10">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80">Your Draft Identity</p>
          <h2 className="text-2xl font-extrabold mt-1 tracking-tight" style={{ color: 'hsl(var(--gold))' }}>{identity.title}</h2>
          <p className="text-[11px] text-muted-foreground/80 leading-snug mt-0.5">{identity.blurb}</p>
          <p className="text-[11px] text-muted-foreground/70 mt-1">
            {agg.draftsPlayed} draft{agg.draftsPlayed === 1 ? '' : 's'} · {(agg.winRate * 100).toFixed(0)}% win rate · {(agg.podiumRate * 100).toFixed(0)}% podium rate
          </p>
          <div className="grid grid-cols-3 gap-2 mt-4">
            {[
              { v: totalPoints, l: 'Lifetime Pts' },
              { v: agg.wins, l: 'Wins' },
              { v: agg.podiums, l: 'Podiums' },
            ].map(s => (
              <div key={s.l} className="text-center bg-background/30 rounded-xl py-2.5 border border-border/15">
                <p className="text-xl font-extrabold leading-none tabular-nums" style={{ color: 'hsl(var(--gold))' }}>
                  <Counter value={s.v} />
                </p>
                <p className="text-[9px] text-muted-foreground/70 font-bold mt-1 uppercase tracking-wider">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Trophy case ─── */
function TrophyCase({ agg, longestStreak, mvpPicks }: {
  agg: ReturnType<typeof computeUserAggregate>;
  longestStreak: number;
  mvpPicks: number;
}) {
  if (!agg) return null;
  const items = [
    { icon: Crown, label: 'Championships', value: agg.championships, color: 'hsl(var(--gold))' },
    { icon: Trophy, label: 'Regular Titles', value: agg.regularSeasonTitles, color: 'hsl(var(--gold))' },
    { icon: Award, label: 'Finals Apps', value: agg.finalsAppearances, color: 'hsl(45 90% 60%)' },
    { icon: Medal, label: '3rd Place', value: agg.thirdPlaceMedals, color: 'hsl(28 80% 55%)' },
    { icon: Sparkles, label: 'Podiums', value: agg.podiums, color: 'hsl(48 90% 60%)' },
    { icon: Gem, label: 'MVP Picks', value: mvpPicks, color: 'hsl(180 60% 55%)' },
    { icon: Flame, label: 'Hot Streak', value: longestStreak, color: 'hsl(15 80% 55%)' },
  ];
  return (
    <div>
      <SectionLabel icon={Trophy}>Trophy Case</SectionLabel>
      {/* 7 items: phones get a clean 4-row x 2-col layout instead of
          the awkward 4+3 that grid-cols-4 forces; sm+ keeps the wider
          row so the case fills the desktop column. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {items.map(it => (
          <div key={it.label} className="da-glass p-2 text-center">
            <it.icon className="w-3.5 h-3.5 mx-auto mb-1" style={{ color: it.color }} />
            <p className="text-sm font-extrabold tabular-nums leading-none" style={{ color: it.value > 0 ? it.color : 'hsl(var(--muted-foreground) / 0.5)' }}>
              {it.value}
            </p>
            <p className="text-[9.5px] text-muted-foreground/60 font-bold mt-0.5 uppercase tracking-wider truncate">{it.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Career pulse sparkline ─── */
function CareerPulse({ points }: { points: ReturnType<typeof computeCareerPulse> }) {
  const gradientId = `draft-career-pulse-${useId().replace(/:/g, '')}`;
  // 1-draft users: show a teaser card instead of silently hiding the
  // whole Career Pulse section. The graph needs two points to draw a
  // line — but signalling "one more draft unlocks this" is way more
  // motivating than a missing section.
  if (points.length === 1) {
    return (
      <div>
        <SectionLabel icon={TrendingUp}>Career Pulse</SectionLabel>
        <div className="da-glass p-4 flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'hsl(var(--gold) / 0.12)', border: '1px solid hsl(var(--gold) / 0.3)' }}
          >
            <Sparkles className="w-4 h-4" style={{ color: 'hsl(var(--gold))' }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-extrabold">Your trend unlocks at draft #2</p>
            <p className="text-[10.5px] text-muted-foreground/70 leading-snug mt-0.5">
              Finish one more draft to see your score line — and whether you're trending up.
            </p>
          </div>
        </div>
      </div>
    );
  }
  if (points.length < 2) return null;
  const scores = points.map(p => p.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;
  const W = 320, H = 80, pad = 6;
  const innerW = W - pad * 2;
  const innerH = H - pad * 2;
  const xy = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * innerW;
    const y = pad + innerH - ((p.score - min) / range) * innerH;
    return [x, y] as const;
  });
  const path = xy.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${path} L ${xy[xy.length - 1][0]} ${H - pad} L ${xy[0][0]} ${H - pad} Z`;
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const trend = scores[scores.length - 1] - scores[0];
  return (
    <div>
      <SectionLabel icon={TrendingUp}>Career Pulse</SectionLabel>
      <div className="da-glass p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-[10px] text-muted-foreground/70 font-bold uppercase tracking-wider">Score over time</p>
            <p className="text-lg font-extrabold tabular-nums">{avg.toFixed(1)} <span className="text-[10px] text-muted-foreground/60">avg</span></p>
          </div>
          <div className={cn('text-right')}>
            <p className="text-[10px] text-muted-foreground/70 font-bold uppercase tracking-wider">Trend</p>
            <p className={cn('text-sm font-extrabold tabular-nums', trend > 0 ? 'text-success' : trend < 0 ? 'text-destructive' : 'text-muted-foreground')}>
              {trend > 0 ? '↗' : trend < 0 ? '↘' : '→'} {Math.abs(trend).toFixed(1)}
            </p>
          </div>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-20" preserveAspectRatio="none" role="img" aria-label="Draft scores over time" data-testid="draft-career-pulse">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--gold))" stopOpacity="0.35" />
              <stop offset="100%" stopColor="hsl(var(--gold))" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${gradientId})`} />
          <path d={path} fill="none" stroke="hsl(var(--gold))" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {xy.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={points[i].rank === 1 ? 3 : 1.8}
              fill={points[i].rank === 1 ? 'hsl(var(--gold))' : 'hsl(var(--gold) / 0.6)'} />
          ))}
        </svg>
        <p className="text-[9px] text-muted-foreground/50 mt-1.5 text-center">{points.length} draft{points.length === 1 ? '' : 's'} · gold dot = win</p>
      </div>
    </div>
  );
}

/* ─── Pick quality ─── */
function PickQualityCard({ pq }: { pq: ReturnType<typeof computePickQuality> }) {
  if (pq.totalRated === 0) return null;
  const maxBucket = Math.max(...pq.histogram);
  return (
    <div>
      <SectionLabel icon={Target}>Pick Quality</SectionLabel>
      <div className="da-glass p-4 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center">
            <p className="text-base font-extrabold tabular-nums" style={{ color: 'hsl(var(--gold))' }}>{pq.avgPickScore.toFixed(2)}</p>
            <p className="text-[9px] text-muted-foreground/70 font-bold mt-0.5">Avg Pick</p>
          </div>
          <div className="text-center">
            <p className="text-base font-extrabold tabular-nums text-success">{(pq.stealRate * 100).toFixed(0)}%</p>
            <p className="text-[9px] text-muted-foreground/70 font-bold mt-0.5">Steal Rate</p>
          </div>
          <div className="text-center">
            <p className="text-base font-extrabold tabular-nums text-destructive">{(pq.bustRate * 100).toFixed(0)}%</p>
            <p className="text-[9px] text-muted-foreground/70 font-bold mt-0.5">Bust Rate</p>
          </div>
        </div>
        <div>
          <div className="flex items-end gap-0.5 h-16 px-1">
            {pq.histogram.map((c, i) => (
              /* The column must be full-height or the bar's percentage
                 height resolves against an auto-height parent and
                 collapses to a sliver — which is what made this chart
                 look like an empty box. */
              <div key={i} className="flex-1 h-full flex flex-col justify-end items-center">
                <div className="w-full rounded-t transition-all"
                  style={{
                    height: `${maxBucket ? Math.max((c / maxBucket) * 100, c > 0 ? 6 : 0) : 0}%`,
                    background: i >= 7 ? 'hsl(var(--gold))' : i >= 5 ? 'hsl(var(--gold) / 0.5)' : 'hsl(var(--muted-foreground) / 0.35)',
                  }} />
              </div>
            ))}
          </div>

          <div className="flex justify-between mt-1 px-1">
            <span className="text-[9.5px] text-muted-foreground/50">0</span>
            <span className="text-[9.5px] text-muted-foreground/50">5</span>
            <span className="text-[9.5px] text-muted-foreground/50">10</span>
          </div>
        </div>
        <div className="flex items-center gap-2 pt-1 border-t border-border/15">
          <div className="flex-1 text-center">
            <p className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-wider">Early</p>
            <p className="text-sm font-extrabold tabular-nums">{pq.earlyAvg.toFixed(2)}</p>
          </div>
          <div className="w-px h-8 bg-border/20" />
          <div className="flex-1 text-center">
            <p className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-wider">Late</p>
            <p className="text-sm font-extrabold tabular-nums">{pq.lateAvg.toFixed(2)}</p>
          </div>
          <div className="w-px h-8 bg-border/20" />
          <div className="flex-1 text-center">
            <p className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-wider">MVPs</p>
            <p className="text-sm font-extrabold tabular-nums" style={{ color: 'hsl(var(--gold))' }}>{pq.topMvpPicks}</p>
          </div>
        </div>
        {pq.bestPick && (
          <div className="rounded-lg p-2.5 bg-success/10 border border-success/20">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Sparkles className="w-3 h-3 text-success" />
              <span className="text-[9px] font-bold uppercase tracking-wider text-success">Best Pick</span>
              <span className="text-[10px] font-extrabold ml-auto tabular-nums text-success">{pq.bestPick.score.toFixed(1)}</span>
            </div>
            <p className="text-[12px] font-bold truncate">{pq.bestPick.text}</p>
            <p className="text-[9px] text-muted-foreground/60 truncate">{pq.bestPick.draftTopic}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Timing ─── */
function TimingCard({ t }: { t: ReturnType<typeof computeTiming> }) {
  if (t.sampleCount === 0) return null;
  return (
    <div>
      <SectionLabel icon={Timer}>Tempo</SectionLabel>
      <div className="da-glass p-4">
        <div className="grid grid-cols-4 gap-2">
          {[
            { l: 'Avg', v: fmtDuration(t.avgMs), c: 'hsl(var(--gold))' },
            { l: 'Fastest', v: fmtDuration(t.fastestMs), c: 'hsl(140 60% 55%)' },
            { l: 'Slowest', v: fmtDuration(t.slowestMs), c: 'hsl(28 80% 55%)' },
            { l: 'On Clock', v: fmtDuration(t.totalMs), c: 'hsl(var(--muted-foreground))' },
          ].map(s => (
            <div key={s.l} className="text-center">
              <p className="text-[12px] font-extrabold tabular-nums" style={{ color: s.c }}>{s.v}</p>
              <p className="text-[9px] text-muted-foreground/60 font-bold mt-0.5 uppercase tracking-wider">{s.l}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Leaderboard list ─── */
const LEADERBOARDS: { key: LeaderMetric; label: string; icon: any }[] = [
  { key: 'wins', label: 'Most Wins', icon: Crown },
  { key: 'championships', label: 'Most Championships', icon: Trophy },
  { key: 'podiums', label: 'Most Podiums', icon: Medal },
  { key: 'draftsPlayed', label: 'Most Drafts', icon: Users },
  { key: 'avgScore', label: 'Highest Avg Score', icon: TrendingUp },
  { key: 'highestSingleScore', label: 'Highest Single Score', icon: Sparkles },
  { key: 'consistency', label: 'Most Consistent', icon: Target },
  { key: 'mvpPicks', label: 'Most MVP Picks', icon: Gem },
  { key: 'longestStreak', label: 'Longest Hot Streak', icon: Flame },
  { key: 'fastestAvg', label: 'Fastest Average', icon: Zap },
];

function Leaderboards({ dataset, userId }: { dataset: any; userId?: string }) {
  // Default-open four boards instead of two: previously only Wins +
  // Championships were visible at mount, so six other meaningful
  // boards were hidden behind a tap. The four open-by-default now are
  // the ones most likely to start a useful comparison conversation.
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(['wins', 'championships', 'avgScore', 'draftsPlayed']),
  );
  return (
    <div>
      <SectionLabel icon={BarChart3}>Leaderboards</SectionLabel>
      <div className="space-y-1.5">
        {LEADERBOARDS.map(lb => {
          const rows = computeLeaderboard(lb.key, dataset, userId).slice(0, 5);
          if (rows.length === 0) return null;
          const isOpen = expanded.has(lb.key);
          return (
            <div key={lb.key} className="da-glass overflow-hidden">
              <button
                onClick={() => setExpanded(prev => {
                  const n = new Set(prev);
                  if (n.has(lb.key)) n.delete(lb.key); else n.add(lb.key);
                  return n;
                })}
                aria-expanded={isOpen}
                className="w-full min-h-11 px-3.5 py-2.5 flex items-center gap-2 text-left">
                <lb.icon className="w-3.5 h-3.5" style={{ color: 'hsl(var(--gold))' }} />
                <span className="min-w-0 text-[12px] font-bold flex-1 [overflow-wrap:anywhere]">{lb.label}</span>
                {!isOpen && rows[0] && (
                  <span className="text-[10px] text-muted-foreground/70 truncate max-w-[80px]">
                    {rows[0].name}
                  </span>
                )}
                <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground/60 transition-transform', isOpen && 'rotate-180')} />
              </button>
              {isOpen && (
                <div className="border-t border-border/15 divide-y divide-border/10">
                  {rows.map((r, i) => {
                    const isMe = r.userId === userId;
                    return (
                      <div key={r.userId} className={cn('flex items-center gap-2.5 px-3.5 py-2', isMe && 'bg-gold/8')}>
                        <span className={cn('w-5 text-center text-[11px] font-extrabold tabular-nums',
                          i === 0 ? 'text-gold' : 'text-muted-foreground/70')}>{i + 1}</span>
                        <UserAvatar name={r.name} url={r.avatar} size={22} />
                        <span title={r.name} className={cn('min-w-0 text-[12px] font-bold flex-1 truncate', isMe && 'text-gold')}>
                          {r.name}{isMe && <span className="ml-1 text-[9.5px] opacity-70">YOU</span>}
                        </span>
                        <span className="shrink-0 text-[12px] font-extrabold tabular-nums" style={{ color: i === 0 ? 'hsl(var(--gold))' : undefined }}>
                          {r.display}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Topic tendencies ─── */
function TopicTendencies({ tt }: { tt: ReturnType<typeof computeTopicTendencies> }) {
  if (tt.totalDraftsPlayed === 0) return null;
  const maxCount = Math.max(...tt.byCategory.map(c => c.count), 1);
  return (
    <div>
      <SectionLabel icon={Sparkles}>Topic Tendencies</SectionLabel>
      <div className="da-glass p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="text-center bg-muted/20 rounded-lg p-2">
            <p className="text-sm font-extrabold tabular-nums">{tt.draftsCreated}</p>
            <p className="text-[9px] text-muted-foreground/70 font-bold mt-0.5 uppercase tracking-wider">Drafts Created</p>
          </div>
          <div className="text-center bg-muted/20 rounded-lg p-2">
            <p className="text-sm font-extrabold tabular-nums">{tt.totalDraftsPlayed}</p>
            <p className="text-[9px] text-muted-foreground/70 font-bold mt-0.5 uppercase tracking-wider">Drafts Joined</p>
          </div>
        </div>
        {tt.byCategory.length > 0 && (
          <div className="space-y-1.5">
            {tt.byCategory.map(c => (
              <div key={c.category} className="flex items-center gap-2">
                <span className="text-[11px] font-bold flex-shrink-0 w-24 truncate">{c.category}</span>
                <div className="flex-1 h-2 rounded-full bg-muted/30 overflow-hidden">
                  <div className="h-full rounded-full" style={{
                    width: `${(c.count / maxCount) * 100}%`,
                    background: 'linear-gradient(90deg, hsl(var(--gold) / 0.6), hsl(var(--gold)))',
                  }} />
                </div>
                <span className="text-[11px] font-extrabold tabular-nums w-8 text-right">{c.count}</span>
                <span className="text-[10px] text-muted-foreground/60 tabular-nums w-10 text-right">{c.avgScore.toFixed(1)}</span>
              </div>
            ))}
          </div>
        )}
        {(tt.bestCategory || tt.worstCategory) && (
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/15">
            {tt.bestCategory && (
              <div className="text-center">
                <p className="text-[9px] text-muted-foreground/70 font-bold uppercase tracking-wider">Best At</p>
                <p className="text-[12px] font-extrabold truncate text-success">{tt.bestCategory.category}</p>
                <p className="text-[10px] text-muted-foreground/60 tabular-nums">{tt.bestCategory.avgScore.toFixed(1)} avg</p>
              </div>
            )}
            {tt.worstCategory && (
              <div className="text-center">
                <p className="text-[9px] text-muted-foreground/70 font-bold uppercase tracking-wider">Toughest</p>
                <p className="text-[12px] font-extrabold truncate text-destructive">{tt.worstCategory.category}</p>
                <p className="text-[10px] text-muted-foreground/60 tabular-nums">{tt.worstCategory.avgScore.toFixed(1)} avg</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Fun awards ─── */
function FunAwards({ awards, userId }: { awards: ReturnType<typeof computeFunAwards>; userId?: string }) {
  if (awards.length === 0) return null;
  return (
    <div>
      <SectionLabel icon={Sparkles}>Hall of Fame</SectionLabel>
      <div className="grid grid-cols-2 gap-1.5">
        {awards.map(a => {
          const isMe = a.winnerId === userId;
          return (
            <div key={a.key}
              className={cn('da-glass p-3', isMe && 'ring-1 ring-gold/40')}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg leading-none">{a.icon}</span>
                <p className="text-[11px] font-extrabold flex-1 truncate" style={{ color: 'hsl(var(--gold))' }}>{a.title}</p>
              </div>
              <p className="text-[12px] font-bold truncate">{a.winnerName}{isMe && <span className="ml-1 text-[9.5px] text-gold/80">YOU</span>}</p>
              <p className="text-[9px] text-muted-foreground/70 truncate mt-0.5">{a.value}</p>
              <p className="text-[9.5px] text-muted-foreground/50 mt-0.5 truncate">{a.caption}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Season-by-season collapsible ─── */
function SeasonHistory({ dataset, userId }: { dataset: any; userId?: string }) {
  const rows = useMemo(() => {
    if (!userId) return [];
    return dataset.seasons
      .map((s: any) => {
        const st = dataset.standings.find((x: any) => x.season_id === s.id && x.user_id === userId);
        if (!st) return null;
        const isChampion = s.champion_user_id === userId;
        const isRunnerUp = s.runner_up_user_id === userId;
        const isThird = s.third_place_user_id === userId;
        const isRegChamp = s.regular_season_champion_user_id === userId;
        return { season: s, st, isChampion, isRunnerUp, isThird, isRegChamp };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.season.starts_at.localeCompare(a.season.starts_at));
  }, [dataset, userId]);

  if (rows.length === 0) return null;
  return (
    <div>
      <SectionLabel icon={Trophy}>Season-by-Season</SectionLabel>
      {/* Each row is now a Link to the season archive detail page, so
          users can drill from "here's your career profile" into "what
          actually happened in that season." Chevron affordance + hover
          state make the tap target obvious. */}
      <div className="da-glass overflow-hidden divide-y divide-border/10">
        {rows.map((r: any) => (
          <Link
            key={r.season.id}
            to={`/drafts/seasons/${r.season.id}`}
            className="px-3.5 py-2.5 flex items-center gap-3 transition-colors hover:bg-gold/8 active:bg-gold/12"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-[12px] font-bold truncate">{formatSeasonTitle({ season_number: r.season.season_number, name: r.season.name })}</p>
                {r.isChampion && <Crown className="w-3 h-3 flex-shrink-0" style={{ color: 'hsl(var(--gold))' }} />}
                {r.isRegChamp && !r.isChampion && <Trophy className="w-3 h-3 flex-shrink-0 text-muted-foreground/60" />}
              </div>
              <p className="text-[9px] text-muted-foreground/60">
                Rank {r.st.rank || '—'} · {r.st.wins}W · {r.st.podiums}P · σ {Number(r.st.consistency).toFixed(2)}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[14px] font-extrabold tabular-nums" style={{ color: 'hsl(var(--gold))' }}>{r.st.season_points}</p>
              <p className="text-[9.5px] text-muted-foreground/60 font-bold uppercase tracking-wider">pts</p>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ─── Loading skeleton ─── */
function LoadingState() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="da-glass p-5">
          <div className="h-4 rounded-lg w-1/3 mb-2.5 skeleton-shimmer" />
          <div className="h-3 rounded-lg w-1/2 skeleton-shimmer" />
        </div>
      ))}
    </div>
  );
}

/* ─── Main hub ─── */
export default function DraftStatsHub() {
  const { user } = useAuth();
  const { dataset, loading, error, refresh } = useDraftStatsHub();
  const [scope, setScope] = useState<ScopeKey>('all');

  const scoped = useMemo(() => filterDatasetByScope(dataset, scope), [dataset, scope]);

  const agg = useMemo(() => user ? computeUserAggregate(user.id, scoped) : null, [scoped, user]);
  const pq = useMemo(() => user ? computePickQuality(user.id, scoped) : null, [scoped, user]);
  const timing = useMemo(() => user ? computeTiming(user.id, scoped) : null, [scoped, user]);
  const pulse = useMemo(() => user ? computeCareerPulse(user.id, scoped) : [], [scoped, user]);
  const streak = useMemo(() => user ? computeLongestStreak(user.id, scoped) : 0, [scoped, user]);
  const tt = useMemo(() => user ? computeTopicTendencies(user.id, scoped) : null, [scoped, user]);
  const awards = useMemo(() => computeFunAwards(scoped), [scoped]);
  const identity = useMemo(() => (agg && pq && timing)
    ? computeIdentityProfile(agg, pq, timing)
    : { title: 'Drafter', blurb: 'Grinding out the reps.', tier: 'base' as const }, [agg, pq, timing]);
  const achievements = useMemo(() => user ? computeAchievements(user.id, scoped) : [], [scoped, user]);

  const seasonChips = useMemo(() =>
    [...dataset.seasons]
      .sort((a, b) => {
        const an = a.season_number ?? -1;
        const bn = b.season_number ?? -1;
        if (an !== bn) return bn - an;
        return b.starts_at.localeCompare(a.starts_at);
      })
      .map(s => ({ id: s.id, name: formatSeasonTitle({ season_number: s.season_number, name: s.name }) })),
    [dataset.seasons],
  );

  // Composition is computed against the FULL dataset (not `scoped`)
  // so the breakdown shown in the scope bar is always the true total,
  // regardless of which scope is active.
  const composition = useMemo(() => countDraftComposition(dataset, user?.id), [dataset, user?.id]);

  if (loading) return <LoadingState />;
  if (error) return (
    <div className="da-glass p-5 text-center">
      <p className="text-[12px] font-bold mb-2">Couldn't load stats</p>
      <p className="text-[10px] text-muted-foreground mb-3">{error}</p>
      <button onClick={refresh} className="px-3 h-11 min-w-11 rounded-lg text-[11px] font-bold btn-press inline-flex items-center gap-1.5 bg-gold/15 text-gold">
        <RefreshCw className="w-3.5 h-3.5" /> Retry
      </button>
    </div>
  );

  if (dataset.results.length === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="empty-state">
        <div className="da-page-icon" style={{ width: '3.5rem', height: '3.5rem', borderRadius: '1rem' }}>
          <BarChart3 className="w-7 h-7" />
        </div>
        <p className="empty-state-title">No stats yet</p>
        <p className="empty-state-desc">Complete a draft to start tracking lifetime stats, leaderboards, and awards.</p>
      </motion.div>
    );
  }

  const noPersonal = !agg || agg.draftsPlayed === 0;

  // A scope can be empty even when the full dataset isn't (e.g. a season the
  // user sat out). Without this, every section short-circuits to null and
  // the page renders as a bare scope bar with no explanation.
  const scopeEmpty = scoped.results.length === 0;

  return (
    <div className="space-y-3 pb-4 da-career-stats min-w-0">
      {/* Scope chips stay full-width above the dashboard grid so they
          read as a global filter for everything below. */}
      <ScopeBar scope={scope} onScope={setScope} seasons={seasonChips} composition={composition} />

      {/* Misc-scope banner — when the user has picked the Misc scope,
          surface a brief explanation so it's unambiguous: this view
          covers only the drafts that aren't tied to any season, and
          season-only awards (championships, regular titles, finals
          appearances, 3rd-place medals) will all show 0 because they
          don't apply outside a season. Without this, a user seeing
          "0 Championships" in misc scope might think their data is
          missing. */}
      {scope === 'misc' && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-border/35 bg-card/50 px-3.5 py-2.5 flex items-start gap-2.5"
        >
          <Archive className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-muted-foreground/75" />
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground/85">
              Misc scope · {composition.misc} {composition.misc === 1 ? 'draft' : 'drafts'}
            </p>
            <p className="text-[10.5px] text-muted-foreground/65 leading-snug mt-0.5">
              These drafts aren't tied to any season. Championships, Regular Titles,
              Finals Apps and Season Points all show 0 here — they're season-only.
            </p>
          </div>
        </motion.div>
      )}

      {/* Two-column dashboard on lg+:
            LEFT  — "You + your numbers"   (Hero · Trophy · Pulse · Pick Quality)
            RIGHT — "Comparison + context" (Timing · Leaderboards · Topics · Awards · Seasons)
          Mobile/tablet is a single column with the previous order preserved.
          items-start so columns at different heights align cleanly. */}
      {scopeEmpty ? (
        <div className="da-glass p-5 text-center">
          <BarChart3 className="w-6 h-6 mx-auto mb-2 text-muted-foreground/50" />
          <p className="text-[12.5px] font-extrabold">No scored drafts in this view</p>
          <p className="text-[10.5px] text-muted-foreground/65 leading-snug mt-1">
            {scope === 'misc'
              ? 'None of your off-season drafts have a generated report yet.'
              : 'This season has no completed Draft Reports yet — stats appear once a draft is scored.'}
          </p>
          <button
            onClick={() => setScope('all')}
            className="mt-3 px-3 h-11 min-w-11 rounded-lg text-[11px] font-bold btn-press bg-gold/15 text-gold"
          >
            View all-time
          </button>
        </div>
      ) : (
      <div className="lg:grid lg:grid-cols-2 lg:gap-4 lg:items-start space-y-3 lg:space-y-0">
        {/* LEFT column */}
        <div className="space-y-3">
          {!noPersonal && agg && (
            <HeroIdentity identity={identity} agg={agg} totalPoints={agg.totalSeasonPoints} />
          )}

          {!noPersonal && agg && (
            <TrophyCase agg={agg} longestStreak={streak} mvpPicks={pq?.topMvpPicks || 0} />
          )}

          {/* CareerPulse renders a teaser at length === 1 (see component),
              so the gate is >= 1. The component itself short-circuits on 0. */}
          {pulse.length >= 1 && <CareerPulse points={pulse} />}

          {pq && pq.totalRated > 0 && <PickQualityCard pq={pq} />}

          {!noPersonal && <AchievementsPanel achievements={achievements} />}
        </div>

        {/* RIGHT column */}
        <div className="space-y-3">
          {timing && timing.sampleCount > 0 && <TimingCard t={timing} />}

          <Leaderboards dataset={scoped} userId={user?.id} />

          {tt && <TopicTendencies tt={tt} />}

          <FunAwards awards={awards} userId={user?.id} />

          {/* Scope-aware: in a season scope this narrows to that season,
              in Misc scope it renders nothing (no seasons in the slice). */}
          <SeasonHistory dataset={scoped} userId={user?.id} />
        </div>
      </div>
      )}

      <button onClick={refresh}
        className="w-full h-11 rounded-lg bg-muted/40 text-[11px] font-bold text-foreground/70 hover:bg-muted/60 btn-press flex items-center justify-center gap-1.5">
        <RefreshCw className="w-3.5 h-3.5" /> Refresh stats
      </button>
    </div>
  );
}
