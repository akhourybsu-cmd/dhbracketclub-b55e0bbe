import { webcrypto } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { handleArcadeRequest, ArcadeFailure, type ArcadeService, type RpcArgs } from '../../supabase/functions/arcade-run/handler';
import { createRun, stepRun, summarize } from '../../supabase/functions/_shared/arcade/riftwatch';
import { MAX_TICKS, RIFTWATCH_KEY, RIFTWATCH_RULESET } from '../../supabase/functions/_shared/arcade/rules';

const club = '11111111-0000-4000-8000-000000000001';
const runId = '11111111-0000-4000-8000-000000000002';
const member = '11111111-0000-4000-8000-000000000003';
const requestId = '11111111-0000-4000-8000-000000000004';
const now = Date.UTC(2026, 10, 28, 12);
const scope = { clubId: club, gameKey: RIFTWATCH_KEY, rulesetVersion: RIFTWATCH_RULESET };
const started = { ...scope, runId, seed: '74623', status: 'started', startedAt: new Date(now - 1800000).toISOString(), expiresAt: new Date(now + 1800000).toISOString() };
const run = createRun(started.seed);
while (run.phase !== 'over' && run.tick < MAX_TICKS) stepRun(run, 0);
const summary = summarize(run);
const ticket = { action: 'start', requestId, clientBuild: 'test', ...scope };
const submission = { action: 'submit', runId, ...scope, replayEncodingVersion: 1, clientBuild: 'test', inputEvents: [], clientSummary: summary };

// SQL policies/uniqueness and real time-boundary cases run separately against PostgreSQL.
// This transport records what the HTTP handler is actually allowed to send to the trusted receipt writer.
function fixture() {
  let status = 'started';
  let hash = '';
  let receipt: object | null = null;
  const read = () => ({ ...started, status, result: receipt });
  const memberRpc = vi.fn(async (name: string) => {
    if (name === 'arcade_start_run' || name === 'arcade_run_status') return read();
    throw Error('Unknown member RPC');
  });
  const trustedRpc = vi.fn(async (name: string, args: RpcArgs) => {
    if (args.p_user_id !== member || args.p_club_id !== club || args.p_run_id !== runId) throw { code: '42501' };
    if (name === 'arcade_claim_run') {
      if (hash && hash !== args.p_replay_hash) throw { code: '23505' };
      hash = String(args.p_replay_hash);
      const verifyNow = status === 'started';
      if (verifyNow) status = 'submitted';
      return { ...read(), verifyNow };
    }
    if (name === 'arcade_finish_run') {
      const total = args.p_summary as typeof summary | null;
      if (total) {
        status = 'verified';
        receipt = { ...total, newPersonalBest: true, personalBest: total.score, rank: 1, previousRank: null, rankChange: null,
          leaderboard: { period: 'all_time', entries: [], personalBest: null, totalMembers: 1 } };
      } else status = 'rejected';
      return read();
    }
    throw Error('Unknown server RPC');
  });
  const service: ArcadeService = { now: () => now, authenticate: async token => {
    if (token !== 'member') throw new ArcadeFailure('unauthorized', 401, 'Sign in.');
    return { userId: member, memberRpc, trustedRpc };
  } };
  const request = async (body: unknown, authorization = 'Bearer member') => {
    const res = await handleArcadeRequest(new Request('https://example.test/arcade-run', {
      method: 'POST', headers: { authorization }, body: JSON.stringify(body),
    }), service);
    return { status: res.status, body: await res.json() };
  };
  return { service, request, trustedRpc, memberRpc };
}

beforeAll(() => vi.stubGlobal('crypto', webcrypto));
afterAll(() => vi.unstubAllGlobals());

