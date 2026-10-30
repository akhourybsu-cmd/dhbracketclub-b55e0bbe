import { useEffect, useRef, useState } from 'react';

interface Props {
  value: number;
  /** Animation duration in ms. */
  duration?: number;
  /** Delay before counting begins. */
  delay?: number;
  /** Format function (e.g. `n => n.toLocaleString()`). */
  format?: (n: number) => string;
  className?: string;
  style?: React.CSSProperties;
  /** Fired once when the count-up completes. */
  onDone?: () => void;
}

/**
 * RequestAnimationFrame-driven number tweener. Starts from 0 (or the
 * previously rendered value, on subsequent updates) and eases out to the
 * target. Used in the Results page for score, shards, XP, etc.
 */
export function CountUp({ value, duration = 850, delay = 0, format, className, style, onDone }: Props) {
  const [display, setDisplay] = useState(() => duration <= 0 ? value : 0);
  const fromRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (duration <= 0 || !Number.isFinite(duration) || document.hidden) {
      fromRef.current = to;
      setDisplay(to);
      onDone?.();
      return;
    }
    let start: number | null = null;
    let cancelled = false;
    let finished = false;
    const stop = () => {
      window.clearTimeout(startTimer);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    const finish = () => {
      if (cancelled || finished) return;
      finished = true;
      stop();
      fromRef.current = to;
      setDisplay(to);
      onDone?.();
    };
    const onVisibility = () => {
      if (document.hidden) finish();
    };
    document.addEventListener('visibilitychange', onVisibility);
    const startTimer = window.setTimeout(() => {
      const tick = (t: number) => {
        if (cancelled || finished) return;
        if (document.hidden) { finish(); return; }
        if (start === null) start = t;
        const elapsed = t - start;
        const k = Math.min(1, elapsed / duration);
        const eased = 1 - Math.pow(1 - k, 2.4); // cubic ease-out
        const cur = Math.round(from + (to - from) * eased);
        setDisplay(cur);
        if (k < 1) rafRef.current = requestAnimationFrame(tick);
        else finish();
      };
      rafRef.current = requestAnimationFrame(tick);
    }, delay);
    return () => {
      cancelled = true;
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // Intentionally omit onDone from deps (would re-trigger).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration, delay]);

  return (
    <span className={className} style={style}>
      {format ? format(display) : display}
    </span>
  );
}
