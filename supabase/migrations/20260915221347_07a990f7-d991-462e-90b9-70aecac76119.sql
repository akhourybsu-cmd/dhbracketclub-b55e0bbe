DROP FUNCTION IF EXISTS public.pw_place_trade(uuid, text, text, numeric, numeric);

CREATE OR REPLACE FUNCTION public.pw_place_trade(
  _user_id uuid,
  _season_id uuid,
  _symbol text,
  _side text,
  _shares numeric,
  _price numeric
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.pw_seasons;
  p public.pw_portfolios;
  h public.pw_holdings;
  st public.pw_league_settings;
  sym text := upper(btrim(_symbol));
  amount numeric;
  trades_today int;
  pos_value numeric;
  portfolio_value numeric;
  realized numeric := NULL;
  new_shares numeric;
BEGIN
  IF _side NOT IN ('buy','sell') THEN RAISE EXCEPTION 'Invalid side'; END IF;
  IF _shares IS NULL OR _shares <= 0 THEN RAISE EXCEPTION 'Share amount must be positive'; END IF;
  IF _price IS NULL OR _price <= 0 THEN RAISE EXCEPTION 'No live price available for %', sym; END IF;

  SELECT * INTO s FROM public.pw_seasons WHERE id = _season_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Season not found'; END IF;
  IF s.status <> 'active' THEN RAISE EXCEPTION 'This season is not open for trading'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.club_members m WHERE m.club_id = s.club_id AND m.user_id = _user_id) THEN
    RAISE EXCEPTION 'Not a member of this club';
  END IF;
  IF NOT public.pw_market_is_open() THEN RAISE EXCEPTION 'The market is closed right now'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.pw_symbols WHERE symbol = sym AND active) THEN
    RAISE EXCEPTION '% is not a tradable US-listed symbol', sym;
  END IF;

  SELECT * INTO st FROM public.pw_league_settings WHERE club_id = s.club_id;

  SELECT * INTO p FROM public.pw_portfolios
   WHERE season_id = _season_id AND user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'You have not joined this season yet'; END IF;

  SELECT count(*) INTO trades_today FROM public.pw_trades
   WHERE portfolio_id = p.id
     AND trading_date = (timezone('America/New_York', now()))::date;
  IF trades_today >= coalesce(st.max_trades_per_day, 5) THEN
    RAISE EXCEPTION 'Daily trade limit reached (% trades)', coalesce(st.max_trades_per_day, 5);
  END IF;

  _shares := round(_shares, 6);
  amount := round(_shares * _price, 2);

  SELECT * INTO h FROM public.pw_holdings
   WHERE portfolio_id = p.id AND symbol = sym FOR UPDATE;

  IF _side = 'buy' THEN
    IF amount > p.cash + 0.005 THEN RAISE EXCEPTION 'Not enough cash for this order'; END IF;
    portfolio_value := p.cash + coalesce((
      SELECT sum(hh.shares * coalesce(q.price, hh.avg_cost))
        FROM public.pw_holdings hh
        LEFT JOIN public.pw_quotes q ON q.symbol = hh.symbol
       WHERE hh.portfolio_id = p.id), 0);
    pos_value := coalesce(h.shares, 0) * _price + amount;
    IF coalesce(st.max_position_pct, 40) < 100
       AND portfolio_value > 0
       AND pos_value > portfolio_value * coalesce(st.max_position_pct, 40) / 100 + 0.01 THEN
      RAISE EXCEPTION 'That would put more than % percent of your portfolio in %',
        coalesce(st.max_position_pct, 40), sym;
    END IF;

    IF h.id IS NULL THEN
      INSERT INTO public.pw_holdings (portfolio_id, club_id, symbol, shares, avg_cost)
      VALUES (p.id, s.club_id, sym, _shares, _price);
    ELSE
      new_shares := h.shares + _shares;
      UPDATE public.pw_holdings
         SET shares = new_shares,
             avg_cost = round((h.shares * h.avg_cost + amount) / new_shares, 6)
       WHERE id = h.id;
    END IF;
    UPDATE public.pw_portfolios SET cash = round(cash - amount, 2) WHERE id = p.id;
  ELSE
    IF h.id IS NULL OR h.shares < _shares - 0.000001 THEN
      RAISE EXCEPTION 'You do not own that many shares of %', sym;
    END IF;
    realized := round((_price - h.avg_cost) * _shares, 2);
    new_shares := round(h.shares - _shares, 6);
    IF new_shares <= 0.000001 THEN
      DELETE FROM public.pw_holdings WHERE id = h.id;
    ELSE
      UPDATE public.pw_holdings SET shares = new_shares WHERE id = h.id;
    END IF;
    UPDATE public.pw_portfolios SET cash = round(cash + amount, 2) WHERE id = p.id;
  END IF;

  INSERT INTO public.pw_trades (portfolio_id, season_id, club_id, user_id, symbol, side, shares, price, amount, realized_pl)
  VALUES (p.id, _season_id, s.club_id, _user_id, sym, _side, _shares, _price, amount, realized);

  UPDATE public.pw_portfolios pp
     SET holdings_value = coalesce((
           SELECT sum(hh.shares * coalesce(q.price, hh.avg_cost))
             FROM public.pw_holdings hh
             LEFT JOIN public.pw_quotes q ON q.symbol = hh.symbol
            WHERE hh.portfolio_id = pp.id), 0),
         total_value = pp.cash + coalesce((
           SELECT sum(hh.shares * coalesce(q.price, hh.avg_cost))
             FROM public.pw_holdings hh
             LEFT JOIN public.pw_quotes q ON q.symbol = hh.symbol
            WHERE hh.portfolio_id = pp.id), 0),
         valued_at = now()
   WHERE pp.id = p.id;

  SELECT * INTO p FROM public.pw_portfolios WHERE id = p.id;
  RETURN jsonb_build_object(
    'ok', true, 'symbol', sym, 'side', _side, 'shares', _shares,
    'price', _price, 'amount', amount, 'realized_pl', realized,
    'cash', p.cash, 'total_value', p.total_value,
    'trades_today', trades_today + 1,
    'trade_limit', coalesce(st.max_trades_per_day, 5)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pw_place_trade(uuid, uuid, text, text, numeric, numeric) FROM public;
REVOKE ALL ON FUNCTION public.pw_place_trade(uuid, uuid, text, text, numeric, numeric) FROM anon;
REVOKE ALL ON FUNCTION public.pw_place_trade(uuid, uuid, text, text, numeric, numeric) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.pw_place_trade(uuid, uuid, text, text, numeric, numeric) TO service_role;