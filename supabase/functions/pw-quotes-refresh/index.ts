// Refreshes the shared Portfolio Wars quote cache and revalues every active portfolio.
// Called by cron during market hours, and on demand by the app (short-circuits on fresh cache).
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const FINNHUB = "https://finnhub.io/api/v1";
const CACHE_MS = 15_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const key = Deno.env.get("FINNHUB_API_KEY");
  if (!key) return json({ error: "FINNHUB_API_KEY not configured" }, 500);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  let body: { symbols?: string[]; snapshot?: boolean; force?: boolean } = {};
  try { body = await req.json(); } catch { /* cron sends no body */ }

  // Symbols to refresh: everything currently held, plus anything explicitly requested.
  const wanted = new Set<string>(
    (body.symbols ?? [])
      .map((s) => String(s).toUpperCase().trim())
      .filter((s) => /^[A-Z][A-Z.\-]{0,8}$/.test(s)),
  );

  const { data: held } = await admin.from("pw_holdings").select("symbol");
  for (const h of held ?? []) wanted.add(String((h as { symbol: string }).symbol));

  const symbols = [...wanted];
  if (!symbols.length) {
    await revalue(admin);
    return json({ ok: true, refreshed: 0, revalued: true });
  }

  // Skip symbols whose cached price is still fresh.
  let stale = symbols;
  if (!body.force) {
    const { data: cached } = await admin
      .from("pw_quotes").select("symbol, fetched_at").in("symbol", symbols);
    const freshAt = new Map(
      (cached ?? []).map((q: { symbol: string; fetched_at: string }) => [q.symbol, Date.parse(q.fetched_at)]),
    );
    const now = Date.now();
    stale = symbols.filter((s) => now - (freshAt.get(s) ?? 0) > CACHE_MS);
  }

  const rows: Array<Record<string, unknown>> = [];
  const failed: string[] = [];
  for (let i = 0; i < stale.length; i += 8) {
    const batch = stale.slice(i, i + 8);
    const results = await Promise.all(batch.map(async (symbol) => {
      try {
        const res = await fetch(`${FINNHUB}/quote?symbol=${encodeURIComponent(symbol)}&token=${key}`);
        if (!res.ok) return { symbol, ok: false };
        const q = await res.json();
        if (typeof q.c !== "number" || q.c <= 0) return { symbol, ok: false };
        return { symbol, ok: true, q };
      } catch {
        return { symbol, ok: false };
      }
    }));
    for (const r of results) {
      if (!r.ok) { failed.push(r.symbol); continue; }
      const q = (r as { q: Record<string, number> }).q;
      rows.push({
        symbol: r.symbol,
        price: q.c,
        prev_close: q.pc ?? null,
        open: q.o ?? null,
        high: q.h ?? null,
        low: q.l ?? null,
        fetched_at: new Date().toISOString(),
      });
    }
  }

  if (rows.length) {
    const { error } = await admin.from("pw_quotes").upsert(rows, { onConflict: "symbol" });
    if (error) return json({ error: error.message }, 500);
  }

  await revalue(admin);
  if (body.snapshot) await snapshot(admin);

  return json({ ok: true, requested: symbols.length, refreshed: rows.length, failed });
});

/** Recompute cash + holdings value for every portfolio in an active season. */
async function revalue(admin: ReturnType<typeof createClient>) {
  const { data: seasons } = await admin.from("pw_seasons").select("id").eq("status", "active");
  const seasonIds = (seasons ?? []).map((s: { id: string }) => s.id);
  if (!seasonIds.length) return;

  const { data: portfolios } = await admin
    .from("pw_portfolios").select("id, cash").in("season_id", seasonIds);
  if (!portfolios?.length) return;

  const ids = portfolios.map((p: { id: string }) => p.id);
  const { data: holdings } = await admin
    .from("pw_holdings").select("portfolio_id, symbol, shares, avg_cost").in("portfolio_id", ids);
  const { data: quotes } = await admin.from("pw_quotes").select("symbol, price");
  const priceOf = new Map((quotes ?? []).map((q: { symbol: string; price: number }) => [q.symbol, Number(q.price)]));

  const holdingsValue = new Map<string, number>();
  for (const h of holdings ?? []) {
    const row = h as { portfolio_id: string; symbol: string; shares: number; avg_cost: number };
    const price = priceOf.get(row.symbol) ?? Number(row.avg_cost);
    holdingsValue.set(row.portfolio_id, (holdingsValue.get(row.portfolio_id) ?? 0) + Number(row.shares) * price);
  }

  const now = new Date().toISOString();
  for (const p of portfolios) {
    const row = p as { id: string; cash: number };
    const hv = round2(holdingsValue.get(row.id) ?? 0);
    await admin.from("pw_portfolios").update({
      holdings_value: hv,
      total_value: round2(Number(row.cash) + hv),
      valued_at: now,
    }).eq("id", row.id);
  }
}

/** Store today's closing value for the equity curve. */
async function snapshot(admin: ReturnType<typeof createClient>) {
  const { data: seasons } = await admin.from("pw_seasons").select("id").eq("status", "active");
  const seasonIds = (seasons ?? []).map((s: { id: string }) => s.id);
  if (!seasonIds.length) return;
  const { data: portfolios } = await admin
    .from("pw_portfolios").select("id, club_id, total_value").in("season_id", seasonIds);
  if (!portfolios?.length) return;
  const tradingDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  await admin.from("pw_daily_values").upsert(
    portfolios.map((p: { id: string; club_id: string; total_value: number }) => ({
      portfolio_id: p.id, club_id: p.club_id, trading_date: tradingDate, value: p.total_value,
    })),
    { onConflict: "portfolio_id,trading_date" },
  );
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
