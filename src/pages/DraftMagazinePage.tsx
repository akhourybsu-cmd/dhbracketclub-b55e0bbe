import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, Crown, Share2, Sparkles, Star, Trophy, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { DraftBoard } from '@/components/draft/DraftBoard';
import { MissedPicksCard } from '@/components/draft/MissedPicksCard';
import { DraftBroadcastFeed } from '@/components/draft/DraftBroadcastFeed';
import { computePickTimings, findBiggestSteal, findMvpPick, formatDuration } from '@/lib/draftStats';
import type { DraftResult } from '@/hooks/useDraftResults';
import { QUERY_TIMEOUT_MS, withTimeout } from '@/lib/asyncGuards';

export default function DraftMagazinePage() {
  const { draftId } = useParams<{ draftId: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!draftId) return;
    setLoading(true); setError(null);
    try {
      const queries = [
        withTimeout<any>(supabase.from('drafts').select('*, profiles:created_by(display_name)').eq('id', draftId).single(), QUERY_TIMEOUT_MS, 'draft recap'),
        withTimeout<any>(supabase.from('draft_participants').select('*, profiles:user_id(display_name)').eq('draft_id', draftId).order('pick_order'), QUERY_TIMEOUT_MS, 'recap participants'),
        withTimeout<any>(supabase.from('draft_picks').select('*, profiles:user_id(display_name)').eq('draft_id', draftId).order('pick_number'), QUERY_TIMEOUT_MS, 'recap picks'),
        withTimeout<any>((supabase as any).from('draft_results').select('*').eq('draft_id', draftId).order('rank'), QUERY_TIMEOUT_MS, 'recap results'),
        withTimeout<any>((supabase as any).from('draft_skips').select('round, user_id').eq('draft_id', draftId), QUERY_TIMEOUT_MS, 'recap passes'),
      ];
      const [draft, participants, picks, results, skips] = await Promise.all(queries);
      const failed = [draft, participants, picks, results, skips].find(result => result.error);
      if (failed?.error) throw failed.error;
      const loadedPicks = picks.data ?? [];
      let enrichments: any[] = [];
      const pickIds = loadedPicks.map((pick: any) => pick.id).filter(Boolean);
      if (pickIds.length > 0) {
        const enrichmentResult = await withTimeout<any>(
          supabase.from('item_enrichments').select('item_id, image_url, thumbnail_url').eq('item_type', 'draft_pick').in('item_id', pickIds),
          QUERY_TIMEOUT_MS,
          'recap artwork',
        );
        if (!enrichmentResult.error) enrichments = enrichmentResult.data ?? [];
      }
      setData({ draft: draft.data, participants: participants.data ?? [], picks: loadedPicks, results: results.data ?? [], skips: skips.data ?? [], enrichments });
    } catch (err: any) { setError(err?.message || 'Could not open this recap.'); }
    finally { setLoading(false); }
  }, [draftId]);
  useEffect(() => { void load(); }, [load]);
  const stats = useMemo(() => {
    if (!data) return null;
    const results = data.results as DraftResult[];
    return { timings: computePickTimings(data.picks), mvp: findMvpPick(results), steal: findBiggestSteal(results, data.picks) };
  }, [data]);
  if (loading) return <div className="loading-spinner"><div className="loading-spinner-ring" /><p className="loading-spinner-text">Opening the magazine…</p></div>;
  if (error || !data?.draft) return <div className="da-magazine-empty"><p className="[overflow-wrap:anywhere]">{error || 'Draft not found.'}</p><Button className="min-h-11" onClick={() => void load()}>Retry</Button></div>;
  const { draft, participants, picks, results } = data;
  const winner = participants.find((participant: any) => participant.user_id === results[0]?.user_id);
  const share = async () => {
    const shareData = { title: `${draft.topic} — Draft Magazine`, text: `${picks.length} picks. ${winner?.profiles?.display_name ? `${winner.profiles.display_name} took the crown.` : 'See the final board.'}`, url: window.location.href };
    try { if (navigator.share) await navigator.share(shareData); else { await navigator.clipboard.writeText(window.location.href); toast.success('Magazine link copied'); } } catch { /* cancelled */ }
  };
  const enrichmentMap = new Map<string, { image_url?: string | null; thumbnail_url?: string | null }>(
    (data.enrichments ?? []).map((enrichment: any) => [enrichment.item_id, enrichment]),
  );
  return <div className="da-magazine min-w-0">
    <div className="da-magazine-toolbar"><Link to={`/drafts/${draftId}`} className="da-back" aria-label="Back to draft"><ArrowLeft className="h-4 w-4" /></Link><div className="flex-1" /><Button variant="outline" size="sm" className="h-11 min-w-11" onClick={() => void share()}><Share2 className="h-4 w-4" /> Share</Button></div>
    <header className="da-magazine-cover">
      <div className="da-magazine-issue"><span>Draft Arena</span><span>Final Edition</span></div>
      <h1 className="dl-display [overflow-wrap:anywhere]">{draft.topic}</h1>
      <div className="da-magazine-deck">{draft.is_live && <span>Live edition</span>}<span>{participants.length} players</span><span>{picks.length} selections</span><span>{draft.num_rounds} rounds</span></div>
      {winner && <div className="da-magazine-winner"><Crown /><div><small>Draft champion</small><strong>{winner.profiles?.display_name}</strong></div></div>}
    </header>
    <section className="da-magazine-stats">
      {stats?.mvp && <article><Star /><small>MVP Pick</small><strong>{stats.mvp.pickText}</strong><span>{stats.mvp.score.toFixed(1)} rating</span></article>}
      {stats?.steal && <article><Zap /><small>Biggest Steal</small><strong>{stats.steal.pickText}</strong><span>Round {stats.steal.round}</span></article>}
      {stats?.timings?.fastest && <article><Clock /><small>Fastest Pick</small><strong>{stats.timings.fastest.pickText}</strong><span>{formatDuration(stats.timings.fastest.deltaMs)}</span></article>}
      <article><Trophy /><small>Final Board</small><strong>{picks.length} picks</strong><span>{stats?.timings?.totalDurationMs ? formatDuration(stats.timings.totalDurationMs) : 'Async edition'}</span></article>
    </section>
    {results.length > 0 && <section className="da-magazine-podium"><p className="dl-eyebrow">Final standings</p>{results.slice(0, 3).map((result: any) => { const p = participants.find((row: any) => row.user_id === result.user_id); return <article key={result.id}><span className="dl-display">{result.rank}</span><div><strong>{p?.profiles?.display_name || 'Unknown'}</strong><small>{Number(result.total_score).toFixed(1)} · +{result.points_awarded} pts</small></div>{result.rank === 1 && <Crown />}</article>; })}</section>}
    <MissedPicksCard draftId={draft.id} initial={draft.missed_picks} />
    <section className="da-magazine-board"><div className="da-magazine-section-title"><Sparkles /><div><p className="dl-eyebrow">The complete board</p><h2 className="dl-display">Every selection, in order</h2></div></div><div className="da-magazine-board-scroll"><DraftBoard participants={participants} picks={picks} numRounds={draft.num_rounds} currentPickNumber={participants.length * draft.num_rounds + 1} enrichments={enrichmentMap} newPickIds={new Set()} skippedSlots={new Set(data.skips.map((skip: any) => `${skip.round}:${skip.user_id}`))} /></div></section>
    <DraftBroadcastFeed picks={picks} totalPicks={participants.length * draft.num_rounds} limit={12} />
    <section className="da-magazine-timeline"><p className="dl-eyebrow">Selection timeline</p>{picks.map((pick: any) => <article key={pick.id}><span className="dl-display">#{pick.pick_number}</span><div><strong>{pick.pick_text}</strong><small>{pick.profiles?.display_name} · Round {pick.round}</small></div></article>)}</section>
  </div>;
}
