import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateLevel } from "@/lib/runedelve/levelGenerator";
import { campaignXpForAttempt } from "@/lib/runedelve/economyProgression";
import { computeClearShards } from "@/lib/runedelve/shardEconomy";
import { treasureShardValue } from "@/lib/runedelve/layoutZones";
import { getLayoutForLevel } from "@/lib/runedelve/chamberAssignment";
import { expeditionReward } from "@/lib/runedelve/expedition";
import { endlessRewardFor } from "@/lib/runedelve/dailyChallenge";

let fixture: typeof import("../../../scripts/fixtures/rune-backend");
beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  history.replaceState({}, "", "/?scenario=full");
  fixture = await import("../../../scripts/fixtures/rune-backend");
});
const rpc = (name: string, args = {}) => fixture.supabase.rpc(name, args);
function run(levelNumber = 1, cleared = true) {
  const level = fixture.qa.tables.rune_delve_levels.find(
    (row) => row.level_number === levelNumber,
  );
  return {
    level_id: level.id,
    level_number: levelNumber,
    hero_class: "warrior",
    score: 1200,
    dungeon_cleared: cleared,
    turns_used: 8,
    total_damage: 120,
    longest_chain: 5,
    hp_remaining: cleared ? 40 : 0,
    enemies_defeated: cleared ? 2 : 0,
    xp_earned: 999999,
    reward_context: {},
  };
}
const ownTrack = (cls = "warrior") =>
  fixture.qa.tables.rune_delve_class_progress.find(
    (row) => row.user_id === "member" && row.class === cls,
  );
const wallet = () =>
  fixture.qa.tables.rune_delve_wallet.find((row) => row.user_id === "member");

