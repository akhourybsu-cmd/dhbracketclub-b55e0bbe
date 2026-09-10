import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, Calculator, CheckCircle2, Loader2,
  Plus, RefreshCw, Shield, Trash2, XCircle, Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  useActiveSeason, usePickemAdmin, useSeasonWeeks, useWeekGames,
  type NflGame,
} from '@/hooks/usePickem';
import {
  settleCrazyChainMarket, useCrazyChainMarkets, type CrazyChainMarket,
} from '@/hooks/useCrazyChain';
import { CHAIN_MARKET_LABELS, formatThreshold, type ChainOperator } from '@/lib/nfl/crazyChain';
import { CrazyChainBoardImport } from '@/components/pickem/CrazyChainBoardImport';

const MARKET_TYPES = [
  'team_win', 'team_points', 'game_total',
  'passing_touchdowns', 'passing_yards', 'rushing_yards',
  'receiving_yards', 'receptions', 'anytime_touchdown',
  'team_sacks', 'team_turnovers',
] as const;

type FormState = {
  gameId: string;
  marketType: typeof MARKET_TYPES[number];
  subjectLabel: string;
  subjectTeamId: string;
  operator: ChainOperator;
  threshold: string;
};

const initialForm: FormState = {
  gameId: '', marketType: 'team_win', subjectLabel: '', subjectTeamId: '', operator: 'gte', threshold: '1',
};

