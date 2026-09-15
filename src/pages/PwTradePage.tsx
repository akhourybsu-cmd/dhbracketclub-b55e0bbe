import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, X, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { MarketStatusBar } from '@/components/portfolioWars/MarketStatusBar';
import {
  usePwSeason, usePwSettings, usePwPortfolio, usePwQuotes,
  usePwSymbolSearch, usePwTradesToday, usePwTrade, PwTradeResult,
} from '@/hooks/usePwLeague';
import { marketState, money, pct, shareCount } from '@/lib/portfolioWars/market';

/** Trade desk: search the US market, read a live quote, buy or sell. */
export default function PwTradePage() {
  const [params, setParams] = useSearchParams();
  const initial = (params.get('symbol') || '').toUpperCase();

  const { data: season } = usePwSeason();
  const { data: settings } = usePwSettings();
  const { data: pf } = usePwPortfolio(season?.id);
  const { data: tradesToday } = usePwTradesToday(pf?.portfolio.id);
  const trade = usePwTrade();

  const [symbol, setSymbol] = useState(initial);
  const [term, setTerm] = useState('');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [mode, setMode] = useState<'dollars' | 'shares'>('dollars');
  const [input, setInput] = useState('');
  const [receipt, setReceipt] = useState<PwTradeResult | null>(null);

  const { data: results, isFetching: searching } = usePwSymbolSearch(term);
  const { data: quotes } = usePwQuotes(symbol ? [symbol] : [], !!symbol);
  const quote = symbol ? quotes?.[symbol] : undefined;
  const price = Number(quote?.price ?? 0);

  const holding = pf?.holdings.find((h) => h.symbol === symbol);
  const cash = Number(pf?.portfolio.cash ?? 0);
  const totalValue = Number(pf?.portfolio.total_value ?? 0);
  const tradeLimit = settings?.max_trades_per_day ?? 5;
  const tradesLeft = Math.max(0, tradeLimit - (tradesToday ?? 0));
  const positionCap = settings?.max_position_pct ?? 40;
  const market = marketState();

  useEffect(() => { if (initial) setSymbol(initial); }, [initial]);

  const amountNum = Number(input) || 0;
  const shares = mode === 'shares' ? amountNum : price > 0 ? amountNum / price : 0;
  const estCost = mode === 'shares' ? shares * price : amountNum;

  const blocker = useMemo(() => {
    if (!symbol) return 'Pick a stock first';
    if (!price) return 'Waiting for a live price';
    if (!market.isOpen) return 'Market is closed';
    if (tradesLeft <= 0) return `Daily limit reached (${tradeLimit} trades)`;
    if (amountNum <= 0) return 'Enter an amount';
    if (side === 'buy' && estCost > cash + 0.005) return 'Not enough cash';
    if (side === 'buy' && totalValue > 0 && estCost + Number(holding?.shares ?? 0) * price > (positionCap / 100) * totalValue)
      return `Position cap is ${positionCap}% of your portfolio`;
    if (side === 'sell' && (!holding || shares > Number(holding.shares) + 1e-6)) return 'You do not own that many shares';
    return null;
  }, [symbol, price, market.isOpen, tradesLeft, tradeLimit, amountNum, side, estCost, cash, totalValue, holding, positionCap, shares]);

  const submit = async () => {
    if (!season || blocker) return;
    try {
      const result = await trade.mutateAsync({
        seasonId: season.id,
        symbol,
        side,
        ...(mode === 'shares' ? { shares: amountNum } : { amount: amountNum }),
      });
      setReceipt(result);
      setInput('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Trade failed');
    }
  };

  const pickSymbol = (s: string) => {
    setSymbol(s);
    setTerm('');
    setReceipt(null);
    setParams({ symbol: s }, { replace: true });
  };

  return (
    <div className="space-y-3 pb-6">
      <MarketStatusBar />

      {/* Search */}
      <section className="glass-card rounded-2xl p-3">
        <label className="relative block">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search symbol or company"
            className="w-full h-11 rounded-xl pl-9 pr-9 text-sm font-semibold text-white bg-black/30 outline-none"
            style={{ border: '1px solid hsl(var(--pw-bull) / 0.22)' }}
          />
          {!!term && (
            <button
              type="button" onClick={() => setTerm('')} aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-white/50"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </label>

        {!!term && (
          <ul className="mt-2 max-h-64 overflow-y-auto space-y-1">
            {searching && <li className="text-xs text-white/50 px-2 py-2">Searching…</li>}
            {!searching && !results?.length && <li className="text-xs text-white/50 px-2 py-2">No matches on US exchanges.</li>}
            {(results ?? []).map((r) => (
              <li key={r.symbol}>
                <button
                  type="button" onClick={() => pickSymbol(r.symbol)}
                  className="w-full text-left rounded-lg px-3 py-2 flex items-center gap-2 btn-press"
                  style={{ background: 'hsl(var(--pw-surface) / 0.55)', border: '1px solid hsl(var(--pw-bull) / 0.12)' }}
                >
                  <span className="text-sm font-black text-white">{r.symbol}</span>
                  <span className="text-[11px] text-white/55 truncate">{r.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Quote + ticket */}
      {symbol ? (
        <section className="glass-card rounded-2xl p-4 space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-2xl font-black text-white leading-none">{symbol}</p>
              <p className="text-[11px] text-white/55 mt-1">
                {holding ? `You hold ${shareCount(Number(holding.shares))} sh · avg ${money(Number(holding.avg_cost))}` : 'No position yet'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black tabular-nums text-white leading-none">{price ? money(price) : '—'}</p>
              {!!quote?.prev_close && (
                <p
                  className="text-[12px] font-bold tabular-nums mt-1"
                  style={{ color: price >= Number(quote.prev_close) ? 'hsl(var(--pw-bull))' : 'hsl(var(--pw-bear))' }}
                >
                  {pct(((price - Number(quote.prev_close)) / Number(quote.prev_close)) * 100)} today
                </p>
              )}
            </div>
          </div>

          {/* Buy / sell */}
          <div className="grid grid-cols-2 gap-2">
            {(['buy', 'sell'] as const).map((s) => (
              <button
                key={s} type="button" onClick={() => { setSide(s); setReceipt(null); }}
                className="h-10 rounded-xl text-[12px] font-black uppercase tracking-[0.14em] btn-press"
                style={{
                  background: side === s
                    ? `hsl(var(--pw-${s === 'buy' ? 'bull' : 'bear'}) / 0.2)`
                    : 'hsl(var(--pw-surface) / 0.5)',
                  border: `1px solid hsl(var(--pw-${s === 'buy' ? 'bull' : 'bear'}) / ${side === s ? 0.5 : 0.16})`,
                  color: side === s ? `hsl(var(--pw-${s === 'buy' ? 'bull' : 'bear'}))` : 'hsl(0 0% 100% / 0.55)',
                }}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Dollars / shares */}
          <div className="flex items-center gap-2">
            {(['dollars', 'shares'] as const).map((m) => (
              <button
                key={m} type="button" onClick={() => { setMode(m); setInput(''); }}
                className="h-8 px-3 rounded-lg text-[10px] font-black uppercase tracking-[0.14em] btn-press"
                style={{
                  background: mode === m ? 'hsl(var(--pw-amber) / 0.16)' : 'hsl(var(--pw-surface) / 0.5)',
                  border: `1px solid hsl(var(--pw-amber) / ${mode === m ? 0.4 : 0.14})`,
                  color: mode === m ? 'hsl(var(--pw-amber))' : 'hsl(0 0% 100% / 0.5)',
                }}
              >
                {m}
              </button>
            ))}
            <span className="ml-auto text-[11px] font-bold text-white/55 tabular-nums">
              {side === 'buy' ? `${money(cash)} cash` : holding ? `${shareCount(Number(holding.shares))} sh owned` : '0 sh owned'}
            </span>
          </div>

          <input
            value={input}
            onChange={(e) => { setInput(e.target.value.replace(/[^0-9.]/g, '')); setReceipt(null); }}
            inputMode="decimal"
            placeholder={mode === 'dollars' ? '0.00' : '0'}
            className="w-full h-12 rounded-xl px-3 text-lg font-black tabular-nums text-white bg-black/30 outline-none"
            style={{ border: '1px solid hsl(var(--pw-bull) / 0.22)' }}
          />

          <div className="flex items-center justify-between text-[11px] font-bold text-white/55 tabular-nums">
            <span>{mode === 'dollars' ? `≈ ${shareCount(Math.round(shares * 1e4) / 1e4)} shares` : `≈ ${money(estCost)}`}</span>
            <span>{tradesLeft} of {tradeLimit} trades left today</span>
          </div>

          <button
            type="button" onClick={submit} disabled={!!blocker || trade.isPending}
            className="w-full h-12 rounded-xl flex items-center justify-center gap-2 text-[13px] font-black uppercase tracking-[0.14em] btn-press disabled:opacity-45"
            style={{
              background: `hsl(var(--pw-${side === 'buy' ? 'bull' : 'bear'}) / 0.2)`,
              border: `1px solid hsl(var(--pw-${side === 'buy' ? 'bull' : 'bear'}) / 0.5)`,
              color: `hsl(var(--pw-${side === 'buy' ? 'bull' : 'bear'}))`,
            }}
          >
            {trade.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {blocker ?? `${side === 'buy' ? 'Buy' : 'Sell'} ${symbol}`}
          </button>

          {receipt && (
            <div
              className="rounded-xl px-3 py-3 flex items-start gap-2"
              style={{ background: 'hsl(var(--pw-bull) / 0.12)', border: '1px solid hsl(var(--pw-bull) / 0.35)' }}
            >
              <CheckCircle2 className="w-4 h-4 mt-0.5" style={{ color: 'hsl(var(--pw-bull))' }} />
              <div className="text-[12px] text-white/80 leading-relaxed">
                <p className="font-black text-white">
                  {receipt.side === 'buy' ? 'Bought' : 'Sold'} {shareCount(Number(receipt.shares))} {receipt.symbol} at {money(Number(receipt.price))}
                </p>
                <p>Total {money(Number(receipt.amount))} · cash now {money(Number(receipt.cash))}</p>
                {receipt.side === 'sell' && receipt.realized_pl != null && (
                  <p style={{ color: Number(receipt.realized_pl) >= 0 ? 'hsl(var(--pw-bull))' : 'hsl(var(--pw-bear))' }}>
                    Realised {money(Number(receipt.realized_pl))}
                  </p>
                )}
              </div>
            </div>
          )}
        </section>
      ) : (
        <section className="glass-card rounded-2xl p-5 text-center space-y-1">
          <p className="text-sm font-bold text-white">Search any US-listed stock</p>
          <p className="text-xs text-white/60">NYSE, Nasdaq and AMEX. Buy in dollars or shares, fills at the live price.</p>
        </section>
      )}

      <Link
        to="/portfolio-wars"
        className="block text-center text-[11px] font-black uppercase tracking-[0.16em] text-white/50 py-2"
      >
        Back to portfolio
      </Link>
    </div>
  );
}
