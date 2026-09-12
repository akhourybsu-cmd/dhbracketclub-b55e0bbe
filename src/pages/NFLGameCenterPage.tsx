import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight, CalendarDays, CheckCircle2, Clock3, Flame,
  ListChecks, Radio, Shield, Trophy, Users, Zap,
} from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import {
  useActiveSeason, useCurrentWeek, useMyWeekPicks, usePickemAdmin,
  useSeasonStandings, useWeekGames, useWeekLock,
} from '@/hooks/usePickem';
import { useCrazyChainMarkets, useCrazyChainStandings, useMyCrazyChainEntry } from '@/hooks/useCrazyChain';
import { TurfBackdrop } from '@/components/pickem/TurfBackdrop';
import { chooseChainBoardWeek, useCrazyChainWeeks } from '@/hooks/useCrazyChainWeeks';
import { useCrazyChainBoard } from '@/hooks/useCrazyChainBoard';
import { chainGameIsOpen } from '../../supabase/functions/_shared/chainGameRules';
import { NflCheckButton } from '@/components/pickem/NflCheckButton';
import { KickoffCountdown } from '@/components/pickem/KickoffCountdown';

export default function NFLGameCenterPage() {
  const { user } = useAuth();
  const { season, loading } = useActiveSeason();
  const { week } = useCurrentWeek(season);
  const { games } = useWeekGames(week?.id);
  const { picks } = useMyWeekPicks(week?.id);
  const { lockAt, locked } = useWeekLock(games, season);
  const { weeks: chainWeeks } = useCrazyChainWeeks(season?.id);
  const chainWeek = chooseChainBoardWeek(chainWeeks, 0, season?.current_week);
  const { games: chainGames } = useWeekGames(chainWeek?.id);
  const { locked: chainLocked, migrationReady, now } = useCrazyChainBoard(chainWeek?.id, chainGames, season);
  const { markets } = useCrazyChainMarkets(chainWeek?.id);
  const { entry } = useMyCrazyChainEntry(chainWeek?.id);
  const { standings: chainStandings } = useCrazyChainStandings(season?.id);
  const { standings: pickemStandings } = useSeasonStandings(season?.id);
  const { isAdmin } = usePickemAdmin();

  const myChain = chainStandings.find(row => row.user_id === user?.id);
  const myPickem = pickemStandings.find(row => row.user_id === user?.id);
  const finalGames = games.filter(game => game.status === 'final').length;
  const liveGames = games.filter(game => game.status === 'live').length;
  const featuredGames = [...games]
    .sort((a, b) => {
      const priority = { live: 0, scheduled: 1, final: 2 };
      return priority[a.status] - priority[b.status] || new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime();
    })
    .slice(0, 4);
  const picksComplete = games.length > 0 && picks.length >= games.length;
  const pickemLeaders = pickemStandings.slice(0, 3);
  const chainLeaders = chainStandings.filter(row => row.total_cards > 0).slice(0, 3);
  const openMarkets = markets.filter(market => migrationReady && market.status === 'open'
    && chainGames.some(game => game.id === market.game_id && chainGameIsOpen(game,now))).length;

  return (
    <div className="nfl-command space-y-4 pb-7">
      <TurfBackdrop className="nfl-command-hero p-4 sm:p-6">
        <div className="nfl-command-kicker">
          <span className={liveGames > 0 ? 'nfl-live-dot' : 'nfl-ready-dot'} aria-hidden />
          {liveGames > 0 ? `${liveGames} game${liveGames === 1 ? '' : 's'} in progress` : 'NFL prediction command center'}
        </div>
        <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="nfl-command-overline">{season?.name || 'Club football'}</p>
            <h1 className="nfl-command-title">NFL Game Center</h1>
            <p className="nfl-command-copy">Track the slate, lock your weekly picks, and build a Crazy Chain from one live command deck.</p>
          </div>
          <div className="nfl-command-metrics">
            <ScoreChip label="Games" value={games.length} />
            <ScoreChip label="Final" value={finalGames} />
            <ScoreChip label="Live" value={liveGames} hot={liveGames > 0} />
          </div>
        </div>
        {loading ? (
          <div className="mt-5 h-14 rounded-lg pk-skeleton" />
        ) : season ? (
          <div className="nfl-week-strip mt-5">
            <div>
              <span className="nfl-data-label">Current slate</span>
              <strong>{week?.label || `Week ${season.current_week}`}</strong>
            </div>
            <div className="nfl-week-status">
              <Clock3 className="h-4 w-4" />
              {liveGames > 0
                ? `${finalGames}/${games.length} complete`
                : locked
                  ? 'Picks locked'
                  : lockAt
                    ? `Next lock ${format(lockAt, 'EEE h:mm a')}`
                    : 'Schedule preparing'}
            </div>
          </div>
        ) : (
          <div className="nfl-week-strip mt-5">No NFL season is configured yet.</div>
        )}
      </TurfBackdrop>

      <div className="nfl-dashboard-grid">
        <div className="space-y-4">
          <section className="nfl-panel" aria-labelledby="slate-heading">
            <div className="nfl-panel-header">
              <div>
                <p className="nfl-command-overline">Live board</p>
                <h2 id="slate-heading">Week at a glance</h2>
              </div>
              <Link to={week ? `/pickem/week/${week.week_number}` : '/pickem'} className="nfl-text-link">Full slate <ArrowRight /></Link>
            </div>
            {featuredGames.length ? (
              <div className="nfl-matchup-list">
                {featuredGames.map(game => <MatchupRow key={game.id} game={game} />)}
              </div>
            ) : (
              <div className="nfl-empty-slate">The next slate will appear here when the schedule is ready.</div>
            )}
          </section>

          <section className="grid gap-4 md:grid-cols-2" aria-label="Prediction games">
            <PredictionCard
              to="/pickem"
              icon={<ListChecks />}
              eyebrow="Weekly card"
              title="Pick'em"
              description="Choose every winner before each matchup locks."
              progress={games.length ? `${picks.length} of ${games.length} selected` : 'Awaiting slate'}
              status={picksComplete ? 'Card complete' : locked ? 'Slate locked' : 'Action needed'}
              complete={picksComplete}
              cta="Review picks"
            />
            <PredictionCard
              to={chainWeek ? `/nfl/crazy-chain?week=${chainWeek.week_number}` : '/nfl/crazy-chain'}
              icon={<Zap />}
              eyebrow={chainWeek ? `Week ${chainWeek.week_number}` : 'Weekly run'}
              title="Crazy Chain"
              description="Link stat predictions together and protect your streak."
              progress={entry
                ? `${entry.links_risked} link${entry.links_risked === 1 ? '' : 's'} active`
                : myChain?.current_chain
                  ? `${myChain.current_chain} current chain`
                  : `${openMarkets} predictions open`}
              status={entry ? 'Chain submitted' : chainLocked ? 'Board locked' : 'Board open'}
              complete={Boolean(entry)}
              cta="Open board"
              featured
            />
          </section>
        </div>

        <aside className="space-y-4">
          <StandingsPanel
            title="Pick'em race"
            to="/pickem/standings"
            rows={pickemLeaders.map(row => ({
              id: row.user_id,
              name: row.profiles?.display_name || 'Club member',
              value: `${row.total_correct} correct`,
              rank: row.rank,
            }))}
            myStat={myPickem?.rank ? `Your position: #${myPickem.rank}` : 'Make a pick to enter the table'}
          />
          <StandingsPanel
            title="Chain leaders"
            to="/nfl/crazy-chain/leaderboard"
            rows={chainLeaders.map(row => ({
              id: row.user_id,
              name: row.profiles?.display_name || 'Club member',
              value: `Best ${row.best_chain}`,
              rank: row.rank,
            }))}
            myStat={myChain ? `Your best chain: ${myChain.best_chain}` : 'Build your first chain'}
            chain
          />
          <div className="nfl-utility-grid">
            <CompactTile to="/nfl/crazy-chain/history" icon={<CalendarDays />} title="My history" detail="Past chain cards" />
            <CompactTile to="/pickem/standings" icon={<Users />} title="Club table" detail={`${pickemStandings.length} competitors`} />
          </div>
        </aside>
      </div>

      {isAdmin && (
        <section className="nfl-admin-strip">
          <div className="flex items-center gap-3">
            <div className="nfl-admin-icon"><Shield /></div>
            <div>
              <p className="nfl-command-overline">Commissioner tools</p>
              <h2>League operations</h2>
              <p>Scores refresh nightly. Run a manual check when results need immediate attention.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
          {season && (
            <NflCheckButton seasonYear={season.year} currentWeek={week?.week_number ?? season.current_week} onDone={() => window.location.reload()} />
          )}
          <Link to="/nfl/admin/crazy-chain" className="nfl-admin-link">
            Chain control <ArrowRight />
          </Link>
          </div>
        </section>
      )}
    </div>
  );
}

