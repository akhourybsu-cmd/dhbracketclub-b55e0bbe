import type { ComponentProps } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeepClaimIndustry } from '@/components/deepClaim/DeepClaimIndustry';
import type { DeepClaimProductionJob, DeepClaimSnapshot } from '@/lib/deepClaim/types';
import { phaseTwoSnapshot } from './fixtures/deepClaimPhase2';

afterEach(cleanup);

function stock() {
  const snapshot = phaseTwoSnapshot();
  snapshot.company!.cash = 1000; snapshot.resources = { copper_ore: 100, coal: 100 };
  snapshot.buildings = snapshot.buildings.map(building => building.key === 'smeltery' ? { ...building, level: 1 } : building);
  return snapshot;
}
function industry(snapshot: DeepClaimSnapshot, overrides: Partial<ComponentProps<typeof DeepClaimIndustry>> = {}) {
  return <DeepClaimIndustry snapshot={snapshot} view="workshop" onView={vi.fn()} station="smeltery" onStation={vi.fn()} busy={false} readOnly={false}
    now={Date.parse(snapshot.server_now)} onRefresh={vi.fn()} onBuild={vi.fn()} onSell={vi.fn()} onOpenHaul={vi.fn()}
    startProduction={vi.fn().mockResolvedValue(snapshot)} collectProduction={vi.fn().mockResolvedValue(undefined)} onConfirmed={vi.fn()} {...overrides} />;
}
function order(id: string, status: 'ready' | 'active'): DeepClaimProductionJob {
  return { id, recipe_key: 'smelt_copper', recipe_version: 1, batches: 1, station: 'smeltery', status,
    started_at: '2026-11-01T11:00:00Z', completes_at: '2026-11-01T11:02:00Z', duration_seconds: 120,
    cash_cost: 5, inputs: { coal: 2, copper_ore: 10 }, outputs: { copper_bar: 2 }, equipment_outputs: [] };
}

describe('Deep Claim finished production discovery', () => {
  it('surfaces finished output before inventory and opens its actual station without attempting collection', () => {
    const snapshot = stock(), onStation = vi.fn(), onView = vi.fn(), collect = vi.fn();
    const recipe = snapshot.recipes!.find(item => item.equipment_output)!;
    snapshot.production_jobs = [{ ...order('finished-gear', 'ready'), recipe_key: recipe.key, station: recipe.station, outputs: {}, equipment_outputs: [recipe.equipment_output!] }];
    render(industry(snapshot, { view: 'stock', onStation, onView, collectProduction: collect }));
    const ready = screen.getByRole('region', { name: 'Finished production' }), inventory = screen.getByRole('region', { name: 'Warehouse inventory' });
    expect(ready.compareDocumentPosition(inventory) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('button', { name: /Workshop/ })).toHaveTextContent('1 ready');
    fireEvent.click(within(ready).getByRole('button', { name: `Open finished ${recipe.name}` }));
    expect(onStation).toHaveBeenCalledExactlyOnceWith(recipe.station);
    expect(onView).toHaveBeenCalledExactlyOnceWith('workshop');
    expect(collect).not.toHaveBeenCalled();
  });

  it('puts server-ready work first but never offers elapsed active work as collectable output', () => {
    const snapshot = stock(), active = order('active', 'active'), ready = { ...order('finished', 'ready'), recipe_key: 'polish_quartz', station: 'gem_workshop' as const, outputs: { polished_quartz: 2 } };
    snapshot.production_jobs = [active, ready];
    const before = structuredClone(snapshot.production_jobs);
    const view = render(industry(snapshot));
    const queue = screen.getByRole('region', { name: 'Production queue' }), orders = within(queue).getAllByRole('article');
    expect(within(orders[0]).getByRole('button', { name: 'Collect Polish Quartz' })).toBeEnabled();
    expect(within(orders[1]).getByRole('button', { name: 'Check production' })).toBeInTheDocument();
    expect(within(orders[1]).queryByRole('button', { name: /Collect/ })).not.toBeInTheDocument();
    expect(snapshot.production_jobs).toEqual(before);
    view.rerender(industry({ ...snapshot, production_jobs: [active] }, { view: 'stock' }));
    expect(screen.queryByRole('region', { name: 'Finished production' })).not.toBeInTheDocument();
  });
});

describe('Deep Claim touch batch controls', () => {
  it('adjusts the actual reviewed quantity and respects the recipe maximum and minimum', () => {
    const snapshot = stock(); render(industry(snapshot));
    fireEvent.click(screen.getByRole('button', { name: 'Review Smelt Copper' }));
    const dialog = screen.getByRole('dialog', { name: 'Smelt Copper' });
    const input = within(dialog).getByRole('spinbutton', { name: 'Production batches' });
    const less = within(dialog).getByRole('button', { name: 'Decrease production batches' }), more = within(dialog).getByRole('button', { name: 'Increase production batches' });
    expect(less).toBeDisabled(); fireEvent.click(more); expect(input).toHaveValue(2);
    fireEvent.click(less); expect(input).toHaveValue(1);
    fireEvent.change(input, { target: { value: '10' } }); expect(more).toBeDisabled();
    fireEvent.click(less); expect(input).toHaveValue(9); expect(more).toBeEnabled();
  });

  it('recovers an invalid manual quantity through a step control without submitting anything', () => {
    const snapshot = stock(), start = vi.fn(); render(industry(snapshot, { startProduction: start }));
    fireEvent.click(screen.getByRole('button', { name: 'Review Smelt Copper' }));
    const input = screen.getByRole('spinbutton', { name: 'Production batches' });
    fireEvent.change(input, { target: { value: '' } }); expect(screen.getByRole('button', { name: 'Review batch' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Increase production batches' }));
    expect(input).toHaveValue(1); expect(screen.getByRole('button', { name: 'Review batch' })).toBeEnabled(); expect(start).not.toHaveBeenCalled();
  });

  it('locks both touch controls during review and submits only the confirmed quantity', async () => {
    const snapshot = stock(), start = vi.fn().mockResolvedValue(snapshot); render(industry(snapshot, { startProduction: start }));
    fireEvent.click(screen.getByRole('button', { name: 'Review Smelt Copper' }));
    fireEvent.click(screen.getByRole('button', { name: 'Increase production batches' }));
    fireEvent.click(screen.getByRole('button', { name: 'Review batch' }));
    expect(screen.getByRole('button', { name: 'Increase production batches' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Decrease production batches' })).toBeDisabled();
    expect(screen.getByRole('spinbutton', { name: 'Production batches' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Start production' }));
    expect(start).toHaveBeenCalledExactlyOnceWith('smelt_copper', 2);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('keeps quantity editing locked after a stale review until the player returns to editing', () => {
    const snapshot = stock(), view = render(industry(snapshot));
    fireEvent.click(screen.getByRole('button', { name: 'Review Smelt Copper' }));
    fireEvent.click(screen.getByRole('button', { name: 'Review batch' }));
    view.rerender(industry({ ...snapshot, revision: snapshot.revision + 1 }));
    expect(screen.getByRole('button', { name: 'Increase production batches' })).toBeDisabled();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('button', { name: 'Increase production batches' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Increase production batches' }));
    expect(screen.getByRole('spinbutton', { name: 'Production batches' })).toHaveValue(2);
  });
});
