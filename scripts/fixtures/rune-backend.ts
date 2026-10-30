// Isolated Rune Delve transport. All mutations stay inside this browser fixture.
import { generateLevel } from "../../src/lib/runedelve/levelGenerator";
import { CLASS_LIST, titleForLevel } from "../../src/lib/runedelve/classConfig";
import { RELIC_CATALOG, rankCost } from "../../src/lib/runedelve/relics";
import { expeditionReward } from "../../src/lib/runedelve/expedition";
import {
  endlessRewardFor,
  endlessStarsFor,
} from "../../src/lib/runedelve/dailyChallenge";

const uid = "member";
const date = new Date().toISOString();
const params = new URLSearchParams(location.search);
const scenario = params.get("scenario") || "full";
const heroClass = params.get("class") || "warrior";
const completed = Number(params.get("completed") || 17);
const levelId = (n: number) =>
  `11000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const progress = (id: string, userId = uid, cap = completed) => ({
  id,
  user_id: userId,
  highest_unlocked_level: cap + 1,
  highest_completed_level: cap,
  total_levels_cleared: cap,
  current_chapter: 1,
});
const tables: Record<string, any[]> = {
  profiles: [
    { id: uid, display_name: "Alex", avatar_url: null },
    { id: "jordan", display_name: "Jordan", avatar_url: null },
  ],
  club_members: [
    { user_id: uid, club_id: "club", role: "member" },
    { user_id: "jordan", club_id: "club", role: "member" },
  ],
  rune_delve_heroes:
    scenario === "new"
      ? []
      : [
          {
            id: "hero",
            user_id: uid,
            hero_name: "Thalia Stormvein",
            class: heroClass,
            level: 8,
            xp: 1600,
            current_streak: 3,
            best_streak: 7,
            lifetime_runs: 23,
            lifetime_score: 32400,
            cosmetic_title: titleForLevel(8, heroClass as any),
            last_run_date: date.slice(0, 10),
          },
          {
            id: "hero-jordan",
            user_id: "jordan",
            hero_name: "Kael",
            class: "mage",
            level: 10,
            xp: 2200,
          },
        ],
  rune_delve_class_progress: CLASS_LIST.map((cls, i) => ({
    ...progress("track-" + cls.id, uid, cls.id === heroClass ? completed : 0),
    class: cls.id,
    xp: i ? 0 : 1600,
    level: i ? 1 : 8,
    cosmetic_title: titleForLevel(i ? 1 : 8, cls.id),
    lifetime_runs: i ? 0 : 23,
    lifetime_score: i ? 0 : 32400,
  })),
  rune_delve_progress: [
    progress("progress"),
    progress("progress-jordan", "jordan", 23),
  ],
  rune_delve_wallet: [
    {
      user_id: uid,
      shards: 2400,
      lifetime_shards_earned: 6100,
      slots_unlocked: 2,
    },
  ],
  rune_delve_loadouts: CLASS_LIST.map((cls) => ({
    id: "loadout-" + cls.id,
    user_id: uid,
    class: cls.id,
    slot_1: null,
    slot_2: null,
    slot_3: null,
  })),
  rune_delve_relic_unlocks: RELIC_CATALOG.slice(0, 4).map((relic, i) => ({
    id: "relic-" + i,
    user_id: uid,
    relic_id: relic.id,
    rank: 1,
    acquired_at: date,
    acquired_at_level: i + 1,
  })),
  rune_delve_levels: Array.from({ length: 150 }, (_, i) => ({
    id: levelId(i + 1),
    ...generateLevel(i + 1),
    status: "active",
  })),
  rune_delve_runs: [],
  rune_delve_failure_rewards: [],
  rune_delve_quest_definitions: [],
  rune_delve_active_quests: [],
  rune_delve_bestiary: [],
  rune_delve_daily_runs: JSON.parse(
    localStorage.getItem("__rune-qa-daily-runs") || "[]",
  ),
  rune_delve_daily_streaks: [
    {
      user_id: uid,
      current_streak: 3,
      best_streak: 7,
      last_completed_date: null,
      lifetime_clears: 12,
    },
  ],
  channels: [],
  messages: [],
  notifications: [],
  channel_read_states: [],
  notification_preferences: [],
  channel_notification_prefs: [],
  dh_feat_accounts: [],
};
export const qa = {
  tables,
  queries: [] as any[],
  writes: [] as any[],
  rpcs: [] as any[],
  failTables: (scenario === "offline" ? ["rune_delve_heroes"] : []) as string[],
  failRpc: [] as string[],
  delayTables: {} as Record<string, number>,
};
Object.assign(window, { runeQa: qa });
const receipts = new Map<string, any>();
const savedTickets = JSON.parse(
  localStorage.getItem("__rune-qa-tickets") || "{}",
);
const persistTickets = () =>
  localStorage.setItem("__rune-qa-tickets", JSON.stringify(savedTickets));
const fail = (message: string) => ({ data: null, error: { message } });
function from(table: string) {
  const filters: Array<(row: any) => boolean> = [];
  const sorts: Array<{ key: string; ascending: boolean }> = [];
  let single = false,
    verb = "select",
    body: any,
    limit = Infinity,
    offset = 0,
    conflict = ["id"],
    cols = "*";
  const builder: any = {
    select(value = "*") {
      cols = value;
      return builder;
    },
    abortSignal() {
      return builder;
    },
    eq(key: string, value: any) {
      filters.push((row) => row[key] === value);
      return builder;
    },
    neq(key: string, value: any) {
      filters.push((row) => row[key] !== value);
      return builder;
    },
    in(key: string, values: any[]) {
      filters.push((row) => values.includes(row[key]));
      return builder;
    },
    is(key: string, value: any) {
      filters.push((row) => (row[key] ?? null) === value);
      return builder;
    },
    lt(key: string, value: any) {
      filters.push((row) => row[key] < value);
      return builder;
    },
    lte(key: string, value: any) {
      filters.push((row) => row[key] <= value);
      return builder;
    },
    gt(key: string, value: any) {
      filters.push((row) => row[key] > value);
      return builder;
    },
    gte(key: string, value: any) {
      filters.push((row) => row[key] >= value);
      return builder;
    },
    order(key: string, opts = { ascending: true }) {
      sorts.push({ key, ascending: opts.ascending });
      return builder;
    },
    limit(n: number) {
      limit = n;
      return builder;
    },
    range(start: number, end: number) {
      offset = start;
      limit = end - start + 1;
      return builder;
    },
    maybeSingle() {
      single = true;
      return builder;
    },
    single() {
      single = true;
      return builder;
    },
    update(value: any) {
      verb = "update";
      body = value;
      return builder;
    },
    delete() {
      verb = "delete";
      return builder;
    },
    insert(value: any) {
      verb = "insert";
      body = value;
      return builder;
    },
    upsert(value: any, options: any = {}) {
      verb = "upsert";
      body = value;
      conflict = (options.onConflict || "id").split(",");
      return builder;
    },
    or() {
      return builder;
    },
    contains() {
      return builder;
    },
    then(resolve: any, reject: any) {
      return run().then(resolve, reject);
    },
  };
  async function run() {
    qa.queries.push({ table, verb, cols });
    if (qa.delayTables[table])
      await new Promise((resolve) =>
        setTimeout(resolve, qa.delayTables[table]),
      );
    if (qa.failTables.includes(table))
      return fail("Connection interrupted. Please try again.");
    let rows = (tables[table] || []).filter((row) =>
      filters.every((filter) => filter(row)),
    );
    if (verb !== "select") {
      qa.writes.push({ table, verb, body: structuredClone(body) });
      if (verb === "upsert")
        rows = (Array.isArray(body) ? body : [body]).map((value) => {
          const existing = (tables[table] || []).find((row) =>
            conflict.every((key) => row[key] === value[key]),
          );
          if (existing) {
            Object.assign(existing, value);
            return existing;
          }
          const row = {
            id: crypto.randomUUID(),
            level: 1,
            xp: 0,
            current_streak: 0,
            best_streak: 0,
            lifetime_runs: 0,
            lifetime_score: 0,
            ...value,
          };
          (tables[table] ||= []).push(row);
          return row;
        });
      else if (verb === "insert") {
        rows = (Array.isArray(body) ? body : [body]).map((value) => ({
          id: crypto.randomUUID(),
          created_at: date,
          acquired_at: date,
          class: "warrior",
          highest_unlocked_level: 1,
          highest_completed_level: 0,
          total_levels_cleared: 0,
          current_chapter: 1,
          ...value,
        }));
        (tables[table] ||= []).push(...rows);
      } else if (verb === "update")
        rows.forEach((row) => Object.assign(row, body));
      else
        tables[table] = (tables[table] || []).filter(
          (row) => !rows.includes(row),
        );
    }
    rows = [...rows]
      .sort((a, b) => {
        for (const sort of sorts) {
          const av = a[sort.key],
            bv = b[sort.key];
          const difference =
            typeof av === "number" && typeof bv === "number"
              ? av - bv
              : String(av ?? "").localeCompare(String(bv ?? ""));
          if (difference) return sort.ascending ? difference : -difference;
        }
        return 0;
      })
      .slice(offset, offset + limit);
    return {
      data: single ? structuredClone(rows[0] ?? null) : structuredClone(rows),
      error: null,
      count: rows.length,
    };
  }
  return builder;
}
async function rpc(name: string, args: any = {}) {
  qa.rpcs.push({ name, args });
  if (qa.failRpc.includes(name)) return fail("Fixture request interrupted");
  if (name === "dh_presence_directory")
    return { data: tables.profiles, error: null };
  if (name === "dh_feats_summary")
    return { data: { score: 0, unlocked: 0 }, error: null };
  if (name === "rune_delve_report_quest") return { data: [], error: null };
  if (name === "rune_delve_equip") {
    const loadout = tables.rune_delve_loadouts.find(
      (row) => row.class === args.p_class,
    );
    if (!loadout) return fail("Loadout unavailable");
    Object.assign(loadout, {
      slot_1: args.p_slot_1,
      slot_2: args.p_slot_2,
      slot_3: args.p_slot_3,
    });
    qa.writes.push({ table: "atomic-loadout", body: args });
    return { data: structuredClone(loadout), error: null };
  }
  if (name === "rune_delve_ensure_level") {
    const definition = args.p_definition;
    const row = tables.rune_delve_levels.find(
      (level) => level.level_number === definition.level_number,
    ) || {
      id: levelId(definition.level_number),
      ...definition,
      status: "active",
    };
    return { data: row, error: null };
  }
  if (name === "rune_delve_buy_relic") {
    if (receipts.has(args.p_request_id))
      return { data: receipts.get(args.p_request_id), error: null };
    const relic = RELIC_CATALOG.find((relic) => relic.id === args.p_relic_id);
    if (!relic) return fail("Relic unavailable");
    const owned = tables.rune_delve_relic_unlocks.find(
      (row) => row.relic_id === relic.id,
    );
    if (owned && args.p_expected_rank == null)
      return fail("Relic already owned");
    if (args.p_expected_rank != null && owned?.rank !== args.p_expected_rank)
      return fail("Rank changed — please retry");
    const cost =
      args.p_expected_rank == null
        ? relic.cost
        : rankCost(relic.cost, args.p_expected_rank + 1);
    const wallet = tables.rune_delve_wallet[0];
    if (wallet.shards < cost) return fail("Not enough Rune Shards");
    wallet.shards -= cost;
    const row = owned || {
      id: crypto.randomUUID(),
      user_id: uid,
      relic_id: relic.id,
      rank: 1,
      acquired_at: date,
      acquired_at_level: completed + 1,
    };
    if (owned) owned.rank += 1;
    else tables.rune_delve_relic_unlocks.push(row);
    receipts.set(args.p_request_id, structuredClone(row));
    qa.writes.push({ table: "atomic-purchase", body: args });
    return { data: structuredClone(row), error: null };
  }
  if (name === "rune_delve_save_run") {
    if (receipts.has(args.p_request_id))
      return { data: receipts.get(args.p_request_id), error: null };
    const run = args.p_run;
    const existing = tables.rune_delve_runs.find(
      (row) =>
        row.level_id === run.level_id && row.hero_class === run.hero_class,
    );
    const row = existing || {
      id: crypto.randomUUID(),
      user_id: uid,
      ...run,
      attempts: 0,
      clears: 0,
    };
    const isBest = !existing || run.score > existing.score;
    const firstClear = run.dungeon_cleared && !existing?.dungeon_cleared;
    Object.assign(row, run, {
      score: Math.max(row.score || 0, run.score),
      attempts: (row.attempts || 0) + 1,
      clears: (row.clears || 0) + Number(run.dungeon_cleared),
      last_played_at: date,
      completed_at: date,
    });
    if (!existing) tables.rune_delve_runs.push(row);
    const result = {
      row,
      wasNewBest: isBest,
      improvedChain: true,
      improvedTurns: !!run.dungeon_cleared,
      improvedHp: !!run.dungeon_cleared,
      firstClear,
      shardsAwarded: run.dungeon_cleared ? 60 : 12,
      xpAwarded: run.xp_earned || 0,
      previousClassLevel: 8,
      classLevel: 8,
      classXp: 1600,
      cosmeticTitle: "Squire of Steel",
      slotsUnlocked: 2,
    };
    receipts.set(args.p_request_id, structuredClone(result));
    qa.writes.push({ table: "atomic-run", body: args });
    return { data: structuredClone(result), error: null };
  }
  if (name === "rune_delve_advance_progress") {
    const track = tables.rune_delve_class_progress.find(
      (row) => row.class === (args.p_hero_class || args.p_class),
    );
    if (track) {
      track.highest_completed_level = Math.max(
        track.highest_completed_level,
        args.p_level_number || 1,
      );
      track.highest_unlocked_level = track.highest_completed_level + 1;
    }
    return { data: track, error: null };
  }
  if (name === "rune_delve_save_daily") {
    if (receipts.has(args.p_request_id))
      return { data: receipts.get(args.p_request_id), error: null };
    const dateStr = date.slice(0, 10);
    const reward = endlessRewardFor(args.p_kills);
    const stars = endlessStarsFor(args.p_kills);
    const existing = tables.rune_delve_daily_runs.find(
      (row) => row.daily_date === dateStr && row.user_id === uid,
    );
    const row = existing || {
      id: crypto.randomUUID(),
      user_id: uid,
      daily_date: dateStr,
    };
    Object.assign(row, {
      score: args.p_score,
      stars,
      dungeon_cleared: false,
      modifiers: [],
      hero_class: args.p_class,
      kills_count: args.p_kills,
      completed_at: date,
    });
    if (!existing) tables.rune_delve_daily_runs.push(row);
    localStorage.setItem(
      "__rune-qa-daily-runs",
      JSON.stringify(tables.rune_delve_daily_runs),
    );
    if (!existing) tables.rune_delve_wallet[0].shards += reward.shards;
    const result = {
      stars,
      reward,
      dateStr,
      kills: args.p_kills,
      rewarded: !existing,
      previousClassLevel: 8,
      classLevel: 8,
      slotsUnlocked: 2,
    };
    receipts.set(args.p_request_id, result);
    qa.writes.push({ table: "atomic-daily", body: args });
    return { data: result, error: null };
  }
  if (name === "rune_delve_claim_quest") {
    const quest = tables.rune_delve_active_quests.find(
      (row) => row.id === args.p_quest_id,
    );
    if (!quest) return fail("Quest unavailable");
    const definition = tables.rune_delve_quest_definitions.find(
      (row) => row.id === quest.quest_id,
    );
    const alreadyClaimed = quest.status === "claimed";
    if (!alreadyClaimed) {
      quest.status = "claimed";
      tables.rune_delve_wallet[0].shards += definition?.shard_reward || 0;
    }
    return {
      data: {
        shards: definition?.shard_reward || 0,
        xp: definition?.xp_reward || 0,
        title: definition?.title || "Quest",
        scope: quest.scope,
        alreadyClaimed,
      },
      error: null,
    };
  }
  if (name === "rune_delve_expedition_profile")
    return {
      data: {
        highest_ascension: 0,
        best_score: 1200,
        total_runs: 4,
        total_clears: 0,
        active_run:
          Object.values(savedTickets).find((ticket: any) => !ticket.receipt) ||
          null,
      },
      error: null,
    };
  if (name === "rune_delve_expedition_begin") {
    const ticket = savedTickets[args.p_id] || {
      id: args.p_id,
      seed: 728391,
      hero_class: args.p_hero_class,
      ascension: args.p_ascension,
      started_at: date,
    };
    savedTickets[ticket.id] = ticket;
    persistTickets();
    qa.writes.push({ table: "expedition-ticket", body: args });
    return { data: ticket, error: null };
  }
  if (name === "rune_delve_expedition_finish") {
    if (!savedTickets[args.p_id]) return fail("Run not found");
    const ticket = savedTickets[args.p_id];
    if (ticket.receipt) return { data: ticket.receipt, error: null };
    const reward = expeditionReward(
      args.p_rooms,
      ticket.ascension,
      args.p_cleared,
    );
    ticket.receipt = {
      reward,
      rooms: args.p_rooms,
      cleared: args.p_cleared,
      highest_ascension: args.p_cleared
        ? ticket.ascension + 1
        : ticket.ascension,
      best_score: args.p_score,
    };
    persistTickets();
    tables.rune_delve_wallet[0].shards += reward;
    qa.writes.push({ table: "expedition-finish", body: args });
    return { data: ticket.receipt, error: null };
  }
  if (name === "rune_delve_earn_shards" || name === "rune_delve_spend_shards") {
    const wallet = tables.rune_delve_wallet[0],
      amount = Number(args.p_amount);
    if (name.includes("spend") && wallet.shards < amount)
      return fail("insufficient_shards");
    wallet.shards += name.includes("spend") ? -amount : amount;
    if (name.includes("earn")) wallet.lifetime_shards_earned += amount;
    return { data: structuredClone(wallet), error: null };
  }
  console.warn("Rune fixture RPC not implemented:", name, args);
  return { data: [], error: null };
}
export const supabase = {
  from,
  rpc,
  channel: () => {
    const api: any = {
      on: () => api,
      subscribe: (cb: any) => {
        queueMicrotask(() => cb?.("SUBSCRIBED"));
        return api;
      },
      track: async () => {},
      presenceState: () => ({}),
      unsubscribe: async () => {},
    };
    return api;
  },
  removeChannel: async () => {},
  functions: { invoke: async () => ({ data: null, error: null }) },
  storage: {
    from: () => ({
      createSignedUrl: async () => ({ data: null, error: null }),
    }),
  },
};
