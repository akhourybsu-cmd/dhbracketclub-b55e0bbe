// Works Portfolio Wars resting orders and price alerts.
// Run on a schedule during market hours: fills target-price orders, releases orders
// queued while the market was closed, expires day orders, and fires price alerts.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { etDate, isMarketOpen } from "../_shared/pwMarket.ts";

const FINNHUB = "https://finnhub.io/api/v1";

interface OrderRow {
  id: string;
  season_id: string;
  club_id: string;
  portfolio_id: string;
  user_id: string;
  symbol: string;
  side: "buy" | "sell";
  order_type: "market" | "limit";
  shares: number | null;
  amount: number | null;
  limit_price: number | null;
  time_in_force: "day" | "gtc";
  placed_on: string;
}

interface AlertRow {
  id: string;
  user_id: string;
  club_id: string;
  symbol: string;
  direction: "above" | "below";
  target_price: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const expectedCron = Deno.env.get("CRON_SHARED_SECRET");
  if (!expectedCron || (req.headers.get("x-cron-secret") || "") !== expectedCron) {
    return json({ error: "Unauthorized" }, 401);
  }

  const key = Deno.env.get("FINNHUB_API_KEY");
  if (!key) return json({ error: "FINNHUB_API_KEY not configured" }, 500);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const today = etDate();
  const open = isMarketOpen();

  const { data: orderRows } = await admin.from("pw_orders")
    .select("id, season_id, club_id, portfolio_id, user_id, symbol, side, order_type, shares, amount, limit_price, time_in_force, placed_on")
    .eq("status", "open").limit(500);
  const orders = (orderRows ?? []) as OrderRow[];

  const { data: alertRows } = await admin.from("pw_price_alerts")
    .select("id, user_id, club_id, symbol, direction, target_price")
    .eq("status", "armed").limit(500);
  const alerts = (alertRows ?? []) as AlertRow[];

  // Expire day orders left over from a previous session.
  const staleDay = orders.filter((o) => o.time_in_force === "day" && o.placed_on < today);
  for (const o of staleDay) {
    await admin.from("pw_orders")
      .update({ status: "expired", reject_reason: "Day order expired unfilled" }).eq("id", o.id);
  }
  const working = orders.filter((o) => !staleDay.some((s) => s.id === o.id));

  if (!open) {
    return json({ ok: true, market_open: false, expired: staleDay.length, filled: 0, alerts_triggered: 0 });
  }

  // One quote per distinct symbol across orders and alerts.
  const symbols = [...new Set([...working.map((o) => o.symbol), ...alerts.map((a) => a.symbol)])];
  const prices = new Map<string, number>();
  for (let i = 0; i < symbols.length; i += 8) {
    const batch = symbols.slice(i, i + 8);
    await Promise.all(batch.map(async (symbol) => {
      try {
        const res = await fetch(`${FINNHUB}/quote?symbol=${encodeURIComponent(symbol)}&token=${key}`);
        if (!res.ok) return;
        const q = await res.json();
        if (typeof q?.c === "number" && q.c > 0) prices.set(symbol, q.c);
      } catch { /* skip this symbol on this tick */ }
    }));
  }

  const stamp = new Date().toISOString();
  const quoteRows = [...prices.entries()].map(([symbol, price]) => ({ symbol, price, fetched_at: stamp }));
  if (quoteRows.length) await admin.from("pw_quotes").upsert(quoteRows, { onConflict: "symbol" });

  // Fill eligible orders.
  let filled = 0;
  const rejected: string[] = [];
  for (const o of working) {
    const price = prices.get(o.symbol);
    if (!price) continue;
    if (o.order_type === "limit" && o.limit_price != null) {
      const target = Number(o.limit_price);
      const triggered = o.side === "buy" ? price <= target : price >= target;
      if (!triggered) continue;
    }
    const shares = o.shares != null
      ? Math.round(Number(o.shares) * 1e6) / 1e6
      : Math.round((Number(o.amount) / price) * 1e6) / 1e6;
    if (!shares || shares <= 0) {
      await admin.from("pw_orders")
        .update({ status: "rejected", reject_reason: "Order size rounded to zero" }).eq("id", o.id);
      continue;
    }

    const { error } = await admin.rpc("pw_place_trade", {
      _user_id: o.user_id,
      _season_id: o.season_id,
      _symbol: o.symbol,
      _side: o.side,
      _shares: shares,
      _price: price,
    });
    if (error) {
      await admin.from("pw_orders")
        .update({ status: "rejected", reject_reason: error.message }).eq("id", o.id);
      rejected.push(o.id);
      await notify(expectedCron, o.user_id, o.club_id,
        `${o.side === "buy" ? "Buy" : "Sell"} order for ${o.symbol} could not fill`,
        error.message, "/portfolio-wars/orders");
      continue;
    }

    await admin.from("pw_orders").update({
      status: "filled", filled_shares: shares, filled_price: price, filled_at: new Date().toISOString(),
    }).eq("id", o.id);
    filled += 1;
    await stampEquityPoint(admin, o.portfolio_id);
    await notify(expectedCron, o.user_id, o.club_id,
      `${o.side === "buy" ? "Bought" : "Sold"} ${trimShares(shares)} ${o.symbol}`,
      `Filled at $${price.toFixed(2)}`, "/portfolio-wars/orders");
  }

  // Fire price alerts.
  let triggeredCount = 0;
  for (const a of alerts) {
    const price = prices.get(a.symbol);
    if (!price) continue;
    const hit = a.direction === "above" ? price >= Number(a.target_price) : price <= Number(a.target_price);
    if (!hit) continue;
    await admin.from("pw_price_alerts").update({
      status: "triggered", triggered_at: new Date().toISOString(), triggered_price: price,
    }).eq("id", a.id);
    triggeredCount += 1;
    await notify(expectedCron, a.user_id, a.club_id,
      `${a.symbol} is ${a.direction} $${Number(a.target_price).toFixed(2)}`,
      `Trading at $${price.toFixed(2)}`, `/portfolio-wars/stock/${a.symbol}`);
  }

  return json({
    ok: true, market_open: true, symbols: symbols.length,
    filled, rejected: rejected.length, expired: staleDay.length, alerts_triggered: triggeredCount,
  });
});

function trimShares(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

async function notify(
  cronSecret: string, userId: string, clubId: string, title: string, message: string, url: string,
) {
  try {
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push-notification`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-cron-secret": cronSecret },
      body: JSON.stringify({
        type: "portfolio_wars",
        title,
        message,
        url,
        club_id: clubId,
        target_user_ids: [userId],
      }),
    });
  } catch (e) {
    console.error("notify failed", e instanceof Error ? e.message : e);
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
