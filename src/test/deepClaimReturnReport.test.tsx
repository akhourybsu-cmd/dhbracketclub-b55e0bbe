import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeepClaimReturnReport } from '@/components/deepClaim/DeepClaimReturnReport';
import { acknowledgeReturnReport, currentReturnReport, firstReturnReportAction, observeReturnReport, readReturnReport, returnReportKey, saveReturnReport, type ReturnReportScope } from '@/lib/deepClaim/returnReport';
import type { DeepClaimDiscovery, DeepClaimExpedition, DeepClaimProductionJob, DeepClaimSnapshot } from '@/lib/deepClaim/types';
import { phaseFourSnapshot } from './fixtures/deepClaimPhase4';

const scope: ReturnReportScope = { userId: 'user-a', clubId: 'club-a', companyId: 'company-a' };
const start = '2026-11-01T12:00:00Z', end = '2026-11-01T12:30:00Z';
function haul(overrides: Partial<DeepClaimExpedition> = {}): DeepClaimExpedition {
  return { id: 'haul-a', mode: 'extract', status: 'ready', worker_ids: ['worker-a'], target: { x: 47, y: 3 }, path: [], stages: [], stage: 'ready', started_at: start, completes_at: end, duration_minutes: 20, duration_seconds: 1200, tutorial: false, wages: 3, energy_per_worker: 1, config_version: 3, cargo: { coal: 10, stone: 2 }, ...overrides };
}
function production(overrides: Partial<DeepClaimProductionJob> = {}): DeepClaimProductionJob {
  return { id: 'production-a', recipe_key: 'smelt_copper', recipe_version: 1, batches: 1, station: 'smeltery', status: 'ready', started_at: start, completes_at: end, duration_seconds: 300, cash_cost: 2, inputs: { copper_ore: 3, coal: 1 }, outputs: { copper_bar: 1 }, equipment_outputs: [], ...overrides };
}
function find(overrides: Partial<DeepClaimDiscovery> = {}): DeepClaimDiscovery {
  return { id: 'find-a', job_id: 'haul-a', x: 47, y: 3, kind: 'banded_geode', name: 'Banded Geode', quality: 'fine', detail: 'Quartz bands.', sale_value: 42, salvage: { quartz: 2 }, status: 'pending', discovered_at: end, resolved_at: null, ...overrides };
}
function readySnapshot(): DeepClaimSnapshot {
  const data = phaseFourSnapshot(); data.server_now = end; data.expeditions = [haul()]; data.production_jobs = [production()]; data.discoveries = [find()];
  data.business!.research = [{ key: 'excavation_1', status: 'completed', started_at: start, completes_at: end, completed_at: end }];
  return data;
}
const baseline = () => acknowledgeReturnReport(null, phaseFourSnapshot(), scope)!;
beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('source-backed return reports', () => {
  it('quietly baselines a first visit even when older work is ready', () => {
    const data = readySnapshot(), result = observeReturnReport(null, data, scope);
    expect(result.report).toBeNull(); expect(result.receipt?.seen).toEqual({ hauls: ['haul-a'], production: ['production-a'], finds: ['find-a'], research: ['excavation_1'] });
    expect(observeReturnReport(result.receipt, data, scope).report).toBeNull();
  });
  it('summarizes only newly confirmed ready states after the baseline', () => {
    const result = observeReturnReport(baseline(), readySnapshot(), scope).report!;
    expect(result.hauls).toEqual([{ id: 'haul-a', depth: 3, resources: { stone: 2, coal: 10 } }]);
    expect(result.production[0]).toMatchObject({ id: 'production-a', station: 'smeltery', resources: { copper_bar: 1 } });
    expect(result.finds[0]).toEqual({ id: 'find-a', name: 'Banded Geode', kind: 'banded_geode', quality: 'fine' });
    expect(result.research[0]).toMatchObject({ key: 'excavation_1' }); expect(firstReturnReportAction(result)).toEqual({ kind: 'haul', id: 'haul-a' });
    expect(result).not.toHaveProperty('cash'); expect(result).not.toHaveProperty('profit');
  });
  it('does not complete active work because a date or a local clock has advanced', () => {
    const data = readySnapshot(); data.server_now = '2027-01-01T12:00:00Z'; data.expeditions[0].status = 'active'; data.production_jobs![0].status = 'active';
    data.business!.research[0].status = 'active'; data.business!.research[0].completed_at = null; data.discoveries = [];
    expect(observeReturnReport(baseline(), data, scope).report).toBeNull();
  });
  it('keeps a report available until acknowledged and suppresses repeated reads after acknowledgement', () => {
    const first = baseline(), data = readySnapshot();
    expect(observeReturnReport(first, data, scope).report).toEqual(observeReturnReport(first, data, scope).report);
    const acknowledged = acknowledgeReturnReport(first, data, scope)!;
    expect(observeReturnReport(acknowledged, data, scope).report).toBeNull();
    const key = returnReportKey(scope); saveReturnReport(key, acknowledged);
    expect(observeReturnReport(readReturnReport(key), data, scope).report).toBeNull();
  });
  it('does not include resolved finds, collected jobs or historical research as new work', () => {
    const data = readySnapshot(); data.expeditions[0].status = 'collected'; data.production_jobs![0].status = 'collected'; data.discoveries![0].status = 'kept';
    data.business!.research[0].completed_at = '2026-10-01T12:00:00Z';
    expect(observeReturnReport(baseline(), data, scope).report).toBeNull();
  });
  it('rejects incomplete or future-dated research evidence while keeping other real results', () => {
    const data = readySnapshot(); data.business!.research[0].completed_at = null;
    expect(observeReturnReport(baseline(), data, scope).report!.research).toEqual([]);
    data.business!.research[0].completed_at = '2026-11-02T12:00:00Z';
    expect(observeReturnReport(baseline(), data, scope).report!.research).toEqual([]);
  });
  it('does not turn a changed company balance into away income', () => {
    const data = phaseFourSnapshot(); data.company!.cash = 40000; data.resources = { gold_bar: 10 }; data.server_now = end;
    expect(observeReturnReport(baseline(), data, scope).report).toBeNull();
  });
  it('uses only the actual staged remainder after a partial collection', () => {
    const data = readySnapshot(); data.expeditions[0].cargo = { coal: 3 }; data.production_jobs![0].outputs = {};
    const value = observeReturnReport(baseline(), data, scope).report!;
    expect(value.hauls[0].resources).toEqual({ coal: 3 }); expect(value.production[0].resources).toEqual({});
    const acknowledged = acknowledgeReturnReport(null, data, scope)!; data.expeditions[0].cargo = { coal: 1 };
    expect(observeReturnReport(acknowledged, data, scope).report).toBeNull();
    expect(currentReturnReport(data, scope)!.hauls[0].resources).toEqual({ coal: 1 });
  });
  it('supports a manual current-work overview without replaying historical research', () => {
    const data = readySnapshot(), value = currentReturnReport(data, scope)!;
    expect(value.hauls).toHaveLength(1); expect(value.production).toHaveLength(1); expect(value.finds).toHaveLength(1); expect(value.research).toEqual([]);
    data.expeditions = []; data.production_jobs = []; data.discoveries = []; expect(currentReturnReport(data, scope)).toBeNull();
  });
  it.each(['userId', 'clubId', 'companyId'] as const)('refuses a foreign %s snapshot and a foreign receipt', key => {
    const foreign = { ...scope, [key]: 'foreign' }, data = readySnapshot();
    expect(observeReturnReport(baseline(), data, foreign)).toEqual({ receipt: null, report: null }); expect(acknowledgeReturnReport(baseline(), data, foreign)).toBeNull(); expect(currentReturnReport(data, foreign)).toBeNull();
    const receipt = { ...baseline(), scope: foreign }; const result = observeReturnReport(receipt, data, scope);
    expect(result.report).toBeNull(); expect(result.receipt!.scope).toEqual(scope);
  });
  it('bounds receipt history, retains current ready IDs, and stores no cargo or company balances', () => {
    const previous = baseline(); previous.seen.hauls = Array.from({ length: 128 }, (_, i) => `old-${i}`);
    const receipt = acknowledgeReturnReport(previous, readySnapshot(), scope)!; expect(receipt.seen.hauls).toHaveLength(128); expect(receipt.seen.hauls).toContain('haul-a');
    const key = returnReportKey(scope); saveReturnReport(key, receipt); const raw = localStorage.getItem(key)!;
    expect(raw).not.toContain('resources'); expect(raw).not.toContain('cash'); expect(raw).not.toContain('sale_value');
  });
  it('fails closed on corrupt, oversized and wrong-scope device receipts', () => {
    const key = returnReportKey(scope);
    for (const value of ['{broken', JSON.stringify({ ...baseline(), version: 2 }), JSON.stringify({ ...baseline(), baselineAt: 2026 }), JSON.stringify({ ...baseline(), seen: { ...baseline().seen, finds: Array.from({ length: 129 }, () => 'a') } }), JSON.stringify({ ...baseline(), scope: { ...scope, clubId: 'other' } })]) {
      localStorage.setItem(key, value); expect(readReturnReport(key)).toBeNull();
    }
    saveReturnReport('other-key', baseline()); expect(localStorage.getItem('other-key')).toBeNull();
  });
  it('continues in memory when storage is blocked and does not mutate source snapshots', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); }); vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(readReturnReport(returnReportKey(scope))).toBeNull(); expect(() => saveReturnReport(returnReportKey(scope), baseline())).not.toThrow();
    const data = readySnapshot(), original = structuredClone(data), value = observeReturnReport(baseline(), data, scope).report!;
    value.hauls[0].resources.coal = 99; value.production[0].equipmentOutputs.push('test'); expect(data).toEqual(original);
  });
});

