// Isolated PostgreSQL migration contract. Never writes to live club accounts.
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const c = JSON.parse(
  await readFile("/tmp/nexus-long-game-contract.json", "utf8"),
);
const db = new PGlite(),
  id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let n = 1000,
  checks = 0;
const check = async (name, fn) => {
  await fn();
  checks++;
  console.log("PASS", name);
};
await db.exec(`create role anon;create role authenticated;create schema auth;
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.user',true),'')::uuid$$;
create table profiles(id uuid primary key,display_name text);create table clubs(id uuid primary key);create table club_members(user_id uuid,club_id uuid);create table platform_assets(slug text,short_description text,full_description text);
grant usage on schema public,auth to authenticated,anon;grant select on profiles,club_members,clubs to authenticated;
insert into profiles values('${id(1)}','Alice'),('${id(2)}','Bob');insert into clubs values('${id(10)}'),('${id(11)}');insert into club_members values('${id(1)}','${id(10)}'),('${id(2)}','${id(11)}');`);
for (const f of [
  "20261029000000_nexus_core_overhaul.sql",
  "20261029010000_nexus_core_economy.sql",
  "20261029020000_nexus_endless_loadouts.sql",
  "20261029030000_nexus_combat_pacing.sql",
])
  await db.exec(await readFile("supabase/migrations/" + f, "utf8"));
await db.exec(
  `insert into nexus_core_profiles(user_id,credits,research,total_waves,endless_best) values('${id(1)}',123,'{"weapons":4}',30,12)`,
);
const migration = await readFile(
  "supabase/migrations/20261030000000_nexus_long_game.sql",
  "utf8",
);
await db.exec(migration);
await db.exec(migration);
await db.exec("set role authenticated");
await db.query("select set_config('test.user',$1,false)", [id(1)]);
const rpc = async (name, args = []) =>
  (
    await db.query(
      `select ${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) r`,
      args,
    )
  ).rows[0].r;
const owner = async (sql, args = []) => {
  await db.exec("reset role");
  try {
    return await db.query(sql, args);
  } finally {
    await db.exec("set role authenticated");
  }
};
const seed = async (patch) => {
  for (const [k, v] of Object.entries(patch))
    await owner(`update nexus_core_profiles set ${k}=$1 where user_id=$2`, [
      k === "research" ? JSON.stringify(v) : v,
      id(1),
    ]);
};
const begin = (
  run,
  loadout = { weapons: [], module: null },
  version = 6,
  difficulty = 1,
) =>
  rpc("nexus_core_begin_endless", [
    id(run),
    id(10),
    JSON.stringify(loadout),
    version,
    difficulty,
  ]);
const finish = (payload) =>
  rpc("nexus_core_finish_endless", [JSON.stringify(payload), id(10)]);
const backdate = (run) =>
  owner(
    "update nexus_core_sessions set created_at=clock_timestamp()-interval '1 day' where id=$1",
    [id(run)],
  );
