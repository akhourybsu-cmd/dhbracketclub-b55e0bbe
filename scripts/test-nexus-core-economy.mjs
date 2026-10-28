// Optional local dependency: @electric-sql/pglite. No live connection or credentials.
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const contract = JSON.parse(
  await readFile(process.argv[2] || "/tmp/nexus-economy-contract.json", "utf8"),
);
process.on("uncaughtException", (e) => {
  console.error("FAIL", e.message, e.where || "");
  process.exit(1);
});
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
await db.exec(
  await readFile(
    "supabase/migrations/20261029000000_nexus_core_overhaul.sql",
    "utf8",
  ),
);
await db.exec(
  `insert into nexus_core_profiles(user_id,credits,research) values('${id(1)}',100,'{"weapons":1}');`,
);
const migration = await readFile(
  "supabase/migrations/20261029010000_nexus_core_economy.sql",
  "utf8",
);
await db.exec(migration);
await db.exec(migration);
await db.exec("set role authenticated");
const actor = async (n) =>
  db.query("select set_config('test.user',$1,false)", [n ? id(n) : ""]);
const profile = async () =>
  (await db.query("select nexus_core_profile() p")).rows[0].p;
const begin = async (n, scenario = "1", club = 10, legacy = false) =>
  (
    await db.query("select nexus_core_begin($1,$2,$3,$4) t", [
      id(n),
      scenario,
      id(club),
      legacy,
    ])
  ).rows[0].t;
const finish = async (p, club = 10) =>
  (
    await db.query("select nexus_core_finish($1,$2) r", [
      JSON.stringify(p),
      id(club),
    ])
  ).rows[0].r;