describe('return ledger presentation', () => {
  it('uses four bounded factual sections and only routes reviews without collecting anything', () => {
    const data = observeReturnReport(baseline(), readySnapshot(), scope).report!, onAction = vi.fn(), onClose = vi.fn();
    render(<DeepClaimReturnReport report={data} onAction={onAction} onClose={onClose} />);
    const dialog = screen.getByRole('dialog', { name: 'Shift report' }); expect(dialog.querySelectorAll('[data-dc-return-kind]')).toHaveLength(4);
    expect(dialog).toHaveTextContent('12units awaiting storage'); expect(within(dialog).getByLabelText('10 Coal')).toBeInTheDocument();
    expect(dialog).not.toHaveTextContent(/profit|offline income|earned/i); expect(onAction).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Review cargo' })); expect(onAction).toHaveBeenLastCalledWith({ kind: 'haul', id: 'haul-a' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Open workshop' })); expect(onAction).toHaveBeenLastCalledWith({ kind: 'production', station: 'smeltery' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Inspect finds' })); expect(onAction).toHaveBeenLastCalledWith({ kind: 'finds' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Review research' })); expect(onAction).toHaveBeenLastCalledWith({ kind: 'research', key: 'excavation_1' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Back to camp' })); expect(onClose).toHaveBeenCalledOnce();
  });
  it('prioritizes the real collection route and preserves counts larger than one displayed specimen', () => {
    const data = readySnapshot(); data.discoveries!.push(find({ id: 'find-b', name: 'Second Geode' }));
    const onAction = vi.fn(); render(<DeepClaimReturnReport report={observeReturnReport(baseline(), data, scope).report!} onAction={onAction} onClose={vi.fn()} />);
    expect(screen.getByRole('region', { name: 'Pending finds' })).toHaveTextContent('2 pending');
    fireEvent.click(screen.getByRole('button', { name: 'Review returns' })); expect(onAction).toHaveBeenCalledWith({ kind: 'haul', id: 'haul-a' });
  });
  it('shows actually finished equipment without inventing owned equipment or an award', () => {
    const data = phaseFourSnapshot(); data.server_now = end; data.production_jobs = [production({ station: 'tool_station', outputs: {}, equipment_outputs: ['copper_pickaxe'] })];
    const onAction = vi.fn(); render(<DeepClaimReturnReport report={observeReturnReport(baseline(), data, scope).report!} onAction={onAction} onClose={vi.fn()} />);
    expect(screen.getByRole('region', { name: 'Ready production' })).toHaveTextContent('1 equipment'); expect(screen.getByText('Awaiting collection')).toBeInTheDocument(); expect(onAction).not.toHaveBeenCalled();
  });
});
