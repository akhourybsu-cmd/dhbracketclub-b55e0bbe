import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ── Cron secret gate (invoked by pg_cron only) ──
  const expected = Deno.env.get("CRON_SHARED_SECRET");
  const provided = req.headers.get("x-cron-secret") || "";
  if (!expected || provided !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(JSON.stringify({ error: "Missing VAPID config" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    webpush.setVapidDetails("https://dryhorse.app", vapidPublicKey, vapidPrivateKey);
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find today's lockbox day
    const now = new Date();
    const yearStart = new Date(Date.UTC(now.getFullYear(), 0, 1));
    const startOfDay = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const dayOfYear = Math.ceil((startOfDay.getTime() - yearStart.getTime()) / 86400000) + 1;

    const { data: day } = await supabase
      .from("lockbox_weeks")
      .select("id")
      .eq("week_number", dayOfYear)
      .eq("year", now.getFullYear())
      .maybeSingle();

    if (!day) {
      return new Response(JSON.stringify({ message: "No active day found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all users who have created a lock today
    const { data: todayLocks } = await supabase
      .from("lockbox_locks")
      .select("user_id")
      .eq("week_id", day.id);

    const usersWithLocks = new Set((todayLocks || []).map((l: any) => l.user_id));

    // Every club member who still has no lock — not just the few with a push
    // subscription, so the in-app inbox reaches everyone.
    const { data: members } = await supabase.from("club_members").select("user_id");
    const targets = [...new Set((members || []).map((m: any) => m.user_id).filter(Boolean))]
      .filter((uid: string) => !usersWithLocks.has(uid));

    if (targets.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "Everyone already locked in" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // send-push-notification owns preference filtering, inbox rows, delivery
    // and expired-subscription cleanup.
    const result = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-cron-secret": expected },
      body: JSON.stringify({
        type: "lockbox",
        title: "🔒 Don't Forget Your Lock!",
        message: "Set up today's Lockbox defense before time runs out.",
        url: "/lockbox",
        tag: "dh-lockbox-reminder",
        target_user_ids: targets,
      }),
    }).then((r) => r.json()).catch(() => ({}));

    return new Response(JSON.stringify({ ok: true, targets: targets.length, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Lockbox reminder error:", error);
    return new Response(JSON.stringify({ error: error?.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
