// Isolated PostgreSQL integration suite. No network, credentials or live data.
// Run: node scripts/test-showdown-db.mjs
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { build } from 'esbuild';

const db=new PGlite();
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const A=uuid(1),B=uuid(2),C=uuid(3),D=uuid(4),E=uuid(5),NONMEMBER=uuid(6),PRIVATE=uuid(7);
let checks=0,requestSequence=100000;
const requestId=()=>uuid(++requestSequence);
const check=async(name,fn)=>{await resetMatches();await fn();checks++;console.log(`PASS ${name}`);};
const library=JSON.parse(await readFile('supabase/seed/prism-break-library.json','utf8'));
const foundationPath='supabase/migrations/20261101010000_showdown_foundation.sql';
const seedPath='supabase/migrations/20261101020000_prism_break_library.sql';
const foundationSource=await readFile(foundationPath,'utf8'),seedSource=await readFile(seedPath,'utf8');
const compiled=await build({entryPoints:['src/lib/showdown/prism/solver.ts','src/lib/showdown/prism/engine.ts'],bundle:true,platform:'node',format:'esm',write:false,outdir:'/tmp/showdown-db-engine'});
const loadModule=async name=>import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles.find(f=>f.path.endsWith(`/${name}.js`)).text).toString('base64')}`);
const {solvePuzzle}=await loadModule('solver');
const {initialOrientations,replayActions,rotatableCells,scoreRound,traceValidatedPuzzle}=await loadModule('engine');
const signatures={showdown_create:['uuid','text','uuid','uuid'],showdown_get:['uuid','boolean'],showdown_save_round:['uuid','integer','jsonb','integer','uuid'],showdown_submit_round:['uuid','integer','jsonb','integer','uuid','boolean'],showdown_act:['uuid','text','uuid'],showdown_lobby:['text','jsonb','integer']};
async function actorQuery(user,sql,args=[],role='authenticated') {
  return db.transaction(async tx=>{
    await tx.exec(`set local role ${role}`);
    await tx.query("select set_config('test.user',$1,true),set_config('test.role',$2,true)",[user??'',role]);
    return tx.query(sql,args);
  });
}
async function rpc(user,name,args,role='authenticated') {
  const types=signatures[name];assert.ok(types,`Unknown test RPC ${name}`);assert.equal(args.length,types.length);
  const {rows}=await actorQuery(user,`select public.${name}(${types.map((type,i)=>`$${i+1}::${type}`).join(',')}) as data`,args.map((value,i)=>types[i]==='jsonb'&&value!==null?JSON.stringify(value):value),role);
  return rows[0].data;
}
const one=async(sql,args=[])=>{const {rows}=await db.query(sql,args);return rows[0];};
const create=(user=A,opponent=B,rematch=null,key=requestId())=>rpc(user,'showdown_create',[opponent,'prism_break',key,rematch]);
const get=(user,challenge,start=false)=>rpc(user,'showdown_get',[challenge,start]);
const lobby=user=>rpc(user,'showdown_lobby',['prism_break',null,30]);
const save=(user,challenge,round,actions,revision=0,key=requestId())=>rpc(user,'showdown_save_round',[challenge,round,actions,revision,key]);
const submit=(user,challenge,round,actions,revision=0,skip=false,key=requestId())=>rpc(user,'showdown_submit_round',[challenge,round,actions,revision,key,skip]);
const act=(user,challenge,action,key=requestId())=>rpc(user,'showdown_act',[challenge,action,key]);
const solutionFor=puzzle=>{const s=solvePuzzle(puzzle,{maxStates:4096});assert.ok(s.solvable&&!s.exhausted);return s.actions;};
const myRound=(detail,round)=>detail.rounds.find(item=>item.round_number===round);
async function finish(user,challenge,{skip=false}={}) {
  let detail=await get(user,challenge,true);
  while(detail.current_round!==null&&detail.can_play) {
    const r=myRound(detail,detail.current_round);
    const actions=skip?r.me.actions:solutionFor(r.puzzle);
    detail=await submit(user,challenge,r.round_number,actions,r.me.revision,skip);
  }
  return detail;
}
async function resetMatches() {
  const guards=[['showdown_challenge_rounds','showdown_frozen_boards'],['showdown_round_states','showdown_sealed_rounds'],['showdown_attempts','showdown_sealed_attempts'],['showdown_challenges','showdown_sealed_matches']];
  for(const [table,trigger]of guards) await db.exec(`alter table public.${table} disable trigger ${trigger}`);
  await db.exec(`delete from public.showdown_events;delete from public.notifications;delete from public.showdown_requests;delete from public.showdown_round_states;delete from public.showdown_attempts;delete from public.showdown_challenge_rounds;delete from public.showdown_challenges;`);
  await db.exec(`update public.clubs set status='active';`);
  for(const [user,club] of [[A,uuid(1001)],[B,uuid(1001)],[C,uuid(1001)],[D,uuid(1002)],[E,uuid(1002)],[PRIVATE,uuid(1003)],[uuid(8),uuid(1003)]]) await db.query('insert into public.club_members(user_id,club_id) values($1,$2) on conflict(user_id) do update set club_id=excluded.club_id',[user,club]);
  await db.exec("update public.showdown_games set enabled=true,current_rules_version=1 where game_key='prism_break';update public.showdown_puzzles set published=true where not published;");
  for(const [table,trigger]of guards) await db.exec(`alter table public.${table} enable trigger ${trigger}`);
}

try {
  await db.exec(await readFile('scripts/fixtures/showdown-db.sql','utf8'));
  await db.exec(foundationSource);
  await db.exec(seedSource);
  const catalog=await one('select count(*)::integer n from public.showdown_puzzles where published');
  assert.equal(catalog.n,18);
  console.log('Schema and all 18 independently checked seed definitions installed.');
  if(process.argv.includes('--schema-only')) { await db.close();process.exit(0); }

  await check('all 18 published puzzles have exact independent SQL minima and TypeScript/SQL beam and replay parity',async()=>{
    for(const entry of library) {
      const {minimumRotations,title:_title,validation:_validation,...puzzle}=entry;
      const optimum=solutionFor(puzzle),js=replayActions(puzzle,optimum);
      const row=await one('select public.prism_minimum_v1($1::jsonb) minimum,public.prism_replay_v1($1::jsonb,$2::jsonb) replay',[JSON.stringify(puzzle),JSON.stringify(optimum)]);
      assert.equal(row.minimum,minimumRotations,puzzle.id);
      assert.equal(row.replay.solved,true,puzzle.id);assert.equal(row.replay.rotations,js.rotations,puzzle.id);
      assert.deepEqual([...row.replay.activated].sort((a,b)=>a-b),js.trace.activatedReceivers,puzzle.id);
      assert.equal(row.replay.required,js.trace.requiredReceivers.length,puzzle.id);
      const cells=rotatableCells(puzzle),initial=initialOrientations(puzzle);
      for(const mask of [0,1,3,5,11,2**cells.length-1]) {
        const orientations={...initial};cells.forEach((cell,bit)=>{if(mask&(1<<bit))orientations[cell]=initial[cell]==='/'?'\\':'/';});
        const trace=traceValidatedPuzzle(puzzle,orientations);
        const sql=await one('select public.prism_trace_v1($1::jsonb,$2::jsonb) result',[JSON.stringify(puzzle),JSON.stringify(orientations)]);
        assert.equal(sql.result.solved,trace.solved,`${puzzle.id}:${mask}`);
        assert.deepEqual([...sql.result.activated].sort((a,b)=>a-b),trace.activatedReceivers,`${puzzle.id}:${mask}`);
      }
    }
  });
  await check('published catalog, ranked base tables and internal answer/solver APIs reject direct member and anonymous access',async()=>{
    const tables=['showdown_games','showdown_rules','showdown_puzzles','showdown_challenges','showdown_challenge_rounds','showdown_attempts','showdown_round_states','showdown_requests','showdown_events'];
    for(const table of tables)for(const role of ['anon','authenticated']){
      const row=await one('select has_table_privilege($1,$2,\'SELECT\') r,has_table_privilege($1,$2,\'INSERT\') i,has_table_privilege($1,$2,\'UPDATE\') u,has_table_privilege($1,$2,\'DELETE\') d',[role,`public.${table}`]);
      assert.deepEqual(row,{r:false,i:false,u:false,d:false});
    }
    await assert.rejects(actorQuery(A,'select * from public.showdown_puzzles'),/permission denied/);
    await assert.rejects(actorQuery(A,'update public.showdown_attempts set total_score=1500'),/permission denied/);
    for(const helper of ['showdown_summary(uuid)','showdown_snapshot(uuid)','showdown_round_view(uuid,uuid,integer)','showdown_record(uuid,uuid,text,uuid)','showdown_write_round(uuid,integer,jsonb,integer,uuid,boolean,boolean)','showdown_notify(uuid,uuid,text,text,text)','showdown_member_metrics(uuid,uuid)','prism_trace_v1(jsonb,jsonb)','prism_minimum_v1(jsonb)','prism_replay_v1(jsonb,jsonb)']){
      const row=await one('select has_function_privilege(\'authenticated\',$1,\'EXECUTE\') allowed',[`public.${helper}`]);assert.equal(row.allowed,false,helper);
    }
    await assert.rejects(rpc(null,'showdown_lobby',['prism_break',null,30],'anon'),/permission denied/);
  });
  await check('a member can challenge only a different visible member of their active club',async()=>{
    await assert.rejects(create(A,A),/another club member/);
    await assert.rejects(create(A,D),/Recipient unavailable/);
    await assert.rejects(create(A,NONMEMBER),/Recipient unavailable/);
    await assert.rejects(create(A,PRIVATE),/Recipient unavailable/);
    await assert.rejects(create(NONMEMBER,A),/Active club membership/);
    await db.query('update public.clubs set status=\'inactive\' where id=$1',[uuid(1001)]);
    await assert.rejects(create(),/Active club membership/);
    assert.equal((await one('select count(*)::integer n from public.showdown_challenges')).n,0);
    assert.equal((await one('select count(*)::integer n from public.notifications')).n,0);
  });
  await check('creation freezes one easy, medium and hard board for 72 hours and the challenger plays immediately',async()=>{
    const detail=await create();const c=detail.challenge;
    assert.equal(c.status,'pending');assert.equal(c.game_key,'prism_break');assert.equal(c.rules_version,1);
    assert.equal(new Date(c.expires_at)-new Date(c.created_at),72*60*60*1000);
    assert.equal(detail.current_round,1);assert.equal(detail.can_play,true);
    assert.deepEqual(detail.rounds.map(r=>r.difficulty),['easy','medium','hard']);
    assert.equal(detail.rounds[0].puzzle.id,detail.rounds[0].puzzle_id);
    assert.equal(detail.rounds[1].puzzle,null);assert.equal(detail.rounds[2].puzzle,null);
    for(const round of detail.rounds){assert.equal(round.minimum_rotations,null);assert.equal(round.opponent,null);assert.equal(round.me.revision,0);}
    const rows=(await db.query('select definition,minimum_rotations from public.showdown_challenge_rounds where challenge_id=$1 order by round_number',[c.id])).rows;
    assert.equal(rows.length,3);for(const row of rows){assert.ok(row.minimum_rotations>0);assert.ok(!('minimumRotations'in row.definition));assert.ok(!('validation'in row.definition));assert.ok(!('solution'in row.definition));}
  });
  await check('recipients open straight into their identical frozen puzzle without a separate acceptance step',async()=>{
    const a=await create(),id=a.challenge.id;
    const invitation=await get(B,id);
    assert.equal(invitation.can_decline,true);assert.equal(invitation.can_play,false);
    const started=await get(B,id,true);
    assert.equal(started.can_play,true);assert.equal(started.can_decline,false);assert.equal(started.challenge.status,'active');
    assert.deepEqual(started.rounds[0].puzzle,a.rounds[0].puzzle);
    assert.deepEqual(started.rounds.map(r=>[r.puzzle_id,r.puzzle_version]),a.rounds.map(r=>[r.puzzle_id,r.puzzle_version]));
    const again=await get(B,id,true);assert.equal(again.challenge.players.find(p=>p.user_id===B).started_at,started.challenge.players.find(p=>p.user_id===B).started_at);
  });
  await check('same-club bystanders, cross-club members and unknown challenges cannot access or alter a private match',async()=>{
    const c=await create(),id=c.challenge.id;
    for(const user of [C,D,NONMEMBER])await assert.rejects(get(user,id),/Challenge unavailable|Active club membership/);
    await assert.rejects(get(A,requestId()),/Challenge unavailable/);
    await assert.rejects(save(C,id,1,[],0),/Challenge unavailable/);
    await assert.rejects(submit(D,id,1,[],0,true),/Challenge unavailable/);
    assert.equal((await lobby(C)).challenges.length,0);assert.equal((await lobby(D)).challenges.length,0);
  });
  await check('create retries return the original match and notification while request identities cannot be reassigned',async()=>{
    const key=requestId(),a=await create(A,B,null,key),b=await create(A,B,null,key);
    assert.equal(a.challenge.id,b.challenge.id);
    assert.equal((await one('select count(*)::integer n from public.showdown_challenges')).n,1);
    assert.equal((await one('select count(*)::integer n from public.notifications')).n,1);
    await assert.rejects(create(A,C,null,key),/Request identity already used/);
    await assert.rejects(create(B,A,null,key),/Request identity already used/);
  });
  await check('incoming invitations use the existing private notification inbox with real target URLs and no client insert permission',async()=>{
    const c=await create(),row=await one('select * from public.notifications');
    assert.equal(row.user_id,B);assert.equal(row.club_id,uuid(1001));assert.equal(row.type,'showdown');assert.equal(row.url,`/showdown/${c.challenge.id}`);assert.equal(row.actor_user_id,A);
    assert.equal((await one('select count(*)::integer n from public.showdown_events where event=\'incoming\'')).n,1);
    assert.equal((await actorQuery(A,'select * from public.notifications')).rows.length,0);
    assert.equal((await actorQuery(B,'select * from public.notifications')).rows.length,1);
    await assert.rejects(actorQuery(A,'insert into public.notifications(user_id,type,title) values($1,\'showdown\',\'fake\')',[B]),/permission denied/);
  });
  await check('saved moves survive reload and a reset never refunds an earlier rotation',async()=>{
    const c=await create(),id=c.challenge.id,solution=solutionFor(c.rounds[0].puzzle),prefix=solution.slice(0,1);
    const saved=await save(A,id,1,prefix,0);assert.equal(saved.rounds[0].me.revision,1);assert.equal(saved.rounds[0].me.rotations,1);
    const restored=await get(A,id);assert.deepEqual(restored.rounds[0].me.actions,prefix);assert.equal(restored.current_round,1);
    const reset=[...prefix,{type:'reset'}];const checkpoint=await save(A,id,1,reset,1);assert.equal(checkpoint.rounds[0].me.rotations,1);assert.equal(checkpoint.rounds[0].me.revision,2);
    const submitted=await submit(A,id,1,[...reset,...solution],2);const round=submitted.rounds[0];
    assert.equal(round.me.rotations,solution.length+1);assert.equal(round.me.score,scoreRound(solution.length,solution.length+1));assert.equal(round.me.submitted,true);
    assert.equal(submitted.current_round,2);assert.ok(submitted.rounds[1].puzzle);assert.equal(submitted.rounds[2].puzzle,null);
    const reload=await get(A,id);assert.equal(reload.current_round,2);assert.equal(reload.rounds[0].me.submitted,true);
  });
  await check('checkpoint retries are idempotent and saved prefixes cannot be removed or rewritten',async()=>{
    const c=await create(),id=c.challenge.id,prefix=solutionFor(c.rounds[0].puzzle).slice(0,1),key=requestId();
    const saved=await save(A,id,1,prefix,0,key),retry=await save(A,id,1,prefix,0,key);assert.deepEqual(retry.rounds[0].me,saved.rounds[0].me);
    await assert.rejects(save(A,id,1,[],1),/cannot be removed or changed/);
    await assert.rejects(save(A,id,1,[{type:'reset'}],1),/cannot be removed or changed/);
    await assert.rejects(save(A,id,1,[...prefix,{type:'reset'}],0),/changed on another device/);
    const untouched=await get(A,id);assert.deepEqual(untouched.rounds[0].me.actions,prefix);assert.equal(untouched.rounds[0].me.revision,1);
  });
  await check('two open devices cannot overwrite a newer checkpoint revision',async()=>{
    const c=await create(),id=c.challenge.id,prefix=solutionFor(c.rounds[0].puzzle).slice(0,1);
    const a=await save(A,id,1,prefix,0);
    await assert.rejects(save(A,id,1,[{type:'reset'}],0),/changed on another device/);
    const b=await save(A,id,1,[...prefix,{type:'reset'}],a.rounds[0].me.revision);
    assert.equal(b.rounds[0].me.revision,2);assert.equal(b.rounds[0].me.rotations,1);
  });
  await check('a solved checkpoint survives reload and seals once without permitting moves after the solution',async()=>{
    const c=await create(),cid=c.challenge.id,actions=solutionFor(c.rounds[0].puzzle);
    const saved=await save(A,cid,1,actions,0);assert.equal(saved.rounds[0].me.solved,true);assert.equal(saved.rounds[0].me.submitted,false);assert.equal(saved.current_round,1);
    const restored=await get(A,cid);assert.deepEqual(restored.rounds[0].me.actions,actions);
    await assert.rejects(save(A,cid,1,[...actions,{type:'reset'}],1),/already solved/);
    const sealed=await submit(A,cid,1,actions,1);assert.equal(sealed.rounds[0].me.score,500);assert.equal(sealed.current_round,2);
  });
  await check('ranked submissions replay legal moves, reject fake solutions and prevent jumping ahead',async()=>{
    const c=await create(),id=c.challenge.id;
    await assert.rejects(submit(A,id,1,[]),/Activate every receiver/);
    await assert.rejects(submit(A,id,2,[],0,true),/current round first/);
    await assert.rejects(submit(A,id,4,[],0,true),/Round unavailable/);
    await assert.rejects(save(A,id,1,[{type:'rotate',cell:0.5}],0),/Invalid rotation/);
    await assert.rejects(save(A,id,1,[{type:'rotate',cell:0,score:500}],0),/Invalid rotation/);
    const fixed=c.rounds[0].puzzle.tiles.findIndex(tile=>tile.kind!=='mirror'||!tile.rotatable);
    await assert.rejects(save(A,id,1,[{type:'rotate',cell:fixed}],0),/Only marked mirrors/);
    await assert.rejects(save(A,id,1,Array.from({length:513},()=>({type:'reset'})),0),/Invalid move sequence/);
    const fresh=await get(A,id);assert.equal(fresh.rounds[0].me.revision,0);assert.equal(fresh.rounds[0].me.score,null);
  });
  await check('opponent totals, solutions and per-round scores remain sealed even after the challenger finishes first',async()=>{
    const c=await create(),id=c.challenge.id,done=await finish(A,id);
    assert.equal(done.current_round,null);assert.equal(done.can_play,false);assert.equal(done.challenge.status,'active');
    assert.equal(done.challenge.players.find(p=>p.user_id===A).total_score,1500);
    const opponent=await get(B,id);const hidden=opponent.challenge.players.find(p=>p.user_id===A);
    assert.ok(hidden.finished_at);assert.equal(hidden.total_score,null);assert.equal(hidden.solved_count,null);assert.equal(hidden.rotations,null);
    for(const round of opponent.rounds)assert.equal(round.opponent,null);
    assert.equal(opponent.rounds[1].puzzle,null);assert.equal(opponent.rounds[2].puzzle,null);
    assert.equal((await one('select count(*)::integer n from public.showdown_events where event=\'attempt_finished\'')).n,1);
    const list=await lobby(B);assert.equal(list.challenges[0].players.find(p=>p.user_id===A).total_score,null);
  });
  await check('completed rounds are immutable and duplicates cannot improve scores or publish repeated results',async()=>{
    const c=await create(),id=c.challenge.id,actions=solutionFor(c.rounds[0].puzzle),key=requestId();
    const first=await submit(A,id,1,actions,0,false,key),retry=await submit(A,id,1,actions,0,false,key);
    assert.equal(first.rounds[0].me.score,500);assert.deepEqual(first.rounds[0].me,retry.rounds[0].me);
    await submit(A,id,1,actions,0,false); // safe identical replay with a fresh delivery request
    await assert.rejects(submit(A,id,1,[],1,true),/already submitted/);
    await assert.rejects(save(A,id,1,[],1),/already submitted/);
    await assert.rejects(db.query('update public.showdown_round_states set score=0 where challenge_id=$1 and user_id=$2 and round_number=1',[id,A]),/immutable|sealed|submitted/i);
    const after=await get(A,id);assert.equal(after.rounds[0].me.score,500);
  });
  await check('three optimal rounds produce the exact 1500 maximum and a legitimate equal-score draw',async()=>{
    const c=await create(),id=c.challenge.id;await finish(A,id);const done=await finish(B,id);
    assert.equal(done.challenge.status,'completed');assert.equal(done.challenge.outcome,'draw');assert.equal(done.challenge.winner_id,null);assert.ok(done.challenge.completed_at);
    assert.deepEqual(done.challenge.players.map(p=>p.total_score),[1500,1500]);assert.deepEqual(done.challenge.players.map(p=>p.solved_count),[3,3]);
    for(const round of done.rounds){assert.equal(round.me.score,500);assert.equal(round.opponent.score,500);assert.ok(round.minimum_rotations>0);assert.ok(round.puzzle);assert.ok(round.opponent.actions.length>0);}
    assert.equal(done.record.draws,1);assert.equal(done.rivalry.draws,1);
    assert.equal((await one('select count(*)::integer n from public.showdown_events where event=\'result\'')).n,2);
  });
  await check('skips are zero points, cannot be replayed, and do not prevent either player from completing',async()=>{
    const c=await create(),id=c.challenge.id;await finish(A,id,{skip:true});const done=await finish(B,id,{skip:true});
    assert.equal(done.challenge.outcome,'draw');assert.equal(done.challenge.players[0].total_score,0);assert.equal(done.challenge.players[1].total_score,0);
    assert.equal(done.challenge.players[0].solved_count,0);
    assert.ok(done.rounds.every(round=>round.me.skipped&&round.me.score===0&&round.opponent.skipped&&round.opponent.score===0));
    const metrics=await one('select public.showdown_member_metrics($1,$2) data',[A,uuid(1001)]);assert.equal(metrics.data.qualified_played,0);assert.equal(metrics.data.prism_solved,0);
    await assert.rejects(submit(A,id,1,solutionFor(done.rounds[0].puzzle),1),/already submitted/);
  });
  await check('score has priority over fewer rotations when declaring the winner',async()=>{
    const c=await create(),id=c.challenge.id;await finish(A,id);const done=await finish(B,id,{skip:true});
    assert.equal(done.challenge.winner_id,A);assert.equal(done.challenge.outcome,'winner');assert.equal(done.record.losses,1);assert.equal(done.rivalry.losses,1);
    assert.ok(done.challenge.players.find(p=>p.user_id===A).rotations>done.challenge.players.find(p=>p.user_id===B).rotations);
  });

  async function actionsAtRotations(puzzle,total) {
    const optimal=solutionFor(puzzle);assert.ok(total>=optimal.length);
    const cell=rotatableCells(puzzle)[0];const waste=Array.from({length:total-optimal.length},()=>[{type:'rotate',cell},{type:'reset'}]).flat();
    return [...waste,...optimal];
  }
  await check('equal totals prefer more solved rounds using actual validated move sequences',async()=>{
    const c=await create(),id=c.challenge.id;
    let a=await get(A,id,true),b=await get(B,id,true);
    for(let round=1;round<=3;round++){
      const ra=myRound(a,round);a=await submit(A,id,round,round===3?[]:solutionFor(ra.puzzle),ra.me.revision,round===3);
      const rb=myRound(b,round),min=solutionFor(rb.puzzle).length,total=6*min-(round===3?1:0);
      b=await submit(B,id,round,await actionsAtRotations(rb.puzzle,total),rb.me.revision,false);
    }
    assert.deepEqual(b.challenge.players.map(p=>p.total_score),[1000,1000]);assert.deepEqual(b.challenge.players.map(p=>p.solved_count),[2,3]);assert.equal(b.challenge.winner_id,B);
  });
  await check('equal score and solved count prefer fewer rotations rather than time or network speed',async()=>{
    const c=await create(),id=c.challenge.id,puzzle=c.rounds[0].puzzle,min=solutionFor(puzzle).length;
    let plateau=min+1;while(scoreRound(min,plateau)!==scoreRound(min,plateau+1))plateau++;
    assert.ok(plateau<150);
    await submit(A,id,1,await actionsAtRotations(puzzle,plateau));await get(B,id,true);await submit(B,id,1,await actionsAtRotations(puzzle,plateau+1));
    await finish(A,id);const done=await finish(B,id);
    assert.equal(done.challenge.players[0].total_score,done.challenge.players[1].total_score);
    assert.equal(done.challenge.players[0].solved_count,done.challenge.players[1].solved_count);
    assert.equal(done.challenge.players[0].rotations+1,done.challenge.players[1].rotations);assert.equal(done.challenge.winner_id,A);
  });
  await check('simultaneous final-player submissions serialize to one immutable outcome and exactly two result receipts',async()=>{
    const c=await create(),id=c.challenge.id;await get(B,id,true);
    for(const user of [A,B])for(let round=1;round<=2;round++){const detail=await get(user,id);const r=myRound(detail,round);await submit(user,id,round,solutionFor(r.puzzle),r.me.revision);}
    const a=await get(A,id),b=await get(B,id),ka=requestId(),kb=requestId();
    const [ra,rb]=await Promise.all([submit(A,id,3,solutionFor(a.rounds[2].puzzle),0,false,ka),submit(B,id,3,solutionFor(b.rounds[2].puzzle),0,false,kb)]);
    assert.ok([ra,rb].some(detail=>detail.challenge.status==='completed'));
    const final=await get(A,id);assert.equal(final.challenge.outcome,'draw');assert.deepEqual(final.challenge.players.map(p=>p.total_score),[1500,1500]);
    const timestamp=final.challenge.completed_at;
    await Promise.all([submit(A,id,3,solutionFor(a.rounds[2].puzzle),0,false,ka),submit(B,id,3,solutionFor(b.rounds[2].puzzle),0,false,kb)]);
    assert.equal((await get(B,id)).challenge.completed_at,timestamp);
    assert.equal((await one('select count(*)::integer n from public.showdown_events where event=\'result\'')).n,2);
    assert.equal((await one('select count(*)::integer n from public.showdown_round_states where submitted')).n,6);
  });
  await check('recipient-first completion is sealed and produces the same result when the challenger finishes later',async()=>{
    const c=await create(),id=c.challenge.id;await finish(B,id);
    const pending=await get(A,id);assert.equal(pending.challenge.players.find(p=>p.user_id===B).total_score,null);
    const done=await finish(A,id);assert.equal(done.challenge.outcome,'draw');assert.deepEqual(done.challenge.players.map(p=>p.total_score),[1500,1500]);
  });
  await check('expiry at the exact deadline closes the match without wins, losses or accepted late scores',async()=>{
    const c=await create(),id=c.challenge.id;
    await db.query("update public.showdown_challenges set created_at=now()-interval '72 hours',expires_at=now() where id=$1",[id]);
    const closed=await submit(A,id,1,solutionFor(c.rounds[0].puzzle),0);
    assert.equal(closed.challenge.status,'expired');assert.equal(closed.challenge.winner_id,null);assert.equal(closed.challenge.completed_at,null);assert.equal(closed.can_play,false);
    assert.equal(closed.rounds[0].me.submitted,false);assert.equal(closed.rounds[0].me.score,null);
    assert.deepEqual((await lobby(A)).record,{played:0,wins:0,losses:0,draws:0});
    assert.equal((await one('select count(*)::integer n from public.showdown_events where event=\'result\'')).n,0);
    assert.equal((await one('select status from public.showdown_challenges where id=$1',[id])).status,'expired');
  });
  await check('declines and permitted cancellations are idempotent and excluded from records',async()=>{
    const declined=await create(),did=declined.challenge.id,key=requestId();
    await assert.rejects(act(A,did,'decline'),/no longer be declined or cancelled/);
    const first=await act(B,did,'decline',key),again=await act(B,did,'decline',key);assert.equal(first.challenge.status,'declined');assert.equal(again.challenge.status,'declined');
    const cancelled=await create();await assert.rejects(act(B,cancelled.challenge.id,'cancel'),/no longer be declined or cancelled/);
    const end=await act(A,cancelled.challenge.id,'cancel');assert.equal(end.challenge.status,'cancelled');
    assert.deepEqual((await lobby(A)).record,{played:0,wins:0,losses:0,draws:0});assert.equal((await lobby(B)).standings.length,0);
  });
  await check('starting the recipient attempt closes cancellation and decline loopholes',async()=>{
    const c=await create(),id=c.challenge.id;await get(B,id,true);
    await assert.rejects(act(A,id,'cancel'),/no longer be declined or cancelled/);
    await assert.rejects(act(B,id,'decline'),/no longer be declined or cancelled/);
    assert.equal((await get(A,id)).challenge.status,'active');
  });
  await check('member removal closes unfinished matches and removed members cannot retain private access',async()=>{
    const c=await create(),id=c.challenge.id;await db.query('delete from public.club_members where user_id=$1',[B]);
    const closed=await get(A,id);assert.equal(closed.challenge.status,'cancelled');assert.equal(closed.can_play,false);assert.match(closed.readonly_reason,/no longer available/);
    assert.equal(closed.challenge.players.find(p=>p.user_id===B).display_name,'Former member');
    await assert.rejects(get(B,id),/Active club membership/);assert.equal((await lobby(A)).record.played,0);
    const ignored=await submit(A,id,1,solutionFor(c.rounds[0].puzzle),0);assert.equal(ignored.rounds[0].me.submitted,false);
  });
  await check('same-user club moves retire old challenge access instead of carrying membership between clubs',async()=>{
    const c=await create(),id=c.challenge.id;await db.query('update public.club_members set club_id=$1 where user_id=$2',[idForClub(1002),A]);
    await assert.rejects(get(A,id),/Challenge unavailable/);assert.equal((await lobby(A)).challenges.length,0);
    const opponent=await get(B,id);assert.equal(opponent.challenge.status,'cancelled');
  });
  function idForClub(n){return uuid(n);}
  await check('frozen content and ranked results cannot be changed even by a later catalog edit or rule switch',async()=>{
    const c=await create(),cid=c.challenge.id,pid=c.rounds[0].puzzle_id;
    await assert.rejects(db.query('update public.showdown_puzzles set minimum_rotations=minimum_rotations+1 where puzzle_id=$1',[pid]),/immutable/);
    await assert.rejects(db.query('update public.showdown_challenge_rounds set minimum_rotations=1 where challenge_id=$1',[cid]),/immutable|frozen/i);
    await db.query('update public.showdown_puzzles set published=false where puzzle_id=$1',[pid]);
    await assert.rejects(db.query('update public.showdown_puzzles set title=\'Changed after unpublishing\' where puzzle_id=$1',[pid]),/immutable/);
    await db.exec("update public.showdown_games set current_rules_version=2,enabled=false where game_key='prism_break'");
    const restored=await get(A,cid);assert.deepEqual(restored.rounds[0].puzzle,c.rounds[0].puzzle);assert.equal(restored.challenge.rules_version,1);
    const done=await submit(A,cid,1,solutionFor(restored.rounds[0].puzzle));assert.equal(done.rounds[0].me.score,500);
    await assert.rejects(create(A,C),/not available/);
  });
  await check('unvalidated, already solved, impossible and falsely advertised catalog entries cannot become published content',async()=>{
    const source=library[0];const {minimumRotations,title,validation,...base}=source;
    const publish=async(def,min,meta=validation)=>db.query("insert into public.showdown_puzzles(game_key,rules_version,puzzle_id,puzzle_version,difficulty,title,definition,minimum_rotations,validation,published) values('prism_break',1,$1,1,'easy',$2,$3::jsonb,$4,$5::jsonb,true)",[def.id,title,JSON.stringify(def),min,JSON.stringify(meta)]);
    await assert.rejects(publish({...base,id:'unvalidated'},minimumRotations,{validated:false}),/metadata/);
    await assert.rejects(publish({...base,id:'false-minimum'},minimumRotations+1),/minimum rotations/);
    const optimum=replayActions(base,solutionFor(base));
    const solved={...base,id:'already-solved',tiles:base.tiles.map((tile,cell)=>tile.kind==='mirror'?{...tile,orientation:optimum.orientations[cell]??tile.orientation}:tile)};
    await assert.rejects(publish(solved,1),/minimum rotations/);
    const impossible={...base,id:'impossible',tiles:base.tiles.map(tile=>tile.kind==='receiver'?{...tile,color:'red'}:tile)};
    await assert.rejects(publish(impossible,1),/minimum rotations/);
    assert.equal((await one('select count(*)::integer n from public.showdown_puzzles')).n,18);
  });
  await check('missing JSON fields, duplicate filters and ambiguous splitter outputs are rejected before publication',async()=>{
    const {minimumRotations:_minimum,title:_title,validation:_validation,...base}=library[0];
    const empty=base.tiles.findIndex(tile=>tile.kind==='empty');
    const checkInvalid=async(tile,error)=>{
      const def={...base,tiles:base.tiles.map((old,index)=>index===empty?tile:old)};
      await assert.rejects(db.query('select public.prism_validate_v1($1::jsonb)',[JSON.stringify(def)]),error);
    };
    await checkInvalid({kind:'filter'},/Invalid color filter/);
    await checkInvalid({kind:'filter',accepts:null},/Invalid color filter/);
    await checkInvalid({kind:'filter',accepts:['cyan','cyan']},/Invalid color filter/);
    await checkInvalid({kind:'splitter',rules:[{incoming:'E',inputColor:'white',outputs:[{direction:'N',color:'cyan'},{direction:'N',color:'cyan'}]}]},/Duplicate splitter output/);
    await checkInvalid({kind:'splitter',rules:[{incoming:'E',inputColor:'white'}]},/Invalid splitter rule/);
    await checkInvalid({kind:'splitter',rules:[{incoming:'E',inputColor:'white',outputs:[{direction:'N',color:'cyan'}]},{incoming:'E',inputColor:'white',outputs:[{direction:'S',color:'magenta'}]}]},/Invalid splitter rule/);
  });
  await check('published boards cannot exceed the independently bounded mobile solver state space',async()=>{
    const {minimumRotations,title,validation,...base}=library[0];
    let remaining=13-rotatableCells(base).length;
    const definition={...base,id:'oversized-mobile-search',tiles:base.tiles.map(tile=>{
      if(remaining>0&&(tile.kind==='empty'||tile.kind==='wall')){remaining--;return {kind:'mirror',rotatable:true,orientation:'/'};}
      return tile;
    })};
    assert.equal(remaining,0);assert.equal(rotatableCells(definition).length,13);
    await assert.rejects(db.query("insert into public.showdown_puzzles(game_key,rules_version,puzzle_id,puzzle_version,difficulty,title,definition,minimum_rotations,validation,published) values('prism_break',1,$1,1,'easy',$2,$3::jsonb,$4,$5::jsonb,true)",[definition.id,title,JSON.stringify(definition),minimumRotations,JSON.stringify(validation)]),/4096-state mobile validation budget/);
    assert.equal((await one('select count(*)::integer n from public.showdown_puzzles')).n,18);
  });
  await check('missing or disabled game content fails creation atomically with no orphan challenge or invitation',async()=>{
    await assert.rejects(rpc(A,'showdown_create',[B,'unknown_game',requestId(),null]),/not available/);
    await db.exec("update public.showdown_puzzles set published=false where difficulty='hard'");
    await assert.rejects(create(),/Validated puzzle library/);
    assert.equal((await one('select count(*)::integer n from public.showdown_challenges')).n,0);assert.equal((await one('select count(*)::integer n from public.notifications')).n,0);
  });
  await check('rematches retain their parent reference, deliver an invitation and avoid immediately repeating the same three puzzles',async()=>{
    const c=await create(),cid=c.challenge.id;await finish(A,cid);await finish(B,cid);
    const next=await create(B,A,cid);assert.equal(next.challenge.rematch_of,cid);assert.equal(next.challenge.challenger_id,B);
    for(let i=0;i<3;i++)assert.notEqual(next.rounds[i].puzzle_id,c.rounds[i].puzzle_id);
    assert.equal((await one('select count(*)::integer n from public.showdown_events where challenge_id=$1 and event=\'rematch\'',[next.challenge.id])).n,1);
    assert.equal((await one('select count(*)::integer n from public.showdown_challenges where status=\'completed\'')).n,1);
    await assert.rejects(create(A,C,cid),/Rematch unavailable/);
  });
  await check('repeat avoidance rotates through all six boards of each difficulty before recycling',async()=>{
    const sets=[new Set(),new Set(),new Set()];
    for(let n=0;n<6;n++){const c=await create();c.rounds.forEach((round,i)=>sets[i].add(round.puzzle_id));await act(B,c.challenge.id,'decline');}
    assert.deepEqual(sets.map(set=>set.size),[6,6,6]);
  });
  await check('a new challenger also avoids the recipient’s recent puzzles against a different rival',async()=>{
    const prior=await create(B,C);await act(C,prior.challenge.id,'decline');
    const next=await create(A,B);
    assert.equal((await lobby(A)).record.played,0);
    next.rounds.forEach((round,index)=>assert.notEqual(round.puzzle_id,prior.rounds[index].puzzle_id));
  });
  await check('history pagination is stable and personal/rivalry records and game standings derive only from completed matches',async()=>{
    const win=await create();await finish(A,win.challenge.id);await finish(B,win.challenge.id,{skip:true});
    const draw=await create(A,C);await finish(A,draw.challenge.id);await finish(C,draw.challenge.id);
    for(let i=0;i<2;i++){const closed=await create();await act(B,closed.challenge.id,'decline');}
    const first=await rpc(A,'showdown_lobby',['prism_break',null,2]);assert.equal(first.challenges.length,2);assert.ok(first.next_cursor);
    const second=await rpc(A,'showdown_lobby',['prism_break',first.next_cursor,2]);assert.equal(second.challenges.length,2);assert.equal(second.next_cursor,null);
    assert.equal(new Set([...first.challenges,...second.challenges].map(c=>c.id)).size,4);
    assert.deepEqual(first.record,{played:2,wins:1,losses:0,draws:1});
    assert.equal(first.rivalries.find(r=>r.opponent_id===B).wins,1);assert.equal(first.rivalries.find(r=>r.opponent_id===C).draws,1);
    assert.equal(first.standings.find(row=>row.user_id===A).points,4);assert.ok(!first.members.some(member=>member.user_id===PRIVATE||member.user_id===D));
    const metrics=await one('select public.showdown_member_metrics($1,$2) data',[A,uuid(1001)]);assert.equal(metrics.data.played,2);assert.equal(metrics.data.wins,1);assert.equal(metrics.data.draws,1);assert.equal(metrics.data.prism_solved,6);assert.equal(metrics.data.optimum_rounds,6);assert.equal(metrics.data.prism_score,3000);assert.equal(metrics.data.best_prism_score,1500);
  });
  await check('hourly challenge throttling counts actual creates but keeps exact retries usable',async()=>{
    let first,key;
    for(let n=0;n<12;n++){const request=requestId();const c=await create(A,B,null,request);if(n===0){first=c;key=request;}}
    await assert.rejects(create(),/Challenge limit reached/);
    const replay=await create(A,B,null,key);assert.equal(replay.challenge.id,first.challenge.id);
    assert.equal((await one('select count(*)::integer n from public.showdown_challenges')).n,12);
    assert.equal((await one('select count(*)::integer n from public.notifications')).n,12);
  });
  await check('checkpoint flood limits do not invalidate a legitimate saved request retry',async()=>{
    const c=await create(),cid=c.challenge.id,key=requestId(),prefix=solutionFor(c.rounds[0].puzzle).slice(0,1);
    const saved=await save(A,cid,1,prefix,0,key);
    await db.query("insert into public.showdown_requests(request_id,club_id,user_id,challenge_id,operation,payload) select gen_random_uuid(),$1,$2,$3,'test','{}'::jsonb from generate_series(1,600)",[uuid(1001),A,cid]);
    await assert.rejects(save(A,cid,1,[...prefix,{type:'reset'}],1),/Too many updates/);
    const retry=await save(A,cid,1,prefix,0,key);assert.equal(retry.rounds[0].me.revision,saved.rounds[0].me.revision);
  });
  await check('maintenance expires due challenges and sends at most one approaching-expiry notification per recipient',async()=>{
    const soon=await create(),late=await create();
    await db.query("update public.showdown_challenges set created_at=now()-interval '63 hours',expires_at=now()+interval '9 hours' where id=$1",[soon.challenge.id]);
    await db.query("update public.showdown_challenges set created_at=now()-interval '74 hours',expires_at=now()-interval '2 hours' where id=$1",[late.challenge.id]);
    await db.exec('select public.showdown_maintenance();select public.showdown_maintenance();');
    assert.equal((await one('select status from public.showdown_challenges where id=$1',[late.challenge.id])).status,'expired');
    assert.equal((await one('select count(*)::integer n from public.showdown_events where challenge_id=$1 and event=\'expiring\'',[soon.challenge.id])).n,2);
    assert.equal((await one('select count(*)::integer n from public.showdown_events where challenge_id=$1 and event=\'expiring\'',[late.challenge.id])).n,0);
    await assert.rejects(actorQuery(A,'select public.showdown_maintenance()'),/permission denied/);
  });
  await check('a sealed attempt does not receive an expiry reminder asking it to play again',async()=>{
    const c=await create(),cid=c.challenge.id;await finish(A,cid);
    await db.query("update public.showdown_challenges set created_at=now()-interval '63 hours',expires_at=now()+interval '9 hours' where id=$1",[cid]);
    await db.exec('select public.showdown_maintenance();select public.showdown_maintenance();');
    const rows=(await db.query('select user_id from public.showdown_events where challenge_id=$1 and event=\'expiring\'',[cid])).rows;
    assert.deepEqual(rows,[{user_id:B}]);assert.equal((await get(A,cid)).challenge.status,'active');
  });
  await check('an invitation-delivery failure rolls back the entire create instead of leaving a decorative challenge',async()=>{
    await db.exec("create function test_fail_notification() returns trigger language plpgsql as $$ begin raise exception 'forced inbox failure';end $$;create trigger test_fail_notification before insert on public.notifications for each row execute function test_fail_notification();");
    try{await assert.rejects(create(),/forced inbox failure/);}finally{await db.exec('drop trigger test_fail_notification on public.notifications;drop function test_fail_notification();');}
    assert.equal((await one('select count(*)::integer n from public.showdown_challenges')).n,0);assert.equal((await one('select count(*)::integer n from public.showdown_attempts')).n,0);assert.equal((await one('select count(*)::integer n from public.showdown_requests')).n,0);
  });
  await check('an outcome-delivery failure rolls back final scores and can be retried exactly once',async()=>{
    const c=await create(),cid=c.challenge.id;await finish(A,cid);await get(B,cid,true);
    for(let round=1;round<=2;round++){const d=await get(B,cid),r=myRound(d,round);await submit(B,cid,round,solutionFor(r.puzzle));}
    const d=await get(B,cid),actions=solutionFor(d.rounds[2].puzzle),key=requestId();
    await db.exec("create function test_fail_result() returns trigger language plpgsql as $$ begin if new.event='result' then raise exception 'forced result delivery failure';end if;return new;end $$;create trigger test_fail_result before insert on public.showdown_events for each row execute function test_fail_result();");
    try{await assert.rejects(submit(B,cid,3,actions,0,false,key),/forced result delivery failure/);}finally{await db.exec('drop trigger test_fail_result on public.showdown_events;drop function test_fail_result();');}
    const before=await get(B,cid);assert.equal(before.challenge.status,'active');assert.equal(before.rounds[2].me.submitted,false);assert.equal(before.challenge.players.find(p=>p.user_id===B).total_score,1000);
    const retried=await submit(B,cid,3,actions,0,false,key);assert.equal(retried.challenge.status,'completed');assert.equal(retried.challenge.players.find(p=>p.user_id===B).total_score,1500);
    assert.equal((await one('select count(*)::integer n from public.showdown_events where challenge_id=$1 and event=\'result\'',[cid])).n,2);
  });

  assert.equal(await readFile(foundationPath,'utf8'),foundationSource,'Foundation changed during verification; rerun the database suite.');
  assert.equal(await readFile(seedPath,'utf8'),seedSource,'Published seed changed during verification; rerun the database suite.');
  console.log(JSON.stringify({foundationSha256:createHash('sha256').update(foundationSource).digest('hex'),seedSha256:createHash('sha256').update(seedSource).digest('hex')}));
  console.log(`${checks} Showdown PostgreSQL integration groups passed.`);
} catch(error) {
  console.error(error.message);
  if(error.code) console.error(`SQLSTATE ${error.code}`);
  if(error.where) console.error(error.where);
  process.exitCode=1;
} finally { await db.close(); }
