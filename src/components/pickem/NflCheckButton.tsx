import { useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';
import { runNflCheck, summarizeNflCheck } from '@/lib/nfl/refreshNow';

/**
 * One-tap "check everything" for NFL Game Center. Refreshes scores for every
 * week with recent or imminent kickoffs, re-scores Pick'em + Crazy Chain, and
 * rebuilds chain boards. Automatic checks otherwise run on the NFL cron.
 */
export function NflCheckButton({ seasonYear, currentWeek, onDone, className, label = 'Check for updates' }: {
  seasonYear: number; currentWeek: number; onDone?: () => void; className?: string; label?: string;
}) {
  const [checking, setChecking] = useState(false);
  const queryClient = useQueryClient();

  async function check() {
    setChecking(true);
    try {
      const summary = await runNflCheck(seasonYear, currentWeek);
      const message = summarizeNflCheck(summary);
      const needsRetry = summary.boardErrors > 0 || summary.weeks.some(week => !week.ok || week.chainDeferred);
      if (summary.weeks.some(week => week.ok) && !needsRetry) toast.success(message);
      else if (summary.weeks.some(week => week.ok)) toast.warning(message);
      else toast.error(message);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['nfl-live'] }),
        queryClient.invalidateQueries({ queryKey: ['crazy-chain-board-weeks'] }),
        queryClient.invalidateQueries({ queryKey: ['crazy-chain-board-state'] }),
        queryClient.invalidateQueries({ queryKey: ['crazy-chain-markets'] }),
        queryClient.invalidateQueries({ queryKey: ['crazy-chain-entry'] }),
        queryClient.invalidateQueries({ queryKey: ['crazy-chain-game-cards'] }),
        queryClient.invalidateQueries({ queryKey: ['crazy-chain-standings'] }),
        queryClient.invalidateQueries({ queryKey: ['crazy-chain-history'] }),
      ]);
      onDone?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The NFL update could not finish. Try again.');
    } finally {
      setChecking(false);
    }
  }

  return (
    <Button size="sm" variant="outline" className={className} onClick={check} disabled={checking}>
      {checking
        ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Checking scores…</>
        : <><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> {label}</>}
    </Button>
  );
}
