import { useEffect, useState } from 'react';
import { marketState, formatCountdown } from '@/lib/portfolioWars/market';

/** Live market-hours strip: open/closed plus a countdown to the next change. */
export function MarketStatusBar({ className = '' }: { className?: string }) {
  const [state, setState] = useState(() => marketState());

  useEffect(() => {
    const id = window.setInterval(() => setState(marketState()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const color = state.isOpen ? 'hsl(var(--pw-bull))' : 'hsl(var(--pw-amber))';

  return (
    <div
      className={`flex items-center gap-2 rounded-xl px-3 py-2 ${className}`}
      style={{ background: 'hsl(var(--pw-surface) / 0.6)', border: `1px solid ${color.replace(')', ' / 0.28)')}` }}
    >
      <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
      <span className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color }}>
        {state.label}
      </span>
      <span className="ml-auto text-[11px] font-bold tabular-nums text-white/60">
        {formatCountdown(state.msUntilChange)} {state.changeLabel}
      </span>
    </div>
  );
}
