-- Watchlists
CREATE TABLE public.pw_watchlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pw_watchlists_user_idx ON public.pw_watchlists(user_id, club_id, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pw_watchlists TO authenticated;
GRANT ALL ON public.pw_watchlists TO service_role;
ALTER TABLE public.pw_watchlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage their own watchlists" ON public.pw_watchlists
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.pw_watchlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  watchlist_id uuid NOT NULL REFERENCES public.pw_watchlists(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  symbol text NOT NULL,
  note text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (watchlist_id, symbol)
);
CREATE INDEX pw_watchlist_items_list_idx ON public.pw_watchlist_items(watchlist_id, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pw_watchlist_items TO authenticated;
GRANT ALL ON public.pw_watchlist_items TO service_role;
ALTER TABLE public.pw_watchlist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage their own watchlist items" ON public.pw_watchlist_items
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Orders (market / limit / queued-for-open)
CREATE TABLE public.pw_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.pw_seasons(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  portfolio_id uuid NOT NULL REFERENCES public.pw_portfolios(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  symbol text NOT NULL,
  side text NOT NULL CHECK (side IN ('buy','sell')),
  order_type text NOT NULL CHECK (order_type IN ('market','limit')),
  shares numeric(18,6),
  amount numeric(18,2),
  limit_price numeric(18,4),
  time_in_force text NOT NULL DEFAULT 'gtc' CHECK (time_in_force IN ('day','gtc')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','filled','cancelled','expired','rejected')),
  filled_shares numeric(18,6),
  filled_price numeric(18,4),
  filled_at timestamptz,
  reject_reason text,
  placed_on date NOT NULL DEFAULT (now() AT TIME ZONE 'America/New_York')::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pw_orders_open_idx ON public.pw_orders(status, symbol);
CREATE INDEX pw_orders_user_idx ON public.pw_orders(user_id, season_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.pw_orders TO authenticated;
GRANT ALL ON public.pw_orders TO service_role;
ALTER TABLE public.pw_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read their own orders" ON public.pw_orders
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Members cancel their own open orders" ON public.pw_orders
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Price alerts
CREATE TABLE public.pw_price_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('above','below')),
  target_price numeric(18,4) NOT NULL CHECK (target_price > 0),
  status text NOT NULL DEFAULT 'armed' CHECK (status IN ('armed','triggered','cancelled')),
  triggered_at timestamptz,
  triggered_price numeric(18,4),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pw_price_alerts_armed_idx ON public.pw_price_alerts(status, symbol);
CREATE INDEX pw_price_alerts_user_idx ON public.pw_price_alerts(user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pw_price_alerts TO authenticated;
GRANT ALL ON public.pw_price_alerts TO service_role;
ALTER TABLE public.pw_price_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage their own price alerts" ON public.pw_price_alerts
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER pw_watchlists_updated_at BEFORE UPDATE ON public.pw_watchlists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER pw_orders_updated_at BEFORE UPDATE ON public.pw_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER pw_price_alerts_updated_at BEFORE UPDATE ON public.pw_price_alerts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();