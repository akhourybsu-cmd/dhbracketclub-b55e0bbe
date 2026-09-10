import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Activity, ArrowRight, CalendarDays, Flame, ListChecks,
  Radio, Shield, Trophy, Zap,
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
import { chainAvailabilityNote } from '@/lib/nfl/chainAvailability';

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
  const openMarkets = markets.filter(market => market.status === 'open' && (!migrationReady || !chainAvailabilityNote(market, now))).length;

  return (
    <div className="space-y-4 pb-7">
      <TurfBackdrop className="p-5 overflow-hidden">
        <div className="pk-field-stripe mb-4" aria-hidden />
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="pk-section-label flex items-center gap-1.5">
              <Radio className="w-3 h-3 text-gold" /> NFL Command Deck
            </p>
            <h1 className="text-[27px] sm:text-[32px] font-black tracking-tight leading-none text-white mt-2">
              NFL Game Center
            </h1>
            <p className="text-[12px] text-white/65 mt-2 max-w-[40ch] leading-relaxed">
              Scores, weekly predictions, live results, and the club's longest Crazy Chain—all in one place.
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-gold/15 border border-gold/35 flex items-center justify-center shrink-0 shadow-[0_0_22px_hsl(45_95%_55%/0.18)]">
            <Activity className="w-6 h-6 text-gold" />
          </div>
        </div>

        {loading ? (
          <div className="mt-5 h-16 rounded-xl pk-skeleton" />
        ) : season ? (
          <div className="pk-scoreboard mt-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="pk-scoreboard-label">{season.name}</p>
                <p className="text-[16px] text-white font-black mt-1">
                  {week?.label || `Week ${season.current_week}`}
                </p>
                <p className="text-[10px] text-white/55 mt-1">
                  {liveGames > 0
                    ? `${liveGames} live · ${finalGames}/${games.length} final`
                    : locked
                      ? `${finalGames}/${games.length} games final`
                      : lockAt
                        ? `Cards lock ${format(lockAt, 'EEE h:mm a')}`
                        : 'Schedule preparing'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-center">
                <ScoreChip label="Games" value={games.length} />
                <ScoreChip label="Live" value={liveGames} hot={liveGames > 0} />
              </div>
            </div>
          </div>
        ) : (
          <div className="pk-scoreboard mt-5 text-[11px] text-white/60">No NFL season is configured yet.</div>
        )}
      </TurfBackdrop>

      <section>
        <div className="pk-broadcast-divider" aria-hidden />
        <p className="pk-section-label mb-2 px-0.5">Play This Week</p>
        <div className="grid sm:grid-cols-2 gap-2.5">
          <GameTile
            to="/pickem"
            icon={<ListChecks className="w-5 h-5 text-gold" />}
            eyebrow="Classic"
            title="Weekly Pick'em"
            description="Pick every winner and climb the season table."
            stat={week ? `${picks.length}/${games.length} picked` : 'Season setup'}
            cta="Open Pick'em"
          />
          <GameTile
            to={chainWeek ? `/nfl/crazy-chain?week=${chainWeek.week_number}` : '/nfl/crazy-chain'}
            icon={<Zap className="w-5 h-5 text-emerald-300" />}
            eyebrow={chainWeek ? `Week ${chainWeek.week_number} · Crazy Chain` : 'Risk · Reward'}
            title="Crazy Chain"
            description="Stack as many stat predictions as you dare. One miss breaks the chain."
            stat={entry
              ? `${entry.links_risked} link${entry.links_risked === 1 ? '' : 's'} in play`
              : myChain?.current_chain
                ? `${myChain.current_chain} current chain`
                : chainLocked ? 'Board locked' : `${openMarkets} predictions open`}
            cta="Build My Chain"
            featured
          />
        </div>
      </section>

      <section>
        <div className="pk-broadcast-divider" aria-hidden />
        <p className="pk-section-label mb-2 px-0.5">Follow the Season</p>
        <div className="grid grid-cols-2 gap-2">
          <CompactTile
            to={week ? `/pickem/week/${week.week_number}` : '/pickem'}
            icon={<Radio className="w-4 h-4 text-emerald-300" />}
            title="Scores & Slate"
            detail={liveGames ? `${liveGames} live now` : `${games.length} games`}
          />
          <CompactTile
            to="/pickem/standings"
            icon={<Trophy className="w-4 h-4 text-gold" />}
            title="Pick'em Table"
            detail={myPickem?.rank ? `You are #${myPickem.rank}` : 'Season race'}
          />
          <CompactTile
            to="/nfl/crazy-chain/leaderboard"
            icon={<Flame className="w-4 h-4 text-orange-300" />}
            title="Chain Leaders"
            detail={myChain ? `Best ${myChain.best_chain}` : 'Club records'}
          />
          <CompactTile
            to="/nfl/crazy-chain/history"
            icon={<CalendarDays className="w-4 h-4 text-sky-300" />}
            title="My Chains"
            detail="Weekly history"
          />
        </div>
      </section>

      {isAdmin && (
        <Link to="/nfl/admin/crazy-chain" className="glass-card p-3.5 flex items-center gap-3 btn-press">
          <div className="w-9 h-9 rounded-xl bg-destructive/10 border border-destructive/25 flex items-center justify-center">
            <Shield className="w-4 h-4 text-destructive" />
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-extrabold">Crazy Chain Control Room</p>
            <p className="text-[10px] text-muted-foreground">Publish and settle weekly predictions</p>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
        </Link>
      )}
    </div>
  );
}

