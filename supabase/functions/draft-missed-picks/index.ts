import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { aiGate, logAiUsage } from "../_shared/aiUsage.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const MODEL = "google/gemini-2.5-pro";
const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").replace(/^the /, "").trim();

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "Unauthorized" }, 401);
    const { draft_id, force } = await req.json();
    if (!draft_id) return json({ error: "draft_id required" }, 400);

    // Visibility enforced by RLS on the caller's own client.
    const { data: draft } = await userClient.from("drafts").select("*").eq("id", draft_id).maybeSingle();
    if (!draft) return json({ error: "Draft not found" }, 404);
    if (draft.status !== "complete") return json({ error: "Draft is not complete" }, 400);
    if (Array.isArray(draft.missed_picks) && !force) return json({ missed_picks: draft.missed_picks });

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json({ error: "AI not configured" }, 500);
    const gate = await aiGate(userClient);
    if (!gate.enabled) return json({ error: "AI is turned off for this club" }, 403);

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: picks } = await admin.from("draft_picks").select("pick_text").eq("draft_id", draft_id);
    const taken = (picks ?? []).map((p: any) => String(p.pick_text));
    const takenSet = new Set(taken.map(norm));
    const context = [draft.description, draft.ai_context, draft.judging_context].filter(Boolean).join("\n");
    const today = new Date().toISOString().slice(0, 10);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: `Today is ${today}. You are a draft analyst. Identify the strongest standalone answers to a draft topic that NOBODY selected. Never list anything already picked, including alternate spellings, abbreviations, or the same entity under another name. Only list real, legitimate entrants for the topic.` },
          { role: "user", content: `Draft topic: ${draft.topic}\n${context ? `Scope notes: ${context}\n` : ""}Already picked (${taken.length}):\n${taken.map(t => `- ${t}`).join("\n")}\n\nReturn up to 8 of the best elite-level picks that were left on the board, best first, each with a one-sentence reason and a 1–10 standalone score.` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "missed_picks",
            parameters: {
              type: "object",
              properties: {
                picks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: { name: { type: "string" }, reason: { type: "string" }, score: { type: "number" } },
                    required: ["name", "reason", "score"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["picks"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "missed_picks" } },
      }),
    });
    const data = res.ok ? await res.json() : null;
    await logAiUsage({ functionName: "draft-missed-picks", model: MODEL, userId: u.user.id, clubId: gate.clubId }, data, { success: res.ok });
    if (res.status === 429) return json({ error: "AI is busy right now. Try again shortly." }, 429);
    if (res.status === 402) return json({ error: "AI credits are exhausted." }, 402);
    if (!data) return json({ error: "AI analysis failed" }, 502);

    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const parsed = typeof args === "string" ? JSON.parse(args) : args;
    const seen = new Set<string>();
    const missed = (parsed?.picks ?? [])
      .filter((p: any) => p && typeof p.name === "string" && p.name.trim())
      .filter((p: any) => { const n = norm(p.name); if (!n || takenSet.has(n) || seen.has(n)) return false; seen.add(n); return true; })
      .slice(0, 5)
      .map((p: any) => ({ name: p.name.trim(), reason: String(p.reason ?? "").trim(), score: Math.max(0, Math.min(10, Number(p.score) || 0)) }));

    await admin.from("drafts").update({ missed_picks: missed, missed_picks_generated_at: new Date().toISOString() }).eq("id", draft_id);
    return json({ missed_picks: missed });
  } catch (e) {
    console.error("draft-missed-picks", e);
    return json({ error: "Could not build the missed picks list" }, 500);
  }
});
