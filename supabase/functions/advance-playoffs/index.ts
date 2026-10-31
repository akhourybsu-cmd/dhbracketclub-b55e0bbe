// Advance a season's playoffs: trigger transition, set winners, generate next round.
// Higher seed picks topic for each match. Finals = best-of-3 with rotating picker.
// Idempotent — safe to call repeatedly.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Returns the user with the better (lower-numbered) seed. */
function higherSeedUser(userA: string, seedA: number, userB: string, seedB: number): string {
  return seedA <= seedB ? userA : userB;
}
function lowerSeedUser(userA: string, seedA: number, userB: string, seedB: number): string {
  return seedA <= seedB ? userB : userA;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // ── Auth gate: require a signed-in user. Function is idempotent reconciliation
    // logic invoked by any logged-in user viewing draft pages, so user-level auth
    // (not admin) is the correct boundary. Prevents anonymous state-write abuse. ──
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

    let payload: { seasonId?: unknown };
    try { payload = await req.json(); } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const seasonId = typeof payload.seasonId === "string" ? payload.seasonId : "";
    if (!seasonId) {
      return new Response(JSON.stringify({ error: "seasonId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: season, error: sErr } = await supabase
      .from("draft_seasons").select("*").eq("id", seasonId).single();
    if (sErr || !season) throw new Error("season not found");

    const { data: activeClub, error: clubError } = await userClient.rpc("current_user_club_id");
    if (clubError || !activeClub || activeClub !== season.club_id) {
      return new Response(JSON.stringify({ error: "This season is outside your active club" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const log: string[] = [];
    let needsQfCheck = false;

    // ─── PHASE 1a: REGULAR → PLAYOFFS TRANSITION ───
    if (season.status === "regular_season") {
      const totalRegular = season.regular_season_drafts || season.regular_season_weeks || 12;
      const { data: regEntries } = await supabase
        .from("draft_season_entries")
        .select("draft_id, drafts:draft_id(status)")
        .eq("season_id", seasonId).eq("is_playoff", false);

      const completedCount = (regEntries || []).filter((e: any) => e.drafts?.status === "complete").length;

      if (completedCount >= totalRegular) {
        const { data: standings } = await supabase
          .from("draft_season_standings").select("*")
          .eq("season_id", seasonId)
          .order("season_points", { ascending: false })
          .order("wins", { ascending: false })
          .order("podiums", { ascending: false })
          .order("avg_finish", { ascending: true })
          .order("avg_score", { ascending: false })
          .limit(5);

        if (!standings || standings.length < 2) {
          return new Response(JSON.stringify({ status: "waiting", reason: "not enough qualifiers" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        for (let i = 0; i < standings.length; i++) {
          await supabase.from("draft_season_standings")
            .update({ playoff_seed: i + 1, rank: i + 1 })
            .eq("id", standings[i].id);
        }

        await supabase.from("draft_seasons").update({ status: "playoffs" }).eq("id", seasonId);
        season.status = "playoffs";
        log.push("transitioned to playoffs");
        needsQfCheck = true;
      } else {
        return new Response(JSON.stringify({ status: "waiting", completed: completedCount, target: totalRegular }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (season.status === "playoffs") {
      needsQfCheck = true;
    }

    // ─── PHASE 1b: SELF-HEAL — ensure QF exists whenever season is in playoffs ───
    if (needsQfCheck) {
      const { data: existingQF } = await supabase
        .from("draft_playoff_matches").select("id")
        .eq("season_id", seasonId).eq("round", "qf");

      if (!existingQF || existingQF.length === 0) {
        const { data: seededStandings } = await supabase
          .from("draft_season_standings").select("*")
          .eq("season_id", seasonId)
          .not("playoff_seed", "is", null)
          .order("playoff_seed", { ascending: true })
          .limit(5);

        const seed4 = seededStandings?.find((s: any) => s.playoff_seed === 4);
        const seed5 = seededStandings?.find((s: any) => s.playoff_seed === 5);
        if (seed4 && seed5) {
          await supabase.from("draft_playoff_matches").insert({
            season_id: seasonId,
            round: "qf",
            match_number: 1,
            seed_a: 4,
            seed_b: 5,
            user_a: seed4.user_id,
            user_b: seed5.user_id,
            topic_picker_user_id: seed4.user_id,
            status: "awaiting_topic",
          });
          log.push("self-healed: created QF (awaiting topic)");
        } else {
          log.push("self-heal skipped: seeds 4/5 not assigned");
        }
      }
    }

    // ─── PHASE 2: SCORE COMPLETED MATCHES ───
    const { data: matches } = await supabase
      .from("draft_playoff_matches").select("*")
      .eq("season_id", seasonId)
      .order("round").order("match_number");

    if (!matches) {
      return new Response(JSON.stringify({ status: "ok", log }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const m of matches) {
      if (m.draft_id && m.status !== "complete") {
        const { data: draftRow } = await supabase
          .from("drafts").select("status").eq("id", m.draft_id).single();
        if (draftRow?.status === "complete") {
          const { data: results } = await supabase
            .from("draft_results").select("user_id, total_score")
            .eq("draft_id", m.draft_id);
          if (results && results.length > 0) {
            const sorted = [...results].sort((a: any, b: any) => Number(b.total_score) - Number(a.total_score));
            const winner = sorted[0].user_id;
            const loser = winner === m.user_a ? m.user_b : m.user_a;
            await supabase.from("draft_playoff_matches").update({
              winner_user_id: winner,
              status: "complete",
            }).eq("id", m.id);
            m.winner_user_id = winner;
            m.status = "complete";
            log.push(`scored ${m.round} M${m.match_number}, winner ${winner}`);

            // Mark loser eliminated (except in finals — both finalists already medaled,
            // and 3rd-place loser gets eliminated too). Skip if loser hasn't lost the series in finals.
            if (loser && m.round !== "final") {
              await supabase.from("draft_season_standings")
                .update({ is_eliminated: true })
                .eq("season_id", seasonId)
                .eq("user_id", loser);
            }
          }
        } else if (draftRow?.status === "in_progress" && m.status === "pending") {
          // Sync match status to in_progress when draft has started
          await supabase.from("draft_playoff_matches")
            .update({ status: "in_progress" })
            .eq("id", m.id);
          m.status = "in_progress";
          log.push(`${m.round} M${m.match_number} → in_progress`);
        }
      }
    }

    // Refresh standings to know seeds
    const { data: top5 } = await supabase
      .from("draft_season_standings").select("*")
      .eq("season_id", seasonId)
      .not("playoff_seed", "is", null)
      .order("playoff_seed");

    const seedUser = (n: number) => top5?.find((s: any) => s.playoff_seed === n)?.user_id as string | undefined;

    const qfMatches = matches.filter((m: any) => m.round === "qf");
    const sfMatches = matches.filter((m: any) => m.round === "sf");
    const finalMatches = matches.filter((m: any) => m.round === "final").sort((a: any, b: any) => a.match_number - b.match_number);
    const thirdPlaceMatches = matches.filter((m: any) => m.round === "third_place");

    const qfDone = qfMatches.length > 0 && qfMatches.every((m: any) => m.status === "complete");
    const sfDone = sfMatches.length === 2 && sfMatches.every((m: any) => m.status === "complete");

    // ─── PHASE 3: GENERATE SEMIS ───
    if (qfDone && sfMatches.length === 0) {
      const qfWinner = qfMatches[0].winner_user_id as string;
      const qfWinnerSeed = qfWinner === qfMatches[0].user_a ? qfMatches[0].seed_a : qfMatches[0].seed_b;
      const seed1 = seedUser(1);
      const seed2 = seedUser(2);
      const seed3 = seedUser(3);

      if (seed1 && seed2 && seed3 && qfWinner) {
        // SF1: #1 vs QF winner — picker = #1 (better seed)
        await supabase.from("draft_playoff_matches").insert({
          season_id: seasonId, round: "sf", match_number: 1,
          seed_a: 1, seed_b: qfWinnerSeed,
          user_a: seed1, user_b: qfWinner,
          topic_picker_user_id: seed1,
          status: "awaiting_topic",
        });
        // SF2: #2 vs #3 — picker = #2
        await supabase.from("draft_playoff_matches").insert({
          season_id: seasonId, round: "sf", match_number: 2,
          seed_a: 2, seed_b: 3,
          user_a: seed2, user_b: seed3,
          topic_picker_user_id: seed2,
          status: "awaiting_topic",
        });
        log.push("created SFs (awaiting topics)");
      }
    }

    // ─── PHASE 4: GENERATE FINALS GAME 1 + THIRD PLACE GAME ───
    if (sfDone && finalMatches.length === 0) {
      const sf1 = sfMatches.find((m: any) => m.match_number === 1);
      const sf2 = sfMatches.find((m: any) => m.match_number === 2);
      if (sf1?.winner_user_id && sf2?.winner_user_id) {
        const sf1WinnerSeed = sf1.winner_user_id === sf1.user_a ? sf1.seed_a : sf1.seed_b;
        const sf2WinnerSeed = sf2.winner_user_id === sf2.user_a ? sf2.seed_a : sf2.seed_b;
        const higherSeed = sf1WinnerSeed <= sf2WinnerSeed ? sf1.winner_user_id : sf2.winner_user_id;
        await supabase.from("draft_playoff_matches").insert({
          season_id: seasonId, round: "final", match_number: 1,
          seed_a: sf1WinnerSeed, seed_b: sf2WinnerSeed,
          user_a: sf1.winner_user_id, user_b: sf2.winner_user_id,
          topic_picker_user_id: higherSeed,
          status: "awaiting_topic",
        });
        log.push("created Final G1 (awaiting topic)");
      }

      // Also generate the 3rd-place game (Bo1) — losers of SF1 and SF2.
      if (sf1?.winner_user_id && sf2?.winner_user_id && thirdPlaceMatches.length === 0) {
        const sf1LoserIsA = sf1.winner_user_id !== sf1.user_a;
        const sf1Loser = sf1LoserIsA ? sf1.user_a : sf1.user_b;
        const sf1LoserSeed = sf1LoserIsA ? sf1.seed_a : sf1.seed_b;
        const sf2LoserIsA = sf2.winner_user_id !== sf2.user_a;
        const sf2Loser = sf2LoserIsA ? sf2.user_a : sf2.user_b;
        const sf2LoserSeed = sf2LoserIsA ? sf2.seed_a : sf2.seed_b;
        if (sf1Loser && sf2Loser) {
          const tpHigherSeed = sf1LoserSeed <= sf2LoserSeed ? sf1Loser : sf2Loser;
          await supabase.from("draft_playoff_matches").insert({
            season_id: seasonId, round: "third_place", match_number: 1,
            seed_a: sf1LoserSeed, seed_b: sf2LoserSeed,
            user_a: sf1Loser, user_b: sf2Loser,
            topic_picker_user_id: tpHigherSeed,
            status: "awaiting_topic",
          });
          log.push("created Third Place game (awaiting topic)");
        }
      }
    }

    // ─── PHASE 5: FINALS BEST-OF-3 PROGRESSION ───
    if (finalMatches.length > 0) {
      // Determine series state from completed finals matches
      const completedFinals = finalMatches.filter((m: any) => m.status === "complete" && m.winner_user_id);
      // Build win counts per user
      const winCount: Record<string, number> = {};
      for (const m of completedFinals) {
        winCount[m.winner_user_id as string] = (winCount[m.winner_user_id as string] || 0) + 1;
      }
      const players = [finalMatches[0].user_a as string, finalMatches[0].user_b as string];
      const seedOf: Record<string, number> = {
        [finalMatches[0].user_a as string]: finalMatches[0].seed_a,
        [finalMatches[0].user_b as string]: finalMatches[0].seed_b,
      };
      const higherSeed = seedOf[players[0]] <= seedOf[players[1]] ? players[0] : players[1];
      const lowerSeed = higherSeed === players[0] ? players[1] : players[0];

      const seriesWinner = players.find(p => (winCount[p] || 0) >= 2);

      if (seriesWinner) {
        // Series clinched. BUT do not finalize/archive the season until the
        // 3rd-place match has also completed. Both the championship series AND
        // the 3rd-place game must be done before the season is archived.
        const tp = thirdPlaceMatches.find((m: any) => m.status === "complete");
        const thirdPlaceDone = !!tp;
        const thirdPlaceExists = thirdPlaceMatches.length > 0;

        if (!thirdPlaceDone) {
          log.push(
            thirdPlaceExists
              ? "finals clinched — waiting on 3rd place match to finish before archiving"
              : "finals clinched — waiting on 3rd place match to be created/completed before archiving"
          );
          return new Response(JSON.stringify({ status: "ok", log }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Both finals series + 3rd place match complete → finalize (idempotent).
        if (season.status !== "complete") {
          // Champion = series winner. Runner-up = the other finalist.
          const championId = seriesWinner;
          const runnerUpId = championId === players[0] ? players[1] : players[0];

          const thirdPlaceId = tp?.winner_user_id ?? null;

          // Regular-season champion = top of standings.
          const { data: regChamp } = await supabase
            .from("draft_season_standings").select("user_id")
            .eq("season_id", seasonId)
            .order("season_points", { ascending: false })
            .order("wins", { ascending: false })
            .order("podiums", { ascending: false })
            .order("avg_finish", { ascending: true })
            .limit(1).maybeSingle();

          // Compose a small summary blob with finals breakdown for the archive.
          const finalsBreakdown = finalMatches
            .filter((m: any) => m.status === "complete")
            .map((m: any) => ({
              game: m.match_number,
              winner: m.winner_user_id,
              draft_id: m.draft_id,
            }));

          await supabase.from("draft_seasons").update({
            status: "complete",
            champion_user_id: championId,
            runner_up_user_id: runnerUpId,
            third_place_user_id: thirdPlaceId,
            regular_season_champion_user_id: (regChamp as any)?.user_id ?? null,
            archived_at: new Date().toISOString(),
            summary: {
              finalized_at: new Date().toISOString(),
              series_score: { [championId]: winCount[championId] || 0, [runnerUpId]: winCount[runnerUpId] || 0 },
              finals: finalsBreakdown,
              third_place_match_id: tp?.id ?? null,
            },
          }).eq("id", seasonId);
          log.push(`season finalized, champion ${championId}, runner-up ${runnerUpId}, 3rd ${thirdPlaceId ?? "n/a"}`);
        }
      } else if (completedFinals.length === finalMatches.length) {
        // No clinch yet AND all created finals are done → create next game
        const nextMatchNumber = finalMatches.length + 1;
        if (nextMatchNumber <= 3) {
          // Picker rotation: G1 = higher, G2 = lower, G3 = higher
          const picker = nextMatchNumber === 2 ? lowerSeed : higherSeed;
          const g1 = finalMatches[0];
          await supabase.from("draft_playoff_matches").insert({
            season_id: seasonId, round: "final", match_number: nextMatchNumber,
            seed_a: g1.seed_a, seed_b: g1.seed_b,
            user_a: g1.user_a, user_b: g1.user_b,
            topic_picker_user_id: picker,
            status: "awaiting_topic",
          });
          log.push(`created Final G${nextMatchNumber} (awaiting topic)`);
        }
      }
    }

    return new Response(JSON.stringify({ status: "ok", log }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("advance-playoffs error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
