// Server-authoritative Portfolio Wars trade execution.
// Verifies the caller, fetches a live quote, then records the fill through pw_place_trade.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { stampEquityPoint } from "../_shared/pwSnapshot.ts";

const FINNHUB = "https://finnhub.io/api/v1";

const BodySchema = z.object({
  season_id: z.string().uuid(),
  symbol: z.string().min(1).max(10).regex(/^[A-Za-z.\-]{1,10}$/),
  side: z.enum(["buy", "sell"]),
  shares: z.number().positive().max(1_000_000).optional(),
  amount: z.number().positive().max(10_000_000).optional(),
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
  const { season_id, side } = parsed.data;
  const symbol = parsed.data.symbol.toUpperCase();
  if (!parsed.data.shares && !parsed.data.amount) {
    return json({ error: "Provide either shares or a dollar amount" }, 400);
  }

  const key = Deno.env.get("FINNHUB_API_KEY");
  if (!key) return json({ error: "Market data is not configured" }, 500);

  // Live fill price
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

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // Keep the quote cache warm so every viewer sees this price too.
  await admin.from("pw_quotes").upsert(
    { symbol, price, fetched_at: new Date().toISOString() },
    { onConflict: "symbol" },
  );

  const { data, error } = await admin.rpc("pw_place_trade", {
    _user_id: user.id,
    _season_id: season_id,
    _symbol: symbol,
    _side: side,
    _shares: shares,
    _price: price,
  });
  if (error) return json({ error: error.message }, 400);

  const { data: pf } = await admin.from("pw_portfolios")
    .select("id").eq("season_id", season_id).eq("user_id", user.id).maybeSingle();
  if (pf) await stampEquityPoint(admin, (pf as { id: string }).id);

  return json(data ?? { ok: true });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
