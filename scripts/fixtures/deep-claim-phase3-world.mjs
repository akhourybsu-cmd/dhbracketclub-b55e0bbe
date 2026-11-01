// Natural-air and current-world invariants using genuine private v3 geometry.
// Private helper reads select deterministic fixtures; they never reach the UI.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export async function runPhase3WorldTests(h) {
  const { check, db, one, A, bootstrap, get, upgrade, previewOperation, dispatchOperation, collect, finish, engine } = h;
  async function deepCompany() {
    let snapshot = await bootstrap();
    await db.query('update public.dc_companies set cash=30000 where id=$1', [snapshot.company.id]); snapshot = await get();
    for (let level = 1; level < 5; level++) snapshot = await upgrade(A, snapshot, 'mine_shaft');
    assert.equal(snapshot.world.max_depth, 599);
    return snapshot;
  }
  async function naturalRun(snapshot, partial) {
    const company = snapshot.company.id;
    const rooms = (await db.query(`
      select q.* from(select
        24*mx+4+(public.dc_hash_v3($1,'room_x',mx,my)%17)::int cx,
        24*my+4+(public.dc_hash_v3($1,'room_y',mx,my)%17)::int cy,
        3+(public.dc_hash_v3($1,'room_rx',mx,my)%6)::int rx
        from generate_series(0,1)mx cross join generate_series(2,21)my
        where public.dc_hash_v3($1,'room_active',mx,my)%100<55)q
      where q.rx>=5 and q.cy between 36 and 550 and q.cx-q.rx>1 and q.cx+q.rx<47 order by cy,cx
    `, [company])).rows;
    for (const room of rooms) {
      const start = partial ? room.cx - room.rx + 6 : room.cx + 3;
      const points = Array.from({ length: 8 }, (_, offset) => ({ x: start - offset, y: room.cy }));
      const cells = [];
      for (const point of points) cells.push((await one('select public.dc_cell_v1($1,$2,$3) cell', [company, point.x, point.y])).cell);
      const airCount = partial ? 7 : 8;
      if (!cells.slice(0, airCount).every(cell => cell.material === null && cell.initial_amount === 0 && cell.formation)) continue;
      if (partial && !(cells[7].material && cells[7].initial_amount > 0 && cells[7].initial_amount < 30)) continue;
      return { points, cells };
    }
    assert.fail('The genuine v3 world must contain an eight-cell natural-air run and a soft finite chamber edge');
  }
  async function connectTo(snapshot, point) {
    for (let x = point.x + 1; x < 48; x++) {
      await db.query('select public.dc_reveal_v1($1,$2,$3)', [snapshot.company.id, x, point.y]);
      await db.query('update public.dc_tiles set remaining=0 where company_id=$1 and x=$2 and y=$3', [snapshot.company.id, x, point.y]);
    }
    return get();
  }
  await check('Phase3 geometry agrees with an independent global-ellipse oracle across chunk borders and preserves original chunk row zero', async () => {
    const snapshot = await bootstrap(), company = snapshot.company.id;
    const world = await one('select seed from public.dc_worlds where company_id=$1', [company]);
    const hash = (namespace, x, y) => Number.parseInt(createHash('md5').update(`dc3:${namespace}:${world.seed}:${x}:${y}`).digest('hex').slice(0, 8), 16);
    function expectedFormation(x, y) {
      if (x === 48) return null;
      for (let my = Math.max(0, Math.floor(y / 24) - 1); my <= Math.floor(y / 24) + 1; my++) for (let mx = Math.max(0, Math.floor(x / 24) - 1); mx <= Math.min(3, Math.floor(x / 24) + 1); mx++) {
        const active = hash('room_active', mx, my); if (active % 100 >= 55) continue;
        const cx = 24 * mx + 4 + hash('room_x', mx, my) % 17, cy = 24 * my + 4 + hash('room_y', mx, my) % 17;
        const rx = 3 + hash('room_rx', mx, my) % 6, ry = 2 + hash('room_ry', mx, my) % 4;
        if ((x - cx) ** 2 * ry ** 2 + (y - cy) ** 2 * rx ** 2 <= rx ** 2 * ry ** 2) return cy >= 320 ? 'ruins' : cy >= 160 ? ['crystal_cavern', 'wet_cavern', 'cavern'][active % 3] : cy >= 50 && active % 3 === 0 ? 'wet_cavern' : 'cavern';
      }
      return null;
    }
    const samples = (await db.query(`select x,y,public.dc_cell_v1($1,x,y) cell,public.dc_formation_v3($1,x,y) formation
      from generate_series(0,95,3)x cross join generate_series(32,590,7)y
      union all select x,y,public.dc_cell_v1($1,x,y),public.dc_formation_v3($1,x,y)
      from(values(30),(31),(32),(33),(62),(63),(64),(65))v(x) cross join generate_series(29,35)y`, [company])).rows;
    let air = 0; const formations = new Set();
    for (const sample of samples) {
      const expected = expectedFormation(sample.x, sample.y); assert.equal(sample.formation, expected);
      if (sample.y >= 32) {
        assert.equal(sample.cell.formation, expected);
        if (expected) { air++; formations.add(expected); assert.equal(sample.cell.material, null); assert.equal(sample.cell.initial_amount, 0); }
      } else {
        const original = (await one('select public.dc_cell_v1_phase1_base($1,$2,$3) cell', [company, sample.x, sample.y])).cell;
        assert.equal(sample.cell.material, original.material); assert.equal(sample.cell.initial_amount, original.initial_amount);
      }
    }
    assert.ok(air > 50, 'New underground chunks must contain actual coherent natural air');
    for (const formation of ['cavern', 'wet_cavern', 'crystal_cavern', 'ruins']) assert.ok(formations.has(formation));
    assert.deepEqual((await get()).world.tiles, snapshot.world.tiles, 'Private geometry validation cannot reveal player terrain');
  });
  for (const partial of [false, true]) await check(`Phase3 natural-air exploration settles ${partial ? 'partial finite' : 'zero'} cargo after eight cells without invented ore`, async () => {
    let snapshot = await deepCompany(); const run = await naturalRun(snapshot, partial), target = run.points[0];
    assert.deepEqual((await one('select public.dc_route_v1($1,$2,$3) route', [snapshot.company.id, target.x, target.y])).route, [], 'Hidden rooms cannot create speculative routes');
    snapshot = await connectTo(snapshot, target);
    const workers = partial ? snapshot.workers.map(worker => worker.id) : [snapshot.workers.find(worker => worker.name === 'Ivo Vale').id];
    const options = { workers, mode: 'explore', x: target.x, y: target.y, duration: 180 };
    const quote = await previewOperation(A, snapshot, options); assert.equal(quote.allowed, true, quote.reasons.join(' ')); assert.equal(quote.estimated_yield.min, 0);
    if (!partial) {
      await db.query('update public.dc_companies set cash=$2 where id=$1', [snapshot.company.id, quote.wages]); snapshot = await get();
      const beforeCash = snapshot.company.cash, beforeTiles = snapshot.world.tiles;
      await assert.rejects(dispatchOperation(A, snapshot, options), /operating|cash|stock|reserve/i);
      const rejected = await get(); assert.equal(rejected.company.cash, beforeCash); assert.deepEqual(rejected.world.tiles, beforeTiles);
    }
    await db.query('update public.dc_companies set cash=$2 where id=$1', [snapshot.company.id, quote.wages + 2]); snapshot = await get();
    const resourcesBefore = snapshot.resources, started = await dispatchOperation(A, snapshot, options), job = started.expeditions.find(job => job.status === 'active');
    assert.equal(job.cargo, null); assert.equal(started.company.cash, 2);
    for (const point of run.points) assert.ok(!started.world.tiles.some(tile => tile.x === point.x && tile.y === point.y), 'Air must remain hidden until a due milestone');
    const ready = await finish(A, started), result = ready.expeditions.find(operation => operation.id === job.id);
    const expected = partial ? { [run.cells[7].material]: run.cells[7].initial_amount } : {};
    assert.deepEqual(result.cargo, expected); assert.deepEqual(ready.resources, resourcesBefore);
    for (const [index, point] of run.points.entries()) {
      const actual = ready.world.tiles.find(tile => tile.x === point.x && tile.y === point.y); assert.ok(actual, 'Every visited natural-air coordinate must become visible');
      assert.equal(actual.initial_amount, run.cells[index].initial_amount); assert.equal(actual.remaining, 0);
      if (index < (partial ? 7 : 8)) assert.equal(actual.formation, run.cells[index].formation);
    }
    const after = result.status === 'ready' ? await collect(A, job.id) : ready;
    assert.equal(after.expeditions.find(operation => operation.id === job.id).status, 'collected');
    for (const [resource, quantity] of Object.entries(expected)) assert.equal(after.resources[resource], (resourcesBefore[resource] || 0) + quantity);
  });

  await check('Phase3 natural rooms are walkable only after actual revelation and connection', async () => {
    let snapshot = await deepCompany(); const run = await naturalRun(snapshot, false), [first, second] = run.points;
    for (const point of [first, second]) await db.query('select public.dc_reveal_v1($1,$2,$3)', [snapshot.company.id, point.x, point.y]);
    snapshot = await get();
    assert.deepEqual((await one('select public.dc_route_v1($1,$2,$3) route', [snapshot.company.id, second.x, second.y])).route, []);
    assert.equal((await previewOperation(A, snapshot, { mode: 'survey', x: second.x, y: second.y, duration: 180 })).allowed, false);
    snapshot = await connectTo(snapshot, first);
    const route = (await one('select public.dc_route_v1($1,$2,$3) route', [snapshot.company.id, second.x, second.y])).route;
    assert.ok(route.some(point => point.x === first.x && point.y === first.y)); assert.deepEqual(route.at(-1), second);
    assert.equal((await previewOperation(A, snapshot, { mode: 'survey', x: second.x, y: second.y, duration: 180 })).allowed, true);
    engine.validateDeepClaimSnapshot(snapshot);
  });

  await check('Phase3 newly dispatched private futures pin generation metadata without revealing terrain', async () => {
    let snapshot = await deepCompany();
    const company = snapshot.company.id, worker = snapshot.workers.find(person => person.name === 'Ivo Vale');
    for (let x = 34; x < 48; x++) {
      await db.query('select public.dc_reveal_v1($1,$2,299)', [company, x]);
      await db.query('update public.dc_tiles set remaining=0 where company_id=$1 and x=$2 and y=299', [company, x]);
    }
    await db.query('update public.dc_workers set stats=$2::jsonb where id=$1', [worker.id, JSON.stringify({ mining: 1, geology: 50, engineering: 1, logistics: 1, safety: 100, endurance: 1, leadership: 1 })]);
    snapshot = await get();
    assert.equal((await one('select count(*)::int n from public.dc_chunks where company_id=$1 and chunk_x=0 and chunk_y=9', [company])).n, 0);
    const beforeTiles = snapshot.world.tiles;
    const started = await dispatchOperation(A, snapshot, { workers: [worker.id], mode: 'explore', x: 33, y: 299, duration: 180 });
    const job = started.expeditions.find(operation => operation.status === 'active'); assert.equal(job.config_version, 3);
    assert.deepEqual(started.world.tiles, beforeTiles, 'Chunk pinning must not publish a hidden future worksite');
    const plan = (await one('select content from public.dc_plans where job_id=$1', [job.id])).content;
    const future = [...plan.reveals, ...plan.extractions]; assert.ok(future.some(point => Math.floor(point.x / 32) === 0));
    for (const point of future) {
      const pinned = await one('select world_version,seed from public.dc_chunks where company_id=$1 and chunk_x=$2 and chunk_y=$3', [company, Math.floor(point.x / 32), Math.floor(point.y / 32)]);
      assert.ok(pinned, 'Every private planned coordinate needs immutable version metadata'); assert.equal(pinned.world_version, 3);
      const expected = await one("select md5(seed::text||':3:'||$2::text||':'||$3::text) seed from public.dc_worlds where company_id=$1", [company, Math.floor(point.x / 32), Math.floor(point.y / 32)]);
      assert.equal(pinned.seed, expected.seed);
    }
    assert.equal((await one('select count(*)::int n from public.dc_tiles where company_id=$1 and x<32 and y between 288 and 319', [company])).n, 0);
    const complete = await finish(A, started); engine.validateDeepClaimSnapshot(complete);
    assert.deepEqual((await one('select content from public.dc_plans where job_id=$1', [job.id])).content, plan);
  });
}
