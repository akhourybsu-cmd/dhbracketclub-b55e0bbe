/** Real equity curve drawn from stored daily portfolio values. */
export function EquityCurve({
  points, baseline, height = 88,
}: {
  points: Array<{ trading_date: string; value: number }>;
  baseline: number;
  height?: number;
}) {
  if (points.length < 2) {
    return (
      <div
        className="rounded-xl flex items-center justify-center text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45"
        style={{ height, background: 'hsl(var(--pw-surface) / 0.5)', border: '1px solid hsl(var(--pw-bull) / 0.14)' }}
      >
        Curve builds after the first market close
      </div>
    );
  }

  const values = points.map((p) => Number(p.value));
  const min = Math.min(...values, baseline);
  const max = Math.max(...values, baseline);
  const span = max - min || 1;
  const W = 300;
  const H = height;
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => H - 6 - ((v - min) / span) * (H - 12);

  const line = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${W},${H} L0,${H} Z`;
  const up = values[values.length - 1] >= baseline;
  const stroke = up ? 'hsl(var(--pw-bull))' : 'hsl(var(--pw-bear))';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img" aria-label="Portfolio value over time">
      <defs>
        <linearGradient id="pw-eq-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.32" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="0" y1={y(baseline)} x2={W} y2={y(baseline)} stroke="hsl(var(--pw-amber) / 0.5)" strokeWidth="1" strokeDasharray="4 4" />
      <path d={area} fill="url(#pw-eq-fill)" />
      <path d={line} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