await check("repeatable migration preserves account data", async () => {
  const p = await rpc("nexus_core_profile");
  assert.equal(p.credits, 123);
  assert.equal(p.total_waves, 30);
  assert.equal(p.endless_best, 12);
  assert.deepEqual(p.research, { weapons: 4 });
});
await check("all 12 unlock prices, gates and idempotent debits", async () => {
  for (const a of c.armory) {
    await seed({ credits: 100000, total_waves: a.waves - 1 });
    await assert.rejects(rpc("nexus_core_unlock", [a.id]), /lifetime waves/);
    await seed({ total_waves: a.waves, credits: a.cost - 1 });
    await assert.rejects(rpc("nexus_core_unlock", [a.id]), /credits/);
    await seed({ credits: 100000 });
    const p = await rpc("nexus_core_unlock", [a.id]);
    assert.equal(p.credits, 100000 - a.cost);
    assert.ok(p.unlocks.includes(a.id));
    assert.equal((await rpc("nexus_core_unlock", [a.id])).credits, p.credits);
  }
});
await check("all 180 research prices match JS and cap at30", async () => {
  for (const r of c.research) {
    await seed({ credits: 100000000, research: { [r.id]: r.level } });
    const p = await rpc("nexus_core_research", [r.id]);
    assert.equal(p.credits, 100000000 - r.cost);
    assert.equal(p.research[r.id], r.level + 1);
  }
  await assert.rejects(rpc("nexus_core_research", ["nova"]), /complete/);
});
await check("difficulty gates and immutable ticket retry", async () => {
  await seed({ research: {}, credits: 100000 });
  for (const d of c.difficulties) {
    if (d.waves) {
      await seed({ total_waves: d.waves - 1 });
      await assert.rejects(begin(n++, undefined, 6, d.id), /lifetime waves/);
    }
    await seed({ total_waves: d.waves });
    const rid = n++;
    const t = await begin(rid, undefined, 6, d.id);
    assert.equal(t.difficulty, d.id);
    assert.equal((await begin(rid, undefined, 6, 1)).difficulty, d.id);
  }
  await assert.rejects(begin(n++, undefined, 6, 7), /difficulty/);
  await assert.rejects(begin(n++, undefined, 5, 2), /difficulty/);
});
await check(
  "cached version4/5 cap research snapshots and reject new equipment",
  async () => {
    await seed({ research: { weapons: 30, salvage: 30 } });
    for (const v of [4, 5]) {
      const t = await begin(n++, undefined, v);
      assert.deepEqual(t.research, { weapons: 10, salvage: 10 });
      await assert.rejects(
        begin(n++, { weapons: ["laser"], module: null }, v),
        /current combat rules/,
      );
    }
  },
);
const payload = (rid, r) => ({
  id: id(rid),
  balanceVersion: r.balanceVersion,
  difficulty: r.difficulty ?? 1,
  scenarioId: "endless",
  phase: "defeat",
  cleared: r.waves,
  time: r.seconds,
  kills: r.kills,
  score: r.score,
  upgrades: r.upgrades,
  earned: r.energyEarned,
  spent: r.energySpent,
  energy: r.energy,
});
await check(
  "actual engine version4/5/6 and new weapons settle and retry safely",
  async () => {
    for (const r of [...c.runs, ...c.newRuns]) {
      await seed({ research: {}, total_waves: 10000, endless_best: 0 });
      const rid = n++;
      await begin(rid, r.loadout, r.balanceVersion, r.difficulty);
      await backdate(rid);
      const p = payload(rid, r);
      if (r.balanceVersion === 6)
        await assert.rejects(
          finish({ ...p, difficulty: r.difficulty === 1 ? 2 : 1 }),
          /Difficulty/,
        );
      const receipt = await finish(p);
      assert.ok(receipt.reward > 0);
      const again = await finish(p);
      assert.equal(again.profile.credits, receipt.profile.credits);
      assert.equal(again.reward, receipt.reward);
    }
  },
);
await check("every upgrade level has exact SQL/JS costs and cap", async () => {
  await seed({ research: {}, total_waves: 10000, endless_best: 10000 });
  for (const u of c.upgrades) {
    const weapons = c.armory.find((a) => a.id === u.id && a.kind === "weapon")
      ? [u.id]
      : [];
    const modules = {
      regen: "repair",
      income: "siphon",
      frost: "stasis",
      cooldown: "capacitor",
      thorns: "thorns",
    };
    const l = { weapons, module: modules[u.id] ?? null };
    const free = weapons.length ? 1 : 0;
    for (let level = free; level <= u.cap + 1; level++) {
      const rid = n++;
      await begin(rid, l);
      await backdate(rid);
      const spent =
          (u.totals[level] ?? u.totals[u.cap]) - (free ? u.totals[1] : 0),
        earned = 80 + 100000 * 4 + 25 * 1000 + 2.5 * 1000 * 1001;
      const p = {
        id: id(rid),
        balanceVersion: 6,
        difficulty: 1,
        scenarioId: "endless",
        phase: "defeat",
        cleared: 1000,
        time: 4000,
        kills: 100000,
        score: 0,
        upgrades: { [u.id]: level },
        spent,
        earned,
        energy: earned - spent,
      };
      if (level > u.cap) await assert.rejects(finish(p), /upgrade ledger/);
      else {
        await assert.rejects(
          finish({ ...p, spent: spent + 1 }),
          /energy ledger/,
        );
        await finish(p);
      }
    }
  }
});
await check(
  "loadout gating, difficulty mismatch and RLS remain enforced",
  async () => {
    await seed({ research: {} });
    const rid = n++;
    await begin(rid);
    await backdate(rid);
    const p = {
      id: id(rid),
      balanceVersion: 6,
      difficulty: 1,
      scenarioId: "endless",
      phase: "defeat",
      cleared: 1,
      time: 4,
      kills: 0,
      score: 0,
      upgrades: { laser: 1 },
      spent: 0,
      earned: 110,
      energy: 110,
    };
    await assert.rejects(finish(p), /loadout/);
    await assert.rejects(
      finish({ ...p, upgrades: {}, difficulty: 2 }),
      /Difficulty/,
    );
    await assert.rejects(
      db.exec("update nexus_core_profiles set credits=999"),
      /permission denied/,
    );
    await assert.rejects(
      db.exec("insert into nexus_core_runs(id) values(gen_random_uuid())"),
      /permission denied/,
    );
    const other = await db.query("select * from nexus_core_records($1,$2,$3)", [
      id(11),
      "endless",
      1,
    ]);
    assert.deepEqual(other.rows, []);
  },
);
await check(
  "records choose one current-rules best per member and separate threats",
  async () => {
    const frontier = (
      await db.query("select * from nexus_core_records($1,$2,$3)", [
        id(10),
        "endless",
        1,
      ])
    ).rows;
    const incursion = (
      await db.query("select * from nexus_core_records($1,$2,$3)", [
        id(10),
        "endless",
        2,
      ])
    ).rows;
    const singularity = (
      await db.query("select * from nexus_core_records($1,$2,$3)", [
        id(10),
        "endless",
        6,
      ])
    ).rows;
    assert.equal(frontier.length, 1);
    assert.equal(frontier[0].waves, 1000);
    assert.equal(incursion.length, 1);
    assert.equal(incursion[0].waves, c.newRuns[1].waves);
    assert.deepEqual(singularity, []);
  },
);
console.log(`PASS ${checks} long-game PostgreSQL contracts`);
await db.close();