export default function CrazyChainAdminPage() {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = usePickemAdmin();
  const { season } = useActiveSeason();
  const { weeks } = useSeasonWeeks(season?.id);
  const [weekId, setWeekId] = useState('');
  const { games } = useWeekGames(weekId || undefined);
  const { markets, loading, error, refetch } = useCrazyChainMarkets(weekId || undefined);
  const [form, setForm] = useState<FormState>(initialForm);
  const [saving, setSaving] = useState(false);
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [actuals, setActuals] = useState<Record<string, string>>({});
  const [autoScoring, setAutoScoring] = useState(false);

  useEffect(() => {
    if (!adminLoading && !isAdmin) navigate('/nfl');
  }, [adminLoading, isAdmin, navigate]);

  useEffect(() => {
    if (!weekId && weeks.length) {
      setWeekId(weeks.find(week => week.week_number === season?.current_week)?.id || weeks[0].id);
    }
  }, [season?.current_week, weekId, weeks]);

  useEffect(() => {
    setForm(current => ({ ...current, gameId: games[0]?.id || '', subjectTeamId: '', subjectLabel: '' }));
  }, [games]);

  const selectedGame = games.find(game => game.id === form.gameId);
  const gameTeams = useMemo(() => selectedGame ? [selectedGame.away_team, selectedGame.home_team].filter(Boolean) : [], [selectedGame]);
  const needsTeam = ['team_win', 'team_points', 'team_sacks', 'team_turnovers'].includes(form.marketType);
  const needsPlayer = ['passing_touchdowns', 'passing_yards', 'rushing_yards', 'receiving_yards', 'receptions', 'anytime_touchdown'].includes(form.marketType);

  if (adminLoading || !isAdmin) return <div className="p-6 text-center text-xs text-muted-foreground">Checking access…</div>;

  function setType(marketType: FormState['marketType']) {
    const defaults: Partial<FormState> = marketType === 'team_win'
      ? { operator: 'eq', threshold: '1' }
      : marketType === 'anytime_touchdown'
        ? { operator: 'gte', threshold: '1' }
        : { operator: 'gte', threshold: marketType.includes('yards') ? '50' : '1' };
    setForm(current => ({ ...current, marketType, subjectLabel: '', subjectTeamId: '', ...defaults }));
  }

  function marketDisplayText() {
    const threshold = Number(form.threshold);
    const team = gameTeams.find(candidate => candidate?.id === form.subjectTeamId);
    const subject = needsTeam ? `${team?.city || ''} ${team?.name || ''}`.trim() : needsPlayer ? form.subjectLabel.trim() : 'Combined score';
    if (form.marketType === 'team_win') return `${subject} to win`;
    if (form.marketType === 'anytime_touchdown') return `${subject} to score a touchdown`;
    return `${subject} · ${formatThreshold(form.operator, threshold)} ${CHAIN_MARKET_LABELS[form.marketType]?.toLowerCase() || form.marketType}`;
  }

  async function createMarket() {
    if (!season || !weekId || !form.gameId) return toast.error('Choose a week and game.');
    if (needsTeam && !form.subjectTeamId) return toast.error('Choose the team for this prediction.');
    if (needsPlayer && !form.subjectLabel.trim()) return toast.error('Enter the player name.');
    const threshold = Number(form.threshold);
    if (!Number.isFinite(threshold) || threshold < 0) return toast.error('Enter a valid threshold.');
    setSaving(true);
    try {
      const team = gameTeams.find(candidate => candidate?.id === form.subjectTeamId);
      const subjectLabel = needsTeam
        ? `${team?.city || ''} ${team?.name || ''}`.trim()
        : needsPlayer
          ? form.subjectLabel.trim()
          : 'Game total';
      const { error: insertError } = await supabase.from('nfl_chain_markets').insert({
        season_id: season.id,
        week_id: weekId,
        game_id: form.gameId,
        market_type: form.marketType,
        subject_label: subjectLabel,
        subject_team_id: form.subjectTeamId || null,
        operator: form.operator,
        threshold,
        display_text: marketDisplayText(),
        source_provider: 'admin',
      });
      if (insertError) throw insertError;
      toast.success('Crazy Chain prediction published.');
      setForm(current => ({ ...initialForm, gameId: current.gameId }));
      await refetch();
    } catch (createError) {
      toast.error(createError instanceof Error ? createError.message : 'Prediction could not be published.');
    } finally {
      setSaving(false);
    }
  }

  async function settleMarket(market: CrazyChainMarket, voided = false) {
    const actual = actuals[market.id];
    if (!voided && (actual === undefined || actual.trim() === '' || !Number.isFinite(Number(actual)))) {
      return toast.error('Enter the verified final value.');
    }
    setSettlingId(market.id);
    try {
      await settleCrazyChainMarket(market.id, voided ? null : Number(actual), voided);
      toast.success(voided ? 'Prediction voided.' : 'Prediction settled and chains rebuilt.');
      await refetch();
    } catch (settleError) {
      toast.error(settleError instanceof Error ? settleError.message : 'Settlement failed.');
    } finally {
      setSettlingId(null);
    }
  }

  async function deleteMarket(marketId: string) {
    if (!confirm('Delete this prediction? Published cards may prevent deletion. Void it instead if members selected it.')) return;
    const { error: deleteError } = await supabase.from('nfl_chain_markets').delete().eq('id', marketId);
    if (deleteError) return toast.error(deleteError.message);
    await refetch();
  }

  async function autoScore() {
    if (!weekId) return;
    setAutoScoring(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('score-nfl-crazy-chain', { body: { week_id: weekId } });
      if (invokeError) throw invokeError;
      if (data?.error || data?.ok === false) throw new Error(data?.error || 'Some predictions could not be settled. Check results and retry.');
      toast.success(`${data?.settled || 0} team/game prediction${data?.settled === 1 ? '' : 's'} settled.`);
      await refetch();
    } catch (scoreError) {
      toast.error(scoreError instanceof Error ? scoreError.message : 'Automatic scoring failed.');
    } finally {
      setAutoScoring(false);
    }
  }

  return (
    <div className="space-y-4 pb-8">
      <Link to="/nfl" className="text-[11px] text-muted-foreground flex items-center gap-1 btn-press"><ArrowLeft className="w-4 h-4" /> NFL Game Center</Link>
      <div className="page-header">
        <div className="page-header-icon bg-destructive/10"><Shield className="w-5 h-5 text-destructive" /></div>
        <div><h1 className="page-header-title">Crazy Chain Control Room</h1><p className="page-header-subtitle">Publish markets and certify results</p></div>
      </div>

      {!season ? (
        <div className="glass-card p-5 text-center text-[11px] text-muted-foreground">Create an NFL season before publishing Crazy Chain predictions.</div>
      ) : (
        <>
          <div className="glass-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-[12px] font-extrabold">Prediction board</p><p className="text-[9px] text-muted-foreground">Team markets auto-settle; player stats can be certified manually.</p></div>
              <Button variant="outline" size="sm" onClick={autoScore} disabled={autoScoring || !weekId}>
                {autoScoring ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Calculator className="w-3.5 h-3.5 mr-1" />} Auto-score
              </Button>
            </div>
            <label className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Week</label>
            <select value={weekId} onChange={event => setWeekId(event.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
              {weeks.map(week => <option key={week.id} value={week.id}>{week.label}</option>)}
            </select>
          </div>

          <CrazyChainBoardImport key={weekId} weekId={weekId} onPublished={() => { void refetch(); }} />

          <div className="glass-card p-4 space-y-3">
            <div className="flex items-center gap-2"><Plus className="w-4 h-4 text-gold" /><p className="text-[12px] font-extrabold">Publish a prediction</p></div>
            <Field label="Game">
              <select value={form.gameId} onChange={event => setForm(current => ({ ...current, gameId: event.target.value, subjectTeamId: '' }))} className="field-select">
                {games.map(game => <option key={game.id} value={game.id}>{matchupLabel(game)}</option>)}
              </select>
            </Field>
            <Field label="Prediction type">
              <select value={form.marketType} onChange={event => setType(event.target.value as FormState['marketType'])} className="field-select">
                {MARKET_TYPES.map(type => <option key={type} value={type}>{CHAIN_MARKET_LABELS[type]}</option>)}
              </select>
            </Field>
            {needsTeam && (
              <Field label="Team">
                <select value={form.subjectTeamId} onChange={event => setForm(current => ({ ...current, subjectTeamId: event.target.value }))} className="field-select">
                  <option value="">Select team</option>
                  {gameTeams.map(team => team && <option key={team.id} value={team.id}>{team.city} {team.name}</option>)}
                </select>
              </Field>
            )}
            {needsPlayer && <Field label="Player"><Input value={form.subjectLabel} onChange={event => setForm(current => ({ ...current, subjectLabel: event.target.value }))} placeholder="Player full name" /></Field>}
            {form.marketType !== 'team_win' && (
              <div className="grid grid-cols-[1fr_1fr] gap-2">
                <Field label="Rule"><select value={form.operator} onChange={event => setForm(current => ({ ...current, operator: event.target.value as ChainOperator }))} className="field-select"><option value="gte">At least</option><option value="lte">At most</option><option value="eq">Exactly</option></select></Field>
                <Field label="Threshold"><Input type="number" min="0" step="0.1" value={form.threshold} onChange={event => setForm(current => ({ ...current, threshold: event.target.value }))} /></Field>
              </div>
            )}
            <div className="rounded-lg bg-primary/5 border border-primary/15 p-2.5"><p className="text-[8px] uppercase tracking-wider text-muted-foreground font-black">Member preview</p><p className="text-[11px] font-extrabold mt-1">{selectedGame ? marketDisplayText() : 'Choose a game'}</p></div>
            <Button onClick={createMarket} disabled={saving || !games.length} className="w-full font-bold">{saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />} Publish</Button>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2"><p className="pk-section-label">Published Predictions</p><Button variant="ghost" size="sm" onClick={() => refetch()}><RefreshCw className="w-3.5 h-3.5" /></Button></div>
            {error ? <div className="glass-card p-4 text-[10px] text-gold flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />{error}</div> : loading ? <div className="h-24 rounded-xl pk-skeleton" /> : markets.length === 0 ? <div className="glass-card p-5 text-center text-[10px] text-muted-foreground">No predictions published for this week.</div> : (
              <div className="space-y-2">
                {markets.map(market => (
                  <div key={market.id} className="glass-card p-3.5 space-y-3">
                    <div className="flex items-start gap-2.5">
                      {market.status === 'settled' ? market.result ? <CheckCircle2 className="w-4 h-4 text-emerald-300 mt-0.5" /> : <XCircle className="w-4 h-4 text-red-300 mt-0.5" /> : market.status === 'void' ? <AlertTriangle className="w-4 h-4 text-muted-foreground mt-0.5" /> : <Zap className="w-4 h-4 text-gold mt-0.5" />}
                      <div className="flex-1 min-w-0"><p className="text-[11px] font-extrabold">{market.display_text}</p><p className="text-[8px] uppercase tracking-wider text-muted-foreground mt-1">{market.status}{market.actual_value != null ? ` · actual ${market.actual_value}` : ''}</p></div>
                      {market.status === 'open' && <button type="button" onClick={() => deleteMarket(market.id)} aria-label="Delete prediction" className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>}
                    </div>
                    <div className="flex gap-2">
                      <Input type="number" step="0.1" placeholder="Final value" value={actuals[market.id] || ''} onChange={event => setActuals(current => ({ ...current, [market.id]: event.target.value }))} />
                      <Button size="sm" onClick={() => settleMarket(market)} disabled={settlingId === market.id}>{settlingId === market.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Settle'}</Button>
                      <Button size="sm" variant="outline" onClick={() => settleMarket(market, true)} disabled={settlingId === market.id}>Void</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
      <style>{`.field-select{width:100%;height:2.5rem;border-radius:.375rem;border:1px solid hsl(var(--input));background:hsl(var(--background));padding:0 .75rem;font-size:.875rem}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1.5"><span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>{children}</label>;
}

function matchupLabel(game: NflGame) {
  return `${game.away_team?.abbr || 'Away'} @ ${game.home_team?.abbr || 'Home'}`;
}
