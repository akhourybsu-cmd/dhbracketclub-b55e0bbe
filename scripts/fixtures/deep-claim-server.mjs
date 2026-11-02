// Loopback-only browser harness endpoint backed by real isolated PostgreSQL.
import { createDeepClaimDatabase } from './deep-claim-db.mjs';
import { randomUUID } from 'node:crypto';

export function createDeepClaimMiddleware(token) {
  const runs = new Map();
  async function runState(key) {
    if (!runs.has(key)) runs.set(key, createDeepClaimDatabase({ notificationPreferences: true }).then(database => ({ database, calls: [], failures: new Map(), holds: new Map() })));
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
      if (input.operation === 'table') {
        if (input.table !== 'notification_preferences') throw new Error('Only the real own notification preference table is available to this fixture');
        const fields = ['chat_messages','polls','events','drafts','mentions','lockbox','portfolio_wars','pickem','rankings','posts','lore','celebrations','narrative','brackets','nexus','runedelve','deep_claim','system'];
        try {
          if (input.method === 'select') {
            if (input.column !== 'user_id' || !input.columns.split(',').every(field => fields.includes(field))) throw new Error('Unexpected preference read');
            const result = await state.database.actorQuery(input.user, `select ${input.columns} from public.notification_preferences where user_id=$1`, [input.value]);
            return reply(response, { data: result.rows[0] ?? null, error: null });
          }
          if (input.method === 'upsert') {
            const columns = Object.keys(input.payload);
            if (!columns.includes('user_id') || columns.some(field => !['user_id','updated_at',...fields].includes(field))) throw new Error('Unexpected preference field');
            const result = await state.database.actorQuery(input.user, `insert into public.notification_preferences(${columns.join(',')}) values(${columns.map((_, index) => '$' + (index + 1)).join(',')}) on conflict(user_id) do update set ${columns.filter(field => field !== 'user_id').map(field => `${field}=excluded.${field}`).join(',')}`, columns.map(field => input.payload[field]));
            return reply(response, { data: null, error: null, count: result.affectedRows });
          }
          throw new Error('Unexpected preference operation');
        } catch (error) { return reply(response, { data: null, error: { message: error.message, code: error.code || 'P0001' } }); }
      }
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
        if (input.command === 'prepare_ancient_deep') {
          // Explicit local late-game history preconditions, never a production
          // account or a claim that this test earned an entire campaign. New
          // minerals/alloy/gear remain ZERO and must be mined/crafted via UI.
          let snapshot = await state.database.rpc(input.user, 'dc_get', {}), company = snapshot.company?.id;
          if (!company || snapshot.expeditions.some(job => job.status === 'active')) throw new Error('A fresh owned local company is required');
          await state.database.db.query('update public.dc_companies set cash=200000,office_level=3,shaft_level=5,warehouse_level=3,tool_level=3,quarters_level=3,smeltery_level=3,gem_workshop_level=3,research_office_level=2,trading_post_level=3 where id=$1', [company]);
          await state.database.db.query('update public.dc_workers set stats=$2::jsonb where company_id=$1', [company, JSON.stringify({mining:100,geology:100,engineering:100,logistics:100,safety:100,endurance:100,leadership:100})]);
          await state.database.db.query("update public.dc_inventory set quantity=case when resource_key in('nickel_ore','sulfur','nickel_alloy') then 0 else 10 end where company_id=$1", [company]);
          // Existing shaft5 history includes its actually constructed passage.
          for (let y=7;y<=556;y++) await state.database.db.query('select public.dc_reveal_v1($1,48,$2)', [company,y]);
          snapshot=await state.database.rpc(input.user,'dc_get',{});
          const pending=new Set(snapshot.business_catalog.research.filter(node=>options.unlock||node.key!=='deep_operations_2').map(node=>node.key));
          while(pending.size){
            const completed=new Set(snapshot.business.research.filter(order=>order.status==='completed').map(order=>order.key));
            const next=snapshot.business_catalog.research.find(node=>pending.has(node.key)&&node.requires.every(key=>completed.has(key)));if(!next)throw new Error('Late research prerequisites could not be prepared');
            if(Object.keys(next.inputs).some(key=>['nickel_ore','sulfur','nickel_alloy'].includes(key)))throw new Error('Old research may not require unearned new minerals');
            await state.database.db.query('update public.dc_inventory set quantity=coalesce(($2::jsonb->>resource_key)::integer,0) where company_id=$1',[company,JSON.stringify(next.inputs)]);
            snapshot=await state.database.rpc(input.user,'dc_get',{});
            snapshot=await state.database.rpc(input.user,'dc_start_research',{p_research_key:next.key,p_expected_revision:snapshot.revision,p_request_id:randomUUID()});
            await state.database.advanceResearch(input.user,next.key,next.duration_seconds+1);snapshot=await state.database.rpc(input.user,'dc_get',{});pending.delete(next.key);
          }
          await state.database.db.query("update public.dc_inventory set quantity=case when resource_key in('nickel_ore','sulfur','nickel_alloy') then 0 else 10 end where company_id=$1",[company]);snapshot=await state.database.rpc(input.user,'dc_get',{});
          if(options.unlock)snapshot=await state.database.rpc(input.user,'dc_upgrade',{p_building_key:'mine_shaft',p_expected_revision:snapshot.revision,p_request_id:randomUUID()});
          return reply(response,{data:{snapshot,scope:'Explicit isolated late-game old-stock/building preconditions; paid research orders. No new ore, alloy or equipment fabricated.'}});
        }
        if(input.command==='deep_worksite'){
          if(!['nickel_ore','sulfur'].includes(options.resource))throw new Error('Invalid deep fixture material');
          const snapshot=await state.database.rpc(input.user,'dc_get',{}),company=snapshot.company?.id;
          if(!company||snapshot.world.max_depth!==999)throw new Error('An owned upgraded local shaft is required');
          const candidates=(await state.database.db.query("select x,y,public.dc_cell_v1($1,x,y) cell from(values(47),(49))v(x) cross join generate_series(608,956)y order by y,x",[company])).rows;
          const worker=snapshot.workers.find(worker=>worker.name==='Mara Flint'&&!worker.assigned_job_id&&worker.energy>=2);
          if(!worker)return reply(response,{data:null});
          for(const point of candidates){
            if(point.cell.material!==options.resource||snapshot.world.tiles.some(tile=>tile.x===point.x&&tile.y===point.y))continue;
            const quote=await state.database.rpc(input.user,'dc_preview_operation',{p_worker_ids:[worker.id],p_mode:'explore',p_target_x:point.x,p_target_y:point.y,p_duration_minutes:60,p_tutorial:false,p_infrastructure_key:null});
            if(quote.allowed&&quote.estimated_yield.max>=6)return reply(response,{data:{x:point.x,y:point.y}});
          }
          return reply(response,{data:null});
        }
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
        if (input.command === 'resource_worksite') {
          if (!['stone','coal'].includes(options.resource) || !Number.isSafeInteger(options.needed) || options.needed < 1) throw new Error('Invalid local source-selection request');
          const snapshot = await state.database.rpc(input.user, 'dc_get', {}), company = snapshot.company?.id;
          const workers = snapshot.workers.filter(worker => !worker.assigned_job_id && worker.energy > 0).slice(0, 3).map(worker => worker.id);
          if (!company || !workers.length) return reply(response, { data: null });
          const points = (await state.database.db.query(`select x,y,true known from public.dc_tiles where company_id=$1 and material=$3 and remaining>0
            union select distinct t.x+v.dx,t.y+v.dy,false from public.dc_tiles t cross join(values(-1,0),(1,0),(0,-1),(0,1))v(dx,dy)
            where t.company_id=$1 and t.remaining=0 and t.x+v.dx between 0 and 95 and t.x+v.dx<>48 and t.y+v.dy between 1 and $2
            and not exists(select 1 from public.dc_tiles known where known.company_id=$1 and known.x=t.x+v.dx and known.y=t.y+v.dy)`, [company, snapshot.world.max_depth, options.resource])).rows;
          const choices = [];
          for (const point of points) {
            const cell = point.known ? snapshot.world.tiles.find(tile => tile.x === point.x && tile.y === point.y) : (await state.database.db.query('select public.dc_cell_v1($1,$2,$3) cell', [company, point.x, point.y])).rows[0].cell;
            if (cell.material !== options.resource) continue;
            const mode = point.known ? 'extract' : 'explore';
            const quote = (await state.database.db.query('select public.dc_preview_operation_v3($1,$2::uuid[],$3,$4,$5,20,false,null,clock_timestamp()) quote', [company, workers, mode, point.x, point.y])).rows[0].quote;
            const amount = Math.min(quote._quantity, point.known ? cell.remaining : cell.initial_amount);
            if (quote.allowed && amount > 0) choices.push({ point: { x: point.x, y: point.y }, mode, amount });
          }
          choices.sort((first, second) => second.amount - first.amount || first.point.y - second.point.y || first.point.x - second.point.x);
          return reply(response, { data: choices[0] ? { point: choices[0].point, mode: choices[0].mode } : null });
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
