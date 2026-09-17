// Portfolio Wars — Home screen widget.
//
// Shows the member's live portfolio value for the current season, marked to the
// latest quotes (same valuation used inside the game). Renders nothing when the
// plugin isn't installed or the member has no portfolio yet.

import { Link } from 'react-router-dom';
import { TrendingDown, TrendingUp, LineChart, ChevronRight } from 'lucide-react';
import {
  usePwSeason, usePwSettings, usePwPortfolio, usePwQuotes, livePortfolioValue,
} from '@/hooks/usePwLeague';
import { money, pct, seasonLabel } from '@/lib/portfolioWars/market';

interface Props { enabled: boolean }

export function PwHomeWidget({ enabled }: Props) {
  const { data: season } = usePwSeason();
  const { data: settings } = usePwSettings();
  const { data: pf } = usePwPortfolio(season?.id);
  const symbols = (pf?.holdings ?? []).map((h) => h.symbol);
  const { data: quotes } = usePwQuotes(symbols, enabled && symbols.length > 0);

  if (!enabled || !season || !pf?.portfolio) return null;

  const startingCash = Number(season.starting_cash ?? settings?.starting_cash ?? 50000);
  const live = livePortfolioValue(pf.portfolio, pf.holdings, quotes, startingCash);
  const returnPct = ((live.total - startingCash) / startingCash) * 100;
  const up = returnPct >= 0;
  const dayUp = live.dayChange >= 0;

  return (
    <Link
      to="/portfolio-wars"
      className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3.5 transition-colors active:bg-muted/50"
      aria-label="Open Portfolio Wars"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <LineChart className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {seasonLabel(season.year, season.quarter)} · Your portfolio
        </span>
        <span className="mt-0.5 block text-[22px] font-semibold tabular-nums leading-tight tracking-[-0.03em]">
          {money(live.total)}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] font-semibold tabular-nums">
          <span className={up ? 'text-emerald-500' : 'text-red-500'}>
            {up ? <TrendingUp className="mr-1 inline h-3.5 w-3.5" /> : <TrendingDown className="mr-1 inline h-3.5 w-3.5" />}
            {pct(returnPct)} season
          </span>
          {live.priced && (
            <span className={dayUp ? 'text-emerald-500' : 'text-red-500'}>
              {dayUp ? '+' : ''}{money(live.dayChange)} today
            </span>
          )}
          <span className="font-medium text-muted-foreground">{money(live.cash)} cash</span>
        </span>
      </span>
      <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