const backdate = async (n) => {
  await db.exec("reset role");
  await db.query(
    "update nexus_core_sessions set created_at=clock_timestamp()-interval '1 day' where id=$1",
    [id(n)],
  );
  await db.exec("set role authenticated");
};
const payload = (n, extra = {}) => ({
  id: id(n),
  scenarioId: "1",
  phase: "victory",
  cleared: 5,
  hpRatio: contract.run.hullRatio,
  score: contract.run.score,
  kills: contract.run.kills,
  time: contract.run.seconds,
  upgrades: contract.run.upgrades,
  energy: contract.run.energy,
  earned: contract.run.energyEarned,
  spent: contract.run.energySpent,
  ...extra,
});
await actor(1);
await check(
  "migration preserves existing balances, research, and one legacy checkpoint slot",
  async () => {
    const p = await profile();
    assert.equal(p.credits, 100);
    assert.equal(p.research.weapons, 1);
    assert.equal(p.legacy_slot, true);
  },
);
await check(
  "unregistered and instant fabricated runs cannot earn credits",
  async () => {
    await assert.rejects(finish(payload(100)), /Deploy your nexus/);
    await begin(100);
    await assert.rejects(finish(payload(100)), /duration/);
    assert.equal((await profile()).credits, 100);
  },
);
await check(
  "first clear pays wave earnings plus a one-time bonus with one credit receipt",
  async () => {
    await backdate(100);
    const r = await finish(payload(100));
    assert.equal(r.reward, 90);
    assert.equal(r.waves, 20);
    assert.equal(r.bonus, 70);
    assert.equal(r.profile.credits, 190);
    const again = await finish(payload(100));
    assert.equal(again.profile.credits, 190);
    assert.equal(
      (await db.query("select * from nexus_core_ledger")).rows.length,
      1,
    );
  },
);
await check(
  "a repeat clear earns waves without farming the first-clear bonus",
  async () => {
    await begin(101);
    await backdate(101);
    const r = await finish(payload(101));
    assert.equal(r.reward, 20);
    assert.equal(r.bonus, 0);
  },
);
await check(
  "zero-wave losses pay nothing and generate no positive ledger entry",
  async () => {
    await begin(102, "endless");
    await finish(
      payload(102, {
        scenarioId: "endless",
        phase: "defeat",
        cleared: 0,
        hpRatio: 0,
        score: 0,
        kills: 0,
        time: 0,
        upgrades: {},
        energy: 80,
        earned: 80,
        spent: 0,
      }),
    );
    assert.equal(
      (
        await db.query("select * from nexus_core_ledger where run_id=$1", [
          id(102),
        ])
      ).rows.length,
      0,
    );
  },
);
await check(
  "deployment registration is idempotent and rejects changed parameters, other clubs, and locked sectors",
  async () => {
    const t = await begin(103, "2");
    const retry = await begin(103, "2");
    assert.equal(t.seed, retry.seed);
    assert.deepEqual(t.research, retry.research);
    await assert.rejects(begin(103, "1"), /Invalid deployment/);
    await assert.rejects(begin(104, "3"), /previous sector/);
    await assert.rejects(begin(104, "1", 11), /membership/);
  },
);
await check(
  "a new deployment closes the previous one without changing the wallet",
  async () => {
    const before = (await profile()).credits;
    await begin(104, "endless");
    await assert.rejects(
      finish(payload(103, { scenarioId: "2", cleared: 6 })),
      /Deploy your nexus/,
    );
    assert.equal((await profile()).credits, before);
  },
);
await check(
  "invalid energy, overspending, unknown upgrades, and challenge-forbidden purchases are rejected",
  async () => {
    await backdate(104);
    const base = payload(104, { scenarioId: "endless", phase: "defeat" });
    await assert.rejects(finish({ ...base, energy: -1 }), /energy ledger/);
    await assert.rejects(finish({ ...base, spent: 0 }), /energy ledger/);
    await assert.rejects(
      finish({ ...base, upgrades: { free_money: 1 } }),
      /upgrade ledger/,
    );
    await begin(105, "glass");
    await backdate(105);
    await assert.rejects(
      finish(
        payload(105, {
          scenarioId: "glass",
          cleared: 6,
          upgrades: { hull: 1 },
        }),
      ),
      /upgrade ledger/,
    );
  },
);
await check(
  "every frontend upgrade price and cap matches server settlement",
  async () => {
    for (const c of contract.costs) {
      const n = ++counter;
      await begin(n, "endless");
      await backdate(n);
      const earned = Math.max(2805, c.total + 100);
      const r = await finish(
        payload(n, {
          scenarioId: "endless",
          phase: "defeat",
          cleared: 10,
          hpRatio: 0,
          kills: 500,
          time: 500,
          upgrades: { [c.id]: c.level },
          energy: earned - c.total,
          earned,
          spent: c.total,
        }),
      );
      assert.equal(r.reward, 65);
    }
  },
);
await check(
  "all frontend wave payout formulas match the server across modes",
  async () => {
    // Unlock remaining sectors in this isolated fixture, then exercise the actual RPC.
    await db.exec("reset role");
    await db.query(
      `update nexus_core_profiles set campaign='{"1":3,"2":3,"3":3,"4":3,"5":3,"6":3,"7":3,"8":3}' where user_id=$1`,
      [id(1)],
    );
    await db.exec("set role authenticated");
    for (const c of contract.rewards) {
      const n = ++counter;
      await begin(n, c.id);
      await backdate(n);
      const r = await finish(
        payload(n, {
          scenarioId: c.id,
          phase: "defeat",
          cleared: c.waves,
          hpRatio: 0,
          kills: 0,
          score: 0,
          time: 500,
          upgrades: {},
          energy: 80 + 25 * c.waves + 2.5 * c.waves * (c.waves + 1),
          earned: 80 + 25 * c.waves + 2.5 * c.waves * (c.waves + 1),
          spent: 0,
        }),
      );
      assert.equal(r.waves, c.credits);
    }
  },
);
await check(
  "research debits are atomic, server-priced, and fully recorded",
  async () => {
    for (const c of contract.research) {
      await db.exec("reset role");
      await db.query(
        "update nexus_core_profiles set credits=10000,research=jsonb_build_object($1::text,$2::integer) where user_id=$3",
        [c.id, c.level, id(1)],
      );
      await db.exec("set role authenticated");
      const p = (await db.query("select nexus_core_research($1) p", [c.id]))
        .rows[0].p;
      assert.equal(p.credits, 10000 - c.cost);
      assert.equal(p.research[c.id], c.level + 1);
    }
    await db.exec("reset role");
    await db.query(
      "update nexus_core_profiles set credits=0,research='{}' where user_id=$1",
      [id(1)],
    );
    await db.exec("set role authenticated");
    await assert.rejects(
      db.query("select nexus_core_research('weapons')"),
      /Not enough credits/,
    );
  },
);
await check(
  "existing checkpoints may import once; new accounts cannot forge legacy imports",
  async () => {
    const n = ++counter;
    await begin(n, "1", 10, true);
    await finish(payload(n));
    await assert.rejects(
      begin(++counter, "1", 10, true),
      /no legacy checkpoint/,
    );
    await actor(2);
    await profile();
    await assert.rejects(
      begin(++counter, "1", 10, true),
      /no legacy checkpoint/,
    );
  },
);
await check(
  "credit ledger and tickets cannot be written directly or read across accounts",
  async () => {
    assert.equal(
      (await db.query("select * from nexus_core_ledger")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from nexus_core_sessions")).rows.length,
      0,
    );
    await assert.rejects(
      db.query("delete from nexus_core_ledger"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("update nexus_core_profiles set credits=999999"),
      /permission denied/,
    );
    await actor(null);
    await assert.rejects(begin(++counter), /membership/);
    await db.exec("reset role;set role anon");
    await assert.rejects(
      db.query("select nexus_core_begin($1,$2,$3,false)", [
        id(++counter),
        "1",
        id(10),
      ]),
      /permission denied/,
    );
  },
);
await db.close();
console.log(
  `${checks} economy database checks passed; ${contract.costs.length} upgrade levels and ${contract.research.length} research prices verified`,
);
