// Quarterly season lifecycle for Portfolio Wars: close finished seasons with final ranks,
// then open the current quarter for every club that has played before.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const etDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  const [year, month] = etDate.split("-").map(Number);
  const quarter = Math.ceil(month / 3);

  // 1. Close seasons whose end date has passed.
  const { data: expiring } = await admin
    .from("pw_seasons").select("id, club_id").eq("status", "active").lt("ends_on", etDate);
  const closed: string[] = [];
  for (const s of expiring ?? []) {
    const season = s as { id: string; club_id: string };
    const { data: portfolios } = await admin
      .from("pw_portfolios").select("id, total_value")
      .eq("season_id", season.id)
      .order("total_value", { ascending: false });
    let rank = 0;
    for (const p of portfolios ?? []) {
      rank += 1;
      await admin.from("pw_portfolios").update({ final_rank: rank })
        .eq("id", (p as { id: string }).id);
    }
    await admin.from("pw_seasons")
      .update({ status: "completed", finalized_at: new Date().toISOString() })
      .eq("id", season.id);
    closed.push(season.id);
  }

  // 2. Open the current quarter for clubs that have any Portfolio Wars history.
  const { data: clubs } = await admin.from("pw_seasons").select("club_id, starting_cash");
  const seen = new Map<string, number>();
  for (const c of clubs ?? []) {
    const row = c as { club_id: string; starting_cash: number };
    if (!seen.has(row.club_id)) seen.set(row.club_id, Number(row.starting_cash) || 50000);
  }
  const startsOn = `${year}-${String((quarter - 1) * 3 + 1).padStart(2, "0")}-01`;
  const endMonth = quarter * 3;
  const endsOn = new Date(Date.UTC(year, endMonth, 0)).toISOString().slice(0, 10);

  const opened: string[] = [];
  for (const [clubId, cash] of seen) {
    const { data: existing } = await admin.from("pw_seasons").select("id, status")
      .eq("club_id", clubId).eq("year", year).eq("quarter", quarter).maybeSingle();
    if (existing) {
      if ((existing as { status: string }).status === "upcoming") {
        await admin.from("pw_seasons").update({ status: "active" })
          .eq("id", (existing as { id: string }).id);
        opened.push(clubId);
      }
      continue;
    }
    const { error } = await admin.from("pw_seasons").insert({
      club_id: clubId, year, quarter, starts_on: startsOn, ends_on: endsOn,
      status: "active", starting_cash: cash,
    });
    if (!error) opened.push(clubId);
  }

  return new Response(JSON.stringify({ ok: true, year, quarter, closed, opened }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
