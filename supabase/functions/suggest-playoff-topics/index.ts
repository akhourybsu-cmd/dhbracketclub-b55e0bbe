// Returns 3 fresh AI-generated draft topic options for a playoff matchup.
// Filters against prior season topics + already-used playoff topics for variety.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { aiGate, logAiUsage } from "../_shared/aiUsage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // ── Auth gate: require a valid signed-in user (prevents anonymous AI cost abuse) ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: authedUser }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !authedUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let payload: { seasonId?: unknown; matchId?: unknown };
    try { payload = await req.json(); } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const seasonId = typeof payload.seasonId === "string" ? payload.seasonId : "";
    const matchId = typeof payload.matchId === "string" ? payload.matchId : "";
    if (!seasonId || !matchId) {
      return new Response(JSON.stringify({ error: "seasonId and matchId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Per-user AI rate limit (lightweight cost cap) ──
    const gate = await aiGate(userClient);
    if (!gate.enabled) {
      return new Response(JSON.stringify({ error: "AI features are turned off for this club." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: quota } = await userClient.rpc("consume_ai_quota", {
      _function_name: "suggest-playoff-topics", _max_requests: 10, _window_minutes: 60,
    });
    if (quota && quota.allowed === false) {
      return new Response(JSON.stringify({
        error: "Rate limit reached", retry_after: quota.retry_after, remaining: 0,
      }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Pull topics used in THIS season + ALL prior seasons (regular + playoffs)
    // so the AI never proposes a category we've already drafted league-wide.
    const { data: allEntries } = await supabase
      .from("draft_season_entries")
      .select("drafts:draft_id(topic, category)");
    const usedTopics = Array.from(new Set(
      (allEntries || [])
        .map((e: any) => e.drafts?.topic)
        .filter(Boolean) as string[]
    ));
    const usedCategories = Array.from(new Set(
      (allEntries || [])
        .map((e: any) => e.drafts?.category)
        .filter(Boolean) as string[]
    ));

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const prompt = `Generate 3 fresh, fun, creative DRAFT topics for a head-to-head pick'em matchup between two friends. Each topic should be a "Top 5" style list where players draft picks one at a time.

Topics should be:
- Universally fun and debatable (movies, music, food, sports, pop culture, life experiences, etc.)
- Specific enough to draft 5 distinct items
- NOT serious or work-related
- Varied across categories
- COMPLETELY DIFFERENT in subject matter from any topic or category already used in past seasons (see lists below). Do not propose minor rewordings, sub-variants, or topics in the same broad category — pick a brand new angle.

ALREADY-USED TOPICS (across all seasons — do NOT repeat or rephrase any of these):
${usedTopics.map(t => `- ${t}`).join("\n") || "(none yet)"}

ALREADY-USED CATEGORIES (avoid these subject areas entirely):
${usedCategories.map(c => `- ${c}`).join("\n") || "(none yet)"}

Return ONLY a JSON object: { "topics": ["topic 1", "topic 2", "topic 3"] }
No prose, no markdown, just the JSON.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You generate fun draft topics. Reply ONLY with valid JSON." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI gateway error", aiRes.status, t);
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again shortly" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI request failed");
    }

    const aiData = await aiRes.json();
    await logAiUsage(
      { functionName: "suggest-playoff-topics", model: "google/gemini-2.5-flash", userId: authedUser.id, clubId: gate.clubId },
      aiData.usage,
    );
    const content = aiData.choices?.[0]?.message?.content || "{}";
    let parsed: { topics?: string[] };
    try { parsed = JSON.parse(content); } catch { parsed = {}; }
    const topics = Array.isArray(parsed.topics) ? parsed.topics.slice(0, 3) : [];

    if (topics.length < 3) {
      // Fallback if AI returned malformed
      const fallback = ["Top 5 Movies of All Time", "Top 5 Pizza Toppings", "Top 5 Vacation Destinations"];
      while (topics.length < 3) topics.push(fallback[topics.length]);
    }

    return new Response(JSON.stringify({ topics }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("suggest-playoff-topics error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
