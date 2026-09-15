# Portfolio Wars — Reimagined as a live trading league

Replace the weekly 3-stock pick game with a real portfolio competition: every member starts a
quarterly season with $50,000 in cash and grows it by buying and selling US-listed stocks during
market hours.

## How it plays

- **Season**: quarterly (Q1–Q4). Everyone resets to $50,000 cash on day one; the season closes at
  the final market close of the quarter and standings are frozen into a hall of fame.
- **Universe**: any stock listed on a US exchange (NYSE / Nasdaq / AMEX), searchable by symbol or
  company name. Refreshed nightly so new listings appear automatically.
- **Trading**: buy and sell only — no shorting, no options. Fractional shares supported so a
  member can put an exact dollar amount to work. Orders fill instantly at the live quote.
- **Market hours**: trades only accepted 9:30–16:00 ET on trading days (US holiday calendar
  included). Outside those hours the trade button is replaced by a countdown to the next open.
- **Guardrails**: a per-day trade cap (default 5 trades/day) and a position size cap (default 40%
  of portfolio value at the moment of purchase). Both are club settings an admin can tune.
- **Standings**: ranked by total portfolio value (cash + holdings) as a percent return on $50k,
  updating through the day. Leaderboard shows return, day change, and top holding.

## Screens

- **Portfolio (home)** — value headline with day/season change, equity curve, holdings list with
  live P/L per position, cash available, trades left today.
- **Trade** — stock search, quote panel with sparkline, dollars-or-shares buy/sell ticket,
  confirmation with the exact fill price.
- **Leaderboard** — season standings, your rank, biggest movers of the day.
- **Activity** — club-wide trade tape ("Alex bought 12 NVDA") to keep it social.
- **History** — past seasons and their winners, plus the archived weekly-pick era for reference.

## Infrastructure required

- **Market data**: Finnhub (already connected via `FINNHUB_API_KEY`) for live quotes, symbol
  directory, and candles for sparklines. Free tier is 60 calls/min, so quotes are fetched in
  batches server-side and cached ~15s in a price table shared by all viewers — one fetch serves the
  whole club. If we outgrow the free tier the provider sits behind one module and can be swapped.
- **Scheduled jobs**: quote refresh every 5 minutes during market hours; end-of-day close snapshot
  for the equity curve; nightly symbol-directory sync; season open/close jobs.
- **Server-authoritative trading**: fills, cash math, and guardrails run in an edge function with
  an atomic database routine. The browser never computes or submits a price, cash balance, or
  portfolio value.
- **Data**: seasons, per-member portfolios, holdings, an immutable trade ledger, daily value
  snapshots, cached quotes, and the tradable symbol directory.

## Technical details

- New tables (club-scoped, RLS via `club_members`): `pw_seasons`, `pw_portfolios`,
  `pw_holdings` (avg cost basis), `pw_trades` (ledger: side, qty, fill price, fees=0, timestamp),
  `pw_daily_values`, `pw_quotes` (symbol, price, prev close, fetched_at), `pw_symbols`,
  `pw_league_settings` (trade cap, position cap, starting cash).
- `place_pw_trade` SECURITY DEFINER function: validates market open, season active, symbol
  tradable, daily trade count, position cap, sufficient cash / sufficient shares; then writes the
  trade, updates holdings + cash, all in one transaction.
- Edge functions: `pw-trade` (quote fetch + call the routine), `pw-quotes-refresh` (cron),
  `pw-symbols-sync` (cron), `pw-season-tick` (open/close + daily snapshot).
- Market calendar helper in `src/lib/portfolioWars/market.ts` (ET conversion, holidays, half days);
  `tickers.ts` curated list becomes a fallback only.
- Existing `pw_challenges/pw_entries/pw_picks/pw_accolades` tables and rows are retained read-only
  to power the archived-history tab; the weekly UI and `pw-week-action` cron are retired.
- Reuse the existing `.pw-mode` shell (`PwLayout`, `PwHUD`, `TickerTape`, `Sparkline`) so the
  visual identity carries over; new pages under `/portfolio-wars/*`.

## Build order

1. Schema + settings + RLS, market calendar helper.
2. Symbol sync and quote cache with cron; trading routine and `pw-trade` function.
3. Portfolio and Trade screens against live data.
4. Leaderboard, activity tape, daily snapshots and equity curve.
5. Season open/close automation and history/archive tab.

## Open items

- Daily trade cap default 5 and position cap default 40% — easy to change once you see it in play.
- Live quotes are delayed by up to the cache interval (~15s); acceptable for a friends league.
