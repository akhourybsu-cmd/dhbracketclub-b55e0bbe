// Loopback-only browser harness endpoint backed by real isolated PostgreSQL.
import { createDeepClaimDatabase } from './deep-claim-db.mjs';

export function createDeepClaimMiddleware(token) {
  const runs = new Map();
  async function runState(key) {
    if (!runs.has(key)) runs.set(key, createDeepClaimDatabase().then(database => ({ database, calls: [], failures: new Map(), holds: new Map() })));
    return runs.get(key);
  }
  function reply(response, body, status = 200) {
    response.statusCode = status;
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Cache-Control', 'no-store');
    response.end(JSON.stringify(body));
  }
  async function body(request) {
    let value = '';
    for await (const chunk of request) {
      value += chunk;
      if (value.length > 32768) throw new Error('Fixture request is too large');
    }
    return JSON.parse(value);
  }
  async function middleware(request, response, next) {
    if (request.url?.split('?')[0] !== '/__deep_claim_qa') return next();
    if (request.method !== 'POST' || request.headers['x-deep-claim-qa'] !== token) return reply(response, { error: { message: 'Private test endpoint', code: '42501' } }, 403);
    try {
      const input = await body(request);
      if (typeof input.run !== 'string' || input.run.length > 100 || typeof input.user !== 'string') throw new Error('Invalid isolated fixture identity');
      const state = await runState(input.run);
      if (input.operation === 'rpc') {
        const call = { name: input.name, user: input.user, args: input.args, received_at: new Date().toISOString(), status: 'pending' };
        state.calls.push(call);
        // Holds happen before PostgreSQL acquires its transaction/company lock.
        // Both devices may reach a deliberate concurrent-delivery barrier.
        const hold = state.holds.get(input.name);
        if (hold) await hold.promise;
        const failure = state.failures.get(input.name);
        if (failure?.count > 0 && !failure.after_commit) {
          failure.count--; call.status = 'failed-before-commit';
          return reply(response, { data: null, error: { message: 'Local fixture connection unavailable', code: 'FETCH_ERROR' } });
        }
        try {
          const data = await state.database.rpc(input.user, input.name, input.args ?? {});
          if (failure?.count > 0 && failure.after_commit) {
            failure.count--; call.status = 'acknowledgement-lost';
            return reply(response, { data: null, error: { message: 'Local fixture acknowledgement was lost', code: 'FETCH_ERROR' } });
          }
          call.status = 'completed';
          return reply(response, { data, error: null });
        } catch (error) {
          call.status = 'rejected'; call.error = error.message;
          return reply(response, { data: null, error: { message: error.message, code: error.code || 'P0001' } });
        }
      }
      if (input.operation === 'command') {
        const options = input.input ?? {};
        if (input.command === 'calls') return reply(response, { data: state.calls });
        if (input.command === 'advance_job') {
          await state.database.advanceJob(input.user, options.job_id, options.seconds);
          return reply(response, { data: true });
        }
        if (input.command === 'advance_production') {
          await state.database.advanceProduction(input.user, options.job_id, options.seconds);
          return reply(response, { data: true });
        }
        if (input.command === 'advance_research') {
          await state.database.advanceResearch(input.user, options.research_key, options.seconds);
          return reply(response, { data: true });
        }
        if (input.command === 'stone_worksite') {
          // Local QA chooses a legal frontier with enough real host stone for
          // the authored first delivery. The player still pays and mines it.
          const snapshot = await state.database.rpc(input.user, 'dc_get', {}), company = snapshot.company?.id;
          const worker = snapshot.workers.find(value => value.name === 'Ivo Vale');
          if (!company || !worker) throw new Error('An owned company and available crew are required');
          const candidates = (await state.database.db.query(`select distinct t.x+v.dx x,t.y+v.dy y from public.dc_tiles t cross join(values(-1,0),(1,0),(0,-1),(0,1))v(dx,dy)
            where t.company_id=$1 and t.remaining=0 and t.x+v.dx between 0 and 95 and t.x+v.dx<>48 and t.y+v.dy between 1 and $2
            and not exists(select 1 from public.dc_tiles known where known.company_id=$1 and known.x=t.x+v.dx and known.y=t.y+v.dy)
            order by y,x`, [company, snapshot.world.max_depth])).rows;
          for (const point of candidates) {
            const cell = (await state.database.db.query('select public.dc_cell_v1($1,$2,$3) cell', [company, point.x, point.y])).rows[0].cell;
            if (cell.material !== 'stone' || cell.initial_amount < Math.max(0, 20 - (snapshot.resources.stone || 0))) continue;
            const quote = (await state.database.db.query("select public.dc_preview_operation_v3($1,$2::uuid[],'explore',$3,$4,20,false,null,clock_timestamp()) quote", [company, [worker.id], point.x, point.y])).rows[0].quote;
            if (quote.allowed && quote._quantity >= Math.max(0, 20 - (snapshot.resources.stone || 0))) return reply(response, { data: point });
          }
          return reply(response, { data: null });
        }
        if (input.command === 'cavern_survey_site') {
          // This owner-only local test oracle selects an existing public
          // shaft worksite whose genuine timed survey will reveal a chamber.
          // It never changes seed, stock, money, terrain or production rules.
          const snapshot = await state.database.rpc(input.user, 'dc_get', {});
          const worker = snapshot.workers.find(value => value.name === 'Ivo Vale');
          if (!snapshot.company || !worker) throw new Error('Found and upgrade a real isolated company first');
          for (let y = 32; y <= 56; y++) {
            if (!snapshot.world.tiles.some(value => value.x === 48 && value.y === y)) continue;
            const quote = (await state.database.db.query("select public.dc_preview_operation_v3($1,$2::uuid[],'survey',48,$3,180,false,null,clock_timestamp()) quote", [snapshot.company.id, [worker.id], y])).rows[0].quote;
            if (!quote.allowed) continue;
            const expected = [];
            for (const point of quote._survey_reveals) {
              const cell = (await state.database.db.query('select public.dc_cell_v1($1,$2,$3) cell', [snapshot.company.id, point.x, point.y])).rows[0].cell;
              if (cell.formation) expected.push({ ...point, formation: cell.formation });
            }
            if (expected.length) return reply(response, { data: { site: { x: 48, y }, expected } });
          }
          return reply(response, { data: null });
        }
        if (input.command === 'fail_next') {
          state.failures.set(options.name, { count: options.count ?? 1, after_commit: options.after_commit ?? false });
          return reply(response, { data: true });
        }
        if (input.command === 'hold') {
          if (!state.holds.has(options.name)) {
            let release;
            const promise = new Promise(resolve => { release = resolve; });
            state.holds.set(options.name, { promise, release });
          }
          return reply(response, { data: true });
        }
        if (input.command === 'release') {
          state.holds.get(options.name)?.release(); state.holds.delete(options.name);
          return reply(response, { data: true });
        }
        throw new Error(`Unknown isolated fixture command ${input.command}`);
      }
      throw new Error('Unknown isolated fixture operation');
    } catch (error) { reply(response, { error: { message: error.message, code: error.code || 'FIXTURE_ERROR' } }, 500); }
  }
  async function releaseAll() {
    for (const pending of runs.values()) {
      const state = await pending.catch(() => null);
      if (state) for (const hold of state.holds.values()) hold.release();
    }
  }
  async function close() {
    await releaseAll();
    for (const pending of runs.values()) {
      const state = await pending.catch(() => null);
      if (!state) continue;
      for (const hold of state.holds.values()) hold.release();
      await state.database.close();
    }
  }
  async function diagnostics() {
    const result = {};
    for (const [name, pending] of runs) {
      const state = await pending.catch(() => null);
      result[name] = state ? { calls: state.calls } : { error: 'Database fixture failed to initialize' };
    }
    return result;
  }
  return { middleware, close, releaseAll, runState, diagnostics };
}