function ScoreChip({ label, value, hot }: { label: string; value: number; hot?: boolean }) {
  return (
    <div className={hot ? 'nfl-metric is-live' : 'nfl-metric'}>
      <p>{value}</p>
      <span>{label}</span>
    </div>
  );
}

function MatchupRow({ game }: { game: ReturnType<typeof useWeekGames>['games'][number] }) {
  const away = game.away_team;
  const home = game.home_team;
  const isLive = game.status === 'live';
  const isFinal = game.status === 'final';
  return (
    <div className="nfl-matchup-row">
      <div className="nfl-matchup-time">
        <span className={isLive ? 'is-live' : ''}>{isLive ? 'In progress' : isFinal ? 'Final' : format(new Date(game.kickoff_at), 'EEE')}</span>
        <strong>{isLive || isFinal ? 'Score' : format(new Date(game.kickoff_at), 'h:mm a')}</strong>
      </div>
      <TeamIdentity team={away} score={game.away_score} />
      <span className="nfl-matchup-at">@</span>
      <TeamIdentity team={home} score={game.home_score} home />
      <div className="nfl-matchup-clock">
        {game.status === 'scheduled' ? <KickoffCountdown target={game.kickoff_at} compact /> : isLive ? <Radio /> : <CheckCircle2 />}
      </div>
    </div>
  );
}

