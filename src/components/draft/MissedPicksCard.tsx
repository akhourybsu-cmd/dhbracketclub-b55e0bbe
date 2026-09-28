import { useCallback, useEffect, useState } from 'react';
import { Eye, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { withTimeout } from '@/lib/asyncGuards';

export interface MissedPick { name: string; reason: string; score: number }

/** Top-5 elite picks nobody took. Cached on the draft; generated once on first view. */
export function MissedPicksCard({ draftId, initial, className = '' }: { draftId: string; initial?: MissedPick[] | null; className?: string }) {
  const [picks, setPicks] = useState<MissedPick[] | null>(Array.isArray(initial) ? initial : null);
  const [loading, setLoading] = useState(!Array.isArray(initial));
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data, error: fnError } = await withTimeout<any>(
        supabase.functions.invoke('draft-missed-picks', { body: { draft_id: draftId } }), 90_000, 'missed picks',
      );
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setPicks(data?.missed_picks ?? []);
    } catch (err: any) {
      setError(err?.message || 'Could not load missed picks.');
    } finally { setLoading(false); }
  }, [draftId]);

  useEffect(() => { if (!Array.isArray(initial)) void load(); }, [initial, load]);

  if (picks && picks.length === 0 && !loading) return null;

  return (
    <section className={`da-missed ${className}`} aria-label="Top picks left on the board">
      <div className="da-magazine-section-title">
        <Eye />
        <div><p className="dl-eyebrow">Left on the board</p><h2 className="dl-display">Top picks nobody took</h2></div>
      </div>
      {loading ? (
        <ol className="da-missed-list" aria-busy>
          {Array.from({ length: 5 }, (_, i) => <li key={i} className="da-missed-skeleton" />)}
        </ol>
      ) : error ? (
        <div className="da-missed-error"><p>{error}</p><button type="button" onClick={() => void load()}><RefreshCw className="h-4 w-4" /> Retry</button></div>
      ) : (
        <ol className="da-missed-list">
          {picks!.map((pick, i) => (
            <li key={pick.name}>
              <span className="da-missed-rank dl-display">{i + 1}</span>
              <div><strong>{pick.name}</strong>{pick.reason && <small>{pick.reason}</small>}</div>
              <b className="dl-display">{Number(pick.score).toFixed(1)}</b>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
