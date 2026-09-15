import { Activity } from 'lucide-react';
import { usePwSeason, usePwActivity } from '@/hooks/usePwLeague';
import { money, shareCount } from '@/lib/portfolioWars/market';

/** Club-wide trade tape for the current season. */
export default function PwActivityPage() {
  const { data: season } = usePwSeason();
  const { data: trades, isLoading } = usePwActivity(season?.id);

  return (
    <div className="space-y-3 pb-6">
      <header className="glass-card rounded-2xl p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">Club tape</p>
        <p className="text-sm text-white/70 mt-1">Every trade your club makes, newest first.</p>
      </header>

      <section className="glass-card rounded-2xl p-3">
        {isLoading ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-12 rounded-xl bg-white/5 animate-pulse" />)}</div>
        ) : !trades?.length ? (
          <div className="text-center py-8 space-y-2">
            <Activity className="w-6 h-6 mx-auto" style={{ color: 'hsl(var(--pw-bull))' }} />
            <p className="text-sm font-bold text-white">No trades yet this season</p>
            <p className="text-xs text-white/60">The first buy shows up here instantly.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {trades.map((t) => {
              const buy = t.side === 'buy';
              return (
                <li
                  key={t.id}
                  className="rounded-xl px-3 py-2.5 flex items-center gap-3"
                  style={{ background: 'hsl(var(--pw-surface) / 0.55)', border: '1px solid hsl(var(--pw-bull) / 0.12)' }}
                >
                  <span
                    className="h-7 px-2 rounded-lg flex items-center text-[10px] font-black uppercase tracking-[0.12em] shrink-0"
                    style={{
                      background: `hsl(var(--pw-${buy ? 'bull' : 'bear'}) / 0.16)`,
                      color: `hsl(var(--pw-${buy ? 'bull' : 'bear'}))`,
                    }}
                  >
                    {t.side}
                  </span>
                  <p className="text-[13px] text-white/85 min-w-0 flex-1 truncate">
                    <span className="font-bold text-white">{t.profile?.display_name || 'Member'}</span>{' '}
                    {buy ? 'bought' : 'sold'} {shareCount(Number(t.shares))} {t.symbol}
                  </p>
                  <div className="text-right shrink-0">
                    <p className="text-[12px] font-black tabular-nums text-white">{money(Number(t.amount))}</p>
                    <p className="text-[10px] text-white/45 tabular-nums">
                      {new Date(t.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
