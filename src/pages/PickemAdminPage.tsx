import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Shield, Plus, Save, Loader2, Calculator, RefreshCw, Download, Settings2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useActiveSeason, usePickemAdmin, useSeasonWeeks, useTeams, useWeekGames } from '@/hooks/usePickem';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

export default function PickemAdminPage() {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = usePickemAdmin();
  const { season, refetch: refetchSeason } = useActiveSeason();
  const { weeks, refetch: refetchWeeks } = useSeasonWeeks(season?.id);
  const { teams } = useTeams();

  const [activeWeekId, setActiveWeekId] = useState<string | null>(null);
  const { games, refetch: refetchGames } = useWeekGames(activeWeekId || undefined);
  const [newGame, setNewGame] = useState({ away: '', home: '', kickoff: '' });
  const [syncingWeek, setSyncingWeek] = useState(false);
  const [importingSeason, setImportingSeason] = useState(false);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null);
  const [newSeasonYear, setNewSeasonYear] = useState(String(new Date().getFullYear()));

  useEffect(() => {
    if (!adminLoading && !isAdmin) navigate('/pickem');
  }, [adminLoading, isAdmin, navigate]);

  if (adminLoading || !isAdmin) return <div className="p-6 text-center text-xs text-muted-foreground">Checking access…</div>;

  // Activate season helper
  async function activateSeason() {
    if (!season) return;
    const { error: closeError } = await (supabase as any)
      .from('nfl_seasons')
      .update({ status: 'complete' })
      .eq('status', 'active')
      .neq('id', season.id);
    if (closeError) return toast.error(closeError.message);
    const { error } = await (supabase as any).from('nfl_seasons').update({ status: 'active' }).eq('id', season.id);
    if (error) return toast.error(error.message);
    toast.success('Season activated');
    refetchSeason();
  }

  async function createSeason() {
    const year = Number.parseInt(newSeasonYear, 10);
    if (!Number.isInteger(year) || year < 2020 || year > 2100) return toast.error('Enter a valid NFL season year');
    const starts = new Date(`${year}-09-01T00:00:00-04:00`);
    const ends = new Date(`${year + 1}-02-20T23:59:59-05:00`);
    const { error } = await (supabase as any).from('nfl_seasons').insert({
      year,
      name: `${year} NFL Pick’em`,
      status: 'upcoming',
      current_week: 1,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
    });
    if (error) return toast.error(error.message);
    toast.success(`${year} season created`);
    refetchSeason();
  }

  async function setCurrentWeek(weekNumber: number) {
    if (!season) return;
    const { error } = await (supabase as any).from('nfl_seasons').update({ current_week: weekNumber }).eq('id', season.id);
    if (error) return toast.error(error.message);
    toast.success(`Current week → ${weekNumber}`);
    refetchSeason();
  }

  // Quick add week
  async function addWeek() {
    if (!season) return;
    const next = (weeks[weeks.length - 1]?.week_number ?? 0) + 1;
    const starts = new Date(); starts.setDate(starts.getDate() + 7 * (next - 1));
    const ends = new Date(starts); ends.setDate(ends.getDate() + 5);
    const { error } = await (supabase as any).from('nfl_weeks').insert({
      season_id: season.id, week_number: next, label: `Week ${next}`,
      starts_at: starts.toISOString(), ends_at: ends.toISOString(),
      status: 'upcoming',
    });
    if (error) return toast.error(error.message);
    toast.success(`Week ${next} added`);
    refetchWeeks();
  }

  async function setFeaturedGame(weekId: string, gameId: string) {
    const { error } = await (supabase as any).from('nfl_weeks').update({ featured_game_id: gameId }).eq('id', weekId);
    if (error) return toast.error(error.message);
    toast.success('Tiebreaker game set');
    refetchWeeks();
  }

  async function addGame() {
    if (!activeWeekId || !season) return;
    if (!newGame.away || !newGame.home || !newGame.kickoff) return toast.error('Pick teams + kickoff');
    if (newGame.away === newGame.home) return toast.error('Teams must differ');
    const { error } = await (supabase as any).from('nfl_games').insert({
      season_id: season.id, week_id: activeWeekId,
      away_team_id: newGame.away, home_team_id: newGame.home,
      kickoff_at: new Date(newGame.kickoff).toISOString(),
      status: 'scheduled',
    });
    if (error) return toast.error(error.message);
    toast.success('Game added');
    setNewGame({ away: '', home: '', kickoff: '' });
    refetchGames();
  }

  async function deleteGame(id: string) {
    if (!confirm('Delete this game?')) return;
    const { error } = await (supabase as any).from('nfl_games').delete().eq('id', id);
    if (error) return toast.error(error.message);
    refetchGames();
  }

  async function saveFinal(gameId: string, away: number, home: number) {
    const game = games.find((g) => g.id === gameId)!;
    const winner = away > home ? game.away_team_id : home > away ? game.home_team_id : null;
    const { error } = await (supabase as any).from('nfl_games').update({
      away_score: away, home_score: home, status: 'final', winner_team_id: winner,
    }).eq('id', gameId);
    if (error) return toast.error(error.message);
    toast.success('Final score saved');
    refetchGames();
  }

  async function scoreWeek() {
    if (!activeWeekId) return;
    const { data, error } = await supabase.functions.invoke('score-nfl-week', {
      body: { week_id: activeWeekId },
    });
    if (error) return toast.error(error.message);
    toast.success(`Scored: ${data?.scored_users ?? 0} users`);
    refetchWeeks();
    refetchGames();
  }

  async function syncWeekFromEspn(weekNumber: number) {
    if (!season) return;
    setSyncingWeek(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-nfl-week', {
        body: { season_year: season.year, week_number: weekNumber },
      });
      if (error) throw error;
      const missing = data?.missing_teams?.length ?? 0;
      if (missing > 0) toast.warning(`Week ${weekNumber} synced, but ${missing} team mapping${missing === 1 ? ' is' : 's are'} missing`);
      else toast.success(`Week ${weekNumber}: ${data?.upserts ?? 0} games synced${data?.finals ? `, ${data.finals} final` : ''}`);
      refetchWeeks();
      refetchGames();
    } catch (e: any) {
      toast.error(e.message ?? 'Sync failed');
    } finally {
      setSyncingWeek(false);
    }
  }

  async function importFullSeason() {
    if (!season) return;
    if (!confirm(`Import all 18 regular-season weeks for ${season.year} from ESPN? This is idempotent and safe to re-run.`)) return;
    setImportingSeason(true);
    setImportProgress({ done: 0, total: 18 });
    let totalGames = 0;
    let consecutiveEmpty = 0;
    try {
      for (let w = 1; w <= 18; w++) {
        const { data, error } = await supabase.functions.invoke('sync-nfl-week', {
          body: { season_year: season.year, week_number: w },
        });
        if (error) {
          toast.error(`Week ${w} failed: ${error.message}`);
          consecutiveEmpty++;
        } else {
          totalGames += data?.upserts ?? 0;
          if (data?.empty || (data?.upserts ?? 0) === 0) consecutiveEmpty++;
          else consecutiveEmpty = 0;
        }
        setImportProgress({ done: w, total: 18 });
        if (consecutiveEmpty >= 3 && totalGames === 0) {
          toast.error(`ESPN has no ${season.year} schedule published yet. Try again once the NFL releases the schedule.`);
          break;
        }
      }
      toast.success(`Season import complete: ${totalGames} games`);
      refetchWeeks();
      refetchGames();
    } finally {
      setImportingSeason(false);
      setImportProgress(null);
    }
  }

  return (
    <div className="space-y-3 pb-8">
      <Link to="/pickem" className="text-[12px] text-muted-foreground flex items-center gap-1 btn-press">
        <ChevronLeft className="w-4 h-4" /> Pick'em
      </Link>
      <div className="page-header">
        <div className="page-header-icon" style={{ background: 'linear-gradient(135deg, hsl(var(--destructive) / 0.2), hsl(var(--destructive) / 0.05))' }}>
          <Shield className="w-5 h-5 text-destructive" />
        </div>
        <div>
          <h1 className="page-header-title">Pick'em Admin</h1>
          <p className="page-header-subtitle">Schedule, finals & scoring</p>
        </div>
      </div>

      {!season && (
        <div className="glass-card p-4 space-y-3">
          <div>
            <h2 className="font-extrabold text-[13px]">Create NFL season</h2>
            <p className="text-[10px] text-muted-foreground mt-0.5">Start with an upcoming season, then import the official ESPN slate.</p>
          </div>
          <div className="flex gap-2">
            <Input
              type="number"
              min={2020}
              max={2100}
              value={newSeasonYear}
              onChange={(event) => setNewSeasonYear(event.target.value)}
              aria-label="NFL season year"
            />
            <Button onClick={createSeason}><Plus className="w-3.5 h-3.5 mr-1" /> Create</Button>
          </div>
        </div>
      )}

      {/* Season */}
      {season && (
        <div className="glass-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Season</p>
              <p className="text-sm font-extrabold">{season.name}</p>
              <p className="text-[11px] text-muted-foreground">Status: <span className="font-bold">{season.status}</span> · Current week: {season.current_week}</p>
            </div>
            {season.status !== 'active' && <Button size="sm" onClick={activateSeason}>Activate</Button>}
          </div>
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-2.5 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary">ESPN Schedule Sync</p>
            <p className="text-[11px] text-muted-foreground">Pulls the schedule and scores from ESPN and auto-selects a tiebreaker. The protected results job runs once a day at midnight Eastern — use Check everything now to update immediately.</p>
            <NflCheckButton
              seasonYear={season.year}
              currentWeek={season.current_week}
              label="Check everything now"
              className="w-full"
              onDone={() => { refetchWeeks(); refetchGames(); }}
            />
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={importFullSeason}
              disabled={importingSeason}
            >
              {importingSeason ? (
                <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Importing {importProgress?.done}/{importProgress?.total}…</>
              ) : (
                <><Download className="w-3 h-3 mr-1" /> Import full {season.year} regular season</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* League Settings */}
      {season && <LeagueSettingsCard season={season} onSaved={refetchSeason} />}

      {/* Weeks */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-extrabold text-[13px]">Weeks</h2>
          <Button size="sm" variant="outline" onClick={addWeek}><Plus className="w-3 h-3 mr-1" /> Add</Button>
        </div>
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {weeks.map((w) => (
            <div key={w.id} className={`rounded-lg p-2.5 border ${activeWeekId === w.id ? 'border-gold/40 bg-gold/5' : 'border-border/30'}`}>
              <div className="flex items-center gap-2">
                <button onClick={() => setActiveWeekId(w.id)} className="flex-1 text-left">
                  <p className="text-[12px] font-bold">{w.label}</p>
                  <p className="text-[10px] text-muted-foreground">{w.status}</p>
                </button>
                <span className="text-[9px] font-extrabold uppercase tracking-wider rounded-full bg-muted/40 border border-border/30 px-2 py-1 text-muted-foreground">
                  {w.status.replace('_', ' ')}
                </span>
                <Button size="sm" variant="ghost" onClick={() => setCurrentWeek(w.week_number)}>Current</Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Games for active week */}
      {activeWeekId && (
        <div className="glass-card p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-extrabold text-[13px] truncate">Games — {weeks.find(w => w.id === activeWeekId)?.label}</h2>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const wn = weeks.find(w => w.id === activeWeekId)?.week_number;
                  if (wn) syncWeekFromEspn(wn);
                }}
                disabled={syncingWeek}
              >
                {syncingWeek ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                Sync
              </Button>
              <Button size="sm" onClick={scoreWeek}><Calculator className="w-3 h-3 mr-1" /> Score</Button>
            </div>
          </div>

          {/* Tiebreaker selector */}
          <div className="rounded-lg bg-gold/5 border border-gold/20 p-2.5">
            <p className="text-[10px] font-bold text-gold mb-1">Tiebreaker game</p>
            <select
              className="w-full text-[12px] bg-background rounded p-2 border border-border"
              value={weeks.find(w => w.id === activeWeekId)?.featured_game_id ?? ''}
              onChange={(e) => setFeaturedGame(activeWeekId, e.target.value)}
            >
              <option value="">— None —</option>
              {games.map((g) => (
                <option key={g.id} value={g.id}>{g.away_team?.abbr} @ {g.home_team?.abbr}</option>
              ))}
            </select>
          </div>

          {/* Add game */}
          <div className="rounded-lg bg-muted/30 p-2.5 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider">Add game</p>
            <div className="grid grid-cols-2 gap-2">
              <select className="text-[12px] bg-background rounded p-2 border border-border" value={newGame.away}
                onChange={(e) => setNewGame({ ...newGame, away: e.target.value })}>
                <option value="">Away…</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.abbr} {t.name}</option>)}
              </select>
              <select className="text-[12px] bg-background rounded p-2 border border-border" value={newGame.home}
                onChange={(e) => setNewGame({ ...newGame, home: e.target.value })}>
                <option value="">Home…</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.abbr} {t.name}</option>)}
              </select>
            </div>
            <Input type="datetime-local" value={newGame.kickoff} onChange={(e) => setNewGame({ ...newGame, kickoff: e.target.value })} />
            <Button size="sm" className="w-full" onClick={addGame}><Plus className="w-3 h-3 mr-1" /> Add Game</Button>
          </div>

          {/* Game list with final-score input */}
          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {games.map((g) => (
              <GameAdminRow key={g.id} game={g} onSaveFinal={saveFinal} onDelete={deleteGame} />
            ))}
            {games.length === 0 && <p className="text-[11px] text-muted-foreground text-center py-3">No games yet for this week</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function GameAdminRow({ game, onSaveFinal, onDelete }: { game: any; onSaveFinal: (id: string, a: number, h: number) => void; onDelete: (id: string) => void }) {
  const [away, setAway] = useState(game.away_score?.toString() ?? '');
  const [home, setHome] = useState(game.home_score?.toString() ?? '');
  const scoresReady = away !== '' && home !== '' && Number(away) >= 0 && Number(home) >= 0;

  useEffect(() => {
    setAway(game.away_score?.toString() ?? '');
    setHome(game.home_score?.toString() ?? '');
  }, [game.away_score, game.home_score]);

  return (
    <div className="rounded-lg bg-card/40 border border-border/30 p-2 flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-bold truncate">{game.away_team?.abbr} @ {game.home_team?.abbr}</p>
        <p className="text-[10px] text-muted-foreground">{new Date(game.kickoff_at).toLocaleString()} · {game.status}</p>
      </div>
      <Input type="number" className="w-14 h-8 text-center" placeholder="A" value={away} onChange={(e) => setAway(e.target.value)} />
      <Input type="number" className="w-14 h-8 text-center" placeholder="H" value={home} onChange={(e) => setHome(e.target.value)} />
      <Button
        size="sm"
        variant="outline"
        disabled={!scoresReady}
        aria-label={`Save final score for ${game.away_team?.abbr} at ${game.home_team?.abbr}`}
        onClick={() => onSaveFinal(game.id, parseInt(away, 10), parseInt(home, 10))}
      >
        <Save className="w-3 h-3" />
      </Button>
      <Button size="sm" variant="ghost" onClick={() => onDelete(game.id)} className="text-destructive">×</Button>
    </div>
  );
}

function LeagueSettingsCard({ season, onSaved }: { season: any; onSaved: () => void }) {
  const [hideFuture, setHideFuture] = useState<boolean>(!!season.hide_unresolved_future_weeks);
  const [windowN, setWindowN] = useState<string>(season.visible_week_window != null ? String(season.visible_week_window) : '');
  const [requireSched, setRequireSched] = useState<boolean>(season.require_finalized_schedule !== false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setHideFuture(!!season.hide_unresolved_future_weeks);
    setWindowN(season.visible_week_window != null ? String(season.visible_week_window) : '');
    setRequireSched(season.require_finalized_schedule !== false);
  }, [season.id, season.pick_lock_minutes, season.hide_unresolved_future_weeks, season.visible_week_window, season.require_finalized_schedule]);

  async function save() {
    setSaving(true);
    const windowNum = windowN.trim() === '' ? null : Math.max(1, parseInt(windowN, 10) || 1);
    const { error } = await (supabase as any)
      .from('nfl_seasons')
      .update({
        hide_unresolved_future_weeks: hideFuture,
        visible_week_window: windowNum,
        require_finalized_schedule: requireSched,
      })
      .eq('id', season.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('League settings saved');
    onSaved();
  }

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Settings2 className="w-4 h-4 text-gold" />
        <h2 className="font-extrabold text-[13px]">League Settings</h2>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/20 p-2.5">
        <div className="min-w-0">
          <p className="text-[12px] font-bold">Hide future weeks until prior is scored</p>
          <p className="text-[10px] text-muted-foreground leading-snug">Members only see the current week and earlier results.</p>
        </div>
        <Switch checked={hideFuture} onCheckedChange={setHideFuture} />
      </div>

      <div className="rounded-lg bg-muted/20 p-2.5 space-y-1.5">
        <p className="text-[12px] font-bold">Visible week window</p>
        <p className="text-[10px] text-muted-foreground leading-snug">Cap how many upcoming weeks members can see at once. Leave blank for all.</p>
        <Input type="number" min={1} placeholder="All weeks" value={windowN} onChange={(e) => setWindowN(e.target.value)} className="h-9" />
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/20 p-2.5">
        <div className="min-w-0">
          <p className="text-[12px] font-bold">Hide weeks with no schedule yet</p>
          <p className="text-[10px] text-muted-foreground leading-snug">Recommended — only weeks with synced games appear to members.</p>
        </div>
        <Switch checked={requireSched} onCheckedChange={setRequireSched} />
      </div>

      <div className="rounded-lg bg-muted/20 p-2.5 space-y-1.5">
        <p className="text-[12px] font-bold">Per-game deadlines · 48 hours</p>
        <p className="text-[10px] text-muted-foreground leading-snug">Pick’em locks each matchup and its featured-game tiebreaker 48 hours before kickoff. Crazy Chain has a separate 30-minute cutoff.</p>
      </div>

      <Button size="sm" className="w-full" onClick={save} disabled={saving}>
        {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
        Save settings
      </Button>
    </div>
  );
}
