// Nightly sync of the tradable US-listed symbol directory (Finnhub -> pw_symbols).
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const FINNHUB = "https://finnhub.io/api/v1";
const ALLOWED_TYPES = new Set(["Common Stock", "ADR", "REIT", "ETP", "ETF", ""]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const key = Deno.env.get("FINNHUB_API_KEY");
  if (!key) {
    return json({ error: "FINNHUB_API_KEY not configured" }, 500);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    const res = await fetch(`${FINNHUB}/stock/symbol?exchange=US&token=${key}`);
    if (!res.ok) return json({ error: `Finnhub ${res.status}` }, 502);
    const list = await res.json() as Array<{
      symbol: string; description: string; type: string; mic?: string;
    }>;

    const rows = list
      .filter((s) => s.symbol && /^[A-Z][A-Z.\-]{0,8}$/.test(s.symbol))
      .filter((s) => ALLOWED_TYPES.has(s.type ?? ""))
      .map((s) => ({
        symbol: s.symbol,
        name: (s.description ?? "").slice(0, 160),
        exchange: s.mic ?? "US",
        type: s.type ?? null,
        active: true,
        updated_at: new Date().toISOString(),
      }));

    let upserted = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await admin.from("pw_symbols").upsert(chunk, { onConflict: "symbol" });
      if (error) return json({ error: error.message, upserted }, 500);
      upserted += chunk.length;
    }

    return json({ ok: true, fetched: list.length, upserted });
  } catch (e) {
    return json({ error: String(e) }, 502);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
