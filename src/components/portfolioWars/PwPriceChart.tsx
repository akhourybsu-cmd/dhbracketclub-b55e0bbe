import { useMemo } from 'react';

/**
 * Compact daily price line for a stock, drawn as a plain SVG path so it stays
 * light inside the Portfolio Wars terminal skin. Colours to the period's
 * direction: bull green when up over the window, bear red when down.
 */
export function PwPriceChart({
  series,
  height = 120,
}: {
  series: { t: number; c: number }[];
  height?: number;
}) {
  const path = useMemo(() => {
    if (series.length < 2) return null;
    const values = series.map((p) => p.c);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const w = 300;
    const h = height;
    const pad = 6;
    const pts = series.map((p, i) => {
      const x = (i / (series.length - 1)) * w;
      const y = h - pad - ((p.c - min) / span) * (h - pad * 2);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
    return {
      line: `M${pts.join('L')}`,
      area: `M${pts.join('L')}L${w},${h}L0,${h}Z`,
      up: values[values.length - 1] >= values[0],
      w,
      h,
    };
  }, [series, height]);

  if (!path) {
    return (
      <div
        className="rounded-xl flex items-center justify-center text-[11px] font-bold text-white/45"
        style={{ height, background: 'hsl(var(--pw-surface) / 0.5)' }}
      >
        Price history unavailable
      </div>
    );
  }

  const stroke = path.up ? 'hsl(var(--pw-bull))' : 'hsl(var(--pw-bear))';

  return (
    <svg
      viewBox={`0 0 ${path.w} ${path.h}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Price trend, ${path.up ? 'up' : 'down'} over the period`}
      className="w-full rounded-xl"
      style={{ height, background: 'hsl(var(--pw-surface) / 0.45)' }}
    >
      <path d={path.area} fill={stroke} opacity={0.14} />
      <path d={path.line} fill="none" stroke={stroke} strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
