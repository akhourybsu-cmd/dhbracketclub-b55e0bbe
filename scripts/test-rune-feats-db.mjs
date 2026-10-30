// Real DH Feats + Expedition SQL in isolated PostgreSQL. No live account writes.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFeatsFixture } from './dh-feats-fixture.mjs';
const fixture = await createFeatsFixture();
const { id } = fixture;
const original = JSON.parse(await readFile('src/lib/feats/catalog.json','utf8'));
const extra = JSON.parse(await readFile('src/lib/feats/runeExpeditionCatalog.json','utf8'));
let checks=0;
const check=async(name,fn)=>{await fn();checks++;console.log('PASS',name);};
const query=fixture.ownerQuery;
const exec=fixture.ownerExec;
const board=async()=>{const result=await fixture.rpc('dh_feats_board',{p_club_id:id(10)});if(result.error)throw new Error(result.error.message);return result.data;};
const rpc=async(name,args=[])=>(await query(`select to_jsonb(${name}(${args.map((_,i)=>'$'+(i+1)).join(',')})) r`,args)).rows[0].r;
try {
  await exec(`
    create table platform_assets(id uuid primary key,slug text);
    create table rune_delve_heroes(user_id uuid primary key);
    create table rune_delve_wallet(user_id uuid primary key,shards integer not null default 0,lifetime_shards_earned integer not null default 0,slots_unlocked integer not null default 2);
    insert into auth.users(id) values('${id(1)}'),('${id(2)}'),('${id(3)}');
    insert into platform_assets values('${id(20)}','rune-delve');
    insert into club_installed_assets(club_id,asset_id,enabled) values('${id(10)}','${id(20)}',true);
    insert into rune_delve_heroes values('${id(1)}'),('${id(2)}');
  `);
  await exec(await readFile('supabase/migrations/20261030140000_rune_delve_expeditions.sql','utf8'));
  const migration=await readFile('supabase/migrations/20261031010000_rune_expedition_feats.sql','utf8');
  await exec(migration);await exec(migration);
  await check('new catalog is additive, repeatable and leaves every existing definition intact',async()=>{
    const b=await board();assert.equal(b.catalog.length,66);assert.equal(b.catalog.reduce((sum,item)=>sum+item.thresholds.length,0),329);
    for(const old of original)assert.deepEqual(b.catalog.find(item=>item.key===old.key),old);
    for(const item of extra)assert.deepEqual(b.catalog.find(candidate=>candidate.key===item.key),item);
  });
  const metrics=()=>rpc('dh_feat_metrics',[id(1)]);
  const begin=(n,tier=0)=>rpc('rune_delve_expedition_begin',[id(n),id(10),'warrior',tier]);
  const finish=(n,rooms,cleared)=>rpc('rune_delve_expedition_finish',[id(n),rooms,rooms*500,rooms*7,cleared]);
  await exec(`select set_config('test.user','${id(1)}',false)`);
  await check('active and abandoned tickets create no feat progress',async()=>{
    await begin(100);await begin(101);
    const m=await metrics();assert.equal(m.rune_expedition_rooms,0);assert.equal(m.rune_expedition_clears,0);assert.equal(m.rune_expedition_ascension,0);
  });
  await check('a banked six-room clear unlocks all three bronze Expedition feats without campaign duplication',async()=>{
    await finish(101,6,true);
    const m=await metrics();assert.equal(m.rune_expedition_rooms,6);assert.equal(m.rune_expedition_clears,1);assert.equal(m.rune_expedition_ascension,1);
    assert.equal(m.rune_clears,0);assert.equal(m.rune_enemies,0);assert.equal(m.rune_level,0);assert.equal(m.feature_explorer,1);assert.equal(m.active_days,1);
    const b=await board();assert.equal(b.unlocks.filter(item=>item.feat_key.startsWith('rune_expedition_')).length,3);
    assert.equal(b.score,40); // three mode feats and the first active day.
    assert.equal(b.monthly_me.score,40);
  });
  await check('replaying a finish acknowledgement never duplicates source counts or DH points',async()=>{
    const before=await board();await finish(101,6,true);const after=await board();
    assert.equal(after.score,before.score);assert.deepEqual(after.progress,before.progress);
  });
  await check('banked partial runs count rooms but do not count a victory or new ascension',async()=>{
    await begin(102,1);await finish(102,3,false);
    const m=await metrics();assert.equal(m.rune_expedition_rooms,9);assert.equal(m.rune_expedition_clears,1);assert.equal(m.rune_expedition_ascension,1);
  });
  await check('clearing the next ascension unlocks the next tier using permanent source receipts',async()=>{
    await begin(103,1);await finish(103,6,true);
    const b=await board();assert.equal(b.progress.rune_expedition_ascension,2);
    assert.ok(b.unlocks.some(item=>item.feat_key==='rune_expedition_ascension'&&item.tier===2&&item.points===20));
    const before=b.score;await exec(migration);const again=await board();assert.equal(again.score,before);
  });
  await check('the same activity day across campaign and Expedition is counted once',async()=>{
    await query('insert into rune_delve_runs(id,user_id,level_number,dungeon_cleared,clears,last_played_at) values($1,$2,1,true,1,now())',[id(200),id(1)]);
    assert.equal((await metrics()).active_days,1);assert.equal((await metrics()).feature_explorer,1);
  });
  await check('the private testing identity remains absent from standings after banking Expedition sources',async()=>{
    const hidden='bea76765-545c-4b48-a24d-861c1918c3d6';
    await query('insert into auth.users(id) values($1)',[hidden]);
    await query("insert into profiles(id,display_name) values($1,'Private operator')",[hidden]);
    await query('insert into rune_delve_expedition_runs(id,user_id,club_id,seed,hero_class,ascension,status,rooms,score,turns,cleared,finished_at) values($1,$2,$3,1,\'warrior\',7,\'banked\',6,3000,42,true,now())',[id(201),hidden,id(10)]);
    const b=await board();assert.equal(b.leaders.some(item=>item.user_id===hidden),false);assert.equal(b.monthly_leaders.some(item=>item.user_id===hidden),false);
  });
  console.log(JSON.stringify({groups:checks,passed:true}));
} finally { await fixture.close(); }
