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