describe("isolated Rune backend permission contracts", () => {
  it.each([
    "rune_delve_wallet",
    "rune_delve_relic_unlocks",
    "rune_delve_class_progress",
    "rune_delve_progress",
    "rune_delve_runs",
    "rune_delve_daily_runs",
    "rune_delve_daily_streaks",
    "rune_delve_failure_rewards",
    "rune_delve_loadouts",
    "rune_delve_active_quests",
    "rune_delve_quest_definitions",
    "rune_delve_action_receipts",
    "rune_delve_expedition_runs",
    "rune_delve_expedition_progress",
  ])(
    "denies mounted direct mutations of %s while allowing explicit fixture seeding",
    async (table) => {
      fixture.qa.tables[table].push({
        id: "seed",
        user_id: "member",
        progress: 2,
      });
      const snapshot = structuredClone(fixture.qa.tables[table]);
      for (const request of [
        fixture.supabase
          .from(table)
          .insert({ id: "forged", user_id: "member" }),
        fixture.supabase
          .from(table)
          .upsert({ id: "seed", user_id: "member", progress: 999 }),
        fixture.supabase.from(table).update({ progress: 999 }).eq("id", "seed"),
        fixture.supabase.from(table).delete().eq("id", "seed"),
      ])
        expect((await request).error?.message).toContain("permission denied");
      expect(fixture.qa.tables[table]).toEqual(snapshot);
    },
  );

  it("permits only an own hero_name PATCH and denies mixed progression fields", async () => {
    expect(
      (
        await fixture.supabase
          .from("rune_delve_heroes")
          .update({ hero_name: "Renamed" })
          .eq("user_id", "member")
      ).error,
    ).toBeNull();
    const snapshot = structuredClone(fixture.qa.tables.rune_delve_heroes);
    expect(
      (
        await fixture.supabase
          .from("rune_delve_heroes")
          .update({ hero_name: "Forged", xp: 999999 })
          .eq("user_id", "member")
      ).error,
    ).toBeTruthy();
    await fixture.supabase
      .from("rune_delve_heroes")
      .update({ hero_name: "Other" })
      .eq("user_id", "jordan");
    expect(fixture.qa.tables.rune_delve_heroes).toEqual(snapshot);
  });

  it.each([
    "rune_delve_earn_shards",
    "rune_delve_spend_shards",
    "rune_delve_report_quest",
    "rune_delve_advance_progress",
  ])("denies legacy arbitrary RPC %s", async (name) => {
    expect((await rpc(name, { p_amount: 1000 })).error?.message).toContain(
      "permission denied",
    );
  });

  it("initializes a zero wallet without creating a hero and creates new heroes with safe defaults", async () => {
    fixture.qa.tables.rune_delve_heroes = [];
    fixture.qa.tables.rune_delve_class_progress = [];
    fixture.qa.tables.rune_delve_progress = [];
    fixture.qa.tables.rune_delve_wallet = [];
    const empty = await rpc("rune_delve_bootstrap");
    expect(empty.data.hero).toBeNull();
    expect(empty.data.wallet).toMatchObject({
      shards: 0,
      lifetime_shards_earned: 0,
      slots_unlocked: 2,
    });
    const created = await rpc("rune_delve_bootstrap", {
      p_class: "mage",
      p_hero_name: "New Mage",
      p_create_hero: true,
      xp: 999999,
    });
    expect(created.data.hero).toMatchObject({
      class: "mage",
      xp: 0,
      level: 1,
      hero_name: "New Mage",
    });
    expect(created.data.track).toMatchObject({
      class: "mage",
      highest_unlocked_level: 1,
      xp: 0,
    });
    const repeated = await rpc("rune_delve_bootstrap", {
      p_class: "rogue",
      p_hero_name: "Overwrite",
      p_create_hero: true,
    });
    expect(repeated.data.hero).toEqual(created.data.hero);
  });

  it("inherits a missing selected legacy track but gives other classes fresh defaults", async () => {
    fixture.qa.tables.rune_delve_class_progress = [];
    const legacyHero = structuredClone(fixture.qa.tables.rune_delve_heroes[0]);
    const restored = await rpc("rune_delve_bootstrap", { p_class: "warrior" });
    expect(restored.data.track).toMatchObject({
      xp: legacyHero.xp,
      level: legacyHero.level,
      highest_unlocked_level: 18,
    });
    const selected = await rpc("rune_delve_select_class", {
      p_class: "mage",
      xp: 999999,
      level: 150,
    });
    expect(selected.data).toMatchObject({ class: "mage", xp: 0, level: 1 });
    expect(ownTrack("mage").highest_unlocked_level).toBe(1);
  });

  it("preserves an earned legacy level above its recomputed XP level across bootstrap, credit and class switches", async () => {
    Object.assign(ownTrack(), { level: 80, xp: 0 });
    Object.assign(fixture.qa.tables.rune_delve_heroes[0], { level: 80, xp: 0 });
    wallet().slots_unlocked = 2;
    const account = await rpc("rune_delve_bootstrap", { p_class: "warrior" });
    expect(account.data.track.level).toBe(80);
    expect(account.data.wallet.slots_unlocked).toBe(3);
    const credited = await rpc("rune_delve_save_daily", { p_class: "warrior", p_kills: 1, p_score: 100, p_request_id: "legacy-level" });
    expect(credited.data.classLevel).toBe(80);
    await rpc("rune_delve_select_class", { p_class: "mage" });
    expect((await rpc("rune_delve_select_class", { p_class: "warrior" })).data.level).toBe(80);
  });

  it("assigns bounded canonical quests and claims their confirmed rewards once", async () => {
    fixture.qa.tables.rune_delve_quest_definitions = [
      "daily",
      "weekly",
    ].flatMap((scope) =>
      [0, 1, 2].map((index) => ({
        id: `${scope}-${index}`,
        scope,
        title: "Quest",
        objective_type: "levels_cleared",
        target_value: 2,
        shard_reward: 25,
        xp_reward: 20,
        is_personal: index === 2,
        hero_class: index === 2 ? "warrior" : null,
      })),
    );
    const assigned = await rpc("rune_delve_assign_quests", {
      target_value: 0,
      status: "completed",
    });
    expect(assigned.data).toHaveLength(6);
    expect(
      assigned.data.every(
        (quest) => quest.target_value === 2 && quest.status === "active",
      ),
    ).toBe(true);
    const quest = fixture.qa.tables.rune_delve_active_quests[0];
    expect(
      (await rpc("rune_delve_claim_quest", { p_quest_id: quest.id })).error
        ?.message,
    ).toBe("Quest not completed");
    // Only fixture setup may seed a confirmed completion.
    Object.assign(quest, { status: "completed", progress: 2 });
    const before = wallet().shards;
    const xp = ownTrack().xp;
    expect(
      (await rpc("rune_delve_assign_quests")).data.find(
        (row) => row.id === quest.id,
      ).status,
    ).toBe("completed");
    await rpc("rune_delve_claim_quest", { p_quest_id: quest.id });
    expect(
      (await rpc("rune_delve_claim_quest", { p_quest_id: quest.id })).data,
    ).toMatchObject({ shards: 0, xp: 0, alreadyClaimed: true });
    expect(wallet().shards).toBe(before + 25);
    expect(ownTrack().xp).toBe(xp + 20);
  });
});

