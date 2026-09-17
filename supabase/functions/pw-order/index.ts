// Places a Portfolio Wars order.
// Market orders fill instantly while the market is open; anything else is recorded as a
// resting order that pw-orders-tick fills later (target price, or next market open).
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { etDate, isMarketOpen } from "../_shared/pwMarket.ts";

const FINNHUB = "https://finnhub.io/api/v1";

const BodySchema = z.object({
  season_id: z.string().uuid(),
  symbol: z.string().min(1).max(10).regex(/^[A-Za-z.\-]{1,10}$/),
  side: z.enum(["buy", "sell"]),
  order_type: z.enum(["market", "limit"]).default("market"),
  shares: z.number().positive().max(1_000_000).optional(),
  amount: z.number().positive().max(10_000_000).optional(),
  limit_price: z.number().positive().max(1_000_000).optional(),
  time_in_force: z.enum(["day", "gtc"]).default("gtc"),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "",
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  let raw: unknown;
  try { raw = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);

  const { season_id, side, order_type, time_in_force } = parsed.data;
  const symbol = parsed.data.symbol.toUpperCase();
  if (!parsed.data.shares && !parsed.data.amount) {
    return json({ error: "Provide either shares or a dollar amount" }, 400);
  }
  if (order_type === "limit" && !parsed.data.limit_price) {
    return json({ error: "A target price is required for limit orders" }, 400);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: season } = await admin.from("pw_seasons")
    .select("id, club_id, status").eq("id", season_id).maybeSingle();
  if (!season || (season as { status: string }).status !== "active") {
    return json({ error: "This season is not open for trading" }, 400);
  }
  const clubId = (season as { club_id: string }).club_id;

  const { data: portfolio } = await admin.from("pw_portfolios")
    .select("id").eq("season_id", season_id).eq("user_id", user.id).maybeSingle();
  if (!portfolio) return json({ error: "You do not have a portfolio in this season" }, 400);
  const portfolioId = (portfolio as { id: string }).id;

  const { data: sym } = await admin.from("pw_symbols")
    .select("symbol, active").eq("symbol", symbol).maybeSingle();
  if (!sym || (sym as { active: boolean }).active === false) {
    return json({ error: `${symbol} is not tradable in this league` }, 400);
  }

  const key = Deno.env.get("FINNHUB_API_KEY");
  const marketOpen = isMarketOpen();

  // Instant fill path: plain market order during trading hours.
  if (order_type === "market" && marketOpen) {
    if (!key) return json({ error: "Market data is not configured" }, 500);
    let price = 0;
    try {
      const res = await fetch(`${FINNHUB}/quote?symbol=${encodeURIComponent(symbol)}&token=${key}`);
      const q = await res.json();
      price = typeof q?.c === "number" ? q.c : 0;
    } catch { /* handled below */ }
    if (!price || price <= 0) return json({ error: `No live price available for ${symbol}` }, 502);

    const shares = parsed.data.shares
      ? Math.round(parsed.data.shares * 1e6) / 1e6
      : Math.round((parsed.data.amount! / price) * 1e6) / 1e6;
    if (shares <= 0) return json({ error: "Order is too small" }, 400);

    await admin.from("pw_quotes").upsert(
      { symbol, price, fetched_at: new Date().toISOString() },
      { onConflict: "symbol" },
    );

    const { data: fill, error } = await admin.rpc("pw_place_trade", {
      _user_id: user.id,
      _season_id: season_id,
      _symbol: symbol,
      _side: side,
      _shares: shares,
      _price: price,
    });
    if (error) return json({ error: error.message }, 400);

    await admin.from("pw_orders").insert({
      season_id, club_id: clubId, portfolio_id: portfolioId, user_id: user.id,
      symbol, side, order_type: "market", shares, amount: parsed.data.amount ?? null,
      time_in_force, status: "filled",
      filled_shares: shares, filled_price: price, filled_at: new Date().toISOString(),
      placed_on: etDate(),
    });

    return json({ ok: true, status: "filled", fill: fill ?? null });
  }

  // Resting order: limit order, or a market order queued for the next open.
  const { count: openCount } = await admin.from("pw_orders")
    .select("id", { count: "exact", head: true })
    .eq("portfolio_id", portfolioId).eq("status", "open");
  if ((openCount ?? 0) >= 20) {
    return json({ error: "You already have 20 working orders. Cancel one first." }, 400);
  }

  const { data: order, error: insertError } = await admin.from("pw_orders").insert({
    season_id, club_id: clubId, portfolio_id: portfolioId, user_id: user.id,
    symbol, side, order_type,
    shares: parsed.data.shares ?? null,
    amount: parsed.data.amount ?? null,
    limit_price: parsed.data.limit_price ?? null,
    time_in_force, status: "open", placed_on: etDate(),
  }).select("*").single();
  if (insertError) return json({ error: insertError.message }, 400);

  return json({ ok: true, status: "open", order, market_open: marketOpen });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