function ScoreChip({ label, value, hot }: { label: string; value: number; hot?: boolean }) {
  return (
    <div className={`min-w-14 rounded-lg px-2 py-1.5 border ${hot ? 'bg-emerald-400/15 border-emerald-300/30' : 'bg-black/30 border-white/10'}`}>
      <p className={`text-[15px] font-black tabular-nums ${hot ? 'text-emerald-200' : 'text-white'}`}>{value}</p>
      <p className="text-[7px] uppercase tracking-widest text-white/45 font-bold">{label}</p>
    </div>
  );
}

function GameTile({ to, icon, eyebrow, title, description, stat, cta, featured }: {
  to: string; icon: React.ReactNode; eyebrow: string; title: string;
  description: string; stat: string; cta: string; featured?: boolean;
}) {
  return (
    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.18 }}>
      <Link to={to} className={`block glass-card p-4 h-full btn-press ${featured ? 'ring-1 ring-emerald-400/30' : ''}`}>
        <div className="flex items-center justify-between">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">{icon}</div>
          {featured && <span className="text-[8px] px-2 py-1 rounded-full bg-emerald-400/10 border border-emerald-300/25 text-emerald-300 uppercase tracking-widest font-black">New</span>}
        </div>
        <p className="text-[8px] uppercase tracking-[0.2em] text-muted-foreground font-black mt-4">{eyebrow}</p>
        <h2 className="text-[18px] font-black tracking-tight mt-1">{title}</h2>
        <p className="text-[11px] text-muted-foreground leading-relaxed mt-1 min-h-10">{description}</p>
        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold text-gold truncate">{stat}</span>
          <span className="text-[10px] font-black flex items-center gap-1 shrink-0">{cta}<ArrowRight className="w-3 h-3" /></span>
        </div>
      </Link>
    </motion.div>
  );
}

function CompactTile({ to, icon, title, detail }: { to: string; icon: React.ReactNode; title: string; detail: string }) {
  return (
    <Link to={to} className="pk-tile p-3.5 btn-press">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">{icon}</div>
        <div className="min-w-0">
          <p className="text-[12px] font-extrabold truncate">{title}</p>
          <p className="text-[9px] text-muted-foreground truncate">{detail}</p>
        </div>
      </div>
    </Link>
  );
}
