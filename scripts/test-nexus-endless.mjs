// Isolated PostgreSQL contract checks; requires optional @electric-sql/pglite.
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const contract = JSON.parse(
  await readFile("/tmp/nexus-endless-contract.json", "utf8"),
);
const db = new PGlite(),
  id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let checks = 0,
  counter = 1000;
const check = async (name, fn) => {
  await fn();
  checks++;
  console.log("PASS", name);
};
await db.exec(`create role anon;create role authenticated;create schema auth;
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.user',true),'')::uuid$$;
create table profiles(id uuid primary key,display_name text);create table clubs(id uuid primary key);create table club_members(user_id uuid,club_id uuid);create table platform_assets(slug text,short_description text,full_description text);
grant usage on schema public,auth to authenticated,anon;grant select on profiles,club_members,clubs to authenticated;
insert into profiles values('${id(1)}','Alice'),('${id(2)}','Bob'),('${id(3)}','Charlie');insert into clubs values('${id(10)}'),('${id(11)}');insert into club_members values('${id(1)}','${id(10)}'),('${id(2)}','${id(10)}'),('${id(3)}','${id(11)}');`);
for (const file of [
  "20261029000000_nexus_core_overhaul.sql",
  "20261029010000_nexus_core_economy.sql",
])
  await db.exec(await readFile("supabase/migrations/" + file, "utf8"));
await db.exec(
  `insert into nexus_core_profiles(user_id,credits,research,best_wave) values('${id(1)}',100,'{"weapons":1}',30);`,
);
const migration = await readFile(
  "supabase/migrations/20261029020000_nexus_endless_loadouts.sql",
  "utf8",
);
await db.exec(migration);
await db.exec(migration);
await db.exec("set role authenticated");
const actor = (n) =>
  db.query("select set_config('test.user',$1,false)", [n ? id(n) : ""]);
const rpc = async (name, args = []) => {
  const params = args.map((_, i) => "$" + (i + 1)).join(",");
  return (await db.query(`select ${name}(${params}) r`, args)).rows[0].r;
};
const profile = () => rpc("nexus_core_profile");
const owner = async (sql, args = []) => {
  await db.exec("reset role");
  try {
    return await db.query(sql, args);
  } finally {
    await db.exec("set role authenticated");
  }
};
const seed = async (n, patch) => {
  for (const [key, value] of Object.entries(patch)) {
    assert.ok(
      [
        "credits",
        "unlocks",
        "research",
        "total_waves",
        "endless_best",
      ].includes(key),
    );
    await owner(`update nexus_core_profiles set ${key}=$1 where user_id=$2`, [
      key === "research" ? JSON.stringify(value) : value,
      id(n),
    ]);
  }
};
const begin = async (n, loadout = { weapons: [], module: null }, club = 10) =>
  rpc("nexus_core_begin_endless", [id(n), id(club), JSON.stringify(loadout)]);
const finish = (run, club = 10) =>
  rpc("nexus_core_finish_endless", [JSON.stringify(run), id(club)]);
const backdate = (n) =>
  owner(
    "update nexus_core_sessions set created_at=clock_timestamp()-interval '1 day' where id=$1",
    [id(n)],
  );