function TeamIdentity({ team, score, home }: {
  team?: { abbr: string; name: string; city: string; logo_url: string | null };
  score: number | null;
  home?: boolean;
}) {
  return (
    <div className={home ? 'nfl-team is-home' : 'nfl-team'}>
      {team?.logo_url ? <img src={team.logo_url} alt={`${team.city} ${team.name}`} /> : <span className="nfl-team-fallback">{team?.abbr || 'NFL'}</span>}
      <div>
        <strong>{team?.abbr || 'TBD'}</strong>
        <span>{team?.city || 'To be determined'}</span>
      </div>
      {score !== null && <b>{score}</b>}
    </div>
  );
}

function PredictionCard({ to, icon, eyebrow, title, description, progress, status, cta, complete, featured }: {
  to: string; icon: React.ReactNode; eyebrow: string; title: string; description: string;
  progress: string; status: string; cta: string; complete?: boolean; featured?: boolean;
}) {
  return (
    <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.18 }} className="h-full">
      <Link to={to} className={featured ? 'nfl-prediction-card is-featured' : 'nfl-prediction-card'}>
        <div className="nfl-card-topline">
          <span className="nfl-card-icon">{icon}</span>
          <span className={complete ? 'nfl-state is-complete' : 'nfl-state'}>{complete && <CheckCircle2 />}{status}</span>
        </div>
        <p className="nfl-command-overline">{eyebrow}</p>
        <h2>{title}</h2>
        <p>{description}</p>
        <div className="nfl-card-footer">
          <strong>{progress}</strong>
          <span>{cta} <ArrowRight /></span>
        </div>
      </Link>
    </motion.div>
  );
}

function StandingsPanel({ title, to, rows, myStat, chain }: {
  title: string; to: string; rows: Array<{ id: string; name: string; value: string; rank: number | null }>;
  myStat: string; chain?: boolean;
}) {
  return (
    <section className="nfl-panel nfl-standings-panel">
      <div className="nfl-panel-header">
        <div>
          <p className="nfl-command-overline">{chain ? 'Crazy Chain' : 'Season standings'}</p>
          <h2>{title}</h2>
        </div>
        <Link to={to} aria-label={`View ${title}`} className="nfl-icon-link"><ArrowRight /></Link>
      </div>
      <div className="nfl-leader-list">
        {rows.length ? rows.map((row, index) => (
          <div key={row.id} className="nfl-leader-row">
            <span>{row.rank || index + 1}</span>
            <div className="nfl-avatar">{row.name.slice(0, 2).toUpperCase()}</div>
            <strong>{row.name}</strong>
            <b>{row.value}</b>
          </div>
        )) : <p className="nfl-empty-leaders">Standings populate after the first completed card.</p>}
      </div>
      <div className="nfl-my-standing">{chain ? <Flame /> : <Trophy />}{myStat}</div>
    </section>
  );
}

function CompactTile({ to, icon, title, detail }: { to: string; icon: React.ReactNode; title: string; detail: string }) {
  return (
    <Link to={to} className="nfl-utility-link">
      <span>{icon}</span>
      <div>
        <strong>{title}</strong>
        <small>{detail}</small>
      </div>
      <ArrowRight />
    </Link>
  );
}
