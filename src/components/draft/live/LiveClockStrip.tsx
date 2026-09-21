import { Radio } from 'lucide-react';
import { LiveClockDial } from './LiveClockDial';
import type { LiveClockState } from '@/lib/draft/liveDraft';

interface LiveClockStripProps {
  clock: LiveClockState;
  pickerName: string;
  isMyTurn: boolean;
  onDeckName?: string;
}

/** Compact live-clock row every participant sees in the draft room. */
export function LiveClockStrip({ clock, pickerName, isMyTurn, onDeckName }: LiveClockStripProps) {
  return (
    <div className="dl-card p-3 flex items-center gap-3">
      <LiveClockDial clock={clock} size={72} stroke={6} />
      <div className="min-w-0 flex-1">
        <p className="dl-eyebrow flex items-center gap-1.5">
          <Radio className="w-3 h-3 text-primary animate-pulse" aria-hidden />
          Live Draft
        </p>
        <p className="dl-display text-[15px] font-bold truncate">
          {isMyTurn ? "You're on the clock" : `${pickerName} on the clock`}
        </p>
        {onDeckName && (
          <p className="text-[11px] text-muted-foreground truncate">On deck: {onDeckName}</p>
        )}
      </div>
    </div>
  );
}
