-- =============== Portfolio Wars: live trading league ===============

CREATE TABLE IF NOT EXISTS public.pw_league_settings (
  club_id uuid PRIMARY KEY REFERENCES public.clubs(id) ON DELETE CASCADE,
  starting_cash numeric NOT NULL DEFAULT 50000,
  max_trades_per_day integer NOT NULL DEFAULT 5,
  max_position_pct numeric NOT NULL DEFAULT 40,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pw_seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  year integer NOT NULL,
  quarter smallint NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  status text NOT NULL DEFAULT 'upcoming',
  starting_cash numeric NOT NULL DEFAULT 50000,
  finalized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_id, year, quarter)
);

CREATE TABLE IF NOT EXISTS public.pw_portfolios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.pw_seasons(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  cash numeric NOT NULL DEFAULT 50000,
  total_value numeric NOT NULL DEFAULT 50000,
  holdings_value numeric NOT NULL DEFAULT 0,
  valued_at timestamptz,
  final_rank integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (season_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.pw_holdings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES public.pw_portfolios(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  shares numeric NOT NULL DEFAULT 0,
  avg_cost numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (portfolio_id, symbol)
);

CREATE TABLE IF NOT EXISTS public.pw_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES public.pw_portfolios(id) ON DELETE CASCADE,
  season_id uuid NOT NULL REFERENCES public.pw_seasons(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  symbol text NOT NULL,
  side text NOT NULL CHECK (side IN ('buy','sell')),
  shares numeric NOT NULL CHECK (shares > 0),
  price numeric NOT NULL CHECK (price > 0),
  amount numeric NOT NULL,
  realized_pl numeric,
  trading_date date NOT NULL DEFAULT (timezone('America/New_York', now()))::date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pw_trades_portfolio_idx ON public.pw_trades(portfolio_id, created_at DESC);
CREATE INDEX IF NOT EXISTS pw_trades_club_idx ON public.pw_trades(club_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.pw_daily_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES public.pw_portfolios(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  trading_date date NOT NULL,
  value numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (portfolio_id, trading_date)
);

CREATE TABLE IF NOT EXISTS public.pw_quotes (
  symbol text PRIMARY KEY,
  price numeric,
  prev_close numeric,
  open numeric,
  high numeric,
  low numeric,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pw_symbols (
  symbol text PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  exchange text,
  type text,
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pw_symbols_name_idx ON public.pw_symbols(name);

CREATE TABLE IF NOT EXISTS public.pw_market_holidays (
  holiday_date date PRIMARY KEY,
  label text,
  early_close boolean NOT NULL DEFAULT false
);

-- ---------------- grants ----------------
GRANT SELECT ON public.pw_league_settings TO authenticated;
GRANT INSERT, UPDATE ON public.pw_league_settings TO authenticated;
GRANT ALL ON public.pw_league_settings TO service_role;

GRANT SELECT ON public.pw_seasons TO authenticated;
GRANT INSERT, UPDATE ON public.pw_seasons TO authenticated;
GRANT ALL ON public.pw_seasons TO service_role;

GRANT SELECT, INSERT ON public.pw_portfolios TO authenticated;
GRANT ALL ON public.pw_portfolios TO service_role;

GRANT SELECT ON public.pw_holdings TO authenticated;
GRANT ALL ON public.pw_holdings TO service_role;

GRANT SELECT ON public.pw_trades TO authenticated;
GRANT ALL ON public.pw_trades TO service_role;

GRANT SELECT ON public.pw_daily_values TO authenticated;
GRANT ALL ON public.pw_daily_values TO service_role;

GRANT SELECT ON public.pw_quotes TO authenticated;
GRANT ALL ON public.pw_quotes TO service_role;

GRANT SELECT ON public.pw_symbols TO authenticated;
GRANT ALL ON public.pw_symbols TO service_role;

GRANT SELECT ON public.pw_market_holidays TO authenticated;
GRANT ALL ON public.pw_market_holidays TO service_role;

-- ---------------- RLS ----------------
ALTER TABLE public.pw_league_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pw_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pw_portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pw_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pw_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pw_daily_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pw_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pw_symbols ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pw_market_holidays ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.pw_is_member(_club_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members m
    WHERE m.club_id = _club_id AND m.user_id = auth.uid()
  ) OR public.is_app_admin(auth.uid());
$$;

DROP POLICY IF EXISTS pw_settings_read ON public.pw_league_settings;
CREATE POLICY pw_settings_read ON public.pw_league_settings FOR SELECT TO authenticated
  USING (public.pw_is_member(club_id));
DROP POLICY IF EXISTS pw_settings_write ON public.pw_league_settings;
CREATE POLICY pw_settings_write ON public.pw_league_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_club_admin(auth.uid(), club_id));
DROP POLICY IF EXISTS pw_settings_update ON public.pw_league_settings;
CREATE POLICY pw_settings_update ON public.pw_league_settings FOR UPDATE TO authenticated
  USING (public.is_club_admin(auth.uid(), club_id)) WITH CHECK (public.is_club_admin(auth.uid(), club_id));

DROP POLICY IF EXISTS pw_seasons_read ON public.pw_seasons;
CREATE POLICY pw_seasons_read ON public.pw_seasons FOR SELECT TO authenticated
  USING (public.pw_is_member(club_id));
DROP POLICY IF EXISTS pw_seasons_insert ON public.pw_seasons;
CREATE POLICY pw_seasons_insert ON public.pw_seasons FOR INSERT TO authenticated
  WITH CHECK (public.is_club_admin(auth.uid(), club_id));
DROP POLICY IF EXISTS pw_seasons_update ON public.pw_seasons;
CREATE POLICY pw_seasons_update ON public.pw_seasons FOR UPDATE TO authenticated
  USING (public.is_club_admin(auth.uid(), club_id)) WITH CHECK (public.is_club_admin(auth.uid(), club_id));

DROP POLICY IF EXISTS pw_portfolios_read ON public.pw_portfolios;
CREATE POLICY pw_portfolios_read ON public.pw_portfolios FOR SELECT TO authenticated
  USING (public.pw_is_member(club_id));
DROP POLICY IF EXISTS pw_portfolios_insert ON public.pw_portfolios;
CREATE POLICY pw_portfolios_insert ON public.pw_portfolios FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.pw_is_member(club_id));

DROP POLICY IF EXISTS pw_holdings_read ON public.pw_holdings;
CREATE POLICY pw_holdings_read ON public.pw_holdings FOR SELECT TO authenticated
  USING (public.pw_is_member(club_id));

DROP POLICY IF EXISTS pw_trades_read ON public.pw_trades;
CREATE POLICY pw_trades_read ON public.pw_trades FOR SELECT TO authenticated
  USING (public.pw_is_member(club_id));

DROP POLICY IF EXISTS pw_daily_values_read ON public.pw_daily_values;
CREATE POLICY pw_daily_values_read ON public.pw_daily_values FOR SELECT TO authenticated
  USING (public.pw_is_member(club_id));

DROP POLICY IF EXISTS pw_quotes_read ON public.pw_quotes;
CREATE POLICY pw_quotes_read ON public.pw_quotes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS pw_symbols_read ON public.pw_symbols;
CREATE POLICY pw_symbols_read ON public.pw_symbols FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS pw_holidays_read ON public.pw_market_holidays;
CREATE POLICY pw_holidays_read ON public.pw_market_holidays FOR SELECT TO authenticated USING (true);

-- ---------------- updated_at triggers ----------------
DROP TRIGGER IF EXISTS pw_settings_touch ON public.pw_league_settings;
CREATE TRIGGER pw_settings_touch BEFORE UPDATE ON public.pw_league_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS pw_seasons_touch ON public.pw_seasons;
CREATE TRIGGER pw_seasons_touch BEFORE UPDATE ON public.pw_seasons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS pw_portfolios_touch ON public.pw_portfolios;
CREATE TRIGGER pw_portfolios_touch BEFORE UPDATE ON public.pw_portfolios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS pw_holdings_touch ON public.pw_holdings;
CREATE TRIGGER pw_holdings_touch BEFORE UPDATE ON public.pw_holdings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------- market hours ----------------
CREATE OR REPLACE FUNCTION public.pw_market_is_open(_at timestamptz DEFAULT now())
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  et timestamp;
  d date;
  minutes int;
  early boolean;
BEGIN
  et := timezone('America/New_York', _at);
  d := et::date;
  IF extract(isodow FROM et) > 5 THEN RETURN false; END IF;
  SELECT h.early_close INTO early FROM public.pw_market_holidays h WHERE h.holiday_date = d;
  IF FOUND AND coalesce(early, false) = false THEN RETURN false; END IF;
  minutes := extract(hour FROM et) * 60 + extract(minute FROM et);
  IF coalesce(early, false) THEN
    RETURN minutes >= 570 AND minutes < 780; -- 9:30 - 13:00
  END IF;
  RETURN minutes >= 570 AND minutes < 960;   -- 9:30 - 16:00
END;
$$;

-- ---------------- season bootstrap ----------------
CREATE OR REPLACE FUNCTION public.pw_ensure_season(_club_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  et date := (timezone('America/New_York', now()))::date;
  y int := extract(year FROM et);
  q int := ceil(extract(month FROM et) / 3.0);
  sid uuid;
  cash numeric;
BEGIN
  IF NOT public.pw_is_member(_club_id) THEN
    RAISE EXCEPTION 'Not a member of this club';
  END IF;

  SELECT s.id INTO sid FROM public.pw_seasons s
   WHERE s.club_id = _club_id AND s.year = y AND s.quarter = q;

  IF sid IS NULL THEN
    SELECT coalesce(ls.starting_cash, 50000) INTO cash
      FROM public.pw_league_settings ls WHERE ls.club_id = _club_id;
    cash := coalesce(cash, 50000);
    INSERT INTO public.pw_seasons (club_id, year, quarter, starts_on, ends_on, status, starting_cash)
    VALUES (
      _club_id, y, q,
      make_date(y, ((q - 1) * 3 + 1)::int, 1),
      (make_date(y, ((q - 1) * 3 + 1)::int, 1) + interval '3 months' - interval '1 day')::date,
      'active', cash
    )
    ON CONFLICT (club_id, year, quarter) DO UPDATE SET status = public.pw_seasons.status
    RETURNING id INTO sid;
  ELSE
    UPDATE public.pw_seasons SET status = 'active'
     WHERE id = sid AND status = 'upcoming';
  END IF;

  -- mark any earlier seasons complete
  UPDATE public.pw_seasons SET status = 'completed'
   WHERE club_id = _club_id AND id <> sid AND status = 'active';

  RETURN sid;
END;
$$;

CREATE OR REPLACE FUNCTION public.pw_join_season(_season_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.pw_seasons;
  pid uuid;
BEGIN
  SELECT * INTO s FROM public.pw_seasons WHERE id = _season_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Season not found'; END IF;
  IF NOT public.pw_is_member(s.club_id) THEN RAISE EXCEPTION 'Not a member of this club'; END IF;

  SELECT id INTO pid FROM public.pw_portfolios
   WHERE season_id = _season_id AND user_id = auth.uid();
  IF pid IS NULL THEN
    INSERT INTO public.pw_portfolios (season_id, club_id, user_id, cash, total_value, holdings_value)
    VALUES (_season_id, s.club_id, auth.uid(), s.starting_cash, s.starting_cash, 0)
    RETURNING id INTO pid;
  END IF;
  RETURN pid;
END;
$$;

-- ---------------- trading routine ----------------
CREATE OR REPLACE FUNCTION public.pw_place_trade(
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
  IF NOT public.pw_is_member(s.club_id) THEN RAISE EXCEPTION 'Not a member of this club'; END IF;
  IF NOT public.pw_market_is_open() THEN RAISE EXCEPTION 'The market is closed right now'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.pw_symbols WHERE symbol = sym AND active) THEN
    RAISE EXCEPTION '% is not a tradable US-listed symbol', sym;
  END IF;

  SELECT * INTO st FROM public.pw_league_settings WHERE club_id = s.club_id;

  SELECT * INTO p FROM public.pw_portfolios
   WHERE season_id = _season_id AND user_id = auth.uid() FOR UPDATE;
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
    -- position cap
    portfolio_value := p.cash + coalesce((
      SELECT sum(hh.shares * coalesce(q.price, hh.avg_cost))
        FROM public.pw_holdings hh
        LEFT JOIN public.pw_quotes q ON q.symbol = hh.symbol
       WHERE hh.portfolio_id = p.id), 0);
    pos_value := coalesce(h.shares, 0) * _price + amount;
    IF coalesce(st.max_position_pct, 40) < 100
       AND portfolio_value > 0
       AND pos_value > portfolio_value * coalesce(st.max_position_pct, 40) / 100 + 0.01 THEN
      RAISE EXCEPTION 'That would put more than %%% of your portfolio in %',
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
  VALUES (p.id, _season_id, s.club_id, auth.uid(), sym, _side, _shares, _price, amount, realized);

  -- refresh cached valuation
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

REVOKE ALL ON FUNCTION public.pw_place_trade(uuid, text, text, numeric, numeric) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pw_place_trade(uuid, text, text, numeric, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.pw_ensure_season(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pw_join_season(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pw_market_is_open(timestamptz) TO authenticated, service_role;

-- ---------------- known market holidays ----------------
INSERT INTO public.pw_market_holidays (holiday_date, label, early_close) VALUES
  ('2026-01-01','New Year''s Day',false),
  ('2026-01-19','MLK Day',false),
  ('2026-02-16','Presidents Day',false),
  ('2026-04-03','Good Friday',false),
  ('2026-05-25','Memorial Day',false),
  ('2026-06-19','Juneteenth',false),
  ('2026-07-03','Independence Day (observed)',false),
  ('2026-09-07','Labor Day',false),
  ('2026-11-26','Thanksgiving',false),
  ('2026-11-27','Day after Thanksgiving',true),
  ('2026-12-24','Christmas Eve',true),
  ('2026-12-25','Christmas Day',false),
  ('2027-01-01','New Year''s Day',false),
  ('2027-01-18','MLK Day',false),
  ('2027-02-15','Presidents Day',false),
  ('2027-03-26','Good Friday',false),
  ('2027-05-31','Memorial Day',false),
  ('2027-06-18','Juneteenth (observed)',false),
  ('2027-07-05','Independence Day (observed)',false),
  ('2027-09-06','Labor Day',false),
  ('2027-11-25','Thanksgiving',false),
  ('2027-11-26','Day after Thanksgiving',true),
  ('2027-12-24','Christmas Eve (observed)',false)
ON CONFLICT (holiday_date) DO NOTHING;