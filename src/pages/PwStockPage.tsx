import { useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeftRight, Bell, BellRing, Loader2, Plus, Star, Check } from 'lucide-react';
import { toast } from 'sonner';
import { MarketStatusBar } from '@/components/portfolioWars/MarketStatusBar';
import { PwPriceChart } from '@/components/portfolioWars/PwPriceChart';
import { usePwSeason, usePwPortfolio } from '@/hooks/usePwLeague';
import {
  usePwStock, usePwWatchlists, usePwWatchlistMutations,
  usePwAlerts, usePwAlertMutations,
} from '@/hooks/usePwDesk';
import { money, pct, shareCount } from '@/lib/portfolioWars/market';

/** Full detail page for one stock: chart, key stats, watchlist and alert tools. */
export default function PwStockPage() {
  const { symbol: raw } = useParams<{ symbol: string }>();
  const symbol = (raw || '').toUpperCase();
  const navigate = useNavigate();

  const [range, setRange] = useState<'3m' | '1y'>('3m');
  const { data: stock, isLoading, error } = usePwStock(symbol, range);
  const { data: season } = usePwSeason();
  const { data: pf } = usePwPortfolio(season?.id);
  const { data: lists } = usePwWatchlists();
  const { addSymbol, removeSymbol } = usePwWatchlistMutations();
  const { data: alerts } = usePwAlerts();
  const { createAlert, cancelAlert } = usePwAlertMutations();

  const [alertDir, setAlertDir] = useState<'above' | 'below'>('above');
  const [alertPrice, setAlertPrice] = useState('');

  const holding = pf?.holdings.find((h) => h.symbol === symbol);
  const price = stock?.price ?? null;
  const prev = stock?.prev_close ?? null;
  const change = price != null && prev ? ((price - prev) / prev) * 100 : null;
  const armed = (alerts ?? []).filter((a) => a.symbol === symbol && a.status === 'armed');

  const membership = useMemo(
    () => (lists ?? []).map((l) => ({ list: l, item: l.items.find((i) => i.symbol === symbol) })),
    [lists, symbol],
  );

  const stats: [string, string][] = stock ? [
    ['Open', stock.open != null ? money(stock.open) : '—'],
    ['Day high', stock.high != null ? money(stock.high) : '—'],
    ['Day low', stock.low != null ? money(stock.low) : '—'],
    ['Prev close', stock.prev_close != null ? money(stock.prev_close) : '—'],
    ['52w high', stock.stats.week52_high != null ? money(stock.stats.week52_high) : '—'],
    ['52w low', stock.stats.week52_low != null ? money(stock.stats.week52_low) : '—'],
    ['P/E', stock.stats.pe != null ? stock.stats.pe.toFixed(1) : '—'],
    ['Beta', stock.stats.beta != null ? stock.stats.beta.toFixed(2) : '—'],
  ] : [];

  const toggleList = async (listId: string, itemId?: string) => {
    try {
      if (itemId) await removeSymbol.mutateAsync(itemId);
      else await addSymbol.mutateAsync({ watchlistId: listId, symbol });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update that list');
    }
  };

  const submitAlert = async () => {
    const target = Number(alertPrice);
    if (!target || target <= 0) return;
    try {
      await createAlert.mutateAsync({ symbol, direction: alertDir, targetPrice: target });
      setAlertPrice('');
      toast.success(`We'll tell you when ${symbol} goes ${alertDir} ${money(target)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not set that alert');
    }
  };

  return (
    <div className="space-y-3 pb-6">
      <MarketStatusBar />

      {/* Header */}
      <section className="glass-card rounded-2xl p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-2xl font-black text-white leading-none">{symbol}</p>
            <p className="text-[12px] text-white/60 mt-1 truncate">
              {stock?.profile.name || (isLoading ? 'Loading…' : 'US-listed stock')}
            </p>
            {!!stock?.profile.industry && (
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40 mt-1 truncate">
                {stock.profile.industry}{stock.profile.exchange ? ` · ${stock.profile.exchange}` : ''}
              </p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-black tabular-nums text-white leading-none">
              {price != null ? money(price) : isLoading ? <Loader2 className="w-5 h-5 animate-spin inline" /> : '—'}
            </p>
            {change != null && (
              <p
                className="text-[12px] font-bold tabular-nums mt-1"
                style={{ color: change >= 0 ? 'hsl(var(--pw-bull))' : 'hsl(var(--pw-bear))' }}
              >
                {pct(change)} today
              </p>
            )}
          </div>
        </div>

        {!!error && (
          <p className="text-[12px] font-bold" style={{ color: 'hsl(var(--pw-bear))' }}>
            {error instanceof Error ? error.message : 'Could not load this stock right now.'}
          </p>
        )}

        <PwPriceChart series={stock?.series ?? []} />

        <div className="flex items-center gap-2">
          {(['3m', '1y'] as const).map((r) => (
            <button
              key={r} type="button" onClick={() => setRange(r)}
              className="h-8 px-3 rounded-lg text-[10px] font-black uppercase tracking-[0.14em] btn-press"
              style={{
                background: range === r ? 'hsl(var(--pw-amber) / 0.16)' : 'hsl(var(--pw-surface) / 0.5)',
                border: `1px solid hsl(var(--pw-amber) / ${range === r ? 0.4 : 0.14})`,
                color: range === r ? 'hsl(var(--pw-amber))' : 'hsl(0 0% 100% / 0.5)',
              }}
            >
              {r === '3m' ? '3 months' : '1 year'}
            </button>
          ))}
          <button
            type="button"
            onClick={() => navigate(`/portfolio-wars/trade?symbol=${symbol}`)}
            className="ml-auto h-9 px-3 rounded-lg flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.14em] btn-press"
            style={{
              background: 'hsl(var(--pw-bull) / 0.18)',
              border: '1px solid hsl(var(--pw-bull) / 0.5)',
              color: 'hsl(var(--pw-bull))',
            }}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" /> Trade
          </button>
        </div>

        {!!holding && (
          <p className="text-[11px] font-bold text-white/60 tabular-nums">
            You hold {shareCount(Number(holding.shares))} sh · avg {money(Number(holding.avg_cost))}
          </p>
        )}
      </section>

      {/* Key stats */}
      <section className="glass-card rounded-2xl p-4">
        <h2 className="text-[10px] font-black uppercase tracking-[0.16em] text-white/50 mb-2">Key numbers</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
          {stats.map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-2">
              <dt className="text-[11px] font-bold text-white/50">{label}</dt>
              <dd className="text-[12px] font-black tabular-nums text-white">{value}</dd>
            </div>
          ))}
          {!stats.length && <p className="text-[11px] text-white/45">Loading numbers…</p>}
        </dl>
      </section>

      {/* Watchlists */}
      <section className="glass-card rounded-2xl p-4 space-y-2">
        <h2 className="text-[10px] font-black uppercase tracking-[0.16em] text-white/50">Watchlists</h2>
        {!membership.length && (
          <p className="text-[12px] text-white/60">
            No lists yet.{' '}
            <Link to="/portfolio-wars/watchlists" className="font-black" style={{ color: 'hsl(var(--pw-bull))' }}>
              Make your first watchlist
            </Link>
            .
          </p>
        )}
        {membership.map(({ list, item }) => (
          <button
            key={list.id} type="button" onClick={() => toggleList(list.id, item?.id)}
            className="w-full h-11 px-3 rounded-xl flex items-center gap-2 btn-press"
            style={{
              background: item ? 'hsl(var(--pw-bull) / 0.14)' : 'hsl(var(--pw-surface) / 0.5)',
              border: `1px solid hsl(var(--pw-bull) / ${item ? 0.4 : 0.12})`,
            }}
          >
            {item
              ? <Check className="w-4 h-4" style={{ color: 'hsl(var(--pw-bull))' }} />
              : <Plus className="w-4 h-4 text-white/45" />}
            <span className="text-[13px] font-bold text-white truncate">{list.name}</span>
            <span className="ml-auto text-[10px] font-black uppercase tracking-[0.14em] text-white/40">
              {item ? 'On list' : 'Add'}
            </span>
          </button>
        ))}
      </section>

      {/* Price alerts */}
      <section className="glass-card rounded-2xl p-4 space-y-3">
        <h2 className="text-[10px] font-black uppercase tracking-[0.16em] text-white/50">Price alert</h2>

        <div className="flex items-center gap-2">
          {(['above', 'below'] as const).map((d) => (
            <button
              key={d} type="button" onClick={() => setAlertDir(d)}
              className="h-9 px-3 rounded-lg text-[10px] font-black uppercase tracking-[0.14em] btn-press"
              style={{
                background: alertDir === d ? 'hsl(var(--pw-amber) / 0.16)' : 'hsl(var(--pw-surface) / 0.5)',
                border: `1px solid hsl(var(--pw-amber) / ${alertDir === d ? 0.4 : 0.14})`,
                color: alertDir === d ? 'hsl(var(--pw-amber))' : 'hsl(0 0% 100% / 0.5)',
              }}
            >
              Goes {d}
            </button>
          ))}
          <input
            value={alertPrice}
            onChange={(e) => setAlertPrice(e.target.value.replace(/[^0-9.]/g, ''))}
            inputMode="decimal"
            placeholder={price != null ? price.toFixed(2) : '0.00'}
            aria-label="Alert price"
            className="flex-1 min-w-0 h-9 rounded-lg px-3 text-[13px] font-black tabular-nums text-white bg-black/30 outline-none"
            style={{ border: '1px solid hsl(var(--pw-bull) / 0.22)' }}
          />
        </div>

        <button
          type="button" onClick={submitAlert}
          disabled={!Number(alertPrice) || createAlert.isPending}
          className="w-full h-11 rounded-xl flex items-center justify-center gap-2 text-[12px] font-black uppercase tracking-[0.14em] btn-press disabled:opacity-45"
          style={{
            background: 'hsl(var(--pw-amber) / 0.16)',
            border: '1px solid hsl(var(--pw-amber) / 0.4)',
            color: 'hsl(var(--pw-amber))',
          }}
        >
          {createAlert.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
          Set alert
        </button>

        {armed.map((a) => (
          <div
            key={a.id}
            className="rounded-xl px-3 py-2 flex items-center gap-2"
            style={{ background: 'hsl(var(--pw-surface) / 0.5)', border: '1px solid hsl(var(--pw-amber) / 0.2)' }}
          >
            <BellRing className="w-4 h-4" style={{ color: 'hsl(var(--pw-amber))' }} />
            <span className="text-[12px] font-bold text-white tabular-nums">
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
      </section>

      <Link
        to="/portfolio-wars/watchlists"
        className="flex items-center justify-center gap-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-white/50 py-2"
      >
        <Star className="w-3.5 h-3.5" /> All watchlists
      </Link>
    </div>
  );
}