describe("isolated Rune settlement contracts", () => {
  it("computes first-clear/replay XP itself and retries the original receipt exactly once", async () => {
    const input = run();
    const before = wallet().shards;
    const first = await rpc("rune_delve_save_run", {
      p_run: input,
      p_request_id: "first",
    });
    expect(first.data.xpAwarded).toBe(
      campaignXpForAttempt({
        levelNumber: 1,
        score: 1200,
        cleared: true,
        isFirstClear: true,
      }),
    );
    expect(first.data.shardsAwarded).toBe(
      computeClearShards({
        levelNumber: 1,
        isFirstClear: true,
        bossClear: false,
        chapterCleared: false,
        compassEquipped: false,
      }).total,
    );
    const after = wallet().shards;
    expect(after).toBe(before + first.data.shardsAwarded);
    expect(
      await rpc("rune_delve_save_run", {
        p_run: structuredClone(input),
        p_request_id: "first",
      }),
    ).toEqual(first);
    expect(wallet().shards).toBe(after);
    expect(fixture.qa.tables.rune_delve_runs[0].attempts).toBe(1);
    const forged = await rpc("rune_delve_save_run", {
      p_run: { ...input, score: 1201 },
      p_request_id: "first",
    });
    expect(forged.error?.message).toBe("request_id_reused");
    const replay = await rpc("rune_delve_save_run", {
      p_run: input,
      p_request_id: "replay",
    });
    expect(replay.data.firstClear).toBe(false);
    expect(replay.data.xpAwarded).toBeGreaterThan(0);
    expect(replay.data.xpAwarded).toBeLessThan(first.data.xpAwarded);
    expect(fixture.qa.tables.rune_delve_action_receipts).toHaveLength(2);
  });

  it("preserves first chapter bonuses and reduces a replay boss bonus to eight", async () => {
    ownTrack().highest_unlocked_level = 50;
    const input = run(50);
    const first = await rpc("rune_delve_save_run", {
      p_run: input,
      p_request_id: "chapter-first",
    });
    const replay = await rpc("rune_delve_save_run", {
      p_run: input,
      p_request_id: "chapter-replay",
    });
    expect(first.data.shardsAwarded).toBe(10 + 50 + 50 + 200);
    expect(replay.data.shardsAwarded).toBe(6 + Math.floor(50 / 5) + 8);
  });

  it("awards meaningful failed-attempt XP with diminishing returns and no XP for idle aborts", async () => {
    const idle = {
      ...run(2, false),
      turns_used: 0,
      total_damage: 0,
      enemies_defeated: 0,
    };
    expect(
      (await rpc("rune_delve_save_run", { p_run: idle, p_request_id: "idle" }))
        .data.xpAwarded,
    ).toBe(0);
    const first = await rpc("rune_delve_save_run", {
      p_run: run(3, false),
      p_request_id: "fail-one",
    });
    const second = await rpc("rune_delve_save_run", {
      p_run: run(3, false),
      p_request_id: "fail-two",
    });
    expect(first.data.xpAwarded).toBeGreaterThan(0);
    expect(second.data.xpAwarded).toBeLessThanOrEqual(first.data.xpAwarded);
    expect(second.data.shardsAwarded).toBeLessThanOrEqual(
      first.data.shardsAwarded,
    );
  });

  it("caps treasury by layout rather than submitted turns and gates variant multipliers", async () => {
    const input = {
      ...run(2),
      turns_used: 999,
      reward_context: { path: "elite", treasure_shards: 999999 },
    };
    const settled = await rpc("rune_delve_save_run", {
      p_run: input,
      p_request_id: "treasury",
    });
    const base = computeClearShards({
      levelNumber: 2,
      isFirstClear: true,
      bossClear: false,
      chapterCleared: false,
      compassEquipped: false,
    }).total;
    expect(settled.data.shardsAwarded).toBe(
      base +
        getLayoutForLevel(2).preview.treasureZones * treasureShardValue(2),
    );
    const variant = await rpc("rune_delve_save_run", {
      p_run: {
        ...run(10),
        reward_context: { path: "treasure", treasure_shards: 999999 },
      },
      p_request_id: "variant",
    });
    const variantBase = computeClearShards({
      levelNumber: 10,
      isFirstClear: true,
      bossClear: false,
      chapterCleared: false,
      compassEquipped: false,
    }).total;
    expect(variant.data.shardsAwarded).toBe(
      Math.round(variantBase * 1.25) + 3 * treasureShardValue(10) * 3,
    );
  });

  it("persists a deterministic confirmed free drop only once with its receipt", async () => {
    const input = run();
    let confirmed = null;
    for (let index = 0; index < 200; index++) {
      const args = { p_run: input, p_request_id: `drop-${index}` };
      const result = await rpc("rune_delve_save_run", args);
      if (result.data.relicDrop) {
        confirmed = { args, result };
        break;
      }
    }
    expect(confirmed).not.toBeNull();
    const count = fixture.qa.tables.rune_delve_relic_unlocks.length;
    expect(
      fixture.qa.tables.rune_delve_relic_unlocks.find(
        (row) => row.id === confirmed.result.data.relicDrop.id,
      ),
    ).toEqual(confirmed.result.data.relicDrop);
    expect(await rpc("rune_delve_save_run", confirmed.args)).toEqual(
      confirmed.result,
    );
    expect(fixture.qa.tables.rune_delve_relic_unlocks).toHaveLength(count);
  });

  it("pays only improvements to a bounded daily reward total and preserves the best record", async () => {
    const before = wallet().shards;
    const xp = ownTrack().xp;
    const save = (kills: number, id: string) =>
      rpc("rune_delve_save_daily", {
        p_class: "warrior",
        p_kills: kills,
        p_score: kills * 100,
        p_request_id: id,
      });
    const first = await save(0, "daily-first");
    expect(first.data).toMatchObject({
      firstAttempt: true,
      previousBestKills: 0,
      bestKills: 0,
      rewarded: false,
    });
    const improved = await save(50, "daily-best");
    const total = endlessRewardFor(50);
    expect(improved.data).toMatchObject({
      firstAttempt: false,
      improvedReward: true,
      bestKills: 50,
      dailyRewardTotal: { shards: total.shards, xp: total.xp },
    });
    expect(improved.data.reward.shards).toBe(
      total.shards - first.data.reward.shards,
    );
    const worse = await save(5, "daily-worse");
    expect(worse.data).toMatchObject({
      rewarded: false,
      stars: 3,
      previousBestKills: 50,
      bestKills: 50,
      reward: { shards: 0, xp: 0 },
    });
    expect(fixture.qa.tables.rune_delve_daily_runs[0]).toMatchObject({
      kills_count: 50,
      reward_shards_awarded: total.shards,
      reward_xp_awarded: total.xp,
    });
    expect(await save(0, "daily-first")).toEqual(first);
    expect(wallet().shards).toBe(before + total.shards);
    expect(ownTrack().xp).toBe(xp + total.xp);
  });

  it("does not complete quests or count a daily run until the first positive attempt", async () => {
    for (const type of ["daily_challenges_completed", "class_run_complete"]) {
      fixture.qa.tables.rune_delve_quest_definitions.push({
        id: type, scope: "daily", title: type, objective_type: type,
        target_value: 1, shard_reward: 25, xp_reward: 20,
      });
      fixture.qa.tables.rune_delve_active_quests.push({
        id: type, user_id: "member", quest_id: type, scope: "daily",
        period_key: new Date().toISOString().slice(0, 10),
        progress: 0, target_value: 1, status: "active", claimed_at: null,
      });
    }
    const lifetime = ownTrack().lifetime_runs;
    const save = (kills: number, id: string) => rpc("rune_delve_save_daily", {
      p_class: "warrior", p_kills: kills, p_score: kills * 100, p_request_id: id,
    });
    const idle = await save(0, "daily-idle");
    expect(idle.data).toMatchObject({ rewarded: false, firstMeaningfulAttempt: false });
    expect(ownTrack().lifetime_runs).toBe(lifetime);
    expect(fixture.qa.tables.rune_delve_active_quests.every((row) => row.status === "active")).toBe(true);
    await save(0, "daily-idle-repeat");
    const positive = await save(1, "daily-positive");
    expect(positive.data).toMatchObject({ firstAttempt: false, firstMeaningfulAttempt: true });
    expect(ownTrack().lifetime_runs).toBe(lifetime + 1);
    expect(fixture.qa.tables.rune_delve_active_quests.every((row) => row.status === "completed" && row.progress === 1)).toBe(true);
    await save(10, "daily-improvement");
    expect(ownTrack().lifetime_runs).toBe(lifetime + 1);
    expect(fixture.qa.tables.rune_delve_daily_runs[0].reward_shards_awarded).toBe(250);
  });

  it("preserves historically paid idle rewards instead of paying or reporting completion twice", async () => {
    fixture.qa.tables.rune_delve_daily_runs.push({
      id: "legacy-idle", user_id: "member", daily_date: new Date().toISOString().slice(0, 10),
      kills_count: 0, score: 0, hero_class: "warrior",
    });
    const before = wallet().shards;
    const lifetime = ownTrack().lifetime_runs;
    const result = await rpc("rune_delve_save_daily", { p_class: "warrior", p_kills: 1, p_score: 100, p_request_id: "legacy-positive" });
    expect(result.data).toMatchObject({
      firstMeaningfulAttempt: false, reward: { shards: 0, xp: 10 },
      dailyRewardTotal: { shards: 25, xp: 10 },
    });
    expect(wallet().shards).toBe(before);
    expect(ownTrack().lifetime_runs).toBe(lifetime);
  });

  it("uses paid legacy receipts when a later unawarded attempt raised the daily best", async () => {
    const dateStr = new Date().toISOString().slice(0, 10);
    fixture.qa.tables.rune_delve_daily_runs.push({
      id: "legacy-best", user_id: "member", daily_date: dateStr,
      kills_count: 10, score: 2500, hero_class: "warrior",
    });
    fixture.qa.tables.rune_delve_action_receipts.push({
      user_id: "member", request_id: "legacy-paid", action_kind: "daily",
      result: { dateStr, reward: { shards: 25, xp: 10 }, rewarded: true },
    }, {
      user_id: "member", request_id: "legacy-unpaid", action_kind: "daily",
      result: { dateStr, reward: { shards: 0, xp: 0 }, rewarded: false },
    });
    const result = await rpc("rune_delve_save_daily", {
      p_class: "warrior", p_kills: 10, p_score: 2500, p_request_id: "catch-up",
    });
    expect(result.data).toMatchObject({
      reward: { shards: 225, xp: 90 },
      dailyRewardTotal: { shards: 250, xp: 100 },
      firstMeaningfulAttempt: false,
    });
  });

  it("credits Expedition XP equal to its reward and unlocks the third slot from canonical level 25 once", async () => {
    ownTrack().xp = 5150;
    ownTrack().level = 24;
    wallet().slots_unlocked = 2;
    await rpc("rune_delve_expedition_begin", {
      p_id: "ticket",
      p_club_id: "club",
      p_hero_class: "warrior",
      p_ascension: 0,
    });
    const args = {
      p_id: "ticket",
      p_rooms: 6,
      p_turns: 40,
      p_score: 3000,
      p_cleared: true,
    };
    const before = wallet().shards;
    const receipt = await rpc("rune_delve_expedition_finish", args);
    const reward = expeditionReward(6, 0, true);
    expect(receipt.data).toMatchObject({
      reward,
      xpAwarded: reward,
      classLevel: 25,
      slotsUnlocked: 3,
    });
    expect(ownTrack().xp).toBe(5150 + reward);
    expect(await rpc("rune_delve_expedition_finish", args)).toEqual(receipt);
    expect(ownTrack().xp).toBe(5150 + reward);
    expect(wallet().shards).toBe(before + reward);
  });
});
