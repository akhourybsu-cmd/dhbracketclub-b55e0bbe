import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Trophy, Calendar, Crown, BarChart3, Swords, Bookmark, ChevronRight, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import {
  useSeasonById,
  useSeasonStandings,
  useSeasonEntries,
  usePlayoffMatches,
  useProfilesByIds,
  getSeasonDraftTarget,
  formatSeasonTitle,
} from '@/hooks/useDraftSeasons';
import { SeasonPodium } from '@/components/draft/SeasonPodium';
import { getPlayoffRoundLabel } from '@/lib/seasonUtils';
import { cn } from '@/lib/utils';

export default function SeasonArchiveDetailPage() {
  const { seasonId } = useParams<{ seasonId: string }>();
  const { season, loading: seasonLoading } = useSeasonById(seasonId);
  const { standings } = useSeasonStandings(seasonId);
  const { entries } = useSeasonEntries(seasonId);
  const { matches } = usePlayoffMatches(seasonId);

  const allUserIds = [
    season?.champion_user_id,
    season?.runner_up_user_id,
    season?.third_place_user_id,
    season?.regular_season_champion_user_id,
    ...standings.map(s => s.user_id),
    ...matches.flatMap(m => [m.user_a, m.user_b]),
  ];
  const profiles = useProfilesByIds(allUserIds);

  if (seasonLoading) {
    return (
      <div className="pb-6 space-y-3">
        <div className="h-12 rounded-xl skeleton-shimmer" />
        <div className="h-48 rounded-xl skeleton-shimmer" />
        <div className="h-32 rounded-xl skeleton-shimmer" />
      </div>
    );
  }

  if (!season) {
    return (
      <div className="pb-6 text-center py-12">
        <p className="text-sm text-muted-foreground">Season not found.</p>
        <Link to="/drafts/seasons" className="text-primary text-sm font-bold mt-3 inline-block">
          Back to seasons
        </Link>
      </div>
    );
  }

  const isComplete = season.status === 'complete';
  const totalDrafts = getSeasonDraftTarget(season);
  const completedRegular = entries.filter(e => !e.is_playoff && e.drafts?.status === 'complete').length;

  const champion = season.champion_user_id ? profiles.get(season.champion_user_id) : null;
  const runnerUp = season.runner_up_user_id ? profiles.get(season.runner_up_user_id) : null;
  const thirdPlace = season.third_place_user_id ? profiles.get(season.third_place_user_id) : null;
  const regChamp = season.regular_season_champion_user_id
    ? profiles.get(season.regular_season_champion_user_id)
    : null;

  // Aggregate stats
  const allDrafts = entries.filter(e => !e.is_playoff && e.drafts?.status === 'complete');
  const playoffMatches = matches.filter(m => m.status === 'complete');

  return (
    <div className="pb-6 da-ledger-page">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Link to="/drafts/seasons" className="da-back" aria-label="Back to Seasons">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
             <h1 className="dl-display font-extrabold text-lg leading-snug break-words">{formatSeasonTitle(season)}</h1>
            {isComplete && (
              <span
                className="text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded"
                style={{ background: 'hsl(var(--gold) / 0.12)', color: 'hsl(var(--gold))' }}
              >
                Archived
              </span>
            )}
          </div>
          {season.subtitle && (
            <p className="text-[11px] font-semibold text-muted-foreground/85 leading-snug break-words mb-0.5">{season.subtitle}</p>
          )}
          <p className="text-[10px] text-muted-foreground/70 font-medium flex items-center gap-1">
            <Calendar className="w-2.5 h-2.5" />
            {format(new Date(season.starts_at), 'MMM d, yyyy')} —{' '}
            {format(new Date(season.ends_at), 'MMM d, yyyy')}
          </p>
        </div>
      </div>

       <div className="space-y-4">
        {/* Podium — only for complete seasons */}
        {isComplete && (champion || runnerUp || thirdPlace) && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="da-glass p-3 flex items-center gap-2.5 overflow-x-auto"
            style={{
              background: 'linear-gradient(135deg, hsl(var(--gold) / 0.08), transparent 60%), hsl(var(--card))',
              border: '1px solid hsl(var(--gold) / 0.18)',
            }}
          >
            <Trophy className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(var(--gold))' }} />
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/70 flex-shrink-0">
              Final
            </span>
            <div className="flex items-center gap-2 text-[11px] font-bold whitespace-nowrap">
              {champion && (
                <span style={{ color: 'hsl(var(--gold))' }}>🏆 {champion.display_name}</span>
              )}
              {runnerUp && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="text-muted-foreground">🥈 {runnerUp.display_name}</span>
                </>
              )}
              {thirdPlace && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="text-muted-foreground">🥉 {thirdPlace.display_name}</span>
                </>
              )}
            </div>
          </motion.div>
        )}

        {isComplete && (
          <SeasonPodium
            champion={champion}
            runnerUp={runnerUp}
            thirdPlace={thirdPlace}
            seasonName={formatSeasonTitle(season)}
          />
        )}

        {!isComplete && (
          <div
            className="da-glass p-4 flex items-center gap-3 border-gold/15"
            style={{ background: 'linear-gradient(135deg, hsl(var(--gold) / 0.06), transparent 60%), hsl(var(--card))' }}
          >
            <Sparkles className="w-5 h-5 flex-shrink-0" style={{ color: 'hsl(var(--gold))' }} />
            <div className="flex-1">
              <p className="text-[12px] font-bold">Season in progress</p>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                Final podium will appear here once playoffs conclude.
              </p>
            </div>
            <Link to="/compete">
              <button className="da-cta" style={{ height: '2rem', fontSize: '10px' }}>
                View Season
              </button>
            </Link>
          </div>
        )}

        {/* Season summary stats */}
         <div className="da-glass da-ledger-section p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
            <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground/70">
              Season Stats
            </h3>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Drafts" value={`${completedRegular}/${totalDrafts}`} />
            <Stat label="Playoff Games" value={`${playoffMatches.length}`} />
            <Stat label="Players" value={`${standings.length}`} />
          </div>
          {regChamp && (
            <div className="mt-3 pt-3 border-t border-gold/15 flex items-center gap-2">
              <Crown className="w-3.5 h-3.5" style={{ color: 'hsl(var(--gold))' }} />
              <span className="text-[10px] text-muted-foreground/70 font-medium">Regular Season Champion</span>
              <span className="text-[11px] font-extrabold ml-auto" style={{ color: 'hsl(var(--gold))' }}>
                {regChamp.display_name}
              </span>
            </div>
          )}
        </div>

        {/* Final Standings */}
        {standings.length > 0 && (
           <div className="da-glass da-ledger-section p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <Trophy className="w-3.5 h-3.5" style={{ color: 'hsl(var(--gold))' }} />
              <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground/70">
                Regular Season Standings
              </h3>
            </div>
            <div className="space-y-1.5">
              {standings.map((s, i) => {
                const p = profiles.get(s.user_id);
                const rank = s.rank ?? i + 1;
                const isTop3 = rank <= 3;
                return (
                  <div
                    key={s.id}
                    className={cn(
                      'flex items-center gap-2 px-2.5 py-2 rounded-lg',
                      isTop3 ? 'bg-gold/5 border border-gold/15' : 'da-subcard'
                    )}
                  >
                    <span
                      className="text-[10px] font-extrabold w-5 text-center"
                      style={{ color: isTop3 ? 'hsl(var(--gold))' : 'hsl(var(--muted-foreground))' }}
                    >
                      #{rank}
                    </span>
                    <span className="flex-1 text-[12px] font-bold truncate">
                      {p?.display_name || '—'}
                    </span>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground/70 font-medium">
                      <span>{s.wins}W</span>
                      <span>{s.podiums}🏆</span>
                    </div>
                    <span
                      className="text-[12px] font-extrabold tabular-nums w-8 text-right"
                      style={{ color: isTop3 ? 'hsl(var(--gold))' : undefined }}
                    >
                      {s.season_points}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Playoff results */}
        {matches.length > 0 && (
           <div className="da-glass da-ledger-section p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <Swords className="w-3.5 h-3.5" style={{ color: 'hsl(var(--gold))' }} />
              <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground/70">
                Playoff Bracket
              </h3>
            </div>
            <div className="space-y-1.5">
              {matches.map(m => {
                const a = m.user_a ? profiles.get(m.user_a) : null;
                const b = m.user_b ? profiles.get(m.user_b) : null;
                const winnerIsA = m.winner_user_id && m.winner_user_id === m.user_a;
                const winnerIsB = m.winner_user_id && m.winner_user_id === m.user_b;
                return (
                  <div key={m.id} className="da-subcard p-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground/60">
                        {getPlayoffRoundLabel(m.round as any)}{' '}
                        {m.round === 'final' || m.round === 'sf' ? `· G${m.match_number}` : ''}
                      </span>
                      <span
                        className={cn(
                          m.status === 'complete'
                            ? 'da-status-complete'
                            : m.status === 'in_progress'
                            ? 'da-status-live'
                            : 'da-status-setup'
                        )}
                      >
                        {m.status === 'complete' ? 'Final' : m.status === 'in_progress' ? 'Live' : m.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span
                        className={cn('font-bold truncate flex-1', winnerIsA && 'text-foreground')}
                        style={winnerIsA ? { color: 'hsl(var(--gold))' } : { color: 'hsl(var(--muted-foreground))' }}
                      >
                        #{m.seed_a} {a?.display_name || '—'}
                        {winnerIsA && <Trophy className="w-2.5 h-2.5 inline ml-1" />}
                      </span>
                      <span className="text-muted-foreground/40 text-[9px]">vs</span>
                      <span
                        className={cn('font-bold truncate flex-1 text-right')}
                        style={winnerIsB ? { color: 'hsl(var(--gold))' } : { color: 'hsl(var(--muted-foreground))' }}
                      >
                        {b?.display_name || '—'} #{m.seed_b}
                        {winnerIsB && <Trophy className="w-2.5 h-2.5 inline ml-1" />}
                      </span>
                    </div>
                    {m.draft_id && (
                      <Link to={`/drafts/${m.draft_id}`}>
                        <div className="mt-2 flex items-center justify-end gap-1 text-[9px] font-bold text-muted-foreground/60 hover:text-foreground">
                          View draft <ChevronRight className="w-2.5 h-2.5" />
                        </div>
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Regular season drafts */}
        {allDrafts.length > 0 && (
           <div className="da-glass da-ledger-section p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <Bookmark className="w-3.5 h-3.5" style={{ color: 'hsl(var(--gold))' }} />
              <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground/70">
                Season Drafts
              </h3>
            </div>
            <div className="space-y-1">
              {allDrafts.map(e => (
                <Link to={`/drafts/${e.draft_id}`} key={e.id} className="block">
                  <div className="flex items-center gap-2 px-2.5 py-2 da-subcard hover:bg-gold/10 transition-colors">
                    <span className="text-[10px] font-extrabold text-muted-foreground/60 w-6">
                      #{e.week_number}
                    </span>
                    <span className="flex-1 text-[12px] font-bold truncate">
                      {e.drafts?.topic || 'Draft'}
                    </span>
                    <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center da-subcard py-2">
      <p className="text-[14px] font-extrabold tabular-nums leading-none">{value}</p>
      <p className="text-[8px] text-muted-foreground/60 font-bold uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}
