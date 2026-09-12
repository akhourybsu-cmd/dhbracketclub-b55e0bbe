import { useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { runNflCheck, summarizeNflCheck } from '@/lib/nfl/refreshNow';

/**
 * One-tap "check everything" for NFL Game Center. Refreshes scores for the
 * recent weeks and re-scores Pick'em + Crazy Chain. Automatic checks otherwise
 * run once a day at midnight Eastern.
 */
export function NflCheckButton({ seasonYear, currentWeek, onDone, className, label = 'Check for updates' }: {
  seasonYear: number; currentWeek: number; onDone?: () => void; className?: string; label?: string;
}) {
  const [checking, setChecking] = useState(false);

  async function check() {
    setChecking(true);
    try {
      const results = await runNflCheck(seasonYear, currentWeek);
      const summary = summarizeNflCheck(results);
      if (results.some(result => result.ok)) toast.success(summary);
      else toast.error(summary);
      onDone?.();
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
