// Deterministic private geology is inspected only by this isolated owner
// fixture. Member payloads and browser oracles never receive a world seed.
import assert from 'node:assert/strict';

export async function runPhase7WorldTests(h) {
  const { check, db, one, A, B, request, bootstrap, get, upgrade, rpc, previewOperation, dispatchOperation, finish, collect, getClub, setSocialPreferences, fixture, deepEngine } = h;
  const current = async () => {
    let snapshot = await bootstrap();
    await db.query('update public.dc_companies set cash=200000,warehouse_level=3 where id=$1', [snapshot.company.id]);
    await db.query('update public.dc_workers set stats=$2::jsonb where company_id=$1', [snapshot.company.id, JSON.stringify({ mining: 100, geology: 100, engineering: 100, logistics: 100, safety: 100, endurance: 100, leadership: 100 })]);
    snapshot = await get();
    for (const key of ['research_office','research_office','smeltery','smeltery','smeltery','tool_station','tool_station']) snapshot = await upgrade(A, snapshot, key);
    const pending = new Set(snapshot.business_catalog.research.map(node => node.key));
    while (pending.size) {
      const completed = new Set(snapshot.business.research.filter(order => order.status === 'completed').map(order => order.key));
      const next = snapshot.business_catalog.research.find(node => pending.has(node.key) && node.requires.every(key => completed.has(key))); assert.ok(next);
      assert.ok(Object.keys(next.inputs).every(key => !['nickel_ore','sulfur','nickel_alloy'].includes(key)));
      assert.ok(Object.values(next.inputs).reduce((sum,value)=>sum+value,0)<=480);
      await db.query('update public.dc_inventory set quantity=coalesce(($2::jsonb->>resource_key)::integer,0) where company_id=$1', [snapshot.company.id,JSON.stringify(next.inputs)]); snapshot = await get();
      snapshot = await rpc(A, 'dc_start_research', { p_research_key: next.key, p_expected_revision: snapshot.revision, p_request_id: request() });
      await fixture.advanceResearch(A, next.key, next.duration_seconds + 1); snapshot = await get(); pending.delete(next.key);
    }
    for (let level = 1; level < 6; level++) snapshot = await upgrade(A, snapshot, 'mine_shaft');
    return snapshot;
  };

  await check('Phase7 world: canonical expansion adds exactly three goods, two recipes and one shield without changing prior catalogs or free progression', async () => {
    const empty = await get(); assert.equal(empty.schema_version, 5); assert.equal(empty.company, null);
    assert.deepEqual(empty.deep_catalog, JSON.parse(fixture.sources.get('supabase/seed/deep-claim-phase7-catalog.json')));
    const snapshot = await bootstrap(); assert.equal(snapshot.company.cash, 180); assert.equal(Object.keys(snapshot.resources).length, 22);
    assert.equal(snapshot.recipes.length, 23); assert.equal(snapshot.equipment_catalog.length, 13);
    assert.equal(snapshot.business_catalog.research.length, 14); assert.equal(snapshot.business_catalog.contracts.length, 12); assert.equal(snapshot.business_catalog.milestones.length, 8);
    assert.equal(snapshot.deep_operations.infrastructure_capacity, 128); assert.equal(snapshot.deep_operations.lift_discount_percent, 0);
    for (const key of ['nickel_ore','sulfur','nickel_alloy']) assert.equal(snapshot.resources[key], 0);
    for (const [version, path] of [[2,'deep-claim-phase2-catalog.json'],[3,'deep-claim-phase3-catalog.json'],[4,'deep-claim-phase4-catalog.json'],[5,'deep-claim-phase5-catalog.json']]) {
      assert.deepEqual((await one('select config from public.dc_rules where version=$1', [version])).config, JSON.parse(fixture.sources.get(`supabase/seed/${path}`)));
    }
    assert.deepEqual((await one('select config from public.dc_rules where version=7')).config, snapshot.deep_catalog);
    const before = JSON.stringify(snapshot);
    const denied = await previewOperation(A, snapshot, { mode: 'explore', x: 47, y: 608 }); assert.equal(denied.allowed, false);
    await assert.rejects(dispatchOperation(A, snapshot, { mode: 'explore', x: 47, y: 608 }));
    const after = await get(); assert.equal(after.company.cash, snapshot.company.cash); assert.deepEqual(after.workers, snapshot.workers); assert.ok(before.length > 0);
  });

  await check('Phase7 world: generator cutover starts only at absent chunk19 while old cells, metadata and the entire600–607 band remain generation3', async () => {
    const snapshot = await bootstrap(), company = snapshot.company.id;
    const world = await one('select * from public.dc_worlds where company_id=$1', [company]);
    await db.query('select public.dc_reveal_v1($1,31,599)', [company]);
    const before = await one('select * from public.dc_chunks where company_id=$1 and chunk_x=0 and chunk_y=18', [company]); assert.equal(before.world_version, 3);
    for (const [x,y] of [[0,600],[31,607],[32,600],[95,607]]) {
      assert.equal((await one('select public.dc_chunk_version_v2($1,$2,$3) version', [company,x,y])).version, 3);
      const selected = (await one('select public.dc_cell_v1($1,$2,$3) value', [company,x,y])).value;
      const old = (await one('select public.dc_cell_v3($1,$2,$3) value', [company,x,y])).value;
      assert.equal(selected.material, old.material); assert.equal(selected.initial_amount, old.initial_amount);
      assert.ok(!['nickel_ore','sulfur'].includes(selected.material));
    }
    assert.equal((await one('select public.dc_chunk_version_v2($1,31,608) version', [company])).version, 4);
    await db.query('select public.dc_reveal_v1($1,31,608)', [company]);
    assert.equal((await one('select world_version from public.dc_chunks where company_id=$1 and chunk_x=0 and chunk_y=19', [company])).world_version, 4);
    assert.deepEqual(await one('select * from public.dc_chunks where company_id=$1 and chunk_x=0 and chunk_y=18', [company]), before);
    assert.deepEqual(await one('select * from public.dc_worlds where company_id=$1', [company]), world);
  });

  await check('Phase7 world: seeded new minerals form finite coherent clusters with deterministic cross-chunk geometry and no shallow new ore', async () => {
    const snapshot = await bootstrap(), company = snapshot.company.id;
    const rows = (await db.query('select x,y,public.dc_cell_v1($1,x,y) cell from generate_series(0,95)x cross join generate_series(608,799,3)y where x%4 in(0,1)', [company])).rows;
    const counts = { nickel_ore: 0, sulfur: 0 }, indexed = new Map(rows.map(row => [`${row.x}:${row.y}`, row.cell])); let neighborMatches = 0, neighbors = 0;
    for (const row of rows) {
      if (Object.hasOwn(counts, row.cell.material)) {
        counts[row.cell.material]++; assert.ok(row.cell.initial_amount >= (row.cell.material === 'nickel_ore' ? 18 : 24) && row.cell.initial_amount <= (row.cell.material === 'nickel_ore' ? 36 : 48));
        const adjacent = indexed.get(`${row.x + 1}:${row.y}`); if (adjacent) { neighbors++; if (adjacent.material === row.cell.material) neighborMatches++; }
      }
    }
    assert.ok(counts.nickel_ore > 25 && counts.sulfur > 25, JSON.stringify(counts)); assert.ok(neighborMatches / neighbors > .45, 'New minerals must cluster rather than independently reroll each cell');
    for (const point of [[31,639],[32,640],[63,671],[64,672],[95,999]]) {
      const first = (await one('select public.dc_cell_v1($1,$2,$3) value', [company,...point])).value;
      const second = (await one('select public.dc_cell_v1($1,$2,$3) value', [company,...point])).value; assert.deepEqual(first, second);
    }
    const shallow = (await db.query('select public.dc_cell_v1($1,x,y) cell from generate_series(0,95,7)x cross join generate_series(1,607,17)y', [company])).rows;
    assert.ok(shallow.every(row => !['nickel_ore','sulfur'].includes(row.cell.material)));
  });

  await check('Phase7 world: actual paid shaft research unlocks999m and956m known corridor without revealing lateral future minerals', async () => {
    const snapshot = await current(), company = snapshot.company.id;
    assert.equal(snapshot.world.max_depth, 999); assert.equal(snapshot.buildings.find(building => building.key === 'mine_shaft').level, 6);
    assert.equal(snapshot.deep_operations.infrastructure_capacity, 192); assert.equal(snapshot.deep_operations.lift_discount_percent, 75);
    for (const depth of [599,600,608,955,956]) assert.ok(snapshot.world.tiles.some(tile => tile.x === 48 && tile.y === depth && tile.remaining === 0));
    assert.ok(!snapshot.world.tiles.some(tile => tile.x === 47 && tile.y === 700));
    assert.equal((await one('select count(*)::int n from public.dc_chunks where company_id=$1', [company])).n <= 34, true);
    for (const invalid of [0,1000,2147483647]) await assert.rejects(previewOperation(A, snapshot, { x: 47,y: invalid }), error => error.code === 'P0001');
  });

  await check('Phase7 world: real paid new-mineral exploration conserves deposits and freezes private cargo until return', async () => {
    let snapshot = await current(); const company = snapshot.company.id;
    await db.query('update public.dc_inventory set quantity=0 where company_id=$1', [company]); snapshot = await get();
    const options = (await db.query("select x,y,public.dc_cell_v1($1,x,y) cell from(values(47),(49))v(x) cross join generate_series(608,956)y", [company])).rows;
    for (const resource of ['nickel_ore','sulfur']) {
      const target = options.find(row => row.cell.material === resource && !snapshot.world.tiles.some(tile => tile.x === row.x && tile.y === row.y)); assert.ok(target, resource);
      const quote = await previewOperation(A, snapshot, { mode: 'explore', x:target.x,y:target.y,duration:60,workers:[snapshot.workers[0].id] }); assert.equal(quote.allowed,true,quote.reasons.join(' '));
      const started = await dispatchOperation(A,snapshot,{mode:'explore',x:target.x,y:target.y,duration:60,workers:[snapshot.workers[0].id]});
      const job = started.expeditions.find(job=>job.status==='active'); assert.equal(job.config_version,7);assert.equal(job.cargo,null);assert.ok(job.deep_modifiers);
      assert.ok(!started.world.tiles.some(tile=>tile.x===target.x&&tile.y===target.y));
      snapshot=await finish(A,started);const ready=snapshot.expeditions.find(value=>value.id===job.id);assert.ok(ready.cargo[resource]>0);
      const oldAmount=target.cell.initial_amount,tile=snapshot.world.tiles.find(tile=>tile.x===target.x&&tile.y===target.y);assert.equal(tile.remaining,oldAmount-ready.cargo[resource]);
      const before=snapshot.resources[resource]||0;snapshot=await collect(A,job.id);assert.equal(snapshot.resources[resource],before+ready.cargo[resource]);
      const repeat=await get();assert.equal(repeat.world.tiles.find(tile=>tile.x===target.x&&tile.y===target.y).remaining,tile.remaining);
    }
    assert.ok(deepEngine, 'The same shipped pure deep engine is available for parity groups');
  });

  await check('Phase7 world: frozen weekly cargo values include explicit new minerals and reject invented market units', async () => {
    assert.equal(Number((await one("select public.dc_mining_value_v5('{\"stone\":1,\"coal\":1,\"nickel_ore\":1,\"sulfur\":1}'::jsonb) value")).value),39);
    assert.equal(Number((await one("select public.dc_mining_value_v5('{\"nickel_alloy\":1,\"unknown_ore\":100000}'::jsonb) value")).value),0);
    let snapshot=await current();snapshot=await setSocialPreferences(A,snapshot,{standings:true});
    const before=(await getClub()).standings.find(row=>row.is_you)?.value||0;
    const candidates=(await db.query("select x,y,public.dc_cell_v1($1,x,y) cell from(values(47),(49))v(x) cross join generate_series(608,956)y",[snapshot.company.id])).rows;
    const target=candidates.find(row=>row.cell.material==='nickel_ore'&&!snapshot.world.tiles.some(tile=>tile.x===row.x&&tile.y===row.y));assert.ok(target);
    snapshot=await dispatchOperation(A,snapshot,{mode:'explore',x:target.x,y:target.y,duration:60,workers:[snapshot.workers[0].id]});
    const job=snapshot.expeditions.find(job=>job.status==='active');snapshot=await finish(A,snapshot);const cargo=snapshot.expeditions.find(value=>value.id===job.id).cargo;
    const value=Number((await one('select public.dc_mining_value_v5($1::jsonb) value',[JSON.stringify(cargo)])).value);
    assert.equal((await getClub()).standings.find(row=>row.is_you).value,before+value);
    snapshot=await collect(A,job.id);assert.equal((await getClub()).standings.find(row=>row.is_you).value,before+value);
    await bootstrap(B);await assert.rejects(rpc(B,'dc_collect',{p_job_id:job.id,p_request_id:request()}),error=>error.code==='42501'||error.code==='P0001');
  });
}
