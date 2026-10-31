// Isolated Rune Delve transport. All mutations stay inside this browser fixture.
import { generateLevel } from "../../src/lib/runedelve/levelGenerator";
import { PUZZLE_ROOMS } from "../../src/lib/runedelve/puzzles/rooms";
import {
  puzzleStars,
  replayPuzzle,
} from "../../src/lib/runedelve/puzzles/engine";
import type {
  PuzzleCompletionReceipt,
  PuzzleDirection,
  PuzzleProgress,
  PuzzleRecord,
  PuzzleRoom,
} from "../../src/lib/runedelve/puzzles/types";
import {
  CLASS_LIST,
  levelFromXp,
  titleForLevel,
  xpForLevel,
  type HeroClass,
} from "../../src/lib/runedelve/classConfig";
import { RELIC_CATALOG, rankCost } from "../../src/lib/runedelve/relics";
import { expeditionReward } from "../../src/lib/runedelve/expedition";
import { BESTIARY_ROSTER } from "../../src/lib/runedelve/enemyRoster";
import { affordableSimProfile } from "../../src/lib/runedelve/simulator";
import {
  dailyPeriodKey,
  rollQuestSet,
  weeklyPeriodKey,
} from "../../src/lib/runedelve/quests";
import {
  campaignXpForAttempt,
  dailyRewardDelta,
} from "../../src/lib/runedelve/economyProgression";
import {
  computeClearShards,
  computeFailureShards,
  failureMultiplier,
} from "../../src/lib/runedelve/shardEconomy";
import { treasureShardValue } from "../../src/lib/runedelve/layoutZones";
import { getLayoutForLevel } from "../../src/lib/runedelve/chamberAssignment";
import { rollRelicDrop } from "../../src/lib/runedelve/relicDrops";
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
  current_chapter: Math.floor(cap / 50) + 1,
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
  rune_delve_class_progress:
    scenario === "new"
      ? []
      : CLASS_LIST.map((cls) => ({
          ...progress(
            "track-" + cls.id,
            uid,
            cls.id === heroClass ? completed : 0,
          ),
          class: cls.id,
          xp: cls.id === heroClass ? 1600 : 0,
          level: cls.id === heroClass ? 8 : 1,
          cosmetic_title: titleForLevel(cls.id === heroClass ? 8 : 1, cls.id),
          lifetime_runs: cls.id === heroClass ? 23 : 0,
          lifetime_score: cls.id === heroClass ? 32400 : 0,
        })),
  rune_delve_progress: [
    ...(scenario === "new" ? [] : [progress("progress")]),
    progress("progress-jordan", "jordan", 23),
  ],
  rune_delve_wallet:
    scenario === "new"
      ? []
      : [
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
  rune_delve_relic_unlocks: (scenario === "new"
    ? []
    : RELIC_CATALOG.slice(0, 4)
  ).map((relic, i) => ({
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
  rune_puzzle_definitions: PUZZLE_ROOMS.map((room) => ({
    room_id: room.id,
    definition_version: room.version,
    ordinal: room.order,
    definition: structuredClone(room),
    active: true,
  })),
  rune_puzzle_profiles: [],
  rune_puzzle_results: [],
  rune_puzzle_receipts: [],
  rune_delve_runs: [],
  rune_delve_action_receipts: [],
  rune_delve_expedition_progress: [],
  rune_delve_expedition_runs: [],
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
// Complete late-game browser encounters with the same earned progression and
// equipment used by the balance sweeps. The default menu/economy fixture stays
// unchanged, and no live encounter state is altered by this opt-in setup.
if (scenario !== "new" && params.get("build") === "affordable") {
  const depth = Math.max(1, Math.min(150, Number(params.get("depth") || 1)));
  const build = affordableSimProfile(depth, heroClass as HeroClass);
  const xp = Array.from({ length: build.classLevel - 1 }, (_, i) =>
    xpForLevel(i + 1),
  ).reduce((total, cost) => total + cost, 0);
  const advancement = {
    level: build.classLevel,
    xp,
    cosmetic_title: titleForLevel(build.classLevel, heroClass as HeroClass),
  };
  Object.assign(
    tables.rune_delve_heroes.find((row) => row.user_id === uid),
    advancement,
  );
  Object.assign(
    tables.rune_delve_class_progress.find((row) => row.class === heroClass),
    advancement,
  );
  tables.rune_delve_wallet[0].slots_unlocked = build.classLevel >= 25 ? 3 : 2;
  for (const relicId of build.slots ?? []) {
    const owned = tables.rune_delve_relic_unlocks.find(
      (row) => row.relic_id === relicId,
    );
    const relic = {
      user_id: uid,
      relic_id: relicId,
      rank: build.ranks?.[relicId] ?? 1,
    };
    if (owned) Object.assign(owned, relic);
    else
      tables.rune_delve_relic_unlocks.push({
        ...relic,
        id: `earned-${relicId}`,
        acquired_at: date,
        acquired_at_level: depth,
      });
  }
  Object.assign(
    tables.rune_delve_loadouts.find((row) => row.class === heroClass),
    {
      slot_1: build.slots?.[0] ?? null,
      slot_2: build.slots?.[1] ?? null,
      slot_3: build.slots?.[2] ?? null,
    },
  );
}
// Rich records are opt-in so the existing empty-state and economy checks keep
// their own baseline. These are data fixtures; gameplay is never replaced.
if (scenario === "archive") {
  tables.rune_delve_runs = [1, 2, 17].map((level, index) => ({
    id: `history-${level}`,
    user_id: uid,
    level_id: levelId(level),
    level_number: level,
    hero_class: heroClass,
    score: 1234 + index * 500,
    total_damage: 150 + index * 40,
    enemies_defeated: 2 + index,
    longest_chain: 6 + index,
    dungeon_cleared: level !== 2,
    hp_remaining: level === 2 ? 0 : 50,
    turns_used: 10,
    best_turns_used: level === 2 ? null : 10,
    xp_earned: 100,
    attempts: 3,
    clears: level === 2 ? 0 : 2,
    completed_at: date,
  }));
  tables.rune_delve_daily_runs = [
    {
      id: "daily-history",
      user_id: uid,
      daily_date: date.slice(0, 10),
      score: 3456,
      stars: 2,
      dungeon_cleared: false,
      modifiers: [],
      hero_class: heroClass,
      completed_at: date,
      kills_count: 17,
    },
  ];
  tables.rune_delve_bestiary = BESTIARY_ROSTER.slice(0, 6).map(
    (enemy, index) => ({
      id: `bestiary-${index}`,
      user_id: uid,
      archetype_id: enemy.id,
      defeat_count: index + 1,
      first_defeated_at: date,
      last_defeated_at: date,
      highest_level_defeated: 17,
      created_at: date,
      updated_at: date,
    }),
  );
  for (const scope of ["daily", "weekly"]) {
    for (let index = 0; index < 3; index++) {
      const id = `${scope}-quest-${index}`;
      tables.rune_delve_quest_definitions.push({
        id,
        scope,
        title: `${scope === "daily" ? "Daily" : "Weekly"} ${["Delver", "Chainweaver", "Class trial"][index]}`,
        description: "Complete campaign encounters to earn Rune Shards.",
        objective_type: "levels_cleared",
        target_value: index + 1,
        shard_reward: 25 + index * 10,
        xp_reward: 20,
        is_personal: index === 2,
        hero_class: index === 2 ? heroClass : null,
        weight: 1,
      });
      tables.rune_delve_active_quests.push({
        id: `active-${id}`,
        user_id: uid,
        quest_id: id,
        scope,
        period_key: scope === "daily" ? dailyPeriodKey() : weeklyPeriodKey(),
        progress: index === 0 ? 1 : 0,
        target_value: index + 1,
        status: index === 0 ? "completed" : "active",
        claimed_at: null,
      });
    }
  }
}
export const qa = {
  tables,
  authenticated: true,
  puzzleUserId: params.get("puzzleUser") || uid,
  failRpcOnce: [] as string[],
  delayRpc: {} as Record<string, number>,
  losePuzzleReceiptOnce: false,
  queries: [] as any[],
  writes: [] as any[],
  rpcs: [] as any[],
  failTables: (params.get("fail")?.split(",") ||
    (scenario === "offline" ? ["rune_delve_heroes"] : [])) as string[],
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
const protectedTables = new Set([
  "rune_puzzle_definitions",
  "rune_puzzle_profiles",
  "rune_puzzle_results",
  "rune_puzzle_receipts",
  "rune_delve_heroes",
  "rune_delve_wallet",
  "rune_delve_relic_unlocks",
  "rune_delve_class_progress",
  "rune_delve_progress",
  "rune_delve_runs",
  "rune_delve_daily_runs",
  "rune_delve_daily_streaks",
  "rune_delve_failure_rewards",
  "rune_delve_loadouts",
  "rune_delve_quest_definitions",
  "rune_delve_active_quests",
  "rune_delve_action_receipts",
  "rune_delve_expedition_runs",
  "rune_delve_expedition_progress",
]);
const isClass = (value: unknown): value is HeroClass =>
  CLASS_LIST.some((cls) => cls.id === value);
const ownHero = () =>
  tables.rune_delve_heroes.find((row) => row.user_id === uid);
const canonical = (value: any): string =>
  JSON.stringify(value, (_key, entry) =>
    entry && typeof entry === "object" && !Array.isArray(entry)
      ? Object.fromEntries(
          Object.keys(entry)
            .sort()
            .map((key) => [key, entry[key]]),
        )
      : entry,
  );
function priorReceipt(kind: string, id: string, input: any) {
  if (!id) return fail("missing_request_id");
  const old = receipts.get(id);
  if (!old) return null;
  if (old.kind !== kind || canonical(old.input) !== canonical(input))
    return fail("request_id_reused");
  return { data: structuredClone(old.result), error: null };
}
function saveReceipt(kind: string, id: string, input: any, result: any) {
  receipts.set(id, structuredClone({ kind, input, result }));
  tables.rune_delve_action_receipts.push({
    user_id: uid,
    request_id: id,
    action_kind: kind,
    action_key: structuredClone(input),
    result: structuredClone(result),
    created_at: date,
  });
}
function ensureWallet() {
  let wallet = tables.rune_delve_wallet.find((row) => row.user_id === uid);
  if (!wallet) {
    wallet = {
      user_id: uid,
      shards: 0,
      lifetime_shards_earned: 0,
      slots_unlocked: 2,
    };
    tables.rune_delve_wallet.push(wallet);
  }
  const maxLevel = Math.max(
    1,
    ...tables.rune_delve_class_progress
      .filter((row) => row.user_id === uid)
      .map((row) => row.level),
  );
  wallet.slots_unlocked = Math.max(
    wallet.slots_unlocked,
    maxLevel >= 25 ? 3 : 2,
  );
  return wallet;
}
function ensureTrack(cls: HeroClass) {
  let track = tables.rune_delve_class_progress.find(
    (row) => row.user_id === uid && row.class === cls,
  );
  if (!track) {
    const hero = ownHero();
    const inherits = hero?.class === cls;
    const legacy =
      inherits && tables.rune_delve_progress.find((row) => row.user_id === uid);
    track = {
      ...progress(crypto.randomUUID(), uid, 0),
      ...(legacy || {}),
      id: crypto.randomUUID(),
      user_id: uid,
      class: cls,
      xp: inherits ? hero.xp : 0,
      level: inherits ? hero.level : 1,
      cosmetic_title: inherits ? hero.cosmetic_title : titleForLevel(1, cls),
      lifetime_runs: inherits ? hero.lifetime_runs || 0 : 0,
      lifetime_score: inherits ? hero.lifetime_score || 0 : 0,
    };
    tables.rune_delve_class_progress.push(track);
  }
  return track;
}
function creditXp(cls: HeroClass, amount: number) {
  const track = ensureTrack(cls);
  const previousClassLevel = track.level;
  track.xp += Math.max(0, amount);
  track.level = Math.max(previousClassLevel, levelFromXp(track.xp).level);
  track.cosmetic_title = titleForLevel(track.level, cls);
  const hero = ownHero();
  if (hero?.class === cls)
    Object.assign(hero, {
      xp: track.xp,
      level: track.level,
      cosmetic_title: track.cosmetic_title,
    });
  return {
    previousClassLevel,
    classLevel: track.level,
    classXp: track.xp,
    cosmeticTitle: track.cosmetic_title,
    slotsUnlocked: ensureWallet().slots_unlocked,
  };
}
function creditShards(amount: number) {
  const wallet = ensureWallet();
  wallet.shards += amount;
  wallet.lifetime_shards_earned += amount;
}
function reportQuest(
  type: string,
  amount: number,
  cls: string,
  meta: any = {},
) {
  for (const quest of tables.rune_delve_active_quests) {
    const definition = tables.rune_delve_quest_definitions.find(
      (row) => row.id === quest.quest_id,
    );
    if (
      quest.user_id !== uid ||
      quest.status !== "active" ||
      definition?.objective_type !== type ||
      ![dailyPeriodKey(), weeklyPeriodKey()].includes(quest.period_key) ||
      (definition.is_personal &&
        definition.hero_class &&
        definition.hero_class !== cls)
    )
      continue;
    if (type === "high_level_clears" && meta.levelNumber < 30) continue;
    if (type === "bosses_defeated" && !meta.isBoss) continue;
    quest.progress = Math.min(
      quest.target_value,
      type === "longest_chain"
        ? Math.max(quest.progress, amount)
        : quest.progress + amount,
    );
    if (quest.progress >= quest.target_value) quest.status = "completed";
  }
}
function requestSeed(id: string) {
  let seed = 2166136261;
  for (const letter of id)
    seed = Math.imul(seed ^ letter.charCodeAt(0), 16777619);
  return seed >>> 0;
}
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
    if (table.startsWith("rune_puzzle_") && !qa.authenticated)
      return fail(`permission denied for table ${table}`);
    let rows = (tables[table] || []).filter(
      (row) =>
        filters.every((filter) => filter(row)) &&
        (!table.startsWith("rune_puzzle_") ||
          table === "rune_puzzle_definitions" ||
          row.user_id === qa.puzzleUserId),
    );
    if (verb !== "select") {
      qa.writes.push({ table, verb, body: structuredClone(body) });
      if (protectedTables.has(table)) {
        if (
          table !== "rune_delve_heroes" ||
          verb !== "update" ||
          Object.keys(body || {}).length !== 1 ||
          typeof body.hero_name !== "string" ||
          body.hero_name.trim().length < 2 ||
          body.hero_name.trim().length > 24
        )
          return fail(`permission denied for table ${table}`);
        rows = rows.filter((row) => row.user_id === uid);
      }
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
// New spatial journey data is separate from every legacy wallet, XP and run table.
const puzzleReceipts = new Map<
  string,
  { input: unknown; result: PuzzleCompletionReceipt }
>();
const puzzleFixtureStorage = "__rune-qa-puzzle-state";
try {
  const saved = JSON.parse(
    localStorage.getItem(puzzleFixtureStorage) || "null",
  );
  if (saved)
    for (const table of [
      "rune_puzzle_profiles",
      "rune_puzzle_results",
      "rune_puzzle_receipts",
    ]) {
      if (Array.isArray(saved[table])) tables[table] = saved[table];
    }
} catch {
  /* Fixture storage is optional. */
}
for (const row of tables.rune_puzzle_receipts)
  puzzleReceipts.set(`${row.user_id}:${row.request_id}`, {
    input: {
      roomId: row.room_id,
      definitionVersion: row.definition_version,
      actions: row.actions,
    },
    result: row.result,
  });
function persistPuzzleFixture() {
  try {
    localStorage.setItem(
      puzzleFixtureStorage,
      JSON.stringify(
        Object.fromEntries(
          [
            "rune_puzzle_profiles",
            "rune_puzzle_results",
            "rune_puzzle_receipts",
          ].map((table) => [table, tables[table]]),
        ),
      ),
    );
  } catch {
    /* Fixture storage is optional. */
  }
}
const seededPuzzleCompleted = Math.max(
  0,
  Math.min(
    PUZZLE_ROOMS.length,
    Math.floor(Number(params.get("puzzleCompleted")) || 0),
  ),
);
for (const room of PUZZLE_ROOMS.slice(0, seededPuzzleCompleted)) {
  if (
    !tables.rune_puzzle_results.some(
      (row) =>
        row.user_id === qa.puzzleUserId &&
        row.room_id === room.id &&
        row.definition_version === room.version,
    )
  )
    tables.rune_puzzle_results.push({
      user_id: qa.puzzleUserId,
      room_id: room.id,
      definition_version: room.version,
      stars: 3,
      best_pushes: room.parPushes,
      best_moves: room.solution.length,
      treasure_collected: true,
    });
}
function puzzleProfile(owner = qa.puzzleUserId): PuzzleProgress {
  let profile = tables.rune_puzzle_profiles.find(
    (row) => row.user_id === owner,
  );
  if (!profile) {
    profile = {
      user_id: owner,
      avatar:
        owner === (params.get("puzzleUser") || uid) &&
        isClass(params.get("avatar"))
          ? params.get("avatar")
          : "warrior",
    };
    tables.rune_puzzle_profiles.push(profile);
    persistPuzzleFixture();
  }
  const active = tables.rune_puzzle_definitions
    .filter((row) => row.active)
    .sort((a, b) => a.ordinal - b.ordinal);
  const current = active.flatMap((definition) => {
    const row = tables.rune_puzzle_results.find(
      (result) =>
        result.user_id === owner &&
        result.room_id === definition.room_id &&
        result.definition_version === definition.definition_version,
    );
    return row ? [{ definition, row }] : [];
  });
  const records: PuzzleRecord[] = current.map(({ row }) => ({
    room_id: row.room_id,
    definition_version: row.definition_version,
    stars: row.stars,
    best_pushes: row.best_pushes,
    best_moves: row.best_moves,
    treasure_collected: row.treasure_collected,
  }));
  return {
    avatar: profile.avatar,
    completed: records.length,
    stars: records.reduce((sum, row) => sum + row.stars, 0),
    unlocked: Math.min(
      Math.max(1, ...active.map((row) => row.ordinal)),
      Math.max(1, ...current.map(({ definition }) => definition.ordinal + 1)),
    ),
    records,
  };
}
function completePuzzle(
  args: Record<string, unknown>,
  owner = qa.puzzleUserId,
) {
  if (
    typeof args.p_request_id !== "string" ||
    !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(args.p_request_id)
  )
    return fail("missing_request_id");
  const action = {
    roomId: args.p_room_id,
    definitionVersion: args.p_definition_version,
    actions: args.p_actions,
  };
  const receiptKey = `${owner}:${args.p_request_id}`;
  const oldReceipt = puzzleReceipts.get(receiptKey);
  if (oldReceipt)
    return canonical(oldReceipt.input) === canonical(action)
      ? { data: structuredClone(oldReceipt.result), error: null }
      : fail("request_id_reused");
  if (
    typeof args.p_room_id !== "string" ||
    !Number.isInteger(args.p_definition_version) ||
    !Array.isArray(args.p_actions) ||
    args.p_actions.length > 1200 ||
    !args.p_actions.every(
      (value) =>
        typeof value === "string" &&
        ["up", "right", "down", "left"].includes(value),
    )
  )
    return fail("invalid_puzzle_actions");
  const definition = tables.rune_puzzle_definitions.find(
    (row) =>
      row.active &&
      row.room_id === args.p_room_id &&
      row.definition_version === args.p_definition_version,
  );
  if (!definition) return fail("puzzle_definition_unavailable");
  if (definition.ordinal > puzzleProfile(owner).unlocked)
    return fail("puzzle_still_locked");
  const room = definition.definition as PuzzleRoom;
  const replay = replayPuzzle(room, args.p_actions as PuzzleDirection[]);
  if (!replay.valid || replay.state.status !== "solved")
    return fail("puzzle_not_solved");
  const stars = puzzleStars(room, replay.state),
    treasure = room.treasures.every((cell) =>
      replay.state.collected.includes(cell),
    );
  let result = tables.rune_puzzle_results.find(
    (row) =>
      row.user_id === owner &&
      row.room_id === room.id &&
      row.definition_version === room.version,
  );
  const firstClear = !result,
    oldStars = result?.stars ?? 0;
  if (!result) {
    result = {
      user_id: owner,
      room_id: room.id,
      definition_version: room.version,
      stars,
      best_pushes: replay.state.pushes,
      best_moves: replay.state.moves,
      treasure_collected: treasure,
    };
    tables.rune_puzzle_results.push(result);
  } else {
    if (replay.state.pushes < result.best_pushes) {
      result.best_pushes = replay.state.pushes;
      result.best_moves = replay.state.moves;
    } else if (replay.state.pushes === result.best_pushes)
      result.best_moves = Math.min(result.best_moves, replay.state.moves);
    result.stars = Math.max(result.stars, stars);
    result.treasure_collected ||= treasure;
  }
  const profile = puzzleProfile(owner);
  const receipt: PuzzleCompletionReceipt = {
    requestId: args.p_request_id,
    roomId: room.id,
    definitionVersion: room.version,
    stars: result.stars,
    starsGained: result.stars - oldStars,
    pushes: replay.state.pushes,
    moves: replay.state.moves,
    treasureCollected: treasure,
    firstClear,
    unlocked: profile.unlocked,
    progress: profile,
  };
  puzzleReceipts.set(
    receiptKey,
    structuredClone({ input: action, result: receipt }),
  );
  tables.rune_puzzle_receipts.push({
    user_id: owner,
    request_id: args.p_request_id,
    room_id: room.id,
    definition_version: room.version,
    actions: structuredClone(args.p_actions),
    result: structuredClone(receipt),
  });
  qa.writes.push({
    table: "rune_puzzle_results",
    body: structuredClone(receipt),
  });
  persistPuzzleFixture();
  return { data: structuredClone(receipt), error: null };
}

async function rpc(name: string, args: any = {}) {
  qa.rpcs.push({ name, args });
  if (qa.failRpc.includes(name)) return fail("Fixture request interrupted");
  const failOnce = qa.failRpcOnce.indexOf(name);
  if (failOnce >= 0) {
    qa.failRpcOnce.splice(failOnce, 1);
    return fail("Fixture request interrupted");
  }
  if (name.startsWith("rune_puzzle_")) {
    if (!qa.authenticated) return fail("not_authenticated");
    const owner = qa.puzzleUserId;
    if (qa.delayRpc[name] > 0)
      await new Promise((resolve) => setTimeout(resolve, qa.delayRpc[name]));
    if (name === "rune_puzzle_profile")
      return { data: structuredClone(puzzleProfile(owner)), error: null };
    if (name === "rune_puzzle_select_avatar") {
      if (!isClass(args.p_avatar)) return fail("invalid_avatar");
      puzzleProfile(owner);
      tables.rune_puzzle_profiles.find((row) => row.user_id === owner)!.avatar =
        args.p_avatar;
      persistPuzzleFixture();
      return { data: structuredClone(puzzleProfile(owner)), error: null };
    }
    if (name === "rune_puzzle_complete") {
      const result = completePuzzle(args, owner);
      if (result.data && qa.losePuzzleReceiptOnce) {
        qa.losePuzzleReceiptOnce = false;
        return fail("Fixture lost result acknowledgement");
      }
      return result;
    }
    return fail(`Puzzle fixture RPC not implemented: ${name}`);
  }
  if (name === "dh_presence_directory")
    return { data: tables.profiles, error: null };
  if (name === "dh_feats_summary")
    return { data: { score: 0, unlocked: 0 }, error: null };
  if (
    [
      "rune_delve_earn_shards",
      "rune_delve_spend_shards",
      "rune_delve_report_quest",
      "rune_delve_advance_progress",
    ].includes(name)
  )
    return fail(`permission denied for function ${name}`);
  if (name === "rune_delve_bootstrap") {
    if (args.p_class != null && !isClass(args.p_class))
      return fail("Invalid class");
    let hero = ownHero();
    if (!hero && args.p_create_hero === true) {
      const cls = args.p_class || "warrior";
      const heroName = (args.p_hero_name ?? "Adventurer").trim();
      if (heroName.length < 2 || heroName.length > 24)
        return fail("Invalid hero name");
      hero = {
        id: crypto.randomUUID(),
        user_id: uid,
        hero_name: heroName,
        class: cls,
        level: 1,
        xp: 0,
        current_streak: 0,
        best_streak: 0,
        lifetime_runs: 0,
        lifetime_score: 0,
        cosmetic_title: titleForLevel(1, cls),
        last_run_date: null,
      };
      tables.rune_delve_heroes.push(hero);
    }
    const track = hero ? ensureTrack(args.p_class || hero.class) : null;
    return {
      data: structuredClone({
        hero: hero || null,
        track,
        wallet: ensureWallet(),
        progress:
          tables.rune_delve_progress.find((row) => row.user_id === uid) || null,
      }),
      error: null,
    };
  }
  if (name === "rune_delve_select_class") {
    if (!isClass(args.p_class)) return fail("Invalid class");
    const hero = ownHero();
    if (!hero) return fail("Create a hero first");
    const track = ensureTrack(args.p_class);
    Object.assign(hero, {
      class: args.p_class,
      xp: track.xp,
      level: track.level,
      cosmetic_title: track.cosmetic_title,
    });
    ensureWallet();
    return { data: structuredClone(hero), error: null };
  }
  if (name === "rune_delve_assign_quests") {
    const hero = ownHero();
    if (!hero) return fail("Create a hero first");
    const assigned = [];
    for (const scope of ["daily", "weekly"] as const) {
      const periodKey =
        scope === "daily" ? dailyPeriodKey() : weeklyPeriodKey();
      const definitions = rollQuestSet({
        defs: tables.rune_delve_quest_definitions,
        scope,
        periodKey,
        userId: uid,
        heroClass: hero.class,
      });
      for (const definition of definitions) {
        let quest = tables.rune_delve_active_quests.find(
          (row) =>
            row.user_id === uid &&
            row.quest_id === definition.id &&
            row.period_key === periodKey,
        );
        if (!quest) {
          quest = {
            id: crypto.randomUUID(),
            user_id: uid,
            quest_id: definition.id,
            scope,
            period_key: periodKey,
            progress: 0,
            target_value: definition.target_value,
            status: "active",
            claimed_at: null,
          };
          tables.rune_delve_active_quests.push(quest);
        }
        assigned.push(quest);
      }
    }
    return { data: structuredClone(assigned), error: null };
  }
  if (name === "rune_delve_equip") {
    if (!isClass(args.p_class)) return fail("Invalid class");
    const slots = [args.p_slot_1, args.p_slot_2, args.p_slot_3].filter(
      (slot) => slot != null,
    );
    if (new Set(slots).size !== slots.length)
      return fail("Each relic can only be equipped once.");
    if (args.p_slot_3 != null && ensureWallet().slots_unlocked < 3)
      return fail("Third relic slot is still locked");
    if (
      slots.some(
        (slot) =>
          !tables.rune_delve_relic_unlocks.some(
            (row) => row.user_id === uid && row.relic_id === slot,
          ),
      )
    )
      return fail("Unlock a relic before equipping it");
    let loadout = tables.rune_delve_loadouts.find(
      (row) => row.user_id === uid && row.class === args.p_class,
    );
    if (!loadout) {
      loadout = { id: crypto.randomUUID(), user_id: uid, class: args.p_class };
      tables.rune_delve_loadouts.push(loadout);
    }
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
    if (
      !Number.isInteger(definition?.level_number) ||
      definition.level_number < 1 ||
      definition.level_number > 100000
    )
      return fail("invalid_level");
    let row = tables.rune_delve_levels.find(
      (level) => level.level_number === definition.level_number,
    );
    if (!row) {
      row = {
        id: levelId(definition.level_number),
        ...generateLevel(definition.level_number),
        status: "active",
      };
      tables.rune_delve_levels.push(row);
    }
    return { data: structuredClone(row), error: null };
  }
  if (name === "rune_delve_buy_relic") {
    const input = {
      relic: args.p_relic_id,
      rank: args.p_expected_rank ?? null,
    };
    const prior = priorReceipt("relic", args.p_request_id, input);
    if (prior) return prior;
    const relic = RELIC_CATALOG.find((relic) => relic.id === args.p_relic_id);
    if (!relic) return fail("Relic unavailable");
    const owned = tables.rune_delve_relic_unlocks.find(
      (row) => row.user_id === uid && row.relic_id === relic.id,
    );
    if (owned && args.p_expected_rank == null) {
      saveReceipt("relic", args.p_request_id, input, owned);
      return { data: structuredClone(owned), error: null };
    }
    if (args.p_expected_rank != null && owned?.rank !== args.p_expected_rank)
      return fail("Rank changed — please retry");
    if (
      args.p_expected_rank != null &&
      (owned.rank >= 5 || args.p_expected_rank < 1)
    )
      return fail("Already at max rank");
    const hero = ownHero();
    if (!hero) return fail("Create a hero first");
    const depth = ensureTrack(hero.class).highest_unlocked_level;
    if (
      args.p_expected_rank == null &&
      Math.floor((depth - 1) / 50) + 1 < relic.tier
    )
      return fail("Relic tier is still locked");
    const cost =
      args.p_expected_rank == null
        ? relic.cost
        : rankCost(relic.cost, args.p_expected_rank + 1);
    const wallet = ensureWallet();
    if (wallet.shards < cost) return fail("Not enough Rune Shards");
    wallet.shards -= cost;
    const row = owned || {
      id: crypto.randomUUID(),
      user_id: uid,
      relic_id: relic.id,
      rank: 1,
      acquired_at: date,
      acquired_at_level: hero.level,
    };
    if (owned) owned.rank += 1;
    else tables.rune_delve_relic_unlocks.push(row);
    saveReceipt("relic", args.p_request_id, input, row);
    qa.writes.push({ table: "atomic-purchase", body: args });
    return { data: structuredClone(row), error: null };
  }
  if (name === "rune_delve_save_run") {
    const run = args.p_run;
    const prior = priorReceipt("run", args.p_request_id, run);
    if (prior) return prior;
    if (!ownHero() || !run || !isClass(run.hero_class))
      return fail("invalid_run");
    const n = run.level_number;
    if (
      !Number.isInteger(n) ||
      n < 1 ||
      n > 100000 ||
      !tables.rune_delve_levels.some(
        (row) => row.id === run.level_id && row.level_number === n,
      )
    )
      return fail("Chamber is unavailable. Please reload.");
    if (
      [
        "score",
        "turns_used",
        "total_damage",
        "longest_chain",
        "hp_remaining",
        "enemies_defeated",
      ].some((key) => !Number.isInteger(run[key]) || run[key] < 0)
    )
      return fail("invalid_run");
    if (
      run.score > 10000000 ||
      run.turns_used > 1000 ||
      run.total_damage > 10000000 ||
      run.longest_chain > 25 ||
      run.hp_remaining > 10000 ||
      run.enemies_defeated > 10000
    )
      return fail("invalid_run");
    const track = ensureTrack(run.hero_class);
    if (n > track.highest_unlocked_level) return fail("Level is still locked");
    const level = generateLevel(n);
    const context = run.reward_context || {};
    const turnLimit = level.turn_limit;
    const totalEnemies =
      level.enemy_config.length +
      (level.modifiers.waves || []).reduce(
        (sum, wave) => sum + wave.enemies.length,
        0,
      );
    const existing = tables.rune_delve_runs.find(
      (row) =>
        row.user_id === uid &&
        row.level_id === run.level_id &&
        row.hero_class === run.hero_class,
    );
    const old = structuredClone(existing || {});
    const cleared = !!run.dungeon_cleared;
    const firstClear = cleared && !old.dungeon_cleared;
    const meaningful =
      cleared ||
      (run.total_damage > 0 &&
        (run.turns_used >= 2 || run.enemies_defeated > 0));
    let failure = tables.rune_delve_failure_rewards.find(
      (row) =>
        row.user_id === uid &&
        row.level_number === n &&
        row.hero_class === run.hero_class,
    );
    if (!failure) {
      failure = {
        id: crypto.randomUUID(),
        user_id: uid,
        level_number: n,
        hero_class: run.hero_class,
        failure_count: 0,
      };
      tables.rune_delve_failure_rewards.push(failure);
    }
    const failureCount = failure.failure_count + 1;
    failure.failure_count = cleared ? 0 : failureCount;
    failure.last_awarded_at = date;
    const xp = campaignXpForAttempt({
      levelNumber: n,
      score: run.score,
      cleared,
      isFirstClear: firstClear,
      previousBestScore: old.score || 0,
      failureCount,
      meaningful,
      enemiesKilled: run.enemies_defeated,
      totalEnemies,
      turnsUsed: run.turns_used,
      turnLimit,
      bossPhaseReached: Math.min(
        3,
        Math.max(0, context.boss_phase_reached || 0),
      ),
      bossHasRule: !!level.modifiers.boss_rule,
    });
    const equipped = tables.rune_delve_loadouts.find(
      (row) => row.user_id === uid && row.class === run.hero_class,
    );
    const compass = tables.rune_delve_relic_unlocks.find(
      (row) =>
        row.user_id === uid &&
        row.relic_id === "wanderers_compass" &&
        [equipped?.slot_1, equipped?.slot_2, equipped?.slot_3].includes(
          row.relic_id,
        ),
    );
    const compassMultiplier = compass
      ? 1.15 + 0.03 * (Math.max(1, Math.min(5, compass.rank)) - 1)
      : 1;
    const shardArgs = {
      levelNumber: n,
      compassEquipped: !!compass,
      compassMultiplier,
    };
    let shards = cleared
      ? computeClearShards({
          ...shardArgs,
          isFirstClear: firstClear,
          bossClear: n % 25 === 0,
          chapterCleared: firstClear && n % 50 === 0,
        }).total
      : computeFailureShards({
          ...shardArgs,
          failureCount,
          enemiesKilled: run.enemies_defeated,
          totalEnemies,
          turnsUsed: run.turns_used,
          turnLimit,
          bossHasRule: !!level.modifiers.boss_rule,
          bossPhaseReached: Math.min(
            3,
            Math.max(0, context.boss_phase_reached || 0),
          ),
        }).total;
    const variantAllowed = n > 1 && (n % 10 === 0 || n % 50 === 1);
    const path = variantAllowed ? context.path : null;
    shards = Math.round(
      shards * (path === "elite" ? 1.5 : path === "treasure" ? 1.25 : 1),
    );
    const treasureZones =
      path === "treasure" ? 3 : getLayoutForLevel(n).preview.treasureZones;
    const treasureCap =
      treasureZones *
      treasureShardValue(n) *
      (n <= 10 && path !== "treasure" ? 1 : 3);
    const treasure = Math.max(
      0,
      Math.min(treasureCap, Number(context.treasure_shards) || 0),
    );
    shards += cleared
      ? treasure
      : Math.round(treasure * failureMultiplier(failureCount));
    const oldClassLevel = track.level;
    if (run.hero_class === "rogue" && oldClassLevel >= 75)
      shards += Math.max(
        0,
        Math.min(run.turns_used * 2 + 2, Number(context.mastery_shards) || 0),
      );
    if (cleared && context.secondary_met) shards += 10;
    const row = existing || { id: crypto.randomUUID(), user_id: uid };
    Object.assign(row, run, {
      score: Math.max(old.score || 0, run.score),
      attempts: (old.attempts || 0) + 1,
      clears: (old.clears || 0) + Number(cleared),
      dungeon_cleared: !!old.dungeon_cleared || cleared,
      total_damage: Math.max(old.total_damage || 0, run.total_damage),
      enemies_defeated: Math.max(
        old.enemies_defeated || 0,
        run.enemies_defeated,
      ),
      longest_chain: Math.max(old.longest_chain || 0, run.longest_chain),
      best_turns_used: cleared
        ? Math.min(old.best_turns_used ?? Infinity, run.turns_used)
        : (old.best_turns_used ?? null),
      best_hp_remaining: Math.max(
        old.best_hp_remaining || 0,
        cleared ? run.hp_remaining : 0,
      ),
      xp_earned: Math.max(old.xp_earned || 0, xp),
      last_played_at: date,
      completed_at: date,
    });
    if (!existing) tables.rune_delve_runs.push(row);
    track.lifetime_runs += 1;
    track.lifetime_score += run.score;
    const hero = ownHero();
    hero.lifetime_runs += 1;
    hero.lifetime_score += run.score;
    if (cleared) {
      const newCampaign = n > track.highest_completed_level;
      track.highest_completed_level = Math.max(
        track.highest_completed_level,
        n,
      );
      track.highest_unlocked_level = Math.max(
        track.highest_unlocked_level,
        n + 1,
      );
      track.total_levels_cleared += Number(newCampaign);
      track.current_chapter =
        Math.floor((track.highest_unlocked_level - 1) / 50) + 1;
      let aggregate = tables.rune_delve_progress.find(
        (entry) => entry.user_id === uid,
      );
      if (!aggregate) {
        aggregate = progress(crypto.randomUUID(), uid, 0);
        tables.rune_delve_progress.push(aggregate);
      }
      aggregate.highest_completed_level = Math.max(
        aggregate.highest_completed_level,
        n,
      );
      aggregate.highest_unlocked_level = Math.max(
        aggregate.highest_unlocked_level,
        n + 1,
      );
      aggregate.total_levels_cleared += Number(newCampaign);
      aggregate.current_chapter =
        Math.floor((aggregate.highest_unlocked_level - 1) / 50) + 1;
    }
    const advancement = creditXp(run.hero_class, xp);
    creditShards(shards);
    let relicDrop = null;
    if (cleared) {
      const drop = rollRelicDrop({
        cleared: true,
        levelNumber: n,
        seed: requestSeed(args.p_request_id),
        ownedRelicIds: new Set(
          tables.rune_delve_relic_unlocks
            .filter((entry) => entry.user_id === uid)
            .map((entry) => entry.relic_id),
        ),
        bonusChance: path === "elite" ? 0.08 : 0,
      });
      if (drop) {
        relicDrop = {
          id: crypto.randomUUID(),
          user_id: uid,
          relic_id: drop.relic.id,
          rank: 1,
          acquired_at: date,
          acquired_at_level: n,
        };
        tables.rune_delve_relic_unlocks.push(relicDrop);
      }
    }
    reportQuest("class_run_complete", 1, run.hero_class);
    reportQuest("enemies_defeated", run.enemies_defeated, run.hero_class);
    reportQuest("total_score", run.score, run.hero_class);
    reportQuest("longest_chain", run.longest_chain, run.hero_class);
    reportQuest("shards_earned", shards, run.hero_class);
    reportQuest("class_xp_earned", xp, run.hero_class);
    if (run.ability_used)
      reportQuest(
        "abilities_used",
        Math.max(1, Math.min(1000, run.quest_context?.abilities_used || 1)),
        run.hero_class,
      );
    reportQuest(
      "bosses_defeated",
      Math.max(
        0,
        Math.min(run.enemies_defeated, run.quest_context?.bosses_defeated || 0),
      ),
      run.hero_class,
      { isBoss: true },
    );
    if (cleared) {
      reportQuest("levels_cleared", 1, run.hero_class);
      reportQuest("high_level_clears", 1, run.hero_class, { levelNumber: n });
      if (run.quest_context?.no_damage_clear)
        reportQuest("no_damage_clear", 1, run.hero_class);
    }
    const result = {
      row,
      wasNewBest: !existing || run.score > (old.score || 0),
      firstClear,
      improvedChain: run.longest_chain > (old.longest_chain || 0),
      improvedTurns:
        cleared &&
        (old.best_turns_used == null || run.turns_used < old.best_turns_used),
      improvedHp: cleared && run.hp_remaining > (old.best_hp_remaining || 0),
      shardsAwarded: shards,
      xpAwarded: xp,
      ...advancement,
      relicDrop,
    };
    saveReceipt("run", args.p_request_id, run, result);
    qa.writes.push({ table: "atomic-run", body: structuredClone(args) });
    return { data: structuredClone(result), error: null };
  }
  if (name === "rune_delve_save_daily") {
    const input = {
      kills: args.p_kills,
      score: args.p_score,
      class: args.p_class,
    };
    const prior = priorReceipt("daily", args.p_request_id, input);
    if (prior) return prior;
    if (
      !ownHero() ||
      !isClass(args.p_class) ||
      !Number.isInteger(args.p_kills) ||
      args.p_kills < 0 ||
      args.p_kills > 10000 ||
      !Number.isInteger(args.p_score) ||
      args.p_score < 0 ||
      args.p_score > 10000000
    )
      return fail("invalid_daily");
    const dateStr = date.slice(0, 10);
    const existing = tables.rune_delve_daily_runs.find(
      (row) => row.daily_date === dateStr && row.user_id === uid,
    );
    const firstAttempt = !existing;
    const previousBestKills = existing?.kills_count ?? 0;
    const bestKills = Math.max(previousBestKills, args.p_kills);
    const total = endlessRewardFor(bestKills);
    // Existing rows without paid columns were already paid by the previous
    // first-attempt contract. Derive that paid total rather than paying twice.
    const dailyReceipts = tables.rune_delve_action_receipts.filter(
      (receipt) =>
        receipt.user_id === uid &&
        receipt.action_kind === "daily" &&
        receipt.result?.dateStr === dateStr,
    );
    const legacyPaid = dailyReceipts.length
      ? dailyReceipts.reduce(
          (paid, receipt) => ({
            shards: paid.shards + (receipt.result?.reward?.shards ?? 0),
            xp: paid.xp + (receipt.result?.reward?.xp ?? 0),
          }),
          { shards: 0, xp: 0 },
        )
      : {
          shards: !existing
            ? 0
            : previousBestKills >= 50
              ? 900
              : previousBestKills >= 30
                ? 600
                : previousBestKills >= 20
                  ? 400
                  : previousBestKills >= 15
                    ? 250
                    : previousBestKills >= 10
                      ? 150
                      : previousBestKills >= 5
                        ? 75
                        : 25,
          xp: existing ? Math.min(500, previousBestKills * 10) : 0,
        };
    const paid = {
      shards: existing?.reward_shards_awarded ?? legacyPaid.shards,
      xp: existing?.reward_xp_awarded ?? legacyPaid.xp,
    };
    const delta = dailyRewardDelta(total, paid);
    const row = existing || {
      id: crypto.randomUUID(),
      user_id: uid,
      daily_date: dateStr,
    };
    const previousBestScore = existing?.score ?? 0;
    const isBest =
      !existing ||
      args.p_kills > previousBestKills ||
      (args.p_kills === previousBestKills &&
        args.p_score > (existing.score || 0));
    if (isBest)
      Object.assign(row, {
        score: args.p_score,
        stars: endlessStarsFor(args.p_kills),
        dungeon_cleared: false,
        modifiers: [],
        hero_class: args.p_class,
        kills_count: args.p_kills,
        completed_at: date,
      });
    row.stars = endlessStarsFor(bestKills);
    row.kills_count = bestKills;
    row.reward_shards_awarded = paid.shards + delta.shards;
    row.reward_xp_awarded = paid.xp + delta.xp;
    const completionReported = existing
      ? (existing.completion_reported ?? true)
      : false;
    const firstMeaningfulAttempt = bestKills > 0 && !completionReported;
    row.completion_reported = completionReported || bestKills > 0;
    if (!existing) tables.rune_delve_daily_runs.push(row);
    localStorage.setItem(
      "__rune-qa-daily-runs",
      JSON.stringify(tables.rune_delve_daily_runs),
    );
    const advancement = creditXp(args.p_class, delta.xp);
    creditShards(delta.shards);
    const rewarded = delta.shards > 0 || delta.xp > 0;
    if (firstMeaningfulAttempt) {
      const track = ensureTrack(args.p_class);
      track.lifetime_runs += 1;
      track.lifetime_score += args.p_score;
      const hero = ownHero();
      hero.lifetime_runs += 1;
      hero.lifetime_score += args.p_score;
      reportQuest("daily_challenges_completed", 1, args.p_class);
      reportQuest("class_run_complete", 1, args.p_class);
    }
    if (bestKills > previousBestKills)
      reportQuest(
        "enemies_defeated",
        bestKills - previousBestKills,
        args.p_class,
      );
    if (row.score > previousBestScore)
      reportQuest("total_score", row.score - previousBestScore, args.p_class);
    if (rewarded) {
      reportQuest("shards_earned", delta.shards, args.p_class);
      reportQuest("class_xp_earned", delta.xp, args.p_class);
    }
    if (bestKills >= 3) {
      let streak = tables.rune_delve_daily_streaks.find(
        (entry) => entry.user_id === uid,
      );
      if (!streak) {
        streak = {
          user_id: uid,
          current_streak: 0,
          best_streak: 0,
          lifetime_clears: 0,
          last_completed_date: null,
        };
        tables.rune_delve_daily_streaks.push(streak);
      }
      if (streak.last_completed_date !== dateStr) {
        const yesterday = new Date(`${dateStr}T00:00:00Z`);
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        streak.current_streak =
          streak.last_completed_date === yesterday.toISOString().slice(0, 10)
            ? streak.current_streak + 1
            : 1;
        streak.best_streak = Math.max(
          streak.best_streak,
          streak.current_streak,
        );
        streak.lifetime_clears += 1;
        streak.last_completed_date = dateStr;
      }
    }
    const result = {
      stars: endlessStarsFor(bestKills),
      reward: { ...delta, title: total.title },
      dailyRewardTotal: {
        shards: row.reward_shards_awarded,
        xp: row.reward_xp_awarded,
      },
      dateStr,
      kills: args.p_kills,
      rewarded,
      firstAttempt,
      firstMeaningfulAttempt,
      previousBestKills,
      bestKills,
      improvedReward: !firstAttempt && rewarded,
      ...advancement,
    };
    saveReceipt("daily", args.p_request_id, input, result);
    qa.writes.push({ table: "atomic-daily", body: structuredClone(args) });
    return { data: structuredClone(result), error: null };
  }
  if (name === "rune_delve_claim_quest") {
    const quest = tables.rune_delve_active_quests.find(
      (row) => row.user_id === uid && row.id === args.p_quest_id,
    );
    if (!quest) return fail("Quest unavailable");
    const definition = tables.rune_delve_quest_definitions.find(
      (row) => row.id === quest.quest_id,
    );
    if (!definition) return fail("Quest unavailable");
    const alreadyClaimed = quest.status === "claimed";
    if (
      !alreadyClaimed &&
      (quest.status !== "completed" || quest.progress < quest.target_value)
    )
      return fail("Quest not completed");
    if (!ownHero()) return fail("Create a hero first");
    let advancement = {};
    if (!alreadyClaimed) {
      quest.status = "claimed";
      quest.claimed_at = date;
      creditShards(Math.max(0, definition.shard_reward || 0));
      advancement = creditXp(
        definition.hero_class || ownHero().class,
        Math.max(0, definition.xp_reward || 0),
      );
    }
    return {
      data: {
        ...advancement,
        shards: alreadyClaimed ? 0 : definition.shard_reward || 0,
        xp: alreadyClaimed ? 0 : definition.xp_reward || 0,
        title: definition?.title || "Quest",
        scope: quest.scope,
        alreadyClaimed,
      },
      error: null,
    };
  }
  if (name === "rune_delve_expedition_profile") {
    if (
      !tables.club_members.some(
        (row) => row.user_id === uid && row.club_id === args.p_club_id,
      )
    )
      return fail("club_membership_required");
    const progress = tables.rune_delve_expedition_progress.find(
      (row) => row.user_id === uid && row.club_id === args.p_club_id,
    );
    return {
      data: {
        highest_ascension: progress?.highest_ascension || 0,
        best_score: progress?.best_score || 1200,
        total_runs: progress?.total_runs || 0,
        total_clears: progress?.total_clears || 0,
        active_run:
          Object.values(savedTickets).find(
            (ticket: any) =>
              !ticket.receipt &&
              !ticket.abandoned &&
              (ticket.club_id || "club") === args.p_club_id,
          ) || null,
      },
      error: null,
    };
  }
  if (name === "rune_delve_expedition_begin") {
    if (
      !tables.club_members.some(
        (row) => row.user_id === uid && row.club_id === args.p_club_id,
      )
    )
      return fail("club_membership_required");
    if (
      !ownHero() ||
      !args.p_id ||
      !isClass(args.p_hero_class) ||
      !Number.isInteger(args.p_ascension) ||
      args.p_ascension < 0 ||
      args.p_ascension > 7
    )
      return fail("invalid_expedition");
    const existing = savedTickets[args.p_id];
    if (existing) {
      if (
        existing.receipt ||
        existing.abandoned ||
        existing.hero_class !== args.p_hero_class ||
        existing.ascension !== args.p_ascension ||
        (existing.club_id || "club") !== args.p_club_id
      )
        return fail("expedition_ticket_mismatch");
      return { data: structuredClone(existing), error: null };
    }
    const progress = tables.rune_delve_expedition_progress.find(
      (row) => row.user_id === uid && row.club_id === args.p_club_id,
    );
    if (args.p_ascension > (progress?.highest_ascension || 0))
      return fail("clear_the_previous_ascension_first");
    for (const ticket of Object.values(savedTickets) as any[])
      if (!ticket.receipt && (ticket.club_id || "club") === args.p_club_id)
        ticket.abandoned = true;
    const ticket = {
      id: args.p_id,
      seed: 728391,
      hero_class: args.p_hero_class,
      club_id: args.p_club_id,
      ascension: args.p_ascension,
      started_at: date,
    };
    savedTickets[ticket.id] = ticket;
    tables.rune_delve_expedition_runs.push({
      ...ticket,
      user_id: uid,
      status: "active",
    });
    persistTickets();
    qa.writes.push({ table: "expedition-ticket", body: structuredClone(args) });
    return { data: structuredClone(ticket), error: null };
  }
  if (name === "rune_delve_expedition_finish") {
    if (!savedTickets[args.p_id]) return fail("Run not found");
    const ticket = savedTickets[args.p_id];
    if (ticket.abandoned) return fail("expedition_was_replaced");
    if (ticket.receipt)
      return { data: structuredClone(ticket.receipt), error: null };
    if (
      !Number.isInteger(args.p_rooms) ||
      args.p_rooms < 0 ||
      args.p_rooms > 6 ||
      !Number.isInteger(args.p_turns) ||
      args.p_turns < args.p_rooms ||
      args.p_turns > 180 ||
      !Number.isInteger(args.p_score) ||
      args.p_score < 0 ||
      args.p_score > 250000 ||
      typeof args.p_cleared !== "boolean" ||
      args.p_cleared !== (args.p_rooms === 6) ||
      (args.p_rooms > 0 && args.p_score === 0)
    )
      return fail("invalid_expedition_result");
    const reward = expeditionReward(
      args.p_rooms,
      ticket.ascension,
      args.p_cleared,
    );
    const advancement = creditXp(ticket.hero_class, reward);
    creditShards(reward);
    let progress = tables.rune_delve_expedition_progress.find(
      (row) => row.user_id === uid && row.club_id === ticket.club_id,
    );
    if (!progress) {
      progress = {
        user_id: uid,
        club_id: ticket.club_id,
        highest_ascension: 0,
        best_score: 0,
        total_runs: 0,
        total_clears: 0,
      };
      tables.rune_delve_expedition_progress.push(progress);
    }
    progress.highest_ascension = Math.max(
      progress.highest_ascension,
      args.p_cleared ? Math.min(7, ticket.ascension + 1) : 0,
    );
    progress.best_score = Math.max(progress.best_score, args.p_score);
    progress.total_runs += 1;
    progress.total_clears += Number(args.p_cleared);
    ticket.receipt = {
      reward,
      xpAwarded: reward,
      ...advancement,
      rooms: args.p_rooms,
      cleared: args.p_cleared,
      highest_ascension: progress.highest_ascension,
      best_score: progress.best_score,
    };
    const run = tables.rune_delve_expedition_runs.find(
      (row) => row.id === ticket.id,
    );
    if (run)
      Object.assign(run, {
        status: "banked",
        rooms: args.p_rooms,
        score: args.p_score,
        turns: args.p_turns,
        cleared: args.p_cleared,
        reward,
        finished_at: date,
      });
    reportQuest("shards_earned", reward, ticket.hero_class);
    reportQuest("class_xp_earned", reward, ticket.hero_class);
    reportQuest("total_score", args.p_score, ticket.hero_class);
    if (args.p_cleared) {
      reportQuest("class_run_complete", 1, ticket.hero_class);
      reportQuest("bosses_defeated", 1, ticket.hero_class, { isBoss: true });
    }
    persistTickets();
    qa.writes.push({ table: "expedition-finish", body: structuredClone(args) });
    return { data: structuredClone(ticket.receipt), error: null };
  }
  if (name.startsWith("rune_delve_"))
    return fail(`Rune fixture RPC not implemented: ${name}`);
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
