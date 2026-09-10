import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Download, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { prepareChainBoard, publishChainBoard, type ChainBoardPreview } from '@/lib/nfl/chainBoardImport';

export function CrazyChainBoardImport({ weekId, onPublished }: { weekId: string; onPublished: () => void }) {
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<ChainBoardPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setPreview(null);
    setError(null);
    try {
      setPreview(await prepareChainBoard(supabase, weekId, setProgress));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load the weekly board.');
    } finally { setBusy(false); setProgress(''); }
  }

  async function publish() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const result = await publishChainBoard(supabase, preview);
      toast.success(`${result.inserted} new predictions · ${result.reviewed} availability checks · ${result.paused} paused.`);
      setPreview(null);
      void queryClient.invalidateQueries({ queryKey: ['crazy-chain-board-weeks'] });
      void queryClient.invalidateQueries({ queryKey: ['crazy-chain-board-state'] });
      onPublished();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not publish predictions.');
    } finally { setBusy(false); }
  }

  return (
    <section className="glass-card p-4 space-y-3">
      <div className="flex items-center gap-2"><Download className="w-4 h-4 text-gold" /><h2 className="text-[13px] font-extrabold">Load weekly predictions</h2></div>
      <p className="text-xs text-muted-foreground leading-relaxed">Import the week's matchups and available starting quarterbacks, running backs, receivers, and tight ends. Injured or unverified players are skipped. Targets are club challenges, with one target per player statistic.</p>
      <p className="text-xs text-muted-foreground">Verified final team and supported player stats score automatically. Commissioners review missing stats and non-participation.</p>
      <p className="text-xs text-muted-foreground">New predictions require more than 30 minutes before kickoff. Injury checks continue until kickoff without changing saved targets or results. Missing data never scores a zero.</p>
      <Button variant="outline" onClick={load} disabled={busy || !weekId} className="w-full min-h-11">
        {busy && !preview ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
        {progress || 'Preview weekly board'}
      </Button>
      {error && <p role="alert" className="text-xs text-gold flex items-start gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />{error}</p>}
      {preview && (
        <div className="rounded-xl border border-gold/25 bg-gold/5 p-3 space-y-3">
          <p className="text-sm font-extrabold">Week {preview.weekNumber} · {preview.markets.length} predictions</p>
          <p className="text-xs text-muted-foreground">{preview.gameCount} verified games · {preview.playerCount} players. Existing predictions and saved cards are preserved.</p>
          {preview.skippedGames > 0 && <p className="text-xs text-gold">{preview.skippedGames} started or locked game(s) excluded.</p>}
          <p className="text-xs text-muted-foreground">{preview.availability.length} existing player predictions rechecked · {preview.availability.filter(item => !item.verified).length} need review.</p>
          <ul className="space-y-1 text-xs text-muted-foreground">{preview.markets.slice(0, 5).map(market => <li key={market.external_id}>{market.display_text}</li>)}</ul>
          {preview.warnings.length > 0 && <details><summary className="text-xs text-gold cursor-pointer">{preview.warnings.length} availability notes</summary><ul className="mt-2 space-y-1 text-xs text-muted-foreground max-h-40 overflow-y-auto">{preview.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>}
          <Button onClick={publish} disabled={busy} className="w-full min-h-11 font-bold">{busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Publish / refresh Week {preview.weekNumber}</Button>
        </div>
      )}
    </section>
  );
}
