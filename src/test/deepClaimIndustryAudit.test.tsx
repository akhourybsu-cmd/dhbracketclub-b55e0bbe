import type { ComponentProps } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeepClaimIndustry } from '@/components/deepClaim/DeepClaimIndustry';
import type { DeepClaimProductionJob, DeepClaimSnapshot } from '@/lib/deepClaim/types';
import { phaseTwoSnapshot } from './fixtures/deepClaimPhase2';

afterEach(cleanup);

function workshop(snapshot: DeepClaimSnapshot, overrides: Partial<ComponentProps<typeof DeepClaimIndustry>> = {}) {
  return <DeepClaimIndustry snapshot={snapshot} view="workshop" onView={vi.fn()} station="smeltery" onStation={vi.fn()} busy={false} readOnly={false}
    now={Date.parse(snapshot.server_now)} onRefresh={vi.fn()} onBuild={vi.fn()} onSell={vi.fn()} onOpenHaul={vi.fn()}
    startProduction={vi.fn()} collectProduction={vi.fn().mockResolvedValue(undefined)} onConfirmed={vi.fn()} {...overrides} />;
}

function readyOrder(overrides: Partial<DeepClaimProductionJob> = {}): DeepClaimProductionJob {
  return { id: 'ready-order', recipe_key: 'smelt_copper', recipe_version: 1, batches: 1, station: 'smeltery', status: 'ready',
    started_at: '2026-11-01T11:00:00Z', completes_at: '2026-11-01T11:02:00Z', duration_seconds: 120,
    cash_cost: 5, inputs: { coal: 2, copper_ore: 10 }, outputs: { copper_bar: 2 }, equipment_outputs: [], ...overrides };
}

function stockedWorkshop() {
  const snapshot = phaseTwoSnapshot();
  snapshot.buildings = snapshot.buildings.map(building => building.key === 'smeltery' ? { ...building, level: 1 } : building);
  snapshot.resources = { coal: 40, copper_ore: 40 };
  snapshot.company!.warehouse_used = 80;
  return snapshot;
}

