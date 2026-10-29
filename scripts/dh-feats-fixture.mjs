// Actual deployed SQL protocol in isolated PostgreSQL; no live user records.
import { readFile } from "node:fs/promises";
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export async function createFeatsFixture() {
  const { PGlite } = await import(
    process.env.PGLITE_MODULE || "@electric-sql/pglite"
  );
  const db = new PGlite();
  let queue = Promise.resolve(),
    seq = 1000;
  const run = (fn) => {
    const pending = queue.then(fn);
    queue = pending.catch(() => {});
    return pending;
  };
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.user',true),'')::uuid$$;grant usage on schema public,auth to authenticated,anon;`,
  );
  await db.exec(
    await readFile("scripts/fixtures/dh-feats-sources.sql", "utf8"),
  );
  await db.exec(
    `insert into profiles(id,display_name) values('${id(1)}','Alex'),('${id(2)}','Blair'),('${id(3)}','Casey');insert into club_members(user_id,club_id) values('${id(1)}','${id(10)}'),('${id(2)}','${id(10)}'),('${id(3)}','${id(10)}');`,
  );
  await db.exec(
    await readFile("supabase/migrations/20261029040000_dh_feats.sql", "utf8"),
  );
  const seed = (table, row) =>
    run(async () => {
      const record = { id: id(seq++), ...row },
        cols = Object.keys(record);
      await db.exec("reset role");
      await db.query(
        `insert into ${table}(${cols.join(",")}) values(${cols.map((_, i) => "$" + (i + 1)).join(",")})`,
        Object.values(record).map((v) =>
          v && typeof v === "object" ? JSON.stringify(v) : v,
        ),
      );
      return record.id;
    });
  const rpc = (name, args) =>
    run(async () => {
      if (
        ![
          "dh_feats_summary",
          "dh_home_progress",
          "dh_feats_board",
          "dh_feats_pin",
          "dh_feats_seen",
        ].includes(name)
      )
        throw new Error("Unexpected RPC");
      await db.query("select set_config('test.user',$1,false)", [id(1)]);
      await db.exec("set role authenticated");
      try {
        const values = Object.values(args || {});
        const result = await db.query(
          `select ${name}(${values.map((_, i) => "$" + (i + 1)).join(",")}) r`,
          values,
        );
        return { data: result.rows[0].r, error: null };
      } catch (error) {
        return { data: null, error: { message: error.message } };
      } finally {
        await db.exec("reset role");
      }
    });
  const assetSlugs = [
    "daily-find",
    "posts",
    "lore",
    "polls",
    "rankings",
    "draft-arena",
    "nexus-defense",
    "rune-delve",
    "workout-competition",
    "portfolio-wars",
    "readshift",
    "nfl-pickem",
    "brackets",
    "lockbox",
    "events",
    "narrative-rpg",
    "splendid-journey",
  ];
  const install = async (page) => {
    await page.route("**/*", (route) =>
      new URL(route.request().url()).hostname === "127.0.0.1"
        ? route.continue()
        : route.abort(),
    );
    await page.exposeFunction("dhFeatsRpc", (name, args) => rpc(name, args));
    await page.route("**/src/contexts/AuthContext.tsx*", (route) =>
      route.fulfill({
        contentType: "text/javascript",
        body: `export const useAuth=()=>({user:{id:'${id(1)}'}});`,
      }),
    );
    await page.route("**/src/contexts/ClubContext.tsx*", (route) =>
      route.fulfill({
        contentType: "text/javascript",
        body: `export const useClub=()=>({club:{id:'${id(10)}',name:'Dry My Horse'}});`,
      }),
    );
    await page.route("**/src/hooks/useClubAssets.ts*", (route) =>
      route.fulfill({
        contentType: "text/javascript",
        body: `const installed=${JSON.stringify(assetSlugs)};export const useClubAssets=()=>({isInstalled:slug=>installed.includes(slug)&&!(window.disabledFeatAssets||[]).includes(slug)});`,
      }),
    );
    await page.route("**/src/integrations/supabase/client.ts*", (route) =>
      route.fulfill({
        contentType: "text/javascript",
        body: `export const supabase={rpc:async(name,args)=>{if(window.featOffline)return {data:null,error:{message:'Offline'}};if(name==='dh_feats_pin'&&window.failFeatPins)return {data:null,error:{message:'Offline'}};return window.dhFeatsRpc(name,args);}};`,
      }),
    );
  };
  return {
    id,
    seed,
    rpc,
    install,
    ownerQuery: (sql, args = []) =>
      run(async () => {
        await db.exec("reset role");
        return db.query(sql, args);
      }),
    ownerExec: (sql) =>
      run(async () => {
        await db.exec("reset role");
        return db.exec(sql);
      }),
    close: () => run(() => db.close()),
  };
}