const payload = (n, run = contract.runs[0]) => ({
  id: id(n),
  scenarioId: "endless",
  phase: "defeat",
  cleared: run.waves,
  time: run.seconds,
  kills: run.kills,
  score: run.score,
  upgrades: run.upgrades,
  earned: run.energyEarned,
  spent: run.energySpent,
  energy: run.energy,
  hpRatio: 0,
});
await actor(1);
await check(
  "migration is repeatable and preserves existing credits, research and archived best",
  async () => {
    const p = await profile();
    assert.equal(p.credits, 100);
    assert.deepEqual(p.research, { weapons: 1 });
    assert.equal(p.best_wave, 30);
    assert.equal(p.endless_best, 0);
    assert.equal(p.total_waves, 0);
    assert.deepEqual(p.unlocks, []);
    assert.deepEqual(p.loadout, { weapons: [], module: null });
  },
);
await check(
  "authentication, club membership and starter equipment are enforced",
  async () => {
    await actor(0);
    await assert.rejects(begin(99), /membership/);
    await assert.rejects(rpc("nexus_core_unlock", ["orbit"]), /Sign in/);
    await actor(3);
    await profile();
    await assert.rejects(begin(99), /membership/);
    await actor(2);
    await profile();
    await assert.rejects(
      begin(99, { weapons: ["orbit"], module: null }),
      /Invalid loadout/,
    );
    await assert.rejects(rpc("nexus_core_unlock", ["orbit"]), /lifetime waves/);
  },
);
await check(
  "all seven unlocks have matching server prices, lifetime gates and idempotent debits",
  async () => {
    await seed(2, { credits: 10000 });
    for (const item of contract.armory) {
      await seed(2, { total_waves: item.waves - 1 });
      await assert.rejects(
        rpc("nexus_core_unlock", [item.id]),
        /lifetime waves/,
      );
      await seed(2, { total_waves: item.waves, credits: item.cost - 1 });
      await assert.rejects(rpc("nexus_core_unlock", [item.id]), /credits/);
      await seed(2, { credits: 10000 });
      const p = await rpc("nexus_core_unlock", [item.id]);
      assert.equal(p.credits, 10000 - item.cost);
      assert.ok(p.unlocks.includes(item.id));
      const again = await rpc("nexus_core_unlock", [item.id]);
      assert.equal(again.credits, p.credits);
    }
  },
);
await check(
  "loadouts reject duplicates, excess power, too many weapons, malformed values and unknown modules",
  async () => {
    for (const value of [
      null,
      {},
      { weapons: ["arc", "rail"], module: null },
      { weapons: ["orbit", "orbit"], module: null },
      { weapons: ["arc", "orbit", "mortar"], module: null },
      { weapons: ["pulse"], module: null },
      { weapons: [], module: "unknown" },
      { weapons: "arc", module: null },
    ])
      await assert.rejects(rpc("nexus_core_loadout", [JSON.stringify(value)]));
    const loadout = { weapons: ["rail", "orbit"], module: "repair" };
    assert.deepEqual(
      (await rpc("nexus_core_loadout", [JSON.stringify(loadout)])).loadout,
      loadout,
    );
    assert.deepEqual((await profile()).loadout, loadout);
  },
);
await check(
  "deployment retries keep their seed, research and loadout; new deployments abandon old sessions",
  async () => {
    await seed(2, { research: { weapons: 1 } });
    const loadout = { weapons: ["rail", "orbit"], module: "repair" },
      a = await begin(100, loadout);
    await seed(2, { research: { weapons: 2 } });
    const b = await begin(100, { weapons: [], module: null });
    assert.equal(a.seed, b.seed);
    assert.deepEqual(b.research, { weapons: 1 });
    assert.deepEqual(b.loadout, loadout);
    await begin(101);
    await assert.rejects(begin(100, loadout), /closed/);
    await assert.rejects(finish(payload(100)), /Deploy your nexus/);
    await assert.rejects(
      rpc("nexus_core_begin", [id(102), "1", id(10), false]),
      /Endless loadout protocol/,
    );
  },
);
await check("new runs cannot use the old reward protocol", async () => {
  await begin(103);
  await backdate(103);
  await assert.rejects(
    rpc("nexus_core_finish", [JSON.stringify(payload(103)), id(10)]),
    /Endless reward protocol/,
  );
});
await check(
  "real engine builds reconcile energy, free starting equipment, loadout snapshots and reward ledgers",
  async () => {
    await seed(2, {
      research: {},
      endless_best: 0,
      total_waves: 0,
      credits: 0,
    });
    for (const run of contract.runs) {
      const n = counter++;
      await begin(n, run.loadout);
      await backdate(n);
      const before = await profile(),
        r = await finish(payload(n, run));
      const bonus = contract.milestones
        .filter((m) => m.wave > before.endless_best && m.wave <= run.waves)
        .reduce((s, m) => s + m.credits, 0);
      const wavePay = Math.min(
        1800,
        3 * run.waves + Math.floor((run.waves * run.waves) / 8),
      );
      assert.equal(r.waves, wavePay);
      assert.equal(r.bonus, bonus);
      assert.equal(r.reward, wavePay + bonus);
      assert.equal(r.profile.total_waves, before.total_waves + run.waves);
      assert.equal(r.profile.credits, before.credits + r.reward);
      const repeated = await finish(payload(n, run));
      assert.deepEqual(repeated, r);
    }
  },
);
await check(
  "invalid phase, fractional counters, missing weapons, unequipped upgrades and false energy budgets cannot pay",
  async () => {
    const n = counter++,
      run = contract.runs[1];
    await begin(n, run.loadout);
    await backdate(n);
    const p = payload(n, run);
    for (const patch of [
      { phase: "victory" },
      { cleared: 1.5 },
      { time: -1 },
      { earned: p.earned + 1 },
      { spent: p.spent + 1 },
      { upgrades: { ...p.upgrades, arc: 1 } },
      { upgrades: { ...p.upgrades, rail: 0 } },
      { upgrades: { ...p.upgrades, income: 1 } },
      { upgrades: { ...p.upgrades, mortar: 1 } },
    ])
      await assert.rejects(finish({ ...p, ...patch }));
    const recent = counter++;
    await begin(recent);
    await assert.rejects(finish(payload(recent)), /duration/);
  },
);
await check(
  "all upgrade prices and caps match the client including free weapon level 1",
  async () => {
    await seed(2, { research: {}, credits: 0 });
    for (const c of contract.costs) {
      const weapons = ["arc", "rail", "orbit", "mortar"].includes(c.id)
        ? [c.id]
        : [];
      const module =
        { regen: "repair", income: "siphon", frost: "stasis" }[c.id] || null;
      const free = weapons.length ? 1 : 0;
      if (c.level < free) continue;
      const base = contract.costs.find(
          (x) => x.id === c.id && x.level === free,
        ).total,
        spent = c.total - base;
      const n = counter++;
      await begin(n, { weapons, module });
      const result = await finish({
        id: id(n),
        scenarioId: "endless",
        phase: "defeat",
        cleared: 0,
        time: 0,
        kills: 400,
        score: 0,
        upgrades: { [c.id]: c.level },
        earned: 40000,
        spent,
        energy: 40000 - spent,
      });
      assert.equal(result.reward, 0);
    }
  },
);
await check(
  "research prices match all 60 client prices and record one debit per level",
  async () => {
    await seed(2, { research: {}, credits: 1000000 });
    for (const c of contract.research) {
      const before = await profile();
      assert.equal(before.research[c.id] || 0, c.level);
      const after = await rpc("nexus_core_research", [c.id]);
      assert.equal(before.credits - after.credits, c.cost);
      assert.equal(after.research[c.id], c.level + 1);
    }
    await assert.rejects(rpc("nexus_core_research", ["weapons"]), /complete/);
  },
);
await check(
  "milestones pay all newly crossed thresholds once; zero-wave runs and retries do not farm credits",
  async () => {
    await seed(2, {
      research: {},
      endless_best: 0,
      total_waves: 0,
      credits: 0,
    });
    for (const { wave, credits } of contract.rewards) {
      const n = counter++;
      await begin(n);
      await backdate(n);
      const before = await profile();
      const earned = 80 + 25 * wave + (5 * wave * (wave + 1)) / 2;
      const result = await finish({
        id: id(n),
        scenarioId: "endless",
        phase: "defeat",
        cleared: wave,
        time: wave * 4,
        kills: 0,
        score: 0,
        upgrades: {},
        earned,
        spent: 0,
        energy: earned,
      });
      assert.equal(result.waves, credits);
      assert.equal(
        result.bonus,
        contract.milestones
          .filter((m) => m.wave > before.endless_best && m.wave <= wave)
          .reduce((s, m) => s + m.credits, 0),
      );
      assert.deepEqual(await finish({ id: id(n) }), result);
    }
  },
);
await check(
  "RLS blocks direct profile edits, restricts ledger reads, and separates archived records",
  async () => {
    await assert.rejects(
      db.query(
        "update nexus_core_profiles set credits=999999 where user_id=$1",
        [id(2)],
      ),
      /permission/,
    );
    await actor(1);
    const own = await db.query("select * from nexus_core_ledger");
    assert.ok(own.rows.every((r) => r.user_id === id(1)));
    await actor(3);
    await assert.rejects(finish({ id: id(1000) }, 10), /membership/);
    const records = await db.query("select * from nexus_core_records($1,$2)", [
      id(10),
      "endless",
    ]);
    assert.equal(records.rows.length, 0);
    await actor(2);
    const r = await db.query("select * from nexus_core_records($1,$2)", [
      id(10),
      "endless",
    ]);
    assert.equal(r.rows.length, 1);
    assert.equal(r.rows[0].user_id, id(2));
    assert.equal(
      (
        await db.query("select * from nexus_core_records($1,$2)", [
          id(10),
          "campaign",
        ])
      ).rows.length,
      0,
    );
  },
);
console.log(
  `PASS ${checks} PostgreSQL contract groups; ${contract.costs.length} upgrade points, ${contract.research.length} research prices, ${contract.armory.length} unlocks`,
);
await db.close();
