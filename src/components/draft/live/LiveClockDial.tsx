import { cn } from '@/lib/utils';
import { formatClock, type LiveClockState } from '@/lib/draft/liveDraft';

interface LiveClockDialProps {
  clock: LiveClockState;
  size?: number;
  stroke?: number;
  /** Extra label under the readout. */
  label?: string;
  className?: string;
}

/**
 * Shared live-draft countdown dial. Drives both the host panel and the
 * projector kiosk so the room and the screen never disagree.
 */
export function LiveClockDial({ clock, size = 120, stroke = 8, label, className }: LiveClockDialProps) {
  const pct = clock.running ? Math.max(0, Math.min(1, clock.remainingMs / clock.totalMs)) : 1;
  const seconds = Math.ceil(clock.remainingMs / 1000);
  const urgent = clock.running && !clock.paused && seconds <= 10;
  const warn = clock.running && !clock.paused && !urgent && seconds <= 30;
  const color = clock.expired || urgent ? '0 84% 60%' : warn ? '38 92% 55%' : '45 93% 52%';
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  return (
    <div
      className={cn('relative inline-flex shrink-0 items-center justify-center', urgent && 'da-urgent-pulse', className)}
      style={{ width: size, height: size }}
      role="timer"
      aria-label={`${formatClock(clock.remainingMs)} left on the clock`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90 overflow-visible" aria-hidden="true" focusable="false">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`hsl(${color} / 0.16)`} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`hsl(${color})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${pct * c} ${c}`}
          style={{
            transition: 'stroke-dasharray 250ms linear, stroke 300ms ease',
            filter: `drop-shadow(0 0 ${urgent ? 14 : 8}px hsl(${color} / ${urgent ? 0.75 : 0.4}))`,
          }}
        />
      </svg>
      <div className="relative flex flex-col items-center leading-none">
        <span
          className="dl-display font-black tabular-nums tracking-tight"
          style={{ color: `hsl(${color})`, fontSize: Math.round(size * 0.27) }}
        >
          {clock.running ? formatClock(clock.remainingMs) : '--:--'}
        </span>
        <span
          className="font-black uppercase tracking-[0.2em] mt-1"
          style={{ color: `hsl(${color} / 0.72)`, fontSize: Math.max(8, Math.round(size * 0.075)) }}
        >
          {label ?? (clock.paused ? 'Paused' : clock.expired ? 'Time' : clock.running ? 'On Clock' : 'Clock Off')}
        </span>
      </div>
    </div>
  );
}
