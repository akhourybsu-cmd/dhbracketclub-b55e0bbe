import { Link } from 'react-router-dom';
import { ArrowUpRight, Trophy, Activity, History, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { MarketStatusBar } from '@/components/portfolioWars/MarketStatusBar';
import { EquityCurve } from '@/components/portfolioWars/EquityCurve';
import {
  usePwSeason, usePwSettings, usePwPortfolio, usePwQuotes,
  usePwTradesToday, usePwEquityCurve, livePortfolioValue,
} from '@/hooks/usePwLeague';
import { money, pct, seasonLabel, shareCount } from '@/lib/portfolioWars/market';

/** Portfolio Wars home: your live portfolio for the current quarterly season. */
export default function PortfolioWarsPage() {
  const { data: season, isLoading: seasonLoading, error: seasonError } = usePwSeason();
  const { data: settings } = usePwSettings();
  const { data: pf, isLoading: pfLoading } = usePwPortfolio(season?.id);
  const symbols = (pf?.holdings ?? []).map((h) => h.symbol);
  const { data: quotes } = usePwQuotes(symbols, symbols.length > 0);
  const { data: tradesToday } = usePwTradesToday(pf?.portfolio.id);
  const { data: curve } = usePwEquityCurve(pf?.portfolio.id);

  const startingCash = Number(season?.starting_cash ?? settings?.starting_cash ?? 50000);
  const live = livePortfolioValue(pf?.portfolio, pf?.holdings, quotes, startingCash);
  const total = live.total;
  const cash = live.cash;
  const returnPct = ((total - startingCash) / startingCash) * 100;
  const tradeLimit = settings?.max_trades_per_day ?? 5;
  const tradesLeft = Math.max(0, tradeLimit - (tradesToday ?? 0));

  const dayChange = live.dayChange;

  // The curve is stamped on fills and at the close; mark today's point to live prices.
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const livePoints = (() => {
    const points = (curve ?? []).filter((p) => p.trading_date !== today);
    if (!pf?.portfolio) return points;
    return [...points, { trading_date: today, value: total }];
  })();

  if (seasonLoading) {
    return <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="glass-card rounded-2xl h-24 animate-pulse" />)}</div>;
  }

  if (seasonError || !season) {
    return (
      <div className="glass-card rounded-2xl p-5 text-center space-y-2">
        <p className="text-sm font-bold text-white">Season not ready</p>
        <p className="text-xs text-white/60">
          The trading season could not be opened. Try again in a moment.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-6">
      <MarketStatusBar />

      {/* Value headline */}
      <section className="glass-card rounded-2xl p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">
              {seasonLabel(season.year, season.quarter)} · Portfolio value
            </p>
            <p className="text-3xl font-black tabular-nums text-white mt-1">{money(total)}</p>
            <div className="flex items-center gap-3 mt-1">
              <span
                className="inline-flex items-center gap-1 text-[12px] font-black tabular-nums"
                style={{ color: returnPct >= 0 ? 'hsl(var(--pw-bull))' : 'hsl(var(--pw-bear))' }}
              >
                {returnPct >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {pct(returnPct)} season
              </span>
              {!!symbols.length && (
                <span
                  className="text-[12px] font-bold tabular-nums"
                  style={{ color: dayChange >= 0 ? 'hsl(var(--pw-bull))' : 'hsl(var(--pw-bear))' }}
                >
                  {dayChange >= 0 ? '+' : ''}{money(dayChange)} today
                </span>
              )}
            </div>
          </div>
          <Link
            to="/portfolio-wars/trade"
            className="shrink-0 h-10 px-4 rounded-xl flex items-center gap-1.5 text-[12px] font-black uppercase tracking-[0.12em] btn-press"
            style={{
              background: 'hsl(var(--pw-bull) / 0.18)',
              border: '1px solid hsl(var(--pw-bull) / 0.45)',
              color: 'hsl(var(--pw-bull))',
            }}
          >
            Trade <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="mt-3">
          <EquityCurve points={livePoints} baseline={startingCash} />
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3">
          <Stat label="Cash" value={money(cash)} />
          <Stat label="Invested" value={money(live.holdingsValue)} />
          <Stat label="Trades left" value={`${tradesLeft}/${tradeLimit}`} />
        </div>
      </section>

      {/* Holdings */}
      <section className="glass-card rounded-2xl p-4">
        <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/55 mb-3">Holdings</h2>
        {pfLoading ? (
          <div className="space-y-2">{[0, 1].map((i) => <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />)}</div>
        ) : !pf?.holdings.length ? (
          <div className="text-center py-6 space-y-2">
            <span
              className="w-11 h-11 mx-auto rounded-2xl flex items-center justify-center"
              style={{ background: 'hsl(var(--pw-bull) / 0.14)', border: '1px solid hsl(var(--pw-bull) / 0.3)' }}
            >
              <Wallet className="w-5 h-5" style={{ color: 'hsl(var(--pw-bull))' }} />
            </span>
            <p className="text-sm font-bold text-white">All cash, no positions</p>
            <p className="text-xs text-white/60">You start the season with {money(startingCash, 0)}. Buy your first stock to get moving.</p>
            <Link
              to="/portfolio-wars/trade"
              className="inline-flex h-10 px-4 rounded-xl items-center text-[12px] font-black uppercase tracking-[0.12em] btn-press"
              style={{ background: 'hsl(var(--pw-bull) / 0.18)', border: '1px solid hsl(var(--pw-bull) / 0.45)', color: 'hsl(var(--pw-bull))' }}
            >
              Find a stock
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {pf.holdings.map((h) => {
              const price = Number(quotes?.[h.symbol]?.price ?? h.avg_cost);
              const value = Number(h.shares) * price;
              const plPct = ((price - Number(h.avg_cost)) / Number(h.avg_cost)) * 100;
              const pl = (price - Number(h.avg_cost)) * Number(h.shares);
              const good = pl >= 0;
              return (
                <li
                  key={h.id}
                  className="rounded-xl px-3 py-2.5 flex items-center gap-3"
                  style={{ background: 'hsl(var(--pw-surface) / 0.55)', border: '1px solid hsl(var(--pw-bull) / 0.14)' }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-white truncate">{h.symbol}</p>
                    <p className="text-[11px] text-white/55 tabular-nums">
                      {shareCount(Number(h.shares))} sh · avg {money(Number(h.avg_cost))}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black tabular-nums text-white">{money(value)}</p>
                    <p
                      className="text-[11px] font-bold tabular-nums"
                      style={{ color: good ? 'hsl(var(--pw-bull))' : 'hsl(var(--pw-bear))' }}
                    >
                      {good ? '+' : ''}{money(pl)} · {pct(plPct)}
                    </p>
                  </div>
                  <Link
                    to={`/portfolio-wars/trade?symbol=${h.symbol}`}
                    className="shrink-0 h-9 px-3 rounded-lg flex items-center text-[11px] font-black uppercase tracking-[0.1em] btn-press"
                    style={{ background: 'hsl(var(--pw-amber) / 0.14)', border: '1px solid hsl(var(--pw-amber) / 0.3)', color: 'hsl(var(--pw-amber))' }}
                  >
                    Trade
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Quick links */}
      <nav className="grid grid-cols-3 gap-2">
        <NavTile to="/portfolio-wars/leaderboard" icon={Trophy} label="Standings" />
        <NavTile to="/portfolio-wars/activity" icon={Activity} label="Club tape" />
        <NavTile to="/portfolio-wars/history" icon={History} label="History" />
      </nav>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-xl px-3 py-2"
      style={{ background: 'hsl(var(--pw-surface) / 0.55)', border: '1px solid hsl(var(--pw-bull) / 0.14)' }}
    >
      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/45">{label}</p>
      <p className="text-sm font-black tabular-nums text-white mt-0.5">{value}</p>
    </div>
  );
}

function NavTile({ to, icon: Icon, label }: { to: string; icon: typeof Trophy; label: string }) {
  return (
    <Link
      to={to}
      className="glass-card rounded-xl px-3 py-3 flex flex-col items-center gap-1.5 btn-press"
    >
      <Icon className="w-4 h-4" style={{ color: 'hsl(var(--pw-bull))' }} />
      <span className="text-[10px] font-black uppercase tracking-[0.12em] text-white/70">{label}</span>
    </Link>
  );
}
