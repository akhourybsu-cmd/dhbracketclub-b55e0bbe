import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle, Check, ChevronRight, Circle, Clock3, Flame,
  History, Link2, LockKeyhole, ShieldCheck, Trophy, X, Zap,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  useActiveSeason, useCurrentWeek, useWeekGames, useWeekLock,
  type NflGame,
} from '@/hooks/usePickem';
import {
  saveCrazyChainCard, useCrazyChainMarkets, useCrazyChainStandings,
  useMyCrazyChainEntry, type CrazyChainLeg, type CrazyChainMarket,
} from '@/hooks/useCrazyChain';
import { useAuth } from '@/contexts/AuthContext';
import { CHAIN_MARKET_LABELS, formatThreshold } from '@/lib/nfl/crazyChain';
import { Button } from '@/components/ui/button';
import { TeamLogo } from '@/components/pickem/TeamLogo';
import { TurfBackdrop } from '@/components/pickem/TurfBackdrop';

export default function CrazyChainPage() {
  const { user } = useAuth();
  const { season, loading: seasonLoading } = useActiveSeason();
  const { week, loading: weekLoading } = useCurrentWeek(season);
  const { games, loading: gamesLoading } = useWeekGames(week?.id);
  const { markets, loading: marketsLoading, error: marketsError, refetch: refetchMarkets } = useCrazyChainMarkets(week?.id);
  const { entry, loading: entryLoading, error: entryError, refetch: refetchEntry } = useMyCrazyChainEntry(week?.id);
  const { standings } = useCrazyChainStandings(season?.id);
  const { lockAt, locked } = useWeekLock(games, season);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSelected(new Set(entry?.legs.map(leg => leg.market_id) || []));
  }, [entry]);

  const myStanding = standings.find(row => row.user_id === user?.id);
  const gameMap = useMemo(() => new Map(games.map(game => [game.id, game])), [games]);
  const groupedMarkets = useMemo(() => {
    const groups = new Map<string, CrazyChainMarket[]>();
    for (const market of markets) {
      groups.set(market.game_id, [...(groups.get(market.game_id) || []), market]);
    }
    return [...groups.entries()]
      .map(([gameId, group]) => ({ game: gameMap.get(gameId), markets: group }))
      .sort((a, b) => new Date(a.game?.kickoff_at || 0).getTime() - new Date(b.game?.kickoff_at || 0).getTime());
  }, [gameMap, markets]);

  const loading = seasonLoading || weekLoading || gamesLoading || marketsLoading || entryLoading;
  const editable = !!week && !locked && entry?.status !== 'won' && entry?.status !== 'lost' && entry?.status !== 'void';
  const currentChain = myStanding?.current_chain || 0;
  const projectedChain = currentChain + selected.size;
  const changed = useMemo(() => {
    const saved = new Set(entry?.legs.map(leg => leg.market_id) || []);
    if (saved.size !== selected.size) return true;
    return [...selected].some(id => !saved.has(id));
  }, [entry, selected]);

  function toggleMarket(market: CrazyChainMarket) {
    if (!editable || market.status !== 'open') return;
    setSelected(current => {
      const next = new Set(current);
      if (next.has(market.id)) next.delete(market.id);
      else next.add(market.id);
      return next;
    });
  }

  async function saveCard() {
    if (!week || selected.size === 0) return toast.error('Choose at least one prediction.');
    setSaving(true);
    try {
      await saveCrazyChainCard(week.id, [...selected]);
      await Promise.all([refetchEntry(), refetchMarkets()]);
      toast.success(`Crazy Chain locked with ${selected.size} link${selected.size === 1 ? '' : 's'}!`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save your chain.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 pb-28">
      <TurfBackdrop className="p-5 overflow-hidden">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="pk-section-label flex items-center gap-1.5"><Zap className="w-3 h-3 text-gold" /> All or Nothing</p>
            <h1 className="text-[28px] font-black text-white leading-none mt-2">Crazy Chain</h1>
            <p className="text-[11px] text-white/65 mt-2 max-w-[38ch] leading-relaxed">
              Every prediction must hit. A perfect card adds every link; one miss breaks your active chain.
            </p>
          </div>
          <div className="relative w-14 h-14 shrink-0">
            <div className="absolute inset-0 rounded-full bg-gold/15 blur-lg" />
            <div className="relative w-full h-full rounded-2xl border border-gold/35 bg-black/25 flex items-center justify-center">
              <Link2 className="w-7 h-7 text-gold" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-5">
          <ChainStat label="Current" value={currentChain} icon={<Flame className="w-3 h-3" />} />
          <ChainStat label="Best" value={myStanding?.best_chain || 0} icon={<Trophy className="w-3 h-3" />} />
          <ChainStat label="At Risk" value={selected.size} icon={<Zap className="w-3 h-3" />} />
        </div>

        <div className="mt-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 flex items-center justify-between gap-3">
          <div>
            <p className="text-[8px] uppercase tracking-widest text-white/45 font-black">Perfect-card result</p>
            <p className="text-[12px] text-white font-extrabold mt-0.5">
              {currentChain} current + {selected.size} links
            </p>
          </div>
          <p className="text-[24px] font-black text-gold tabular-nums">{projectedChain}</p>
        </div>
      </TurfBackdrop>

      <div className="grid grid-cols-2 gap-2">
        <Link to="/nfl/crazy-chain/leaderboard" className="pk-tile p-3 flex items-center gap-2.5 btn-press">
          <Trophy className="w-4 h-4 text-gold" />
          <div><p className="text-[11px] font-extrabold">Leaderboard</p><p className="text-[9px] text-muted-foreground">Club chains</p></div>
        </Link>
        <Link to="/nfl/crazy-chain/history" className="pk-tile p-3 flex items-center gap-2.5 btn-press">
          <History className="w-4 h-4 text-sky-300" />
          <div><p className="text-[11px] font-extrabold">My History</p><p className="text-[9px] text-muted-foreground">Every card</p></div>
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-32 rounded-2xl pk-skeleton" />)}</div>
      ) : marketsError || entryError ? (
        <div className="glass-card p-5 text-center">
          <AlertTriangle className="w-6 h-6 text-gold mx-auto mb-2" />
          <p className="text-[13px] font-extrabold">Crazy Chain is warming up</p>
          <p className="text-[10px] text-muted-foreground mt-1">{marketsError || entryError}</p>
        </div>
      ) : !season || !week ? (
        <EmptyState title="No active NFL week" detail="Crazy Chain opens with the weekly schedule." />
      ) : markets.length === 0 ? (
        <EmptyState title="Predictions are being published" detail="Check back once this week's Crazy Chain board is live." />
      ) : (
        <>
          <div className="flex items-center justify-between px-0.5">
            <div>
              <p className="pk-section-label">{week.label} Prediction Board</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {locked
                  ? 'The weekly board is locked.'
                  : lockAt
                    ? `Edit until ${format(lockAt, 'EEE h:mm a')}`
                    : 'Choose your risk.'}
              </p>
            </div>
            {entry && <StatusBadge status={entry.status} />}
          </div>

          <div className="space-y-3">
            {groupedMarkets.map(({ game, markets: gameMarkets }, index) => (
              <motion.section
                key={gameMarkets[0].game_id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.04, 0.2) }}
                className="glass-card overflow-hidden"
              >
                <GameHeader game={game} />
                <div className="divide-y divide-white/5">
                  {gameMarkets.map(market => {
                    const leg = entry?.legs.find(item => item.market_id === market.id);
                    const chosen = selected.has(market.id);
                    return (
                      <button
                        key={market.id}
                        type="button"
                        onClick={() => toggleMarket(market)}
                        disabled={!editable || market.status !== 'open'}
                        aria-pressed={chosen}
                        className={`w-full text-left px-3.5 py-3 flex items-center gap-3 transition-colors ${chosen ? 'bg-emerald-400/[0.08]' : 'hover:bg-white/[0.025]'} disabled:cursor-default`}
                      >
                        <SelectionMark selected={chosen} status={leg?.status} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-extrabold leading-snug">{market.display_text}</p>
                          <p className="text-[9px] text-muted-foreground mt-1">
                            {CHAIN_MARKET_LABELS[market.market_type] || market.market_type} · {formatThreshold(market.operator, market.threshold)}
                          </p>
                        </div>
                        {leg?.status && leg.status !== 'pending' ? (
                          <LegResult leg={leg} />
                        ) : (
                          <ChevronRight className={`w-4 h-4 shrink-0 ${chosen ? 'text-emerald-300' : 'text-muted-foreground/35'}`} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </motion.section>
            ))}
          </div>
        </>
      )}

      <div className="glass-card p-4">
        <p className="text-[11px] font-extrabold flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-300" /> Chain Rules</p>
        <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2 mt-3 text-[10px] text-muted-foreground">
          <p>• Every non-void leg must hit.</p>
          <p>• Perfect cards add one link per hit.</p>
          <p>• Any miss resets the active chain.</p>
          <p>• Skipped weeks preserve your chain.</p>
        </div>
      </div>

      <AnimatePresence>
        {!loading && markets.length > 0 && editable && (
          <motion.div
            initial={{ y: 90, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 90, opacity: 0 }}
            className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]"
          >
            <div className="max-w-[616px] mx-auto rounded-2xl border border-gold/30 bg-[hsl(160_45%_5%/0.96)] backdrop-blur-xl p-3 shadow-[0_-12px_40px_hsl(160_60%_2%/0.7)] flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[9px] uppercase tracking-widest text-white/45 font-black">Your weekly risk</p>
                <p className="text-[13px] font-black text-white mt-0.5">
                  {selected.size} link{selected.size === 1 ? '' : 's'} · Perfect → {projectedChain}
                </p>
              </div>
              <Button
                onClick={saveCard}
                disabled={saving || selected.size === 0 || (!!entry && !changed)}
                className="rounded-xl font-black gap-2 bg-gold text-black hover:bg-gold/90"
              >
                {saving ? <Clock3 className="w-4 h-4 animate-spin" /> : <LockKeyhole className="w-4 h-4" />}
                {entry ? 'Update Card' : 'Lock Chain'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ChainStat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-black/25 border border-white/10 p-2.5 text-center">
      <p className="text-[18px] font-black text-white tabular-nums">{value}</p>
      <p className="text-[8px] text-white/50 uppercase tracking-wider font-black flex items-center justify-center gap-1 mt-0.5">{icon}{label}</p>
    </div>
  );
}

function GameHeader({ game }: { game?: NflGame }) {
  if (!game) return <div className="px-3.5 py-2.5 text-[10px] text-muted-foreground">NFL matchup</div>;
  return (
    <div className="px-3.5 py-2.5 bg-black/10 border-b border-white/5 flex items-center gap-2">
      <TeamLogo team={game.away_team} size={18} />
      <p className="text-[10px] font-black flex-1 min-w-0 truncate">
        {game.away_team?.abbr || 'AWAY'} <span className="text-muted-foreground mx-1">@</span> {game.home_team?.abbr || 'HOME'}
      </p>
      <TeamLogo team={game.home_team} size={18} />
      <p className="text-[9px] text-muted-foreground tabular-nums ml-1">{format(new Date(game.kickoff_at), 'EEE h:mm a')}</p>
    </div>
  );
}

function SelectionMark({ selected, status }: { selected: boolean; status?: CrazyChainLeg['status'] }) {
  if (status === 'hit') return <span className="w-7 h-7 rounded-lg bg-emerald-400/15 border border-emerald-300/35 flex items-center justify-center"><Check className="w-4 h-4 text-emerald-300" /></span>;
  if (status === 'miss') return <span className="w-7 h-7 rounded-lg bg-red-400/15 border border-red-300/35 flex items-center justify-center"><X className="w-4 h-4 text-red-300" /></span>;
  if (status === 'void') return <span className="w-7 h-7 rounded-lg bg-white/5 border border-white/15 flex items-center justify-center text-[8px] font-black text-muted-foreground">VOID</span>;
  return (
    <span className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-colors ${selected ? 'bg-emerald-400/15 border-emerald-300/40' : 'bg-white/[0.02] border-white/10'}`}>
      {selected ? <Check className="w-4 h-4 text-emerald-300" /> : <Circle className="w-3 h-3 text-muted-foreground/35" />}
    </span>
  );
}

function LegResult({ leg }: { leg: CrazyChainLeg }) {
  const tone = leg.status === 'hit' ? 'text-emerald-300' : leg.status === 'miss' ? 'text-red-300' : 'text-muted-foreground';
  return <span className={`text-[9px] font-black uppercase ${tone}`}>{leg.status}{leg.actual_value != null ? ` · ${leg.actual_value}` : ''}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const styles = status === 'won'
    ? 'text-emerald-300 bg-emerald-400/10 border-emerald-300/25'
    : status === 'lost'
      ? 'text-red-300 bg-red-400/10 border-red-300/25'
      : 'text-gold bg-gold/10 border-gold/25';
  return <span className={`text-[8px] uppercase tracking-widest font-black px-2 py-1 rounded-full border ${styles}`}>{status}</span>;
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="glass-card p-7 text-center">
      <Zap className="w-7 h-7 text-muted-foreground/40 mx-auto mb-2" />
      <p className="text-[13px] font-extrabold">{title}</p>
      <p className="text-[10px] text-muted-foreground mt-1">{detail}</p>
    </div>
  );
}
