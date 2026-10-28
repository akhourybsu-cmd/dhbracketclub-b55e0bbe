import { useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CountdownRingProps {
  /** Time when the clock started — last pick OR draft start. */
  startedAt: string | null;
  /** Soft target for a full lap, in seconds. Default 60. Visual only — no auto-pick. */
  softLimitSec?: number;
  /** Render size in px. */
  size?: number;
  /** Compact (no label) variant for inline placement. */
  compact?: boolean;
  /** Color overrides — defaults to gold (calm) → red (urgent). */
  calmHsl?: string;
  urgentHsl?: string;
}

/**
 * Cinematic circular countdown ring with an inline mm:ss readout.
 * - Fills smoothly toward `softLimitSec`, then wraps past 100% (overtime).
 * - Switches to urgent state (red glow + pulse) under 15s remaining or after overtime.
 * - Respects prefers-reduced-motion (drops the breathing pulse, keeps the readout).
 */
export function CountdownRing({
  startedAt,
  softLimitSec = 60,
  size = 92,
  compact = false,
  calmHsl = '45 93% 52%',
  urgentHsl = '0 84% 60%',
}: CountdownRingProps) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number>(Date.now());

  useEffect(() => {
    startRef.current = startedAt ? new Date(startedAt).getTime() : Date.now();
    setElapsed(0);
    const id = setInterval(() => setElapsed(Date.now() - startRef.current), 250);
    return () => clearInterval(id);
  }, [startedAt]);

  const seconds = Math.max(0, Math.floor(elapsed / 1000));
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  const hours = Math.floor(min / 60);
  const days = Math.floor(hours / 24);

  // Async drafts can sit "on the clock" for hours or days. A raw mm:ss
  // readout turns into things like `1843:35`, which overflows the ring
  // and reads as noise — so anything past an hour is humanized.
  const readout =
    days >= 1
      ? `${days}d ${hours % 24}h`
      : hours >= 1
        ? `${hours}h ${min % 60}m`
        : `${min}:${sec.toString().padStart(2, '0')}`;
  // Shrink the glyphs slightly for the wider humanized strings so they
  // always stay inside the ring.
  const readoutFontSize = (compact ? 13 : 16) - (readout.length > 5 ? 2 : 0);

  const remaining = softLimitSec - seconds;
  const isOvertime = remaining < 0;
  // Only agitate while the wait is still "live". A draft that has been
  // stalled for hours shouldn't pulse red forever.
  const isUrgent = remaining <= 15 && min < 10;
  const isStale = isOvertime && min >= 10;
  const ringColor = isUrgent || isOvertime ? urgentHsl : calmHsl;

  // Wrap progress so overtime keeps sweeping around the ring.
  const rawPct = (seconds / softLimitSec) * 100;
  const pct = Math.min(100, rawPct % 100 || (rawPct >= 100 ? 100 : rawPct));


  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', isUrgent && 'da-urgent-pulse')}
      style={{ width: size, height: size }}
      role="timer"
      aria-label={`${min} minutes ${sec} seconds elapsed`}
    >
      <svg width={size} height={size} className="absolute inset-0 -rotate-90">
        {/* track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`hsl(${ringColor} / 0.14)`}
          strokeWidth={stroke}
        />
        {/* progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`hsl(${ringColor})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          style={{
            transition: 'stroke-dasharray 250ms linear, stroke 300ms ease',
            filter: `drop-shadow(0 0 6px hsl(${ringColor} / ${isUrgent ? 0.7 : 0.45}))`,
          }}
        />
      </svg>
      <div className="relative flex flex-col items-center leading-none">
        <Clock
          className={cn('mb-0.5', isUrgent && 'animate-pulse')}
          style={{
            color: `hsl(${ringColor} / ${isUrgent ? 1 : 0.7})`,
            width: compact ? 10 : 12,
            height: compact ? 10 : 12,
          }}
        />
        <span
          className="font-mono font-extrabold tabular-nums tracking-tight whitespace-nowrap"
          style={{
            color: `hsl(${ringColor})`,
            fontSize: readoutFontSize,
            textShadow: isUrgent ? `0 0 10px hsl(${ringColor} / 0.55)` : undefined,
          }}
        >
          {readout}
        </span>
        {!compact && (
          <span
            className="text-[9.5px] font-extrabold uppercase tracking-[0.18em] mt-0.5"
            style={{ color: `hsl(${ringColor} / 0.7)` }}
          >
            {isStale ? 'Waiting' : isOvertime ? 'Overtime' : isUrgent ? 'Hurry' : 'On Clock'}
          </span>
        )}

      </div>
    </div>
  );
}
