import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, Clock3, History, Link2, LockKeyhole, RefreshCw, Trophy, X, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useActiveSeason, useWeekGames, type NflGame, type NflSeason } from '@/hooks/usePickem';
import { saveCrazyChainGame, useCrazyChainMarkets, useCrazyChainStandings, useMyCrazyChainEntry, useMyCrazyChainGameCards } from '@/hooks/useCrazyChain';
import { useAuth } from '@/contexts/AuthContext';
import { CHAIN_MARKET_LABELS, formatThreshold } from '@/lib/nfl/crazyChain';
import { Button } from '@/components/ui/button';
import { TeamLogo } from '@/components/pickem/TeamLogo';
import { TurfBackdrop } from '@/components/pickem/TurfBackdrop';
import { Input } from '@/components/ui/input';
import { chooseChainBoardWeek, useCrazyChainWeeks, type CrazyChainBoardWeek } from '@/hooks/useCrazyChainWeeks';
import { useCrazyChainBoard } from '@/hooks/useCrazyChainBoard';
import { chainAvailabilityNote } from '@/lib/nfl/chainAvailability';
import { chainGameIsOpen, chainGameLockAt } from '../../supabase/functions/_shared/chainGameRules';

export default function CrazyChainPage() {
  const { season, loading: seasonLoading } = useActiveSeason();
  const { weeks, loading, error, refetch } = useCrazyChainWeeks(season?.id);
  const [params, setParams] = useSearchParams();
  const week = chooseChainBoardWeek(weeks, Number(params.get('week')), season?.current_week);
  useEffect(() => {
    if (week && Number(params.get('week')) !== week.week_number) setParams({ week: String(week.week_number) }, { replace: true });
  }, [week, params, setParams]);
  if (seasonLoading || (loading && !weeks.length)) return <div className="h-64 rounded-2xl pk-skeleton" />;
  if (error) return <div className="glass-card p-5"><p role="alert">{error.message}</p><Button onClick={() => void refetch()}>Retry</Button></div>;
  if (!season || !week) return <p className="glass-card p-5">No active NFL week.</p>;
  return <div className="member-page">
    <label className="block mb-4 space-y-1.5">
      <span className="text-xs font-bold text-muted-foreground">Browse games by week</span>
      <select aria-label="Crazy Chain week" value={week.week_number} onChange={event => setParams({ week: event.target.value })} className="w-full min-h-11 rounded-xl border border-input bg-background px-3 text-sm">
        {weeks.map(item => <option key={item.id} value={item.week_number}>{item.label || 'Week ' + item.week_number} · {item.marketCount} predictions</option>)}
      </select>
    </label>
    <CrazyChainWeek key={week.id} season={season} week={week} />
  </div>;
}

