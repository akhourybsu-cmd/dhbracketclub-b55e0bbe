import { DaStatChip, DaSectionHeader } from '@/components/draft/ui/DraftKit';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { withTimeout, QUERY_TIMEOUT_MS, HYDRATE_TIMEOUT_MS } from '@/lib/asyncGuards';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/status-pill';
import {
  Bookmark, Plus, ArrowRight, Users, Play, Trophy, Award, Target, Archive,
  Calendar, TrendingUp, Crown, Swords, Shield, ChevronRight, ChevronDown,
  Medal, Sparkles, X, Loader2, RefreshCw, Flame, BarChart3, ListChecks, Search,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getDerivedDraftTurn } from '@/lib/draftTurn';
import draftEmblem from '@/assets/draft-emblem.png';
import { format, formatDistanceToNow } from 'date-fns';
import { useDraftListUpdates } from '@/hooks/useRealtimeSubscription';
import {
  useCurrentSeason,
  useSeasonStandings,
  useSeasonEntries,
  usePlayoffMatchesLive,
  usePlayoffMatchByDraftIds,
  useLifetimeStats,
  useIsCommissioner,
  useUnassignedDrafts,
  addDraftToSeason,
  removeDraftFromSeason,
  recalculateSeasonStandings,
  advancePlayoffs,
  suggestPlayoffTopics,
  startPlayoffMatch,
  getSeasonDraftTarget,
  formatSeasonTitle,
  type SeasonStanding,
  type PlayoffMatch,
} from '@/hooks/useDraftSeasons';
import {
  getOrdinalSuffix,
  getDraftLabel,
  getSeasonProgressText,
} from '@/lib/seasonUtils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { PlayoffBadge } from '@/components/draft/PlayoffBadge';
import { getPlayoffGameLabel } from '@/lib/playoffStyle';
import { StartNextSeasonSheet } from '@/components/draft/StartNextSeasonSheet';
import { TransferCommissionerCard } from '@/components/draft/TransferCommissionerCard';

import { lazy, Suspense } from 'react';

const DraftStatsHub = lazy(() => import('@/components/draft/stats/DraftStatsHub'));

const DRAFT_LIST_PAGE_SIZE = 1000;

async function fetchAllDraftListRows<T>(
  makeQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += DRAFT_LIST_PAGE_SIZE) {
    const { data, error } = await makeQuery(from, from + DRAFT_LIST_PAGE_SIZE - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < DRAFT_LIST_PAGE_SIZE) break;
  }
  return rows;
}

/* ══════════════════════════════════════════════════════════
   SEASON HEADER CARD
   ══════════════════════════════════════════════════════════ */
