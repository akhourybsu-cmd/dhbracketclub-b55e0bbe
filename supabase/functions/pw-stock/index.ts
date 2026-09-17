// Stock detail data for Portfolio Wars: live quote, company profile, key stats,
// and a daily price history for the chart. Degrades gracefully when the upstream
// plan does not include a given endpoint.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const FINNHUB = "https://finnhub.io/api/v1";

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

  const url = new URL(req.url);
  let body: Record<string, unknown> = {};
  if (req.method === "POST") body = await req.json().catch(() => ({}));
  const symbol = String(body.symbol ?? url.searchParams.get("symbol") ?? "").toUpperCase().trim();
  if (!symbol || !/^[A-Z.\-]{1,10}$/.test(symbol)) return json({ error: "Invalid symbol" }, 400);
  const range = (body.range ?? url.searchParams.get("range")) === "1y" ? "1y" : "3m";

  const key = Deno.env.get("FINNHUB_API_KEY");
  if (!key) return json({ error: "Market data is not configured" }, 500);

  const now = Math.floor(Date.now() / 1000);
  const from = now - (range === "1y" ? 400 : 100) * 86400;

  const [quoteRes, profileRes, metricRes, candleRes] = await Promise.all([
    safeJson(`${FINNHUB}/quote?symbol=${encodeURIComponent(symbol)}&token=${key}`),
    safeJson(`${FINNHUB}/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${key}`),
    safeJson(`${FINNHUB}/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all&token=${key}`),
    safeJson(`${FINNHUB}/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${from}&to=${now}&token=${key}`),
  ]);

  const q = (quoteRes ?? {}) as Record<string, number>;
  let price = typeof q.c === "number" && q.c > 0 ? q.c : null;
  let open = q.o ?? null;
  let high = q.h ?? null;
  let low = q.l ?? null;
  let prevClose = q.pc ?? null;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  if (!price) {
    // Live feed came back empty (rate limit, or a symbol the plan omits) —
    // fall back to the last price the app already cached.
    const { data: cached } = await admin.from("pw_quotes")
      .select("price, open, high, low, prev_close").eq("symbol", symbol).maybeSingle();
    if (cached?.price) {
      price = Number(cached.price);
      open = open ?? cached.open;
      high = high ?? cached.high;
      low = low ?? cached.low;
      prevClose = prevClose ?? cached.prev_close;
    }
  } else {
    await admin.from("pw_quotes").upsert({
      symbol, price, prev_close: prevClose, open, high, low,
      fetched_at: new Date().toISOString(),
    }, { onConflict: "symbol" });
  }

  const candle = candleRes as { s?: string; t?: number[]; c?: number[] } | null;
  const series = candle?.s === "ok" && Array.isArray(candle.t) && Array.isArray(candle.c)
    ? candle.t.map((t, i) => ({ t: t * 1000, c: candle.c![i] })).filter((p) => typeof p.c === "number")
    : [];

  const profile = (profileRes ?? {}) as Record<string, unknown>;
  const metrics = ((metricRes as { metric?: Record<string, number> } | null)?.metric ?? {});

  return json({
    symbol,
    price,
    open,
    high,
    low,
    prev_close: prevClose,
    profile: {
      name: (profile.name as string) ?? null,
      exchange: (profile.exchange as string) ?? null,
      industry: (profile.finnhubIndustry as string) ?? null,
      logo: (profile.logo as string) ?? null,
      market_cap: (profile.marketCapitalization as number) ?? null,
      ipo: (profile.ipo as string) ?? null,
      weburl: (profile.weburl as string) ?? null,
    },
    stats: {
      week52_high: metrics["52WeekHigh"] ?? null,
      week52_low: metrics["52WeekLow"] ?? null,
      pe: metrics.peTTM ?? metrics.peBasicExclExtraTTM ?? null,
      beta: metrics.beta ?? null,
      dividend_yield: metrics.dividendYieldIndicatedAnnual ?? null,
      avg_volume_10d: metrics["10DayAverageTradingVolume"] ?? null,
    },
    series,
    range,
  });
});

async function safeJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