function CrazyChainWeek({ season, week }: { season: NflSeason; week: CrazyChainBoardWeek }) {
  const { user } = useAuth();
  const cache = useQueryClient();
  const { games, loading: gamesLoading, error: gamesError, refetch: refreshGames } = useWeekGames(week.id);
  const { markets, loading: marketsLoading, error: marketsError, refetch: refreshMarkets } = useCrazyChainMarkets(week.id);
  const { entry, loading: entryLoading, error: entryError, refetch: refreshEntry } = useMyCrazyChainEntry(week.id);
  const { standings, error: standingsError } = useCrazyChainStandings(season.id);
  const { board, migrationReady, now, loading: boardLoading, error: boardError, refetch: refreshBoard } = useCrazyChainBoard(week.id, games, season);
  const { cards, error: cardsError } = useMyCrazyChainGameCards(week.id, undefined, migrationReady);
  const [drafts, setDrafts] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [gameFilter, setGameFilter] = useState('all');
  const mine = standings.find(row => row.user_id === user?.id);
  const marketMap = useMemo(() => new Map(markets.map(m => [m.id,m])), [markets]);
  const savedByGame = useMemo(() => {
    const result = new Map<string,string[]>();
    for (const leg of entry?.legs || []) {
      const gameId = marketMap.get(leg.market_id)?.game_id;
      if (gameId) result.set(gameId,[...(result.get(gameId) || []),leg.market_id]);
    }
    return result;
  }, [entry,marketMap]);
  const isOpen = (game: NflGame) => migrationReady && !boardError && chainGameIsOpen(game,now)
    && board?.games?.find(item => item.game_id === game.id)?.unlocked === true;
  const loading = gamesLoading || marketsLoading || entryLoading || boardLoading;
  const error = gamesError || marketsError || entryError || boardError?.message;
  const visible = games.filter(game => markets.some(m => m.game_id === game.id) && (gameFilter === 'all' || game.id === gameFilter));
  async function saveGame(gameId: string, selections: string[]) {
    setSaving(gameId);
    try {
      await saveCrazyChainGame(gameId,selections);
      await refreshEntry();
      setDrafts(current => { const next = {...current}; delete next[gameId]; return next; });
      await Promise.all(['crazy-chain-game-cards','crazy-chain-standings','crazy-chain-history'].map(key => cache.invalidateQueries({queryKey:[key]})));
      toast.success(selections.length ? 'Game picks saved. Other games are unchanged.' : 'Picks removed for this game.');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not save game picks.'); }
    finally { setSaving(null); }
  }
  return <div className="space-y-4 pb-8">
    <TurfBackdrop className="p-5">
      <p className="pk-section-label flex items-center gap-2"><Zap className="w-3 h-3 text-gold" /> Game by game</p>
      <h1 className="text-3xl font-black text-white mt-2">Crazy Chain</h1>
      <p className="text-sm text-white/70 mt-2 max-w-prose">Build a set of predictions for each game. Hit them all to add links; one miss breaks your chain. Later games stay open until their own deadlines.</p>
      <div className="grid grid-cols-3 gap-2 mt-4">
        {[['Current',mine?.current_chain || 0],['Best',mine?.best_chain || 0],['Pending picks',entry?.legs.filter(l => l.status === 'pending').length || 0]].map(([label,value]) =>
          <div key={label} className="rounded-xl bg-black/25 p-3 text-center"><p className="text-2xl font-black text-white tabular-nums">{value}</p><p className="text-[10px] text-white/65">{label}</p></div>)}
      </div>
      {standingsError && <p role="alert" className="text-xs text-white/75 mt-2">Standings could not refresh. Last available totals shown.</p>}
    </TurfBackdrop>
    <div className="grid grid-cols-2 gap-2">
      <Link to="/nfl/crazy-chain/leaderboard" className="pk-tile p-3 flex items-center gap-2 text-sm"><Trophy className="w-4 h-4 text-primary" /> Leaderboard</Link>
      <Link to="/nfl/crazy-chain/history" className="pk-tile p-3 flex items-center gap-2 text-sm"><History className="w-4 h-4 text-primary" /> My game results</Link>
    </div>
    <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs space-y-1">
      <p className="font-bold">Every game locks 48 hours before kickoff.</p>
      <p className="text-muted-foreground">Final results refresh automatically. Chain steps follow kickoff order; games starting together are checked together. Missing stats stay pending for review.</p>
      <p className="text-muted-foreground">Custom club targets{board?.checked_at ? ' · Availability checked ' + format(new Date(board.checked_at),'MMM d, h:mm a') : ''}</p>
    </div>
    {!loading && !migrationReady && <p role="alert" className="rounded-xl border border-primary/30 p-3 text-sm">The NFL per-game SQL update is required before new picks can be saved. Existing picks are preserved.</p>}
    {cardsError && <p role="alert" className="text-sm text-destructive">{cardsError}</p>}
    {error ? <div className="glass-card p-4"><p role="alert" className="text-sm">{error}</p><Button className="mt-2" variant="outline" onClick={() => void Promise.all([refreshGames(),refreshMarkets(),refreshEntry(),refreshBoard()])}><RefreshCw className="w-4 h-4 mr-2" /> Retry</Button></div>
      : loading ? <div className="h-40 rounded-xl pk-skeleton" />
      : <>
        <div className="grid sm:grid-cols-2 gap-2">
          <Input aria-label="Search predictions" placeholder="Search a player or team…" value={search} onChange={event => setSearch(event.target.value)} className="min-h-11" />
          <select aria-label="Filter by matchup" value={gameFilter} onChange={event => setGameFilter(event.target.value)} className="min-h-11 min-w-0 rounded-md border border-input bg-background px-3 text-sm">
            <option value="all">All matchups</option>
            {games.filter(g => markets.some(m => m.game_id === g.id)).map(g => <option key={g.id} value={g.id}>{g.away_team?.abbr} @ {g.home_team?.abbr}</option>)}
          </select>
        </div>
        {!visible.length && <p className="glass-card p-5 text-sm text-muted-foreground">No predictions published for these games yet.</p>}
        {visible.map(game => {
          const open = isOpen(game);
          const saved = savedByGame.get(game.id) || [];
          // Polls update results without replacing unsaved drafts. Expired drafts
          // are never presented as saved picks and cannot be submitted.
          const selected = open ? drafts[game.id] ?? saved : saved;
          const changed = selected.length !== saved.length || selected.some(id => !saved.includes(id));
          const rows = markets.filter(m => m.game_id === game.id && (!search.trim() ||
            (m.display_text + ' ' + game.home_team?.abbr + ' ' + game.away_team?.abbr).toLowerCase().includes(search.trim().toLowerCase())));
          if (!rows.length) return null;
          const card = cards.find(c => c.game_id === game.id);
          return <section key={game.id} className="glass-card overflow-hidden">
            <GameHeader game={game} open={open} />
            {card && <div className="px-3.5 py-2 bg-muted/30 border-b border-border text-xs flex flex-wrap gap-x-3 gap-y-1">
              <span className="font-bold">{card.status === 'locked' ? (game.status === 'final' ? 'Awaiting verified stats' : open ? 'Saved · editable' : 'Picks locked') : card.status === 'won' ? 'Perfect game · ' + card.hits + ' hits' : card.status === 'lost' ? 'Game missed' : 'Voided · chain preserved'}</span>
              <span className="text-muted-foreground">{card.hits} hit · {card.misses} missed · {card.pending} pending{card.voids ? ' · ' + card.voids + ' void' : ''}</span>
            </div>}
            <div className="divide-y divide-border">
              {rows.map(market => {
                const leg = entry?.legs.find(l => l.market_id === market.id);
                const chosen = selected.includes(market.id);
                const note = chainAvailabilityNote(market,now);
                const result = leg?.status !== 'pending' ? leg?.status : null;
                return <button key={market.id} type="button" aria-pressed={chosen}
                  disabled={!open || saving !== null || market.status !== 'open' || (!!note && !chosen)}
                  onClick={() => setDrafts(current => ({...current,[game.id]:chosen ? selected.filter(id => id !== market.id) : [...selected,market.id]}))}
                  className={'w-full text-left px-3.5 py-3 flex items-start gap-3 transition-colors disabled:cursor-default ' + (chosen ? 'bg-primary/10' : 'hover:bg-muted/40')}>
                  <span className={'mt-0.5 w-6 h-6 shrink-0 rounded-md border flex items-center justify-center ' + (result === 'miss' ? 'border-destructive text-destructive' : chosen ? 'border-primary text-primary' : 'border-border')}>
                    {result === 'miss' ? <X className="w-4 h-4" /> : chosen ? <Check className="w-4 h-4" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold leading-snug">{leg?.display_text || market.display_text}</span>
                    <span className="block text-xs text-muted-foreground mt-1">{CHAIN_MARKET_LABELS[market.market_type]} · {formatThreshold(market.operator,market.threshold)}</span>
                    {note && market.status === 'open' && <span className="block text-xs text-muted-foreground mt-1">{note}{chosen ? ' Existing pick retained.' : ''}</span>}
                  </span>
                  {result && <span className={'text-xs font-bold shrink-0 ' + (result === 'miss' ? 'text-destructive' : 'text-primary')}>{result}{leg?.actual_value != null ? ' · ' + leg.actual_value : ''}</span>}
                </button>;
              })}
            </div>
            {open ? <div className="p-3 border-t border-border flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">{selected.length} selected{changed ? ' · Unsaved changes' : saved.length ? ' · Saved' : ''}</p>
              <Button aria-label={'Save picks for ' + game.away_team?.abbr + ' at ' + game.home_team?.abbr} onClick={() => void saveGame(game.id,selected)} disabled={!changed || saving !== null} className="min-h-11 gap-2">
                {saving === game.id ? <Clock3 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                {selected.length ? 'Save game picks' : 'Remove game picks'}
              </Button>
            </div> : <p className="px-3.5 py-2.5 border-t border-border text-xs text-muted-foreground flex items-center gap-2"><LockKeyhole className="w-3.5 h-3.5 shrink-0" />{migrationReady ? 'This game is closed to new picks. Later games have their own deadlines.' : 'Database update required to enable per-game picks.'}</p>}
          </section>;
        })}
      </>}
  </div>;
}
function GameHeader({game,open}:{game:NflGame;open:boolean}) {
  return <div className="p-3.5 bg-muted/25 border-b border-border space-y-2">
    <div className="flex items-center gap-2">
      <TeamLogo team={game.away_team} size={22} /><p className="text-sm font-black flex-1">{game.away_team?.abbr} @ {game.home_team?.abbr}</p><TeamLogo team={game.home_team} size={22} />
      {game.status !== 'scheduled' && <span className="text-sm font-bold tabular-nums">{game.away_score ?? '—'}–{game.home_score ?? '—'} · {game.status}</span>}
    </div>
    <p className="text-xs text-muted-foreground">Kickoff {format(new Date(game.kickoff_at),'EEE, MMM d · h:mm a')}</p>
    <p className="text-xs font-semibold">{open ? 'Pick by ' : 'Deadline: '}{format(new Date(chainGameLockAt(game)),'EEE, MMM d · h:mm a')} · 48h before kickoff</p>
  </div>;
}
