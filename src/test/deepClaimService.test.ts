import { describe, expect, it, vi } from 'vitest';
import { DeepClaimError, deepClaimFailure, deepClaimDispatchArgs, deepClaimRpc, parseDeepClaimPreview, parseDeepClaimSnapshot, shareDeepClaimSnapshot } from '@/lib/deepClaim/service';
import { companySnapshot } from './fixtures/deepClaim';
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: vi.fn() } }));

describe('Deep Claim private/public transport boundary', () => {
  it('does not allow the transport to call private generation or reconciliation helpers', async () => {
    for (const name of ['dc_cell_v1', 'dc_cell_v2', 'dc_snapshot_v1', 'dc_freeze_equipment_v2']) {
      await expect(deepClaimRpc(name)).rejects.toMatchObject({ code: 'rule', message: 'Unknown company operation.' });
    }
  });
  it('classifies a rejected operating-reserve purchase as a rule error so recovery is not locked', () => {
    const error = deepClaimFailure({ code: 'P0001', message: 'Keep $2 operating cash after an upgrade' });
    expect(error.code).toBe('rule'); expect(error.message).toContain('$2');
  });
  it.each(['23505','40P01'])('treats transaction conflict %s as a rejected intent rather than a lost acknowledgement', code => {
    expect(deepClaimFailure({ code }).code).toBe('conflict');
  });
  it('accepts a coherent company and a genuinely unstarted account', () => {
    expect(parseDeepClaimSnapshot(companySnapshot()).company?.cash).toBe(180);
    expect(parseDeepClaimSnapshot({ schema_version: 1, server_now: '2026-11-01T12:00:00Z', revision: 0, company: null, world: null, resources: {}, workers: [], expeditions: [], buildings: [], log: [] }).company).toBeNull();
  });
  it.each(['seed','world_seed','simulation_seed','private_plan','milestones','hidden_deposits'])('rejects leaked private field %s anywhere in a response', field => {
    const data = companySnapshot(); Object.assign(data.world!, { nested: { [field]: 'private' } });
    expect(() => parseDeepClaimSnapshot(data)).toThrow(DeepClaimError);
  });
  it('rejects negative balances, invalid inventory and duplicated terrain instead of enabling actions', () => {
    const money = companySnapshot(); money.company!.cash = -1;
    const inventory = companySnapshot(); inventory.resources.coal = -2;
    const tile = companySnapshot(); tile.world!.tiles.push({ ...tile.world!.tiles[0] });
    const energy = companySnapshot(); energy.workers[0].energy = 7;
    for (const data of [money, inventory, tile, energy]) expect(() => parseDeepClaimSnapshot(data)).toThrow(DeepClaimError);
  });
  it('rejects a worker assignment without a corresponding active expedition', () => {
    const data = companySnapshot(); data.workers[0].assigned_job_id = 'invented-job';
    expect(() => parseDeepClaimSnapshot(data)).toThrow(DeepClaimError);
  });
  it('does not roll a mutated company back when a slow earlier read arrives', () => {
    const current = companySnapshot(4), older = companySnapshot(3);
    expect(shareDeepClaimSnapshot(current, older)).toBe(current);
    expect(shareDeepClaimSnapshot(current, { ...older, company: null, world: null })).toBe(current);
    expect(shareDeepClaimSnapshot(current, companySnapshot(5)).revision).toBe(5);
    expect(shareDeepClaimSnapshot(current, { ...current, server_now: '2026-11-01T11:59:59Z' })).toBe(current);
    expect(shareDeepClaimSnapshot(current, { ...current, server_now: '2026-11-01T12:00:01Z' }).server_now).toBe('2026-11-01T12:00:01Z');
  });
  it('sends raw dispatch choices without any client score, cash, outcome or seed', () => {
    expect(deepClaimDispatchArgs({ worker_ids: ['worker-a'], mode: 'explore', target_x: 48, target_y: 5, duration_minutes: 20, tutorial: true })).toEqual({
      p_worker_ids: ['worker-a'], p_mode: 'explore', p_target_x: 48, p_target_y: 5, p_duration_minutes: 20, p_tutorial: true,
    });
  });
  it('rejects corrupt quote ranges and private preview data', () => {
    const quote = { allowed: true, reasons: [], company_revision: 1, server_now: '2026-11-01T12:00:00Z', wages: 3, energy_per_worker: 1,
      duration_seconds: 1200, estimated_yield: { min: 2, max: 10 }, route: [], stages: [], cargo_capacity: 20, risk_level: 'low', accessible_depth: 49, expected_resources: ['stone'], projected_completion_at: '2026-11-01T12:20:00Z' };
    expect(parseDeepClaimPreview(quote).wages).toBe(3);
    expect(() => parseDeepClaimPreview({ ...quote, estimated_yield: { min: 12, max: 10 } })).toThrow(DeepClaimError);
    expect(() => parseDeepClaimPreview({ ...quote, private_plan: [] })).toThrow(DeepClaimError);
  });
});
