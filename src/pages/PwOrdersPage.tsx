import { Link } from 'react-router-dom';
import { BellRing, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { MarketStatusBar } from '@/components/portfolioWars/MarketStatusBar';
import { usePwSeason } from '@/hooks/usePwLeague';
import { usePwOrders, usePwCancelOrder, usePwAlerts, usePwAlertMutations, PwOrder } from '@/hooks/usePwDesk';
import { money, shareCount } from '@/lib/portfolioWars/market';

/** Working orders, order history and armed price alerts. */
export default function PwOrdersPage() {
  const { data: season } = usePwSeason();
  const { data: orders } = usePwOrders(season?.id);
  const cancel = usePwCancelOrder();
  const { data: alerts } = usePwAlerts();
  const { cancelAlert, clearAlert } = usePwAlertMutations();

  const open = (orders ?? []).filter((o) => o.status === 'open');
  const past = (orders ?? []).filter((o) => o.status !== 'open');
  const armed = (alerts ?? []).filter((a) => a.status === 'armed');
  const triggered = (alerts ?? []).filter((a) => a.status === 'triggered');

  const size = (o: PwOrder) =>
    o.shares != null ? `${shareCount(Number(o.shares))} sh` : money(Number(o.amount ?? 0));

  const doCancel = async (id: string) => {
    try { await cancel.mutateAsync(id); } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not cancel that order');
    }
  };

  return (
    <div className="space-y-3 pb-6">
      <MarketStatusBar />

      {/* Working orders */}
      <section className="glass-card rounded-2xl p-4 space-y-2">
        <h1 className="text-[10px] font-black uppercase tracking-[0.16em] text-white/50 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" /> Working orders
        </h1>
        {!open.length && (
          <p className="text-[12px] text-white/60">
            Nothing waiting. Set a target price on the{' '}
            <Link to="/portfolio-wars/trade" className="font-black" style={{ color: 'hsl(var(--pw-bull))' }}>
              trade desk
            </Link>{' '}
            and it will fill on its own.
          </p>
        )}
        {open.map((o) => (
          <div
            key={o.id}
            className="rounded-xl px-3 py-3 flex items-center gap-3"
            style={{ background: 'hsl(var(--pw-surface) / 0.55)', border: '1px solid hsl(var(--pw-amber) / 0.22)' }}
          >
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-black text-white">
                {o.side === 'buy' ? 'Buy' : 'Sell'} {o.symbol} · {size(o)}
              </p>
              <p className="text-[11px] text-white/55 tabular-nums">
                {o.order_type === 'limit' && o.limit_price != null
                  ? `Fills at ${money(Number(o.limit_price))} or better`
                  : 'Fills when the market opens'}
                {o.time_in_force === 'day' ? ' · today only' : ' · until cancelled'}
              </p>
            </div>
            <button
              type="button" onClick={() => doCancel(o.id)}
              className="h-9 px-3 rounded-lg text-[10px] font-black uppercase tracking-[0.14em] btn-press shrink-0"
              style={{
                background: 'hsl(var(--pw-bear) / 0.14)',
                border: '1px solid hsl(var(--pw-bear) / 0.34)',
                color: 'hsl(var(--pw-bear))',
              }}
            >
              Cancel
            </button>
          </div>
        ))}
      </section>

      {/* Alerts */}
      <section className="glass-card rounded-2xl p-4 space-y-2">
        <h2 className="text-[10px] font-black uppercase tracking-[0.16em] text-white/50 flex items-center gap-1.5">
          <BellRing className="w-3.5 h-3.5" /> Price alerts
        </h2>
        {!armed.length && !triggered.length && (
          <p className="text-[12px] text-white/60">No alerts set. Add one from any stock page.</p>
        )}
        {armed.map((a) => (
          <div
            key={a.id}
            className="rounded-xl px-3 py-2.5 flex items-center gap-3"
            style={{ background: 'hsl(var(--pw-surface) / 0.55)', border: '1px solid hsl(var(--pw-amber) / 0.2)' }}
          >
            <Link to={`/portfolio-wars/stock/${a.symbol}`} className="text-[13px] font-black text-white">
              {a.symbol}
            </Link>
            <span className="text-[12px] font-bold text-white/60 tabular-nums">
              {a.direction} {money(Number(a.target_price))}
            </span>
            <button
              type="button" onClick={() => cancelAlert.mutate(a.id)}
              className="ml-auto text-[10px] font-black uppercase tracking-[0.14em] text-white/45 btn-press"
            >
              Remove
            </button>
          </div>
        ))}
        {triggered.map((a) => (
          <div
            key={a.id}
            className="rounded-xl px-3 py-2.5 flex items-center gap-3"
            style={{ background: 'hsl(var(--pw-bull) / 0.1)', border: '1px solid hsl(var(--pw-bull) / 0.28)' }}
          >
            <Link to={`/portfolio-wars/stock/${a.symbol}`} className="text-[13px] font-black text-white">
              {a.symbol}
            </Link>
            <span className="text-[12px] font-bold tabular-nums" style={{ color: 'hsl(var(--pw-bull))' }}>
              hit {money(Number(a.triggered_price ?? a.target_price))}
            </span>
            <button
              type="button" onClick={() => clearAlert.mutate(a.id)}
              className="ml-auto text-[10px] font-black uppercase tracking-[0.14em] text-white/45 btn-press"
            >
              Clear
            </button>
          </div>
        ))}
      </section>

      {/* History */}
      <section className="glass-card rounded-2xl p-4 space-y-2">
        <h2 className="text-[10px] font-black uppercase tracking-[0.16em] text-white/50">Order history</h2>
        {!past.length && <p className="text-[12px] text-white/60">No completed orders yet this season.</p>}
        {past.map((o) => {
          const good = o.status === 'filled';
          return (
            <div
              key={o.id}
              className="rounded-xl px-3 py-2.5 flex items-start gap-2"
              style={{
                background: 'hsl(var(--pw-surface) / 0.45)',
                border: `1px solid hsl(var(--pw-${good ? 'bull' : 'bear'}) / 0.18)`,
              }}
            >
              {good
                ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'hsl(var(--pw-bull))' }} />
                : <XCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'hsl(var(--pw-bear))' }} />}
              <div className="min-w-0">
                <p className="text-[12px] font-black text-white">
                  {o.side === 'buy' ? 'Buy' : 'Sell'} {o.symbol} · {size(o)} · {o.status}
                </p>
                <p className="text-[11px] text-white/55 tabular-nums">
                  {good && o.filled_price != null
                    ? `Filled ${shareCount(Number(o.filled_shares ?? 0))} sh at ${money(Number(o.filled_price))}`
                    : o.reject_reason || '—'}
                </p>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