function SeasonHeaderCard({ season, entries }: { season: any; entries: any[] }) {
  const statusLabels: Record<string, { label: string; cls: string; dotCls: string }> = {
    upcoming: { label: 'Upcoming', cls: 'bg-muted text-muted-foreground', dotCls: 'bg-muted-foreground' },
    regular_season: { label: 'Regular Season', cls: 'bg-success/15 text-success border border-success/20', dotCls: 'bg-success' },
    playoffs: { label: 'Playoffs', cls: 'bg-gold/15 text-gold border border-gold/20', dotCls: 'bg-gold' },
    complete: { label: 'Complete', cls: 'bg-primary/10 text-primary', dotCls: 'bg-primary' },
  };
  const st = statusLabels[season.status] || statusLabels.upcoming;
  const isActive = season.status === 'regular_season' || season.status === 'playoffs';
  const totalDrafts = getSeasonDraftTarget(season);
  const completedDrafts = entries.filter(e => !e.is_playoff && e.drafts?.status === 'complete').length;
  const progressPct = totalDrafts > 0 ? Math.round((completedDrafts / totalDrafts) * 100) : 0;
  const progressText = getSeasonProgressText(completedDrafts, totalDrafts, season.status);

  return (
    <motion.div initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
      <div className="relative rounded-2xl overflow-hidden">
        <div className="absolute inset-0" style={{ background: 'var(--gradient-hero-gold)' }} />
        <div className="absolute inset-0" style={{ background: 'var(--gradient-hero-gold-accent)' }} />
        <div className="glass-card p-0 relative overflow-hidden rounded-2xl" style={{
          backgroundImage: 'var(--gradient-arena-edge-gold)',
          boxShadow: 'var(--shadow-gold)',
          border: '1px solid hsl(var(--gold) / 0.18)',
        }}>
          {/* Top edge rule + faint trophy watermark for a premium hero feel */}
          <div aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, hsl(var(--gold) / 0.7), transparent)' }} />
          <Trophy aria-hidden className="absolute -right-3 -top-3 w-24 h-24 pointer-events-none" style={{ color: 'hsl(var(--gold))', opacity: 0.06 }} strokeWidth={1.5} />
          <div className="relative z-10 p-5 pb-4">
            <div className="flex items-start justify-between mb-4 gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: 'linear-gradient(135deg, hsl(var(--gold) / 0.28), hsl(var(--gold) / 0.06))', border: '1px solid hsl(var(--gold) / 0.35)', boxShadow: '0 0 14px hsl(var(--gold) / 0.25)' }}>
                  <Trophy className="w-5 h-5" style={{ color: 'hsl(var(--gold))' }} />
                </div>
                <div className="min-w-0">
                  <h2 className="dl-display font-extrabold text-xl tracking-tight leading-tight">{formatSeasonTitle(season)}</h2>
                  {season.subtitle && (
                    <p className="text-[12px] font-semibold text-muted-foreground/85 mt-0.5 leading-snug">{season.subtitle}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                    {format(new Date(season.starts_at), 'MMM d')} — {format(new Date(season.ends_at), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>
              <span className={cn('status-pill flex items-center gap-1.5 text-[10px] px-2.5 py-1 flex-shrink-0', st.cls)}>
                {isActive && (
                  <span className={cn('w-1.5 h-1.5 rounded-full animate-pulse', st.dotCls)} />
                )}
                {st.label}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4">
              {[
                { icon: <Bookmark className="w-3.5 h-3.5" />, v: String(totalDrafts), l: 'Drafts' },
                { icon: <Target className="w-3.5 h-3.5" />, v: `Best ${season.best_of}`, l: 'Scoring' },
                { icon: <Trophy className="w-3.5 h-3.5" />, v: 'All 5', l: 'Playoffs' },
              ].map((stat) => (
                <div key={stat.l} className="rounded-xl px-2 py-2.5 text-center"
                  style={{ background: 'linear-gradient(180deg, hsl(var(--gold) / 0.10), hsl(var(--gold) / 0.02))', border: '1px solid hsl(var(--gold) / 0.16)' }}>
                  <span className="inline-flex mb-1" style={{ color: 'hsl(var(--gold) / 0.8)' }}>{stat.icon}</span>
                  <p className="text-[15px] font-extrabold tabular-nums leading-none">{stat.v}</p>
                  <p className="text-[9.5px] text-muted-foreground/70 font-bold uppercase tracking-wider mt-1">{stat.l}</p>
                </div>
              ))}
            </div>
            {season.status !== 'complete' && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold text-muted-foreground/75">{progressText}</span>
                  <span className="text-[10px] font-extrabold tabular-nums" style={{ color: 'hsl(var(--gold))' }}>
                    {season.status === 'playoffs' ? 'Playoffs' : `${progressPct}% · ${completedDrafts}/${totalDrafts}`}
                  </span>
                </div>
                <div className="relative h-2.5 w-full overflow-hidden rounded-full" style={{ background: 'hsl(var(--gold) / 0.12)' }}>
                  <div
                    className="h-full rounded-full relative overflow-hidden transition-all duration-500"
                    style={{
                      width: `${season.status === 'playoffs' ? 100 : progressPct}%`,
                      background: 'linear-gradient(90deg, hsl(var(--gold) / 0.65), hsl(var(--gold)))',
                      boxShadow: '0 0 10px hsl(var(--gold) / 0.45)',
                    }}
                  >
                    <div aria-hidden className="absolute inset-0" style={{ background: 'linear-gradient(180deg, hsl(0 0% 100% / 0.25), transparent 60%)' }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════
   NEXT DRAFT CARD
   ══════════════════════════════════════════════════════════ */
function NextDraftCard({ entries, totalDrafts }: { entries: any[]; totalDrafts: number }) {
  const regularEntries = entries.filter(e => !e.is_playoff);
  const completedCount = regularEntries.filter(e => e.drafts?.status === 'complete').length;
  const nextDraftNumber = completedCount + 1;
  const isRegularSeasonComplete = completedCount >= totalDrafts;
  const currentEntry = regularEntries.find(e => e.drafts?.status !== 'complete');
  const latestEntry = currentEntry || regularEntries[regularEntries.length - 1];
  const isLive = latestEntry?.drafts?.status === 'in_progress';
  const label = isRegularSeasonComplete ? 'Regular Season Complete' : getDraftLabel(nextDraftNumber, totalDrafts);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
      <div className={cn('glass-card p-4 relative overflow-hidden', isLive && 'border-success/20')}
        style={{ borderLeft: '3px solid hsl(var(--gold))' }}>
        <div className="flex items-center gap-2 mb-3">
          <Bookmark className="w-4 h-4" style={{ color: 'hsl(var(--gold))' }} />
          <h3 className="font-bold text-[13px]">{label}</h3>
          {isLive && (
            <StatusPill variant="live" size="xs" dot pulse>IN PROGRESS</StatusPill>
          )}
          {!isRegularSeasonComplete && (
            <span className="text-[9px] text-muted-foreground/60 ml-auto tabular-nums">
              Draft {Math.min(nextDraftNumber, totalDrafts)} of {totalDrafts}
            </span>
          )}
        </div>
        {latestEntry && !isRegularSeasonComplete ? (
          latestEntry.drafts?.status !== 'complete' ? (
            <Link to={`/drafts/${latestEntry.draft_id}`}>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                <Bookmark className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(var(--gold))' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold leading-snug break-words">{latestEntry.drafts?.topic || 'Draft'}</p>
                  <span className={cn('status-pill text-[9px] mt-1 inline-flex',
                    latestEntry.drafts?.status === 'in_progress' ? 'bg-success/12 text-success' : 'bg-muted text-muted-foreground')}>
                    {latestEntry.drafts?.status === 'in_progress' ? 'In Progress' : latestEntry.drafts?.status || 'Unknown'}
                  </span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
              </div>
            </Link>
          ) : (
            <div className="text-center py-4">
              <p className="text-[11px] text-muted-foreground/70 mb-3">No draft assigned yet</p>
              <Link to="/drafts/create">
                <button className="w-full h-10 rounded-lg text-[12px] font-bold transition-colors flex items-center justify-center gap-2 btn-press"
                  style={{ background: 'hsl(var(--gold) / 0.15)', color: 'hsl(var(--gold))', border: '1px solid hsl(var(--gold) / 0.15)' }}>
                  <Plus className="w-4 h-4" /> Create Draft {nextDraftNumber}
                </button>
              </Link>
            </div>
          )
        ) : isRegularSeasonComplete ? (
          <div className="text-center py-3">
            <p className="text-[12px] font-bold" style={{ color: 'hsl(var(--gold))' }}>
              🏆 All {totalDrafts} regular-season drafts complete
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">Playoffs are unlocked!</p>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-[11px] text-muted-foreground/70 mb-3">No draft assigned yet</p>
            <Link to="/drafts/create">
              <button className="w-full h-10 rounded-lg text-[12px] font-bold transition-colors flex items-center justify-center gap-2 btn-press"
                style={{ background: 'hsl(var(--gold) / 0.15)', color: 'hsl(var(--gold))', border: '1px solid hsl(var(--gold) / 0.15)' }}>
                <Plus className="w-4 h-4" /> Create Draft {nextDraftNumber}
              </button>
            </Link>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════
   STANDINGS CARD
   ══════════════════════════════════════════════════════════ */
function StandingsCard({ standings, userId }: { standings: SeasonStanding[]; userId?: string }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (standings.length === 0) {
    return (
      <div className="glass-card p-6 text-center">
        <Trophy className="w-6 h-6 mx-auto mb-2 text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground">No standings yet — complete a draft to get on the board.</p>
      </div>
    );
  }

  const leaderPts = standings[0]?.season_points || 0;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
      <div className="glass-card overflow-hidden rounded-2xl" style={{ boxShadow: 'var(--shadow-elevated)' }}>
        <div className="px-4 py-3 border-b border-border/20 flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg" style={{ background: 'hsl(var(--gold) / 0.14)' }}>
            <TrendingUp className="w-3.5 h-3.5" style={{ color: 'hsl(var(--gold))' }} />
          </span>
          <h3 className="font-extrabold text-[13px]">Season Standings</h3>
          <span className="ml-auto text-[10px] font-bold text-muted-foreground/60 tabular-nums">
            {standings.length} {standings.length === 1 ? 'player' : 'players'}
          </span>
        </div>
        <div className="divide-y divide-border/10">
          {standings.map((s, i) => {
            const isMe = s.user_id === userId;
            const isExpanded = expanded === s.id;
            const rank = s.rank || i + 1;
            const isPodium = rank <= 3;
            const isLeader = rank === 1;
            const gap = isLeader ? null : leaderPts - s.season_points;
            // Medal color tracks visible rank so the tint matches the number shown.
            const medalVar = rank === 1 ? 'var(--gold)' : rank === 2 ? 'var(--silver)' : rank === 3 ? 'var(--bronze)' : null;
            const name = (s.profiles as any)?.display_name || 'Unknown';
            const initials = name.split(' ').map((x: string) => x[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';

            return (
              <div key={s.id} style={isLeader ? { background: 'linear-gradient(90deg, hsl(var(--gold) / 0.10), transparent 70%)' } : undefined}>
                <button
                  type="button"
                  className={cn('flex items-center gap-3 px-3.5 py-3 transition-colors cursor-pointer w-full text-left hover:bg-muted/20',
                    isMe && !isPodium && 'border-l-2 border-l-gold/40')}
                  onClick={() => setExpanded(isExpanded ? null : s.id)}
                  aria-expanded={isExpanded}
                >
                  {/* Rank medal */}
                  {medalVar ? (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-extrabold flex-shrink-0 border"
                      style={{ background: `hsl(${medalVar} / 0.2)`, color: `hsl(${medalVar})`, borderColor: `hsl(${medalVar} / 0.45)`, boxShadow: isLeader ? `0 0 10px hsl(${medalVar} / 0.35)` : 'none' }}>
                      {rank}
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-muted/50 text-muted-foreground flex items-center justify-center text-[11px] font-extrabold flex-shrink-0">
                      {rank}
                    </div>
                  )}
                  {/* Avatar initials */}
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-extrabold flex-shrink-0"
                    style={{
                      background: medalVar ? `linear-gradient(135deg, hsl(${medalVar} / 0.22), hsl(${medalVar} / 0.06))` : 'hsl(var(--muted) / 0.6)',
                      color: medalVar ? `hsl(${medalVar})` : 'hsl(var(--muted-foreground))',
                      border: medalVar ? `1px solid hsl(${medalVar} / 0.35)` : '1px solid hsl(var(--border))',
                    }}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className={cn('text-[13px] font-bold truncate', isMe && 'text-gold')}>{name}</p>
                      {isMe && <span className="text-[9.5px] text-gold bg-gold/12 px-1.5 py-0.5 rounded font-extrabold tracking-wide flex-shrink-0">YOU</span>}
                      {isLeader && <Crown className="w-3 h-3 flex-shrink-0" style={{ color: 'hsl(var(--gold))' }} />}
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-muted/50 text-muted-foreground/80 tabular-nums">{s.drafts_played} played</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md tabular-nums" style={{ background: 'hsl(var(--gold) / 0.1)', color: 'hsl(var(--gold) / 0.9)' }}>{s.wins}W</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-muted/50 text-muted-foreground/80 tabular-nums">{s.podiums} podium</span>
                    </div>
                    <div className="mt-1.5 h-1 rounded-full bg-muted/50 overflow-hidden" aria-hidden>
                      <motion.div className="h-full rounded-full" style={{ background: 'hsl(var(--da-gold))' }}
                        initial={{ width: 0 }} animate={{ width: `${leaderPts > 0 ? Math.max(4, (s.season_points / leaderPts) * 100) : 0}%` }}
                        transition={{ duration: 0.6, delay: Math.min(i, 8) * 0.04, ease: [0.22, 1, 0.36, 1] }} />
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 pl-1">
                    <p className="text-base font-black tabular-nums leading-none" style={{ color: 'hsl(var(--gold))' }}>{s.season_points}</p>
                    {gap !== null ? (
                      <p className="text-[9.5px] text-muted-foreground/50 tabular-nums font-bold mt-0.5">-{gap} back</p>
                    ) : (
                      <p className="text-[9.5px] font-extrabold uppercase tracking-wide mt-0.5" style={{ color: 'hsl(var(--gold) / 0.65)' }}>Leader</p>
                    )}
                  </div>
                  <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0 transition-transform', isExpanded && 'rotate-180')} />
                </button>
                {isExpanded && (
                  <div className="px-3.5 pb-3 pt-0">
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { v: s.avg_finish.toFixed(1), l: 'Avg Finish' },
                        { v: s.avg_score.toFixed(1), l: 'Avg Score' },
                        { v: s.best_score.toFixed(1), l: 'Best', c: 'hsl(var(--success))' },
                        { v: s.worst_score.toFixed(1), l: 'Worst', c: 'hsl(var(--destructive))' },
                      ].map(stat => (
                        <div key={stat.l} className="text-center rounded-lg bg-muted/30 border border-border/20 p-2">
                          <p className="text-[13px] font-extrabold tabular-nums" style={stat.c ? { color: stat.c } : undefined}>{stat.v}</p>
                          <p className="text-[9px] text-muted-foreground/60 font-bold uppercase tracking-wider mt-0.5">{stat.l}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════
   TOPIC PICKER DIALOG
   ══════════════════════════════════════════════════════════ */
function TopicPickerDialog({ open, onOpenChange, seasonId, match, onStarted }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  seasonId: string; match: PlayoffMatch; onStarted: () => void;
}) {
  const [topics, setTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [rerollsUsed, setRerollsUsed] = useState(0);
  const MAX_REROLLS = 1;

  const fetchTopics = useCallback(async (isReroll = false) => {
    setLoading(true); setTopics([]);
    try {
      const list = await suggestPlayoffTopics(seasonId, match.id);
      setTopics(list);
      if (isReroll) setRerollsUsed(n => n + 1);
    } catch (err: any) {
      toast.error(err.message || 'Failed to get suggestions');
    } finally { setLoading(false); }
  }, [seasonId, match.id]);

  // Reset re-roll counter whenever the dialog opens for this match
  useEffect(() => {
    if (open) {
      setRerollsUsed(0);
      fetchTopics(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, match.id]);

  const handlePick = async (topic: string) => {
    setSubmitting(topic);
    try {
      await startPlayoffMatch(match.id, topic);
      toast.success('Matchup created!');
      onOpenChange(false); onStarted();
    } catch (err: any) {
      toast.error(err.message || 'Failed to start matchup');
    } finally { setSubmitting(null); }
  };

  const rerollsRemaining = MAX_REROLLS - rerollsUsed;
  const canReroll = rerollsRemaining > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-4 h-4" style={{ color: 'hsl(var(--gold))' }} />
            Choose your matchup topic
          </DialogTitle>
          <DialogDescription className="text-[12px]">
            {match.round === 'final' && match.match_number === 2
              ? 'As the lower seed, you pick the topic for Game 2.'
              : 'As the higher seed, you get to pick the topic for this draft.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-14 rounded-lg skeleton-shimmer" />)}
            </div>
          ) : (
            <>
              {topics.map(t => (
                <button key={t} onClick={() => handlePick(t)} disabled={!!submitting}
                  className="w-full text-left p-3 rounded-lg border border-border/30 hover:border-gold/40 hover:bg-gold/5 transition-all disabled:opacity-40">
                  <p className="font-bold text-[13px]">{t}</p>
                  {submitting === t && (
                    <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Creating draft…
                    </p>
                  )}
                </button>
              ))}
              <button
                onClick={() => fetchTopics(true)}
                disabled={loading || !!submitting || !canReroll}
                className="w-full mt-2 h-9 rounded-lg bg-muted/50 text-[11px] font-bold text-foreground/80 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40"
                title={canReroll ? 'Get a fresh set of 3 topics' : 'You have used your re-roll for this round'}
              >
                <RefreshCw className="w-3 h-3" />
                {canReroll
                  ? `Re-roll options (${rerollsRemaining} left)`
                  : 'Re-roll used — pick one above'}
              </button>
              <p className="text-[9.5px] text-muted-foreground/60 text-center font-medium pt-0.5">
                One re-roll per matchup to keep things fair.
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ══════════════════════════════════════════════════════════
   PLAYOFF FORMAT GUIDE
   ══════════════════════════════════════════════════════════ */
function PlayoffFormatGuide({ embedded = false }: { embedded?: boolean }) {
  const rules = [
    { icon: <Users className="w-3 h-3" style={{ color: 'hsl(var(--gold))' }} />, label: 'Field', body: 'Top 5 in Season Points qualify. #1, #2, #3 get a first-round bye.' },
    { icon: <Swords className="w-3 h-3" style={{ color: 'hsl(var(--primary))' }} />, label: 'Bracket', body: 'Play-In: #4 vs #5 (Bo1). Semis: #1 vs Play-In winner & #2 vs #3 (Bo1 each).' },
    { icon: <Crown className="w-3 h-3" style={{ color: 'hsl(var(--gold))' }} />, label: 'Final', body: 'Best-of-3. First to 2 game wins is Champion.' },
    { icon: <Award className="w-3 h-3" style={{ color: 'hsl(var(--bronze))' }} />, label: '3rd Place', body: 'Bo1 between the two semifinal losers — the winner takes bronze.' },
    { icon: <Sparkles className="w-3 h-3" style={{ color: 'hsl(var(--gold))' }} />, label: 'Topic Picker', body: 'Higher seed picks the draft topic. In the Final, picker rotates: G1 higher, G2 lower, G3 higher.' },
    { icon: <Target className="w-3 h-3" style={{ color: 'hsl(var(--success))' }} />, label: 'Tiebreaks', body: 'Match winner = highest draft score. Series clinched at 2 wins ends the Final.' },
  ];
  return (
    <div className={cn(embedded ? 'mt-3' : 'mt-4 pt-3 border-t border-border/15')}>
      <div className="flex items-center gap-1.5 mb-2">
        <Trophy className="w-3 h-3" style={{ color: 'hsl(var(--gold))' }} />
        <p className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: 'hsl(var(--gold))' }}>Playoff Format</p>
      </div>
      <ul className="space-y-1.5">
        {rules.map(r => (
          <li key={r.label} className="flex items-start gap-2 p-2 rounded-md bg-muted/20">
            <span className="mt-0.5 flex-shrink-0">{r.icon}</span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold leading-tight">{r.label}</p>
              <p className="text-[10px] text-muted-foreground/80 leading-snug mt-0.5">{r.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   PLAYOFF PICTURE
   ══════════════════════════════════════════════════════════ */
function PlayoffPicture({ standings, matches, seasonId }: { standings: SeasonStanding[]; matches: PlayoffMatch[]; seasonId: string | undefined }) {
  const { user } = useAuth();
  const [pickerMatch, setPickerMatch] = useState<PlayoffMatch | null>(null);
  const seeds = standings.filter(s => s.playoff_seed).sort((a, b) => (a.playoff_seed || 99) - (b.playoff_seed || 99));
  const getName = (seed: number) => { const s = seeds.find(s => s.playoff_seed === seed); return s ? (s.profiles as any)?.display_name || '?' : 'TBD'; };
  const getNameByUser = (userId: string | null) => { if (!userId) return 'TBD'; const s = standings.find(s => s.user_id === userId); return (s?.profiles as any)?.display_name || '?'; };

  if (seeds.length === 0 && matches.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
        <div className="glass-card p-4">
          <h3 className="font-bold text-[13px] flex items-center gap-1.5 mb-3">
            <Crown className="w-4 h-4" style={{ color: 'hsl(var(--gold))' }} /> Playoff Picture
          </h3>
          <p className="text-[11px] text-muted-foreground/70 text-center py-3">Complete all regular-season drafts to unlock playoffs.</p>
        </div>
      </motion.div>
    );
  }

  const qfMatches = matches.filter(m => m.round === 'qf').sort((a, b) => a.match_number - b.match_number);
  const sfMatches = matches.filter(m => m.round === 'sf').sort((a, b) => a.match_number - b.match_number);
  const finalMatches = matches.filter(m => m.round === 'final').sort((a, b) => a.match_number - b.match_number);
  const thirdPlaceMatch = matches.find(m => m.round === 'third_place');

  const finalWinCount: Record<string, number> = {};
  for (const m of finalMatches) {
    if (m.status === 'complete' && m.winner_user_id) finalWinCount[m.winner_user_id] = (finalWinCount[m.winner_user_id] || 0) + 1;
  }
  const finalsPlayers = finalMatches[0] ? [finalMatches[0].user_a, finalMatches[0].user_b] : [];
  const champion = finalsPlayers.find(p => p && (finalWinCount[p] || 0) >= 2) || null;
  const seriesScore = finalsPlayers.length === 2 ? `${finalWinCount[finalsPlayers[0]!] || 0}–${finalWinCount[finalsPlayers[1]!] || 0}` : null;

  const MatchCard = ({ m, placeholder, gameLabel }: { m?: PlayoffMatch; placeholder?: { roundLabel: string }; gameLabel?: string }) => {
    if (!m) {
      return (
        <div className="rounded-lg bg-muted/20 p-2.5 border border-dashed border-border/20 text-center">
          <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wider">{placeholder?.roundLabel}</p>
          <p className="text-[10px] text-muted-foreground/50 mt-1">Awaiting prior round</p>
        </div>
      );
    }
    const isAwaitingTopic = m.status === 'awaiting_topic';
    const isCallerPicker = isAwaitingTopic && user?.id === m.topic_picker_user_id;
    const pickerName = getNameByUser(m.topic_picker_user_id);
    let statusLabel = 'Pending';
    let statusClass = 'bg-muted text-muted-foreground';
    if (m.status === 'complete') { statusLabel = 'Final'; statusClass = 'bg-primary/15 text-primary'; }
    else if (m.status === 'in_progress') { statusLabel = 'Live'; statusClass = 'bg-success/15 text-success'; }
    else if (isAwaitingTopic) { statusLabel = 'Topic'; statusClass = 'bg-gold/15 text-gold'; }
    return (
      <div className="rounded-lg bg-muted/30 p-2.5 border border-border/15 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">{gameLabel || `M${m.match_number}`}</span>
          <span className={cn('text-[9.5px] font-bold px-1.5 py-0.5 rounded', statusClass)}>{statusLabel}</span>
        </div>
        <div className="space-y-0.5">
          <p className={cn('text-[10px] font-bold flex items-center gap-1', m.winner_user_id === m.user_a && 'text-gold')}>
            <span className="text-muted-foreground/70">#{m.seed_a}</span>
            <span className="truncate">{getNameByUser(m.user_a)}</span>
            {m.winner_user_id === m.user_a && <Trophy className="w-2.5 h-2.5 ml-auto" style={{ color: 'hsl(var(--gold))' }} />}
          </p>
          <p className={cn('text-[10px] font-bold flex items-center gap-1', m.winner_user_id === m.user_b && 'text-gold')}>
            <span className="text-muted-foreground/70">#{m.seed_b}</span>
            <span className="truncate">{getNameByUser(m.user_b)}</span>
            {m.winner_user_id === m.user_b && <Trophy className="w-2.5 h-2.5 ml-auto" style={{ color: 'hsl(var(--gold))' }} />}
          </p>
        </div>
        {isAwaitingTopic && isCallerPicker && (
          <button onClick={() => setPickerMatch(m)} className="block w-full text-[9px] font-bold text-center py-1 rounded bg-gold/15 hover:bg-gold/25 transition-colors flex items-center justify-center gap-1" style={{ color: 'hsl(var(--gold))' }}>
            <Sparkles className="w-2.5 h-2.5" /> Choose topic
          </button>
        )}
        {isAwaitingTopic && !isCallerPicker && (
          <p className="text-[9px] text-center py-1 text-muted-foreground/70 italic truncate">Waiting for {pickerName}…</p>
        )}
        {m.draft_id && (
          <Link to={`/drafts/${m.draft_id}`} className="block">
            <div className="text-[9px] font-bold text-center py-1 rounded bg-gold/10 hover:bg-gold/15 transition-colors flex items-center justify-center gap-1" style={{ color: 'hsl(var(--gold))' }}>
              Open Draft <ChevronRight className="w-2.5 h-2.5" />
            </div>
          </Link>
        )}
      </div>
    );
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
      <div className="glass-card p-4">
        <h3 className="font-bold text-[13px] flex items-center gap-1.5 mb-4">
          <Crown className="w-4 h-4" style={{ color: 'hsl(var(--gold))' }} /> Playoff Picture
        </h3>
        {champion && (
          <div className="mb-4 p-3 rounded-lg text-center" style={{ background: 'linear-gradient(135deg, hsl(var(--gold) / 0.2), hsl(var(--gold) / 0.05))', border: '1px solid hsl(var(--gold) / 0.3)' }}>
            <Trophy className="w-6 h-6 mx-auto mb-1" style={{ color: 'hsl(var(--gold))' }} />
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Champion</p>
            <p className="text-[14px] font-black mt-0.5" style={{ color: 'hsl(var(--gold))' }}>{getNameByUser(champion)}</p>
            {seriesScore && <p className="text-[10px] text-muted-foreground mt-1">Series {seriesScore}</p>}
          </div>
        )}
        {matches.length > 0 ? (
          <>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-2">
                <p className="text-[9.5px] font-bold uppercase tracking-widest text-muted-foreground/50 text-center">Play-In</p>
                <MatchCard m={qfMatches[0]} placeholder={{ roundLabel: 'Play-In' }} />
              </div>
              <div className="space-y-2">
                <p className="text-[9.5px] font-bold uppercase tracking-widest text-muted-foreground/50 text-center">Semis</p>
                <MatchCard m={sfMatches[0]} placeholder={{ roundLabel: 'SF 1' }} />
                <MatchCard m={sfMatches[1]} placeholder={{ roundLabel: 'SF 2' }} />
              </div>
              <div className="space-y-2">
                <p className="text-[9.5px] font-bold uppercase tracking-widest text-muted-foreground/50 text-center">Final · Bo3</p>
                {seriesScore && finalMatches.length > 0 && !champion && (
                  <p className="text-[9.5px] font-bold text-center text-gold">Series {seriesScore}</p>
                )}
                {finalMatches.length === 0 ? (
                  <MatchCard placeholder={{ roundLabel: 'Final' }} />
                ) : (
                  finalMatches.map(fm => <MatchCard key={fm.id} m={fm} gameLabel={`Game ${fm.match_number}`} />)
                )}
              </div>
            </div>
            {sfMatches.length === 2 && sfMatches.every(m => m.status === 'complete') && (
              <div className="mt-3 pt-3 border-t border-border/15">
                <div className="flex items-center justify-center gap-1.5 mb-2">
                  <Award className="w-3 h-3" style={{ color: 'hsl(var(--bronze))' }} />
                  <p className="text-[9.5px] font-bold uppercase tracking-widest text-muted-foreground/70 text-center">3rd Place · Bo1</p>
                </div>
                <div className="max-w-[200px] mx-auto">
                  {thirdPlaceMatch ? <MatchCard m={thirdPlaceMatch} gameLabel="3rd Place" /> : <MatchCard placeholder={{ roundLabel: '3rd Place' }} />}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 mb-3">
              {['Play-In', 'Semis', 'Finals'].map(r => (
                <div key={r} className="text-center"><span className="text-[9.5px] font-bold uppercase tracking-widest text-muted-foreground/50">{r}</span></div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 items-center">
              <div className="rounded-lg bg-muted/30 p-2.5 border border-border/10">
                <p className="text-[10px] font-bold">#{4} <span className="text-muted-foreground font-normal">{getName(4)}</span></p>
                <p className="text-[10px] font-bold mt-1">#{5} <span className="text-muted-foreground font-normal">{getName(5)}</span></p>
              </div>
              <div className="rounded-lg bg-muted/30 p-2.5 border border-border/10">
                <p className="text-[10px] font-bold">#{1} <span className="text-muted-foreground font-normal">{getName(1)}</span></p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'hsl(var(--gold) / 0.15)', color: 'hsl(var(--gold))' }}>BYE</span>
                </div>
                <div className="h-px bg-border/20 my-1.5" />
                <p className="text-[9px] text-muted-foreground">vs Play-In ✦</p>
              </div>
              <div className="rounded-lg p-2.5 border border-gold/15" style={{ background: 'hsl(var(--gold) / 0.05)' }}>
                <div className="text-center">
                  <Trophy className="w-4 h-4 mx-auto mb-1" style={{ color: 'hsl(var(--gold) / 0.5)' }} />
                  <p className="text-[9px] font-bold" style={{ color: 'hsl(var(--gold))' }}>Championship</p>
                  <p className="text-[9.5px] text-muted-foreground mt-0.5">Best of 3</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 items-center">
              <div />
              <div className="rounded-lg bg-muted/30 p-2.5 border border-border/10">
                <p className="text-[10px] font-bold">#{2} <span className="text-muted-foreground font-normal">{getName(2)}</span></p>
                <div className="h-px bg-border/20 my-1.5" />
                <p className="text-[10px] font-bold">#{3} <span className="text-muted-foreground font-normal">{getName(3)}</span></p>
              </div>
              <div />
            </div>
            <div className="flex items-center justify-center gap-1.5 pt-2">
              <Award className="w-3 h-3" style={{ color: 'hsl(var(--bronze))' }} />
              <p className="text-[9px] font-bold" style={{ color: 'hsl(var(--bronze))' }}>3rd Place · Bo1</p>
              <span className="text-[9px] text-muted-foreground/60">— SF losers face off</span>
            </div>
          </div>
        )}
      </div>
      {pickerMatch && seasonId && (
        <TopicPickerDialog
          open={!!pickerMatch}
          onOpenChange={(v) => { if (!v) setPickerMatch(null); }}
          seasonId={seasonId}
          match={pickerMatch}
          onStarted={() => {}}
        />
      )}
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════
   PLAYOFF CONTROL CENTER
   ══════════════════════════════════════════════════════════ */
function PlayoffControlCenter({ season, matches, standings, userId, onUpdate }: {
  season: any; matches: PlayoffMatch[]; standings: SeasonStanding[];
  userId: string | undefined; onUpdate: () => void;
}) {
  const [pickerMatch, setPickerMatch] = useState<PlayoffMatch | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [hasReadyWork, setHasReadyWork] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(true);

  const seasonId = season?.id as string | undefined;
  const onboardingKey = seasonId ? `playoff_onboarding_dismissed_${seasonId}` : null;

  useEffect(() => { if (!onboardingKey) return; setOnboardingDismissed(localStorage.getItem(onboardingKey) === '1'); }, [onboardingKey]);
  const dismissOnboarding = () => { if (onboardingKey) localStorage.setItem(onboardingKey, '1'); setOnboardingDismissed(true); };

  const getNameByUser = useCallback((uid: string | null): string => {
    if (!uid) return 'TBD';
    const s = standings.find(s => s.user_id === uid);
    return (s?.profiles as any)?.display_name || '?';
  }, [standings]);

  useEffect(() => {
    if (!seasonId) { setHasReadyWork(false); return; }
    const candidateDraftIds = matches.filter(m => m.draft_id && m.status !== 'complete').map(m => m.draft_id as string);
    if (candidateDraftIds.length === 0) { setHasReadyWork(false); return; }
    let cancelled = false;
    supabase.from('drafts').select('id, status').in('id', candidateDraftIds).then(({ data }) => {
      if (cancelled) return;
      setHasReadyWork((data || []).some((d: any) => d.status === 'complete'));
    });
    return () => { cancelled = true; };
  }, [seasonId, matches]);

  const handleAdvance = async () => {
    if (!seasonId) return;
    setAdvancing(true);
    try {
      const res: any = await advancePlayoffs(seasonId);
      if (res?.log?.length) toast.success(`Playoffs: ${res.log.join(' • ')}`);
      else toast.success('Up to date');
      onUpdate();
    } catch (err: any) { toast.error(err.message || 'Failed to advance'); }
    finally { setAdvancing(false); }
  };

  const roundLabelForMatch = (m: PlayoffMatch): string => {
    if (m.round === 'qf') return 'Play-In';
    if (m.round === 'sf') return `Semi ${m.match_number}`;
    if (m.round === 'final') return `Final · G${m.match_number}`;
    if (m.round === 'third_place') return '3rd Place';
    return m.round;
  };

  const order: Record<string, number> = { awaiting_topic: 0, in_progress: 1, pending: 2, complete: 3 };
  const activeMatches = [...matches].filter(m => m.status !== 'complete').sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9)).slice(0, 3);

  const sfDone = matches.filter(m => m.round === 'sf' && m.status === 'complete').length;
  const finalWinByUser: Record<string, number> = {};
  for (const m of matches) {
    if (m.round === 'final' && m.status === 'complete' && m.winner_user_id)
      finalWinByUser[m.winner_user_id] = (finalWinByUser[m.winner_user_id] || 0) + 1;
  }
  const champion = Object.entries(finalWinByUser).find(([, n]) => n >= 2)?.[0] || null;
  const playoffsStarted = season?.status === 'playoffs' || matches.length > 0;
  const playInDone = matches.some(m => m.round === 'qf' && m.status === 'complete') || sfDone > 0;

  type StepState = 'done' | 'active' | 'todo';
  const steps: { label: string; state: StepState }[] = [
    { label: 'Regular', state: playoffsStarted ? 'done' : 'active' },
    { label: 'Play-In', state: !playoffsStarted ? 'todo' : (playInDone ? 'done' : 'active') },
    { label: 'Semis', state: !playInDone ? 'todo' : (sfDone >= 2 ? 'done' : 'active') },
    { label: 'Finals', state: sfDone < 2 ? 'todo' : (champion ? 'done' : 'active') },
    { label: 'Champ', state: champion ? 'done' : 'todo' },
  ];

  if (champion) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
        <div className="rounded-2xl p-4 text-center"
          style={{ background: 'linear-gradient(135deg, hsl(var(--gold) / 0.22), hsl(var(--gold) / 0.04))', border: '1px solid hsl(var(--gold) / 0.35)' }}>
          <Trophy className="w-7 h-7 mx-auto mb-1.5" style={{ color: 'hsl(var(--gold))' }} />
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Season Champion</p>
          <p className="text-[16px] font-black mt-1" style={{ color: 'hsl(var(--gold))' }}>{getNameByUser(champion)}</p>
          <p className="text-[10px] text-muted-foreground/80 mt-1">Playoffs complete — see the bracket below for full results.</p>
        </div>
      </motion.div>
    );
  }

  const showOnboarding = season?.status === 'playoffs' && !onboardingDismissed && matches.filter(m => m.status === 'complete').length === 0;
  const statusPillLabel = season?.status === 'playoffs' ? 'Playoffs In Progress' : season?.status === 'regular_season' ? 'Regular Season' : 'Off-season';
  const statusPillTone = season?.status === 'playoffs' ? 'gold' : 'muted';

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
      <div className="glass-card overflow-hidden" style={{ border: '1px solid hsl(var(--gold) / 0.22)' }}>
        <div className="px-4 py-3 flex items-center justify-between gap-2" style={{ background: 'hsl(var(--gold) / 0.06)', borderBottom: '1px solid hsl(var(--border) / 0.4)' }}>
          <div className="flex items-center gap-2 min-w-0">
            <Trophy className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(var(--gold))' }} />
            <h3 className="font-bold text-[13px] truncate">Playoff Control Center</h3>
          </div>
          <span className={cn('text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full', statusPillTone === 'gold' ? 'text-gold' : 'text-muted-foreground')}
            style={{ background: statusPillTone === 'gold' ? 'hsl(var(--gold) / 0.15)' : 'hsl(var(--muted) / 0.6)' }}>
            {statusPillLabel}
          </span>
        </div>

        {showOnboarding && (
          <div className="px-3 py-2 flex items-start gap-2" style={{ background: 'hsl(var(--gold) / 0.08)', borderBottom: '1px solid hsl(var(--border) / 0.3)' }}>
            <span className="text-[14px] leading-none mt-0.5">🏆</span>
            <p className="text-[10.5px] leading-snug flex-1 text-foreground/80">
              Playoffs have started! <strong>Higher seeds pick topics</strong>, then both players draft.
            </p>
            <button onClick={dismissOnboarding} className="text-muted-foreground/60 hover:text-foreground transition-colors p-0.5" aria-label="Dismiss">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <div className="px-3 pt-3">
          <div className="flex items-center justify-between gap-1">
            {steps.map((s, i) => (
              <div key={s.label} className="flex items-center flex-1 min-w-0">
                <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                  <div className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold',
                    s.state === 'done' && 'bg-success/20 text-success',
                    s.state === 'active' && 'text-gold',
                    s.state === 'todo' && 'bg-muted/40 text-muted-foreground/50')}
                    style={s.state === 'active' ? { background: 'hsl(var(--gold) / 0.18)', boxShadow: '0 0 0 2px hsl(var(--gold) / 0.25)' } : undefined}>
                    {s.state === 'done' ? '✓' : i + 1}
                  </div>
                  <span className={cn('text-[10px] font-bold uppercase tracking-wider truncate',
                    s.state === 'active' && 'text-gold',
                    s.state === 'done' && 'text-foreground/70',
                    s.state === 'todo' && 'text-muted-foreground/50')}>
                    {s.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div className={cn('h-px flex-shrink-0 w-2 -mt-3.5', s.state === 'done' ? 'bg-success/40' : 'bg-border/30')} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="p-3 space-y-2">
          {activeMatches.length === 0 ? (
            <div className="rounded-lg bg-muted/20 p-3 text-center">
              <p className="text-[11px] font-bold text-foreground/80">
                {season?.status === 'playoffs' ? 'Awaiting next round' : 'Regular season in progress'}
              </p>
              <p className="text-[10px] text-muted-foreground/70 mt-1">
                {season?.status === 'playoffs' ? 'Matches will appear here as soon as the next round is created.' : 'Once all regular drafts complete, playoffs unlock automatically.'}
              </p>
            </div>
          ) : (
            activeMatches.map(m => {
              const isPicker = m.status === 'awaiting_topic' && userId && userId === m.topic_picker_user_id;
              const pickerName = getNameByUser(m.topic_picker_user_id);
              const aName = getNameByUser(m.user_a);
              const bName = getNameByUser(m.user_b);
              const isFinalsG2 = m.round === 'final' && m.match_number === 2;
              const pickerRoleLabel = isFinalsG2 ? 'lower seed' : 'higher seed';
              let statusSentence = '';
              if (m.status === 'awaiting_topic') statusSentence = isPicker ? `You're the ${pickerRoleLabel} for this game — choose the draft topic to begin.` : `Waiting for ${pickerName} (${pickerRoleLabel}) to choose a topic.`;
              else if (m.status === 'in_progress') statusSentence = 'Draft is live — make your picks before the timer runs out.';
              else if (m.status === 'pending') statusSentence = 'Match created — open the draft to start picking.';
              return (
                <div key={m.id} className="rounded-lg p-3 border space-y-2"
                  style={{ background: 'hsl(var(--muted) / 0.25)', borderColor: m.status === 'awaiting_topic' ? 'hsl(var(--gold) / 0.3)' : 'hsl(var(--border) / 0.3)' }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/70">{roundLabelForMatch(m)}</span>
                    <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider',
                      m.status === 'awaiting_topic' && 'bg-gold/15 text-gold',
                      m.status === 'in_progress' && 'bg-success/15 text-success',
                      m.status === 'pending' && 'bg-muted text-muted-foreground')}>
                      {m.status === 'awaiting_topic' ? 'Pick Topic' : m.status === 'in_progress' ? 'Live' : 'Pending'}
                    </span>
                  </div>
                  <p className="text-[11.5px] font-bold leading-snug">
                    <span className="text-muted-foreground/70 font-semibold">#{m.seed_a}</span> {aName}
                    <span className="text-muted-foreground mx-1.5">vs</span>
                    <span className="text-muted-foreground/70 font-semibold">#{m.seed_b}</span> {bName}
                  </p>
                  <p className="text-[10.5px] text-muted-foreground/85 leading-snug">{statusSentence}</p>
                  {m.status === 'awaiting_topic' && isPicker && (
                    <button onClick={() => setPickerMatch(m)} className="w-full h-9 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 btn-press transition-colors" style={{ background: 'hsl(var(--gold) / 0.18)', color: 'hsl(var(--gold))' }}>
                      <Sparkles className="w-3.5 h-3.5" /> Choose Topic
                    </button>
                  )}
                  {m.status === 'awaiting_topic' && !isPicker && (
                    <button onClick={() => toast.success(`Reminder sent to ${pickerName}`)} className="w-full h-9 rounded-lg text-[11px] font-bold bg-muted/50 text-foreground/70 hover:bg-muted/70 transition-colors flex items-center justify-center gap-1.5">
                      Nudge {pickerName}
                    </button>
                  )}
                  {(m.status === 'in_progress' || m.status === 'pending') && m.draft_id && (
                    <Link to={`/drafts/${m.draft_id}`} className="block">
                      <button className="w-full h-9 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 btn-press transition-colors" style={{ background: 'hsl(var(--gold) / 0.15)', color: 'hsl(var(--gold))' }}>
                        Open Draft <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </Link>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="px-3 pb-3 space-y-2">
          <button onClick={handleAdvance} disabled={advancing}
            className="w-full h-10 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 btn-press transition-all disabled:opacity-50"
            style={{ background: hasReadyWork ? 'hsl(var(--gold) / 0.22)' : 'hsl(var(--muted) / 0.5)', color: hasReadyWork ? 'hsl(var(--gold))' : 'hsl(var(--muted-foreground))', boxShadow: hasReadyWork ? '0 0 0 1px hsl(var(--gold) / 0.3)' : undefined }}>
            {advancing ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Advancing…</> : <><Trophy className="w-3.5 h-3.5" /> Advance Playoffs</>}
          </button>
          <p className="text-[10px] text-muted-foreground/70 text-center leading-snug">
            {hasReadyWork ? 'Tap to score completed games and create the next round.' : 'Up to date · auto-advances after each draft.'}
          </p>
          <button onClick={() => setShowRules(v => !v)} className="w-full h-8 rounded-lg text-[10.5px] font-bold text-foreground/70 hover:text-foreground bg-muted/30 hover:bg-muted/50 transition-colors flex items-center justify-center gap-1.5">
            How it works <ChevronDown className={cn('w-3 h-3 transition-transform', showRules && 'rotate-180')} />
          </button>
          {showRules && <PlayoffFormatGuide embedded />}
        </div>
      </div>
      {pickerMatch && seasonId && (
        <TopicPickerDialog open={!!pickerMatch} onOpenChange={(v) => { if (!v) setPickerMatch(null); }} seasonId={seasonId} match={pickerMatch} onStarted={() => onUpdate()} />
      )}
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════
   SEASON DRAFT HISTORY
   ══════════════════════════════════════════════════════════ */
function SeasonDraftHistory({ entries, totalDrafts }: { entries: any[]; totalDrafts: number }) {
  const regularEntries = entries.filter(e => !e.is_playoff);
  const [isOpen, setIsOpen] = useState(regularEntries.length <= 4);
  if (regularEntries.length === 0) return null;
  const displayEntries = isOpen ? regularEntries : regularEntries.slice(0, 3);
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
      <div className="glass-card overflow-hidden bg-card/60">
        <div className="p-3 border-b border-border/20 flex items-center justify-between">
          <h3 className="font-bold text-[13px] flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" style={{ color: 'hsl(var(--gold))' }} /> Draft History
          </h3>
          {regularEntries.length > 3 && (
            <button onClick={() => setIsOpen(!isOpen)} className="text-[9px] font-bold text-muted-foreground/60 flex items-center gap-0.5 hover:text-muted-foreground transition-colors">
              {isOpen ? 'Collapse' : `Show all ${regularEntries.length}`}
              <ChevronDown className={cn('w-3 h-3 transition-transform', isOpen && 'rotate-180')} />
            </button>
          )}
        </div>
        <div className="divide-y divide-border/10">
          {displayEntries.map((e, i) => {
            const isComplete = e.drafts?.status === 'complete';
            const isActive = e.drafts?.status === 'in_progress';
            return (
              <Link key={e.id} to={`/drafts/${e.draft_id}`} className="block">
                <div className={cn('flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors', i % 2 === 1 && 'bg-muted/8')}>
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', isComplete ? 'bg-success/12' : isActive ? 'bg-gold/12' : 'bg-muted/50')}>
                    {isComplete ? <span className="text-[10px]">✓</span> : <span className="text-[10px] font-bold text-muted-foreground">#{e.week_number}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold leading-snug break-words">{e.drafts?.topic || 'Draft'}</p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] text-muted-foreground/50">#{e.week_number} of {totalDrafts}</span>
                      <span className="text-[9px] text-muted-foreground/30">·</span>
                      <span className={cn('text-[9px] font-semibold', isComplete ? 'text-primary' : isActive ? 'text-success' : 'text-muted-foreground')}>
                        {isComplete ? 'Complete' : isActive ? 'In Progress' : e.drafts?.status || 'unknown'}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════
   LIFETIME STATS
   ══════════════════════════════════════════════════════════ */
function LifetimeStatsCard({ userId }: { userId?: string }) {
  const { stats, loading } = useLifetimeStats(userId);
  if (loading || !stats) return null;
  const items = [
    { label: 'Seasons', value: stats.totalSeasons },
    { label: 'Wins', value: stats.totalWins },
    { label: 'Podiums', value: stats.totalPodiums },
    { label: 'Playoffs', value: stats.totalPlayoffs },
    { label: 'Championships', value: stats.totalChampionships, highlight: true },
    { label: 'Avg Finish', value: stats.avgSeasonFinish > 0 ? getOrdinalSuffix(Math.round(stats.avgSeasonFinish)) : '—' },
  ];
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}>
      <div className="glass-card p-4 bg-card/60">
        <h3 className="font-bold text-[13px] flex items-center gap-1.5 mb-3">
          <Medal className="w-4 h-4" style={{ color: 'hsl(var(--gold))' }} /> Lifetime Stats
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {items.map(item => (
            <div key={item.label} className={cn('text-center rounded-lg p-2', item.highlight && 'ring-1 ring-gold/20')}
              style={item.highlight ? { background: 'hsl(var(--gold) / 0.06)' } : undefined}>
              <p className={cn('text-lg font-extrabold leading-none tabular-nums', item.highlight && 'text-gold')}>{item.value}</p>
              <p className="text-[9px] text-muted-foreground/60 font-medium mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════
   COMMISSIONER PANEL
   ══════════════════════════════════════════════════════════ */
function CommissionerPanel({ season, entries, onUpdate }: { season: any; entries: any[]; onUpdate: () => void }) {
  const { drafts: unassigned, loading, refetch: refetchUnassigned } = useUnassignedDrafts(season?.id);
  const [busy, setBusy] = useState<string | null>(null);
  const totalDrafts = getSeasonDraftTarget(season);
  const regularEntries = entries.filter(e => !e.is_playoff);
  const slotsFilled = regularEntries.length;
  const slotsRemaining = Math.max(0, totalDrafts - slotsFilled);

  const handleAdd = async (draftId: string) => {
    setBusy(draftId);
    try {
      const num = await addDraftToSeason(season.id, draftId);
      await recalculateSeasonStandings(season.id);
      toast.success(`Added as Season Draft #${num}`);
      refetchUnassigned(); onUpdate();
    } catch (err: any) { toast.error(err.message || 'Failed to add'); }
    finally { setBusy(null); }
  };

  const handleRemove = async (draftId: string) => {
    setBusy(draftId);
    try {
      await removeDraftFromSeason(draftId);
      await recalculateSeasonStandings(season.id);
      toast.success('Removed from season');
      refetchUnassigned(); onUpdate();
    } catch (err: any) { toast.error(err.message || 'Failed to remove'); }
    finally { setBusy(null); }
  };

  return (
    <div className="glass-card overflow-hidden border" style={{ borderColor: 'hsl(var(--gold) / 0.2)' }}>
      <div className="p-3.5 border-b border-border/20 flex items-center justify-between" style={{ background: 'hsl(var(--gold) / 0.05)' }}>
        <h3 className="font-bold text-[13px] flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5" style={{ color: 'hsl(var(--gold))' }} /> Season Drafts
        </h3>
        <span className="text-[10px] font-bold tabular-nums" style={{ color: slotsRemaining > 0 ? 'hsl(var(--gold))' : 'hsl(var(--success))' }}>
          {slotsFilled} / {totalDrafts} slots
        </span>
      </div>
      {unassigned.length > 0 && slotsRemaining > 0 && (
        <div className="p-3 border-b border-border/10">
          <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-2">Unassigned Drafts</p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {unassigned.map(d => (
              <div key={d.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                <Bookmark className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'hsl(var(--gold) / 0.5)' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold leading-snug break-words">{d.topic}</p>
                  <span className={cn('text-[9px] font-semibold', d.status === 'complete' ? 'text-primary' : d.status === 'in_progress' ? 'text-success' : 'text-muted-foreground')}>{d.status}</span>
                </div>
                <button onClick={() => handleAdd(d.id)} disabled={busy === d.id}
                  className="px-2 py-1 rounded-md text-[9px] font-bold transition-colors flex items-center gap-1 btn-press"
                  style={{ background: 'hsl(var(--gold) / 0.15)', color: 'hsl(var(--gold))' }}>
                  {busy === d.id ? '…' : <><Plus className="w-3 h-3" /> Add</>}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {regularEntries.length > 0 && (
        <div className="p-3">
          <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-2">Season Drafts</p>
          <div className="space-y-1">
            {regularEntries.map(e => (
              <div key={e.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/20 transition-colors">
                <span className="text-[10px] font-bold text-muted-foreground w-5 text-center">#{e.week_number}</span>
                <p className="text-[11px] font-semibold flex-1 leading-snug break-words">{e.drafts?.topic || 'Draft'}</p>
                <span className={cn('text-[9px] font-semibold', e.drafts?.status === 'complete' ? 'text-primary' : e.drafts?.status === 'in_progress' ? 'text-success' : 'text-muted-foreground')}>
                  {e.drafts?.status || '?'}
                </span>
                <button onClick={() => handleRemove(e.draft_id)} disabled={busy === e.draft_id}
                  className="p-1 rounded text-muted-foreground/40 hover:text-destructive transition-colors" title="Remove from season">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {slotsRemaining === 0 && (
        <div className="p-3 text-center">
          <p className="text-[10px] font-bold" style={{ color: 'hsl(var(--success))' }}>✓ All {totalDrafts} season slots filled</p>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   NO SEASON STATE
   ══════════════════════════════════════════════════════════ */
function NoSeasonState() {
  const [activeDrafts, setActiveDrafts] = useState(0);
  useEffect(() => {
    supabase.from('drafts').select('*', { count: 'exact', head: true }).neq('status', 'complete').then(({ count }) => setActiveDrafts(count || 0));
  }, []);
  return (
    <div className="space-y-3">
      <div className="glass-card arena-edge p-6 text-center">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 relative z-10"
          style={{ background: 'linear-gradient(135deg, hsl(var(--gold) / 0.15), hsl(var(--gold) / 0.05))' }}>
          <Trophy className="w-7 h-7" style={{ color: 'hsl(var(--gold) / 0.6)' }} />
        </div>
        <h3 className="text-base font-extrabold relative z-10 mb-1">Draft League</h3>
        <p className="text-[11px] text-muted-foreground leading-relaxed relative z-10 mb-4">
          No season is active yet. A commissioner can start a season to track standings, playoffs, and championships.
        </p>
        <Link to="/drafts">
          <button className="flex items-center gap-2 font-bold rounded-xl px-4 py-2.5 text-[12px] btn-press mx-auto" style={{ background: 'hsl(var(--gold) / 0.15)', color: 'hsl(var(--gold))' }}>
            <Bookmark className="w-4 h-4" /> View Drafts
            {activeDrafts > 0 && <span className="text-[9px] opacity-70">({activeDrafts} active)</span>}
          </button>
        </Link>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════════ */
export default function DraftsListPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab') || 'drafts';
  const defaultTab = ['drafts', 'season', 'stats', 'commissioner'].includes(requestedTab) ? requestedTab : 'drafts';

  // Draft list state
  const [drafts, setDrafts] = useState<any[]>([]);
  const [participantCounts, setParticipantCounts] = useState<Map<string, number>>(new Map());
  const [draftParticipants, setDraftParticipants] = useState<Map<string, any[]>>(new Map());
  const [draftPickCounts, setDraftPickCounts] = useState<Map<string, number>>(new Map());
  const [draftWinners, setDraftWinners] = useState<Map<string, { user_id: string; display_name: string }>>(new Map());
  const [myDraftStats, setMyDraftStats] = useState({ totalPoints: 0, wins: 0, draftsRated: 0, podiums: 0, bestFinish: 0, avgScore: 0 });
  const [loading, setLoading] = useState(true);
  const [draftLoadError, setDraftLoadError] = useState(false);
  // Season grouping: map every draft id → { seasonId, seasonName, startsAt, status }
  const [seasonByDraft, setSeasonByDraft] = useState<Map<string, { seasonId: string; name: string; startsAt: string; status: string }>>(new Map());
  const [allSeasons, setAllSeasons] = useState<Array<{ id: string; name: string; startsAt: string; status: string }>>([]);


  // Season state
  const { season, loading: seasonLoading, refetch: refetchSeason } = useCurrentSeason();
  const { standings, loading: standingsLoading, refetch: refetchStandings } = useSeasonStandings(season?.id);
  const { entries, loading: entriesLoading, refetch: refetchEntries } = useSeasonEntries(season?.id);
  const { matches } = usePlayoffMatchesLive(season?.id);
  const isCommissioner = useIsCommissioner(season);
  const [isAppAdmin, setIsAppAdmin] = useState(false);
  const [startNextOpen, setStartNextOpen] = useState(false);

  const playoffDraftIds = entries.filter(e => e.is_playoff).map(e => e.draft_id);
  const playoffMatchByDraft = usePlayoffMatchByDraftIds(playoffDraftIds);
  const totalDrafts = season ? getSeasonDraftTarget(season) : 12;

  useEffect(() => {
    if (!user?.id) { setIsAppAdmin(false); return; }
    supabase.rpc('is_app_admin', { _user_id: user.id }).then(({ data }) => setIsAppAdmin(!!data));
  }, [user?.id]);

  const handleSeasonUpdate = useCallback(() => {
    refetchEntries(); refetchStandings();
  }, [refetchEntries, refetchStandings]);

  // Visibility-based refetch
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && season?.id) { refetchStandings(); refetchEntries(); }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [season?.id, refetchStandings, refetchEntries]);

  // Auto-recalc stale standings
  useEffect(() => {
    if (!season?.id || standingsLoading || entriesLoading) return;
    const completedEntries = entries.filter(e => !e.is_playoff && e.drafts?.status === 'complete');
    const maxDraftsPlayed = standings.length > 0 ? Math.max(...standings.map(s => s.drafts_played)) : 0;
    if (completedEntries.length > 0 && maxDraftsPlayed < completedEntries.length) {
      recalculateSeasonStandings(season.id).then(() => refetchStandings()).catch(err => console.error('Auto-recalc failed:', err));
    }
  }, [season?.id, standings, entries, standingsLoading, entriesLoading, refetchStandings]);

  // Auto-advance playoffs
  useEffect(() => {
    if (!season?.id) return;
    if (season.status !== 'regular_season' && season.status !== 'playoffs') return;
    let cancelled = false;
    const tryAdvance = () => {
      advancePlayoffs(season.id).then(() => { if (!cancelled) { refetchEntries(); refetchStandings(); } }).catch(() => {});
    };
    tryAdvance();
    const onVis = () => { if (document.visibilityState === 'visible') tryAdvance(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { cancelled = true; document.removeEventListener('visibilitychange', onVis); };
  }, [season?.id, season?.status, refetchEntries, refetchStandings]);

  const fetchDrafts = useCallback(async () => {
    if (!user) return;
    setDraftLoadError(false);
    try {
    const { data, error } = await withTimeout(
      Promise.resolve(
        supabase
          .from('drafts')
          .select('*, competitions(title, status), profiles:created_by(display_name), current_pick_profiles:current_pick_user_id(display_name)')
          .order('created_at', { ascending: false }),
      ),
      QUERY_TIMEOUT_MS,
      'drafts list query',
    );
    if (error) throw error;

    if (data) {
      const draftIds = data.map(d => d.id);
      if (draftIds.length > 0) {
        const [{ data: parts }, picks, { data: seasonEntriesAll }, { data: seasonsAll }] = await withTimeout(Promise.all([
          supabase.from('draft_participants').select('draft_id, user_id, pick_order, profiles:user_id(display_name)').in('draft_id', draftIds),
          fetchAllDraftListRows<any>((from, to) =>
            supabase.from('draft_picks').select('draft_id').in('draft_id', draftIds).range(from, to),
          ),
          supabase.from('draft_season_entries' as any).select('draft_id, season_id').in('draft_id', draftIds),
          supabase.from('draft_seasons' as any).select('id, name, season_number, subtitle, starts_at, status').order('season_number', { ascending: false, nullsFirst: false }).order('starts_at', { ascending: false }),
        ]), HYDRATE_TIMEOUT_MS, 'drafts list hydrate');
        // Build season-by-draft map and seasons list
        const seasonsById = new Map<string, { id: string; name: string; startsAt: string; status: string }>();
        (seasonsAll || []).forEach((s: any) => {
          const display = formatSeasonTitle({ season_number: s.season_number, name: s.name });
          seasonsById.set(s.id, { id: s.id, name: display, startsAt: s.starts_at, status: s.status });
        });
        const sbd = new Map<string, { seasonId: string; name: string; startsAt: string; status: string }>();
        (seasonEntriesAll || []).forEach((e: any) => {
          const s = seasonsById.get(e.season_id);
          if (s) sbd.set(e.draft_id, { seasonId: s.id, name: s.name, startsAt: s.startsAt, status: s.status });
        });
        setSeasonByDraft(sbd);
        setAllSeasons(Array.from(seasonsById.values()));

        const participantsByDraft = new Map<string, any[]>();
        if (parts) {
          const counts = new Map<string, number>();
          parts.forEach(p => {
            counts.set(p.draft_id, (counts.get(p.draft_id) || 0) + 1);
            const existing = participantsByDraft.get(p.draft_id) || [];
            existing.push(p); participantsByDraft.set(p.draft_id, existing);
          });
          setParticipantCounts(counts);
          setDraftParticipants(participantsByDraft);
        }
        const pickCounts = new Map<string, number>();
        picks.forEach(p => pickCounts.set(p.draft_id, (pickCounts.get(p.draft_id) || 0) + 1));
        setDraftPickCounts(pickCounts);
        const partCounts = new Map<string, number>();
        if (parts) parts.forEach(p => partCounts.set(p.draft_id, (partCounts.get(p.draft_id) || 0) + 1));
        const fixIds: string[] = [];
        const updatedData = data.map(d => {
          if (d.status === 'in_progress') {
            const numParts = partCounts.get(d.id) || 0;
            const numPicks = pickCounts.get(d.id) || 0;
            if (numParts > 0 && numPicks >= numParts * d.num_rounds) { fixIds.push(d.id); return { ...d, status: 'complete' }; }
          }
          return d;
        });
        for (const id of fixIds) await supabase.from('drafts').update({ status: 'complete' }).eq('id', id);
        setDrafts(updatedData.map(d => ({
          ...d,
          ...getDerivedDraftTurn(d, participantsByDraft.get(d.id) || [], pickCounts.get(d.id) || 0),
        })));
        if (draftIds.length > 0) {
          const { data: allResults } = await supabase.from('draft_results' as any).select('draft_id, user_id, rank, points_awarded, total_score').in('draft_id', draftIds);
          if (allResults) {
            const winners = new Map<string, { user_id: string; display_name: string }>();
            const winnerUserIds = new Set<string>();
            for (const r of allResults as any[]) { if (r.rank === 1) { winners.set(r.draft_id, { user_id: r.user_id, display_name: '' }); winnerUserIds.add(r.user_id); } }
            if (winnerUserIds.size > 0) {
              const { data: wp } = await supabase.from('profiles').select('id, display_name').in('id', [...winnerUserIds]);
              if (wp) { const pm = new Map(wp.map(p => [p.id, p.display_name])); for (const [, w] of winners) w.display_name = pm.get(w.user_id) || 'Unknown'; }
            }
            setDraftWinners(winners);
            const myResults = (allResults as any[]).filter((r: any) => r.user_id === user?.id);
            const podiums = myResults.filter((r: any) => r.rank <= 3).length;
            const bestFinish = myResults.length > 0 ? Math.min(...myResults.map((r: any) => r.rank)) : 0;
            const avgScore = myResults.length > 0 ? myResults.reduce((s: number, r: any) => s + (r.total_score || 0), 0) / myResults.length : 0;
            setMyDraftStats({ totalPoints: myResults.reduce((s: number, r: any) => s + (r.points_awarded || 0), 0), wins: myResults.filter((r: any) => r.rank === 1).length, draftsRated: myResults.length, podiums, bestFinish, avgScore });
          }
        }
      } else {
        setDrafts(data);
      }
    }
    } catch (err) {
      setDraftLoadError(true);
      console.error('[DraftsListPage] fetchDrafts failed', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchDrafts(); }, [fetchDrafts]);
  useDraftListUpdates(fetchDrafts, !!user);

  const statusConfig: Record<string, { label: string; cls: string }> = {
    setup: { label: 'Setup', cls: 'da-status-setup' },
    in_progress: { label: 'In Progress', cls: 'da-status-live' },
    complete: { label: 'Complete', cls: 'da-status-complete' },
  };

  // Sort priority by draft status. Active drafts sit on top, setup
  // drafts next, completed (resolved) drafts at the bottom — so once
  // a draft resolves it drops below anything still in flight. Within
  // each tier the original `created_at desc` order from the fetch is
  // preserved (Array.prototype.sort is stable in modern engines).
  // Used by BOTH the Drafts tab (per-season group ordering) and the
  // Misc tab (flat list ordering).
  const STATUS_RANK: Record<string, number> = {
    in_progress: 0,
    setup: 1,
    complete: 2,
  };
  const sortedDrafts = useMemo(() => {
    return [...drafts].sort((a, b) => {
      const ra = STATUS_RANK[a.status] ?? 3;
      const rb = STATUS_RANK[b.status] ?? 3;
      return ra - rb;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drafts]);

  // ── Desktop scannability: search + status filters ────────────────
  // Applies to both the season accordions and the Misc tab so the two
  // lists never disagree about what's visible.
  const [draftQuery, setDraftQuery] = useState('');
  const [draftFilter, setDraftFilter] = useState<'all' | 'mine' | 'live' | 'complete'>('all');
  const [roomGroup, setRoomGroup] = useState('all');
  const [seasonView, setSeasonView] = useState<'overview' | 'standings' | 'playoffs' | 'history'>('overview');

  const visibleDrafts = useMemo(() => {
    const q = draftQuery.trim().toLowerCase();
    return sortedDrafts.filter(d => {
      if (q && !(d.topic || d.title || '').toLowerCase().includes(q)) return false;
      if (draftFilter === 'live') return d.status === 'in_progress';
      if (draftFilter === 'complete') return d.status === 'complete';
      if (draftFilter === 'mine') return d.status === 'in_progress' && d.current_pick_user_id === user?.id;
      return true;
    });
  }, [sortedDrafts, draftQuery, draftFilter, user?.id]);

  const filterCounts = useMemo(() => ({
    all: sortedDrafts.length,
    mine: sortedDrafts.filter(d => d.status === 'in_progress' && d.current_pick_user_id === user?.id).length,
    live: sortedDrafts.filter(d => d.status === 'in_progress').length,
    complete: sortedDrafts.filter(d => d.status === 'complete').length,
  }), [sortedDrafts, user?.id]);

  const canSeeCommissioner = isCommissioner || isAppAdmin;

  // ── renderDraftRow ────────────────────────────────────────────────
  // Shared row renderer used by BOTH the Drafts tab (inside season
  // accordions) and the Misc tab (flat list). Lifted to component
  // scope so the visual treatment stays in lockstep across both.
  // Closes over component-level state (participantCounts,
  // statusConfig, draftWinners, playoffMatchByDraft, user) — no need
  // to pass deps explicitly.
  const renderDraftRow = (d: any, i: number) => {
    const count = participantCounts.get(d.id) || 0;
    const sc = statusConfig[d.status] || statusConfig.setup;
    const winner = draftWinners.get(d.id);
    const playoffMatch = playoffMatchByDraft.get(d.id);
    const isPlayoff = !!playoffMatch;
    const isLive = d.status === 'in_progress';
    const isMyTurn = isLive && d.current_pick_user_id === user?.id;
    const made = draftPickCounts.get(d.id) || 0;
    const roomParticipants = [...(draftParticipants.get(d.id) || [])].sort((a, b) => a.pick_order - b.pick_order);
    const currentPickerName = roomParticipants.find(participant => participant.user_id === d.current_pick_user_id)?.profiles?.display_name || d.current_pick_profiles?.display_name || 'Another player';
    const totalExpected = count * d.num_rounds;
    const progressLabel = isLive
      ? `Round ${d.current_round || 1} · Pick ${Math.min(d.current_pick_number || made + 1, totalExpected || made + 1)}/${totalExpected || '—'}`
      : d.status === 'complete' ? `${made} selections` : `${count} participants`;
    let picksUntilYou: number | null = null;
    if (isLive && user?.id && !isMyTurn && count > 0) {
      const current = d.current_pick_number || made + 1;
      for (let pickNo = current + 1; pickNo <= totalExpected; pickNo += 1) {
        const zero = pickNo - 1;
        const roundIndex = Math.floor(zero / count);
        const position = zero % count;
        const participantIndex = roundIndex % 2 === 0 ? position : count - 1 - position;
        if (roomParticipants[participantIndex]?.user_id === user.id) {
          picksUntilYou = pickNo - current;
          break;
        }
      }
    }
    let newSinceVisit = 0;
    if (user?.id && typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(`da_last_visit_v1:${user.id}:${d.id}`);
        const previous = raw ? Number(JSON.parse(raw)?.c || 0) : made;
        newSinceVisit = Math.max(0, made - previous);
      } catch { newSinceVisit = 0; }
    }
    const staggerIdx = Math.min(i, 8);
    // Left-edge accent — drives the visual identity at a glance:
    //   playoff   → bright gold (championship vibe)
    //   my turn   → gold (you should act)
    //   live(other) → success-green
    //   default   → none
    const edgeAccent =
      isPlayoff ? 'hsl(var(--da-gold))'
      : isMyTurn ? 'hsl(var(--gold))'
      : isLive  ? 'hsl(var(--success))'
      : null;
    return (
      <motion.article
        key={d.id}
        className="da-room-card-wrapper"
        variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.22, delay: staggerIdx * 0.025 } } }}
      >
        <Link
          to={`/drafts/${d.id}`}
          className={cn('da-room-card da-glass', isPlayoff && 'is-playoff', isLive && 'is-live', isMyTurn && 'is-your-turn')}
          style={edgeAccent ? { '--da-room-accent': edgeAccent } as React.CSSProperties : undefined}
          data-room-status={d.status}
          data-your-turn={isMyTurn}
        >
          <div className="da-room-card-top">
            <span className="da-room-card-mark" aria-hidden="true">{isPlayoff ? <Trophy /> : isLive ? <Swords /> : d.status === 'complete' ? <Award /> : <Bookmark />}</span>
            {isPlayoff && <PlayoffBadge round={playoffMatch!.round} matchNumber={playoffMatch!.match_number} size="xs" />}
            <span className={cn('da-room-status', isPlayoff ? 'da-status-complete' : sc.cls)}>{isMyTurn ? 'YOUR TURN' : sc.label}</span>
          </div>
          <h3>{d.topic}</h3>
          <div className="da-room-card-meta">
            <span>{isPlayoff ? getPlayoffGameLabel(playoffMatch!.round, playoffMatch!.match_number) : progressLabel}</span>
            <span><Users size={12} aria-hidden="true" />{count}</span>
          </div>
          <div className="da-room-card-meter" aria-label={`${made} of ${totalExpected || 0} selections`}>
            <span style={{ width: `${totalExpected > 0 ? Math.min(100, made / totalExpected * 100) : 0}%` }} />
          </div>
          <div className="da-room-card-detail">
            {winner ? <span className="da-room-card-winner"><Crown size={13} aria-hidden="true" />{winner.display_name}</span> : isLive ? (
              <span>{isMyTurn ? 'Your roster is waiting.' : `${currentPickerName} is choosing`}{!isMyTurn && picksUntilYou !== null ? ` · ${picksUntilYou === 1 ? 'You’re next' : `${picksUntilYou} until you`}` : ''}</span>
            ) : <span>{d.status === 'complete' ? 'The final board is in.' : 'Build a room. Bring your rivals.'}</span>}
            {newSinceVisit > 0 && <b>{newSinceVisit} new</b>}
          </div>
          <div className="da-room-card-footer">
            <div className="da-room-card-players" aria-label={`${count} participants`}>
              {roomParticipants.slice(0, 4).map((participant) => {
                const name = participant.profiles?.display_name || 'Player';
                return <span key={participant.user_id} title={name} aria-hidden="true">{name.split(/\s+/).slice(0, 2).map((part: string) => part[0]).join('').toUpperCase()}</span>;
              })}
              {count > 4 && <small>+{count - 4}</small>}
            </div>
            <span className="da-room-card-action">{isMyTurn ? 'Make your pick' : d.status === 'complete' ? 'View results' : isLive ? 'Enter draft' : 'Open lobby'}<ArrowRight size={15} aria-hidden="true" /></span>
          </div>
        </Link>
      </motion.article>
    );
  };

  const nextTurn = sortedDrafts.find(d => d.status === 'in_progress' && d.current_pick_user_id === user?.id);

  return (
    <div className="da-lobby da-ledger-page" data-testid="draft-arena-lobby">
      <header className="da-lobby-hero">
        <img src={draftEmblem} className="da-lobby-hero-emblem" alt="" aria-hidden="true" />
        <div className="da-lobby-hero-copy">
          <p className="da-lobby-eyebrow">{season ? formatSeasonTitle(season) : 'The club draft room'} <span>•</span> DRAFT ARENA</p>
          <h1>{nextTurn ? 'You’re on the clock.' : 'Make your mark.'}</h1>
          <p>{nextTurn ? nextTurn.topic : 'Every pick builds your legacy.'}</p>
        </div>
        <Link to={nextTurn ? `/drafts/${nextTurn.id}` : '/drafts/create'} className="da-lobby-enter da-cta btn-press">
          {nextTurn ? <><Play size={17} aria-hidden="true" /> Make your pick</> : <><Plus size={17} aria-hidden="true" /> Create draft</>}
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </header>
      {myDraftStats.draftsRated > 0 && (
        <div className="da-lobby-career" aria-label="Your draft career">
          <span><Trophy aria-hidden="true" /><b>{myDraftStats.totalPoints}</b><small>points</small></span>
          <span><Crown aria-hidden="true" /><b>{myDraftStats.wins}</b><small>wins</small></span>
          <span><Medal aria-hidden="true" /><b>{myDraftStats.podiums}</b><small>podiums</small></span>
          <Link to="/drafts?tab=stats" aria-label="View career stats"><BarChart3 aria-hidden="true" /><span>Career</span><ChevronRight aria-hidden="true" /></Link>
        </div>
      )}
      <Tabs
        value={defaultTab === 'commissioner' && !canSeeCommissioner ? 'drafts' : defaultTab}
        onValueChange={(value) => {
          if (value === 'drafts') setSearchParams({});
          else setSearchParams({ tab: value });
        }}
        className="da-lobby-tabs"
      >
        <div className="da-lobby-nav da-ledger-toolbar">
          <TabsList className="da-ledger-tabs" aria-label="Draft Arena sections">
            <TabsTrigger value="drafts" className="da-ledger-tab"><Swords size={15} aria-hidden="true" /> Rooms</TabsTrigger>
            <TabsTrigger value="season" className="da-ledger-tab"><Trophy size={15} aria-hidden="true" /> Season</TabsTrigger>
            <TabsTrigger value="stats" className="da-ledger-tab"><BarChart3 size={15} aria-hidden="true" /> Stats</TabsTrigger>
            {canSeeCommissioner && <TabsTrigger value="commissioner" className="da-ledger-tab"><Shield size={15} aria-hidden="true" /><span>Manage</span></TabsTrigger>}
          </TabsList>
        </div>

        {/* ── DRAFTS TAB ── */}
        <TabsContent value="drafts" className="da-lobby-rooms">
          {draftLoadError && <div className="da-lobby-load-error" role="alert"><span>Rooms couldn’t refresh.</span><button type="button" onClick={() => void fetchDrafts()}><RefreshCw size={14} aria-hidden="true" />Retry</button></div>}
          {/* Search + status filters — keeps long season archives scannable */}
          {!loading && drafts.length > 0 && (
            <div className="da-lobby-room-tools">
              <div className="da-lobby-search relative flex-1 min-w-0">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                <input
                  value={draftQuery}
                  onChange={e => setDraftQuery(e.target.value)}
                  placeholder="Search drafts"
                  aria-label="Search drafts"
                         className="w-full h-9 pl-9 pr-3 rounded-lg bg-card border border-border text-[12.5px] font-semibold placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/60"
                />
              </div>
              <div className="da-lobby-status-filters" aria-label="Filter draft rooms">
                {([
                  { key: 'all', label: 'All' },
                  { key: 'mine', label: 'Your turn' },
                  { key: 'live', label: 'Live' },
                  { key: 'complete', label: 'Complete' },
                ] as const).map(f => {
                  const active = draftFilter === f.key;
                  return (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setDraftFilter(f.key)}
                      aria-pressed={active}
                      className={cn(
                         'da-filter-chip flex-shrink-0 h-9 px-3 rounded-lg text-[11px] font-extrabold border transition-colors',
                        active
                           ? 'is-active'
                          : 'border-border/40 text-muted-foreground/75 hover:text-foreground',
                      )}
                    >
                      {f.label}
                      <span className="ml-1 tabular-nums opacity-70">{filterCounts[f.key]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="da-lobby-scroll da-lobby-room-scroll" aria-label="Draft rooms">
          {loading ? (
            <div className="space-y-2.5">
              {[1, 2].map(i => (
                <div key={i} className="da-glass p-5">
                  <div className="h-4 rounded-lg w-1/3 mb-2.5 da-shimmer" />
                  <div className="h-3 rounded-lg w-1/2 da-shimmer" />
                </div>
              ))}
            </div>
          ) : draftLoadError && drafts.length === 0 ? (
            <div className="da-lobby-empty" role="status"><RefreshCw size={28} aria-hidden="true" /><h2>Rooms are unavailable.</h2><p>Try again in a moment to return to the arena.</p></div>
          ) : drafts.length === 0 ? (
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="empty-state">
              <div className="da-page-icon" style={{ width: '3.5rem', height: '3.5rem', borderRadius: '1rem' }}>
                <Bookmark className="w-7 h-7" />
              </div>
              <p className="empty-state-title">No drafts yet</p>
              <p className="empty-state-desc mb-6">Run a snake draft on any topic with your crew.</p>
              <Link to="/drafts/create">
                <Button className="font-bold rounded-xl gap-2 btn-press da-cta"><Plus className="w-4 h-4" /> Create Draft</Button>
              </Link>
            </motion.div>
          ) : (() => {
            // ── Group drafts by season ──
            // Season drafts and one-off drafts now live together so the
            // room list is the single place to browse draft boards.
            type Group = { id: string; name: string; status: string | null; startsAt: string | null; drafts: any[] };
            const groupsMap = new Map<string, Group>();
            for (const s of allSeasons) {
              groupsMap.set(s.id, { id: s.id, name: s.name, status: s.status, startsAt: s.startsAt, drafts: [] });
            }
            const miscDrafts: any[] = [];
            // Iterate the status-sorted list so each season group ends up
            // with active → setup → complete order naturally (push order
            // is preserved).
            for (const d of visibleDrafts) {
              const meta = seasonByDraft.get(d.id);
              if (meta && groupsMap.has(meta.seasonId)) groupsMap.get(meta.seasonId)!.drafts.push(d);
              else miscDrafts.push(d);
            }
            // Only show seasons that have drafts. Sort newest → oldest.
            const seasonGroups = Array.from(groupsMap.values())
              .filter(g => g.drafts.length > 0)
              .sort((a, b) => (b.startsAt || '').localeCompare(a.startsAt || ''));
            const orderedGroups: Group[] = [
              ...seasonGroups,
              ...(miscDrafts.length > 0 ? [{ id: '__misc__', name: 'One-off Drafts', status: null, startsAt: null, drafts: miscDrafts }] : []),
            ];

            const selected = roomGroup === 'all' ? undefined : orderedGroups.find(group => group.id === roomGroup);
            const shown = selected ? selected.drafts : visibleDrafts;
            return (
              <>
                <nav className="da-room-groups" aria-label="Room seasons">
                  <button type="button" aria-pressed={!selected} onClick={() => setRoomGroup('all')}>All rooms <span>{visibleDrafts.length}</span></button>
                  {orderedGroups.map(group => <button type="button" key={group.id} aria-pressed={selected?.id === group.id} onClick={() => setRoomGroup(group.id)}>{group.name}<span>{group.drafts.length}</span></button>)}
                </nav>
                {shown.length ? (
                  <motion.div className="da-room-card-grid" initial="hidden" animate="show" key={`${selected?.id ?? 'all'}:${draftFilter}:${draftQuery}`}>
                    {shown.map((draft, index) => renderDraftRow(draft, index))}
                  </motion.div>
                ) : (
                  <div className="da-lobby-empty" role="status">
                    <Search size={28} aria-hidden="true" /><h2>No rooms match.</h2><p>Try another topic or status.</p>
                    <button type="button" className="da-cta" onClick={() => { setDraftQuery(''); setDraftFilter('all'); setRoomGroup('all'); }}>Show all rooms</button>
                  </div>
                )}
              </>
            );
          })()}
          </div>



        </TabsContent>

        {/* ── SEASON TAB ── */}
        <TabsContent value="season" className="da-lobby-panel">
          <nav className="da-season-nav" aria-label="Season views">
            {([
              { value: 'overview', label: 'Overview', icon: Target },
              { value: 'standings', label: 'Standings', icon: Trophy },
              { value: 'playoffs', label: 'Playoffs', icon: Swords },
              { value: 'history', label: 'History', icon: Archive },
            ] as const).map(view => <button key={view.value} type="button" aria-pressed={seasonView === view.value} onClick={() => setSeasonView(view.value)}><view.icon size={14} aria-hidden="true" />{view.label}</button>)}
          </nav>
          <div className="da-lobby-scroll" key={seasonView}>
            {seasonLoading ? (
              <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="da-glass p-5"><div className="h-4 rounded-lg w-1/3 mb-2.5 da-shimmer" /><div className="h-3 rounded-lg w-1/2 da-shimmer" /></div>)}</div>
            ) : season ? (
              <div className="da-season-content space-y-3" data-season-view={seasonView}>
                {seasonView === 'overview' && <>
                  <SeasonHeaderCard season={season} entries={entries} />
                  {season.status !== 'complete' ? <NextDraftCard entries={entries} totalDrafts={totalDrafts} /> : (
                    <Link to={`/drafts/seasons/${season.id}`} className="da-season-finish da-glass"><Trophy aria-hidden="true" /><span><b>Season complete</b><small>Open the final podium and season recap.</small></span><ArrowRight aria-hidden="true" /></Link>
                  )}
                  <div className="da-season-destinations">
                    <button type="button" onClick={() => setSeasonView('standings')}><Trophy aria-hidden="true" /><span><b>The standings</b><small>{standings.length} contenders</small></span><ChevronRight aria-hidden="true" /></button>
                    <button type="button" onClick={() => setSeasonView('playoffs')}><Swords aria-hidden="true" /><span><b>The championship</b><small>Bracket and matchups</small></span><ChevronRight aria-hidden="true" /></button>
                  </div>
                  {season.status === 'complete' && canSeeCommissioner && <button type="button" onClick={() => setStartNextOpen(true)} className="da-season-next da-cta"><Plus size={17} aria-hidden="true" />Start the next season<ArrowRight size={17} aria-hidden="true" /></button>}
                </>}
                {seasonView === 'standings' && <><StandingsCard standings={standings} userId={user?.id} /><LifetimeStatsCard userId={user?.id} /></>}
                {seasonView === 'playoffs' && (season.status !== 'complete'
                  ? <><PlayoffControlCenter season={season} matches={matches} standings={standings} userId={user?.id} onUpdate={handleSeasonUpdate} /><PlayoffPicture standings={standings} matches={matches} seasonId={season.id} /></>
                  : <Link to={`/drafts/seasons/${season.id}`} className="da-season-finish da-glass"><Trophy aria-hidden="true" /><span><b>The championship is complete</b><small>Open the final bracket in the season recap.</small></span><ArrowRight aria-hidden="true" /></Link>)}
                {seasonView === 'history' && <>
                  <SeasonDraftHistory entries={entries} totalDrafts={totalDrafts} />
                  <Link to="/drafts/seasons" className="da-season-archive da-glass"><Archive size={18} aria-hidden="true" /><span>Explore past seasons</span><ArrowRight size={17} aria-hidden="true" /></Link>
                </>}
                <StartNextSeasonSheet open={startNextOpen} onOpenChange={setStartNextOpen} previousSeason={season} onCreated={() => { refetchSeason(); }} />
              </div>
            ) : <NoSeasonState />}
          </div>
        </TabsContent>

        {/* ── STATS TAB ── */}
        <TabsContent value="stats" className="da-lobby-panel"><div className="da-lobby-scroll">
          {myDraftStats.draftsRated > 0 && <section className="da-career-summary da-glass" aria-label="Your career summary">
            <p className="da-lobby-eyebrow">YOUR PLAYER CARD</p>
            <div>{[
              { label: 'Points', value: myDraftStats.totalPoints, icon: Trophy },
              { label: 'Wins', value: myDraftStats.wins, icon: Crown },
              { label: 'Podiums', value: myDraftStats.podiums, icon: Medal },
              { label: 'Average score', value: myDraftStats.avgScore.toFixed(1), icon: BarChart3 },
              { label: 'Best finish', value: myDraftStats.bestFinish > 0 ? getOrdinalSuffix(myDraftStats.bestFinish) : '—', icon: Award },
              { label: 'Rated drafts', value: myDraftStats.draftsRated, icon: ListChecks },
            ].map(stat => <article key={stat.label}><stat.icon aria-hidden="true" /><b>{stat.value}</b><span>{stat.label}</span></article>)}</div>
          </section>}
          <Suspense fallback={
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="da-glass p-5">
                  <div className="h-4 rounded-lg w-1/3 mb-2.5 skeleton-shimmer" />
                  <div className="h-3 rounded-lg w-1/2 skeleton-shimmer" />
                </div>
              ))}
            </div>
          }>
            <DraftStatsHub />
          </Suspense>
          </div>
        </TabsContent>

        {/* ── COMMISSIONER TAB ── */}
        {canSeeCommissioner && (
          <TabsContent value="commissioner" className="da-lobby-panel"><div className="da-lobby-scroll">
            {seasonLoading ? (
              <div className="glass-card p-5"><div className="h-4 rounded-lg w-1/3 mb-2.5 skeleton-shimmer" /></div>
            ) : season ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'hsl(var(--gold) / 0.15)', border: '1px solid hsl(var(--gold) / 0.3)' }}>
                    <Shield className="w-4 h-4" style={{ color: 'hsl(var(--gold))' }} />
                  </div>
                  <div>
                    <p className="text-[11px] font-extrabold" style={{ color: 'hsl(var(--gold))' }}>Commissioner Tools</p>
                    <p className="text-[10px] text-muted-foreground/70">{formatSeasonTitle(season)}{season.subtitle ? ` · ${season.subtitle}` : ''}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { to: `/drafts/seasons/${season.id}`, icon: Archive, label: 'Season page' },
                    { to: '/drafts/create', icon: Plus, label: 'New draft' },
                    { to: '/drafts/seasons', icon: Trophy, label: 'All seasons' },
                  ].map(t => (
                    <Link key={t.label} to={t.to} className="flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-card/70 btn-press hover:bg-muted/40 transition-colors">
                      <t.icon className="w-5 h-5 text-[hsl(var(--da-gold))]" />
                      <span className="text-[11px] font-bold">{t.label}</span>
                    </Link>
                  ))}
                </div>
                <CommissionerPanel season={season} entries={entries} onUpdate={handleSeasonUpdate} />
                <TransferCommissionerCard season={season} isAppAdmin={isAppAdmin} onTransferred={refetchSeason} />
                {season.status !== 'complete' && (
                  <div className="glass-card p-4 space-y-2">
                    <h3 className="text-[12px] font-bold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" style={{ color: 'hsl(var(--gold))' }} /> Season Actions
                    </h3>
                    <Link to={`/drafts/seasons/${season.id}`} className="block">
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                        <Archive className="w-4 h-4" style={{ color: 'hsl(var(--gold) / 0.6)' }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-bold">Season Detail Page</p>
                          <p className="text-[10px] text-muted-foreground/60">Full season history and settings</p>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
                      </div>
                    </Link>
                  </div>
                )}
                {season.status === 'complete' && (
                  <div className="glass-card p-4 flex items-center gap-3"
                    style={{ background: 'linear-gradient(135deg, hsl(var(--gold) / 0.10), transparent 60%), hsl(var(--card))', border: '1px solid hsl(var(--gold) / 0.25)' }}>
                    <Sparkles className="w-5 h-5 flex-shrink-0" style={{ color: 'hsl(var(--gold))' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-extrabold">Start a new season?</p>
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">Archive {formatSeasonTitle(season)} and open fresh standings.</p>
                    </div>
                    <button onClick={() => setStartNextOpen(true)}
                      className="h-9 px-3 rounded-lg text-[11px] font-extrabold btn-press flex items-center gap-1.5 flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, hsl(var(--gold) / 0.95), hsl(var(--gold) / 0.7))', color: 'hsl(0 0% 8%)' }}>
                      <Plus className="w-3.5 h-3.5" /> Start
                    </button>
                  </div>
                )}
                <StartNextSeasonSheet open={startNextOpen} onOpenChange={setStartNextOpen} previousSeason={season} onCreated={() => { refetchSeason(); }} />
              </div>
            ) : (
              <div className="glass-card p-6 text-center">
                <Shield className="w-8 h-8 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-sm font-bold mb-1">No active season</p>
                <p className="text-[11px] text-muted-foreground/70">Create a season first to manage it here.</p>
                <Link to="/drafts/seasons" className="mt-4 inline-block">
                  <Button size="sm" variant="outline" className="gap-1.5 rounded-lg font-bold btn-press border-gold/30 text-gold hover:bg-gold/10">
                    <Archive className="w-3.5 h-3.5" /> Seasons
                  </Button>
                </Link>
              </div>
            )}
          </div></TabsContent>
        )}
      </Tabs>
    </div>
  );
}