describe('arcade score HTTP contract', () => {
  it('binds starts and status to the verified JWT and returns only a public session', async () => {
    const f = fixture();
    expect((await f.request(ticket)).body).toEqual({ ...started, rejectionCode: null, result: null });
    expect(f.memberRpc).toHaveBeenCalledWith('arcade_start_run', { p_club_id: club, p_game_key: RIFTWATCH_KEY,
      p_ruleset_version: RIFTWATCH_RULESET, p_request_id: requestId, p_client_build: 'test' });
    expect((await f.request({ ...scope, action: 'status', runId })).body.status).toBe('started');
    expect((await f.request(ticket, '')).status).toBe(401);
    expect((await f.request(submission, 'Bearer expired')).status).toBe(401);
    expect(f.trustedRpc).not.toHaveBeenCalled();
  });

  it('replays from the server seed; repeat submissions receive the same score and create one receipt', async () => {
    const f = fixture();
    const first = await f.request(submission);
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ ...summary, status: 'verified', isPersonalBest: true, rank: 1 });
    expect(await f.request(submission)).toEqual(first);
    expect(f.trustedRpc.mock.calls.filter(([name]) => name === 'arcade_finish_run')).toHaveLength(1);
    expect((await f.request({ ...submission, inputEvents: [[0, 1]] })).status).toBe(409);
    expect((await f.request({ ...scope, action: 'status', runId })).body.result).toEqual(first.body);
  });

  it('rejects a forged score and persists only a generic rejection code', async () => {
    const f = fixture();
    const forged = { ...submission, clientSummary: { ...summary, score: summary.score + 4000 } };
    const res = await f.request(forged);
    expect(res).toMatchObject({ status: 422, body: { error: { code: 'rejected', retryable: false } } });
    expect(f.trustedRpc).toHaveBeenLastCalledWith('arcade_finish_run', expect.objectContaining({ p_summary: null, p_rejection_code: 'invalid_replay' }));
    expect((await f.request(forged)).status).toBe(422);
  });

  it('refuses unsupported rules, client-chosen seeds, foreign owners, other clubs and ineligible starts', async () => {
    const f = fixture();
    expect((await f.request({ ...submission, seed: '548' })).status).toBe(400);
    expect((await f.request({ ...submission, rulesetVersion: 'unknown' })).body.error.code).toBe('unsupported_rules');
    expect((await f.request({ ...submission, userId: member })).status).toBe(400);
    expect((await f.request({ ...submission, clubId: runId })).status).toBe(403);
    f.memberRpc.mockRejectedValueOnce({ code: '42501', message: 'internal details' });
    expect((await f.request(ticket)).body.error).toEqual({ code: 'not_eligible', message: 'This club or cartridge is unavailable for ranked play.', retryable: false });
    f.memberRpc.mockRejectedValueOnce({ code: 'P0001', message: 'rate_limited' });
    expect((await f.request(ticket)).status).toBe(429);
  });

  it('bounds parsed request bytes, ticks, event count, encoding and summary before simulation', async () => {
    const f = fixture();
    expect((await f.request({ ...submission, inputEvents: Array(8200).fill([0, 0]) })).status).toBe(400);
    expect((await f.request({ ...submission, inputEvents: ['a'.repeat(135000)] })).status).toBe(413);
    expect((await f.request({ ...submission, clientSummary: { ...summary, simulationTicks: MAX_TICKS + 1 } })).status).toBe(400);
    expect((await f.request({ ...submission, replayEncodingVersion: 0 })).status).toBe(400);
    expect((await f.request({ ...submission, clientSummary: { ...summary, score: -1 } })).status).toBe(400);
    expect(f.trustedRpc).not.toHaveBeenCalled();
  });

  it.each([
    [[-1, 1]], [[1, 1], [0, 0]], [[0, 0]], [[0, 128]], [[summary.simulationTicks, 1]],
  ])('rejects illegal saved control changes (%j)', async (...inputEvents) => {
    const f = fixture();
    expect((await f.request({ ...submission, inputEvents })).status).toBe(422);
    expect(f.trustedRpc).toHaveBeenLastCalledWith('arcade_finish_run', expect.objectContaining({ p_summary: null }));
  });

  it('checks elapsed time, expired sessions and the verifier lease before calculating a score', async () => {
    const f = fixture();
    f.service.now = () => Date.parse(started.startedAt);
    expect((await f.request(submission)).status).toBe(422);
    expect(f.trustedRpc).toHaveBeenLastCalledWith('arcade_finish_run', expect.objectContaining({ p_summary: null, p_rejection_code: 'elapsed_time' }));
    const expired = fixture();
    expired.trustedRpc.mockResolvedValueOnce({ ...started, status: 'expired', result: null });
    expect((await expired.request(submission)).status).toBe(410);
    const pending = fixture();
    pending.trustedRpc.mockResolvedValueOnce({ ...started, status: 'submitted', verifyNow: false, result: null });
    expect((await pending.request(submission))).toMatchObject({ status: 409, body: { error: { retryable: true, code: 'pending' } } });
    expect(pending.trustedRpc).toHaveBeenCalledTimes(1);
  });
});