describe('Deep Claim workshop audit regressions', () => {
  it.each(['0', '-1', '1.5', '10000000000000000', ''])('does not present invalid batch count %j as real input or output quantities', value => {
    const snapshot = stockedWorkshop(), start = vi.fn();
    render(workshop(snapshot, { startProduction: start }));
    fireEvent.click(screen.getByRole('button', { name: 'Review Smelt Copper' }));
    const dialog = screen.getByRole('dialog', { name: 'Smelt Copper' });
    fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'Production batches' }), { target: { value } });
    const inputs = within(dialog).getByRole('heading', { name: 'Inputs' }).closest('section')!;
    const output = within(dialog).getByRole('heading', { name: 'Output' }).closest('section')!;
    expect(within(inputs).getAllByText('—')).toHaveLength(2);
    expect(within(output).getAllByText('—')).toHaveLength(1);
    expect(within(dialog).getByRole('button', { name: 'Review batch' })).toBeDisabled();
    expect(within(dialog).queryByRole('button', { name: 'Start production' })).not.toBeInTheDocument();
    expect(start).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'Production batches' }), { target: { value: '2' } });
    expect(within(inputs).queryAllByText('—')).toHaveLength(0);
    expect(within(dialog).getByRole('button', { name: 'Review batch' })).toBeEnabled();
  });

  it('routes full-warehouse recovery to Stores without making a no-op collection, then permits a partial transfer', () => {
    const snapshot = phaseTwoSnapshot(), collect = vi.fn().mockResolvedValue(undefined), onView = vi.fn();
    snapshot.company!.warehouse_used = snapshot.company!.warehouse_capacity;
    snapshot.production_jobs = [readyOrder()];
    const view = render(workshop(snapshot, { collectProduction: collect, onView }));
    expect(screen.getByText('Warehouse full')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collect Smelt Copper' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Make room in Stores' }));
    expect(onView).toHaveBeenCalledWith('stock');
    expect(collect).not.toHaveBeenCalled();

    const freedSpace = { ...snapshot, company: { ...snapshot.company!, warehouse_used: snapshot.company!.warehouse_capacity - 1 }, revision: 3 };
    view.rerender(workshop(freedSpace, { collectProduction: collect, onView }));
    expect(screen.getByText('1 unit fits now · the rest stays staged')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Collect Smelt Copper' }));
    expect(collect).toHaveBeenCalledExactlyOnceWith(snapshot.production_jobs[0]);
    expect(snapshot.production_jobs[0].outputs).toEqual({ copper_bar: 2 });
  });

  it('keeps equipment collection available when material storage is full and describes only actual output', () => {
    const snapshot = phaseTwoSnapshot(), collect = vi.fn().mockResolvedValue(undefined);
    snapshot.company!.warehouse_used = snapshot.company!.warehouse_capacity;
    const recipe = snapshot.recipes!.find(item => item.equipment_output)!;
    snapshot.production_jobs = [readyOrder({ recipe_key: recipe.key, station: recipe.station, outputs: {}, equipment_outputs: [recipe.equipment_output!] })];
    render(workshop(snapshot, { collectProduction: collect }));
    expect(screen.getByText('1 equipment item staged')).toBeInTheDocument();
    expect(screen.queryByText(/0 material units/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Make room in Stores' })).not.toBeInTheDocument();
    const collectButton = screen.getByRole('button', { name: `Collect ${recipe.name}` });
    expect(collectButton).toBeEnabled();
    fireEvent.click(collectButton);
    expect(collect).toHaveBeenCalledExactlyOnceWith(snapshot.production_jobs[0]);
  });

  it('closes an unavailable selected recipe after refresh and requires a fresh review when it returns', () => {
    const snapshot = stockedWorkshop(), start = vi.fn();
    const view = render(workshop(snapshot, { startProduction: start }));
    fireEvent.click(screen.getByRole('button', { name: 'Review Smelt Copper' }));
    fireEvent.click(screen.getByRole('button', { name: 'Review batch' }));
    expect(screen.getByRole('button', { name: 'Start production' })).toBeEnabled();

    const removed = { ...snapshot, revision: 3, recipes: snapshot.recipes!.filter(recipe => recipe.key !== 'smelt_copper') };
    view.rerender(workshop(removed, { startProduction: start }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Recipe unavailable. Choose another recipe.');
    expect(start).not.toHaveBeenCalled();

    view.rerender(workshop({ ...snapshot, revision: 4 }, { startProduction: start }));
    fireEvent.click(screen.getByRole('button', { name: 'Review Smelt Copper' }));
    expect(screen.getByRole('spinbutton', { name: 'Production batches' })).toHaveValue(1);
    expect(screen.getByRole('button', { name: 'Review batch' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Start production' })).not.toBeInTheDocument();
  });

  it('requires another review when a saved company revision changes after the batch was reviewed', () => {
    const snapshot = stockedWorkshop(), start = vi.fn();
    const view = render(workshop(snapshot, { startProduction: start }));
    fireEvent.click(screen.getByRole('button', { name: 'Review Smelt Copper' }));
    fireEvent.click(screen.getByRole('button', { name: 'Review batch' }));
    view.rerender(workshop({ ...snapshot, revision: snapshot.revision + 1 }, { startProduction: start }));
    expect(screen.getByText('Your company changed. Review this batch again.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start production' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review batch' })).toBeEnabled();
    expect(start).not.toHaveBeenCalled();
  });

  it('closes a recipe cleanly when changing stations without reporting an unavailable recipe', () => {
    const snapshot = stockedWorkshop();
    const view = render(workshop(snapshot));
    fireEvent.click(screen.getByRole('button', { name: 'Review Smelt Copper' }));
    view.rerender(workshop(snapshot, { station: 'gem_workshop' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gem Workshop' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('explains that a full active queue must finish before a slot can be freed', () => {
    const snapshot = stockedWorkshop();
    snapshot.production_jobs = ['a', 'b', 'c'].map(id => readyOrder({ id, status: 'active' }));
    render(workshop(snapshot));
    fireEvent.click(screen.getByRole('button', { name: 'Review Smelt Copper' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('All 3 queue slots are in use. Collect an order when it finishes.');
    fireEvent.click(screen.getByRole('button', { name: 'Review batch' }));
    expect(screen.getByRole('button', { name: 'Start production' })).toBeDisabled();
  });
});
