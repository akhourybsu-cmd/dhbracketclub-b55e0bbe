// Ensures the caller's club has an active quarterly season and that the caller has a portfolio.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

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

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  let clubId: string | null = null;
  try {
    const body = await req.json();
    if (typeof body?.club_id === "string") clubId = body.club_id;
  } catch { /* optional body */ }

  // Confirm membership of the requested club (or fall back to the caller's only club).
  const { data: memberships } = await admin
    .from("club_members").select("club_id").eq("user_id", user.id);
  const clubIds = (memberships ?? []).map((m: { club_id: string }) => m.club_id);
  if (!clubIds.length) return json({ error: "You are not in a club yet" }, 403);
  if (!clubId) clubId = clubIds[0];
  if (!clubIds.includes(clubId)) return json({ error: "Not a member of that club" }, 403);

  const { data: seasonId, error: sErr } = await admin.rpc("pw_ensure_season", { _club_id: clubId });
  if (sErr) return json({ error: sErr.message }, 400);

  const { data: portfolioId, error: pErr } = await admin.rpc("pw_join_season", {
    _season_id: seasonId,
    _user_id: user.id,
  });
  if (pErr) return json({ error: pErr.message }, 400);

  return json({ ok: true, season_id: seasonId, portfolio_id: portfolioId });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
