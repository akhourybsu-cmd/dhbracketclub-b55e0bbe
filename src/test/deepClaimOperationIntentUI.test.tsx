import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeepClaimOperationPicker } from '@/components/deepClaim/DeepClaimOperationPicker';
import { DeepClaimDispatch } from '@/components/deepClaim/DeepClaimDispatch';
import { DeepClaimOperations } from '@/components/deepClaim/DeepClaimField';
import { DeepClaimWorksitePicker } from '@/components/deepClaim/DeepClaimWorksitePicker';
import * as publicAdvice from '@/lib/deepClaim/operationAdvice';
import type { DeepClaimMode, DeepClaimPreview, DeepClaimSnapshot } from '@/lib/deepClaim/types';
import { phaseThreeSnapshot } from './fixtures/deepClaimPhase3';

const MODES = [
  ['explore', 'Expand tunnels', 'Choose a tunnel frontier'],
  ['extract', 'Mine a deposit', 'Choose a deposit'],
  ['survey', 'Scout the area', 'Scout from'],
  ['infrastructure', 'Improve the mine', 'Build at'],
] as const;
const quote = (overrides: Partial<DeepClaimPreview> = {}): DeepClaimPreview => ({
  allowed: true, reasons: [], company_revision: 3, server_now: '2026-11-01T12:00:00Z', wages: 6,
  energy_per_worker: 1, duration_seconds: 1200, estimated_yield: { min: 0, max: 0 }, cargo_capacity: 40,
  risk_level: 'low', accessible_depth: 49, expected_resources: [], route: [{ x: 48, y: 1 }],
  projected_completion_at: '2026-11-01T12:20:00Z', stages: [{ key: 'travel', duration_seconds: 40 }, { key: 'work', duration_seconds: 1120 }, { key: 'return', duration_seconds: 40 }],
  operation_version: 3, operation_cost: 0, materials_cost: {},
  conditions: { instability: 1, gas: 0, water: 0, incident_chance_percent: 0, max_delay_seconds: 0, transport_bonus_percent: 0, infrastructure_ids: [] },
  survey: null, installation: null, ...overrides,
});
function plan({ mode = 'survey', initialTarget = null, data = phaseThreeSnapshot(), preview = vi.fn().mockResolvedValue(quote()), dispatch = vi.fn().mockResolvedValue(data), busy = false, readOnly = false }: {
  mode?: DeepClaimMode; initialTarget?: { x: number; y: number } | null; data?: DeepClaimSnapshot; preview?: ReturnType<typeof vi.fn>; dispatch?: ReturnType<typeof vi.fn>; busy?: boolean; readOnly?: boolean;
} = {}) {
  render(<DeepClaimDispatch snapshot={data} initialMode={mode} initialTarget={initialTarget} onClose={vi.fn()} busy={busy} readOnly={readOnly} preview={preview} dispatch={dispatch} />);
  return { preview, dispatch };
}
const advice = () => screen.getByRole('dialog').querySelector<HTMLElement>('[data-dc-operation-advice]')!;
const selectedSite = () => within(screen.getByRole('group', { name: 'Expedition worksite' })).getByRole('button', { pressed: true });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Deep Claim operation intent', () => {
  it('groups mining and optional planning clearly while retaining canonical mode callbacks', () => {
    const choose = vi.fn(); render(<DeepClaimOperationPicker value="extract" onChange={choose} />);
    const picker = screen.getByRole('group', { name: 'Expedition type' });
    expect(within(picker).getByRole('group', { name: 'Mining' })).toContainElement(screen.getByRole('button', { name: 'Mine a deposit' }));
    const support = within(picker).getByRole('group', { name: 'Planning & improvements' });
    expect(within(support).getAllByRole('button')).toHaveLength(2); expect(support).toHaveTextContent('Optional');
    for (const [mode, label] of MODES) {
      const button = within(picker).getByRole('button', { name: label });
      expect(button).toHaveAttribute('data-dc-operation', mode); fireEvent.click(button);
    }
    expect(choose.mock.calls).toEqual([['explore'], ['survey'], ['infrastructure']]);
    expect(screen.getByRole('button', { name: 'Mine a deposit' })).toHaveAttribute('aria-pressed', 'true');
    expect(picker.querySelectorAll('svg[data-dc-operation-art]')).toHaveLength(4);
  });
  it('hides unavailable support operations and prevents changing a frozen selection', () => {
    const choose = vi.fn(); const view = render(<DeepClaimOperationPicker value="explore" onChange={choose} disabled includeSupport={false} />);
    const picker = screen.getByRole('group', { name: 'Expedition type' });
    expect(within(picker).queryByRole('group', { name: 'Planning & improvements' })).not.toBeInTheDocument();
    for (const button of within(picker).getAllByRole('button')) { expect(button).toBeDisabled(); fireEvent.click(button); }
    expect(choose).not.toHaveBeenCalled();
    view.rerender(<DeepClaimOperationPicker value="explore" onChange={choose} includeSupport={false} />);
    fireEvent.click(within(picker).getByRole('button', { name: 'Mine a deposit' })); expect(choose).toHaveBeenCalledExactlyOnceWith('extract');
  });
  it('routes the field operations picker through the same canonical modes and actual selected passage', () => {
    const dispatch = vi.fn(), point = { x: 48, y: 1 };
    render(<DeepClaimOperations snapshot={phaseThreeSnapshot()} point={point} onClose={vi.fn()} onDispatch={dispatch} onLocate={vi.fn()} onFinds={vi.fn()} onReports={vi.fn()} />);
    const picker = screen.getByRole('group', { name: 'Expedition type' });
    for (const [, label] of MODES) fireEvent.click(within(picker).getByRole('button', { name: label }));
    expect(dispatch.mock.calls).toEqual(MODES.map(([mode]) => [mode, point]));
  });
  it.each(MODES)('gives %s a distinct worksite instruction', (mode, title, heading) => {
    plan({ mode }); expect(screen.getByRole('dialog', { name: title })).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Expedition worksite' })).getByRole('heading', { name: heading })).toBeInTheDocument();
  });
  it.each([{ busy: true }, { readOnly: true }])('freezes every operation choice when writes are unavailable: %j', restriction => {
    plan(restriction);
    for (const button of within(screen.getByRole('group', { name: 'Expedition type' })).getAllByRole('button')) expect(button).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Review dispatch' })).toBeDisabled();
  });
});

describe('Deep Claim preparation explains actual outcomes', () => {
  it('updates public survey reach when the duration changes without creating a quote or revealing terrain', () => {
    const data = phaseThreeSnapshot(), original = JSON.stringify(data), { preview, dispatch } = plan({ data });
    expect(selectedSite()).toHaveAccessibleName(/Scout from here.*8 unseen tiles/); expect(advice()).toHaveTextContent('Up to 8 new tiles');
    fireEvent.click(within(screen.getByRole('group', { name: 'Shift duration' })).getByRole('button', { name: /^Wide/ }));
    expect(selectedSite()).toHaveAccessibleName(/15 unseen tiles/); expect(advice()).toHaveTextContent('Up to 15 new tiles');
    expect(JSON.stringify(data)).toBe(original); expect(preview).not.toHaveBeenCalled(); expect(dispatch).not.toHaveBeenCalled();
  });
  it('recomputes survey reach for the selected crew and removes the estimate when no crew remains', () => {
    const data = phaseThreeSnapshot(); data.workers.forEach((worker, index) => { worker.stats.geology = index === 0 ? 100 : 1; });
    plan({ data }); expect(selectedSite()).toHaveAccessibleName(/3 unseen tiles/);
    fireEvent.click(screen.getByRole('button', { name: 'Change crew' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Send Worker b' })); fireEvent.click(screen.getByRole('checkbox', { name: 'Send Worker c' }));
    expect(selectedSite()).toHaveAccessibleName(/15 unseen tiles/);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Send Worker a' }));
    expect(selectedSite()).not.toHaveAccessibleName(/unseen tiles/); expect(advice()).toHaveTextContent('Choose a crew to see its reach');
    expect(screen.getByRole('button', { name: 'Review dispatch' })).toBeDisabled();
  });
  it('shows survey feedback as an accessible status and never promises cargo or a project fee', async () => {
    plan({ preview: vi.fn().mockResolvedValue(quote({ survey: { radius: 2, tile_limit: 13 } })) });
    expect(advice()).toHaveAttribute('role', 'status'); expect(advice()).toHaveTextContent(/no cargo/i);
    fireEvent.click(screen.getByRole('button', { name: 'Review dispatch' })); await screen.findByRole('button', { name: 'Dispatch crew' });
    const estimate = screen.getByRole('region', { name: 'Verified dispatch estimate' });
    expect(estimate).toHaveTextContent('Survey radius'); expect(estimate).not.toHaveTextContent('Estimated haul'); expect(estimate).not.toHaveTextContent('Cargo capacity'); expect(estimate).not.toHaveTextContent('Project fee now');
  });
  it('warns about a shallow pump but honors the authoritative allowed quote and canonical dispatch', async () => {
    const preview = vi.fn().mockResolvedValue(quote({ operation_cost: 23, materials_cost: { stone: 4 }, installation: { key: 'pump', grade: 1, radius: 7, strength: 7 } }));
    const { dispatch } = plan({ mode: 'infrastructure', preview });
    fireEvent.click(within(screen.getByRole('group', { name: 'Infrastructure project' })).getByRole('button', { name: /Drainage Pump/ }));
    expect(advice()).toHaveAttribute('data-tone', 'caution'); expect(advice()).toHaveTextContent('No water risk here yet');
    expect(screen.getByRole('button', { name: 'Review dispatch' })).toBeEnabled(); fireEvent.click(screen.getByRole('button', { name: 'Review dispatch' }));
    const confirm = await screen.findByRole('button', { name: 'Dispatch crew' }); expect(confirm).toBeEnabled();
    const estimate = screen.getByRole('region', { name: 'Verified dispatch estimate' });
    expect(estimate).toHaveTextContent('Project fee now23 cr'); expect(estimate).not.toHaveTextContent('Estimated haul'); expect(estimate).not.toHaveTextContent('Cargo capacity');
    expect(screen.getByLabelText('Project materials consumed now')).toHaveTextContent('4Stone'); fireEvent.click(confirm);
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ mode: 'infrastructure', infrastructure_key: 'pump', target_x: 48, target_y: 1 }), 3));
    expect(preview).toHaveBeenCalledOnce();
  });
  it('never turns a useful preparation hint into permission when the server rejects the shift', async () => {
    const { dispatch } = plan({ mode: 'survey', preview: vi.fn().mockResolvedValue(quote({ allowed: false, reasons: ['Operating reserve is required.'], survey: { radius: 2, tile_limit: 13 } })) });
    fireEvent.click(screen.getByRole('button', { name: 'Review dispatch' }));
    expect(await screen.findByText('Operating reserve is required.')).toBeInTheDocument();
    expect(advice()).toHaveAttribute('data-tone', 'useful'); expect(screen.queryByRole('button', { name: 'Dispatch crew' })).not.toBeInTheDocument(); expect(dispatch).not.toHaveBeenCalled();
  });
});


it('reuses visible and pinned survey counts on unrelated camp ticks but refreshes them for real planning inputs', () => {
  const calculate = vi.spyOn(publicAdvice, 'operationAdvice');
  const data = phaseThreeSnapshot();
  data.world!.tiles = Array.from({ length: 5 }, (_, index) => ({ x: 48, y: index + 1, terrain: 'excavated' as const, material: null, remaining: 0, initial_amount: 0 }));
  const sites = data.world!.tiles.map(({ x, y }) => ({ x, y })), selected = sites[4], onSelect = vi.fn();
  function Board({ snapshot, disabled = false, minutes = 20 }: { snapshot: DeepClaimSnapshot; disabled?: boolean; minutes?: 20 | 60 }) {
    return <DeepClaimWorksitePicker world={snapshot.world} sites={sites} selected={selected} mode="survey" disabled={disabled} onSelect={onSelect} surveyWorkers={snapshot.workers} minutes={minutes} />;
  }
  const view = render(<Board snapshot={data} />);
  const cards = screen.getByRole('group', { name: 'Expedition worksite' }).querySelectorAll('[data-dc-worksite]');
  expect(cards).toHaveLength(5); expect(calculate).toHaveBeenCalledTimes(5);
  const tick = { ...data, revision: data.revision + 1, company: { ...data.company!, cash: data.company!.cash + 100 } };
  view.rerender(<Board snapshot={tick} disabled />); expect(calculate).toHaveBeenCalledTimes(5);
  view.rerender(<Board snapshot={tick} />); expect(calculate).toHaveBeenCalledTimes(5);
  const mapped = { ...tick, world: { ...tick.world!, tiles: [...tick.world!.tiles, { x: 47, y: 2, terrain: 'excavated' as const, material: null, remaining: 0, initial_amount: 0 }] } };
  view.rerender(<Board snapshot={mapped} />); expect(calculate).toHaveBeenCalledTimes(10);
  view.rerender(<Board snapshot={mapped} minutes={60} />); expect(calculate).toHaveBeenCalledTimes(15);
  const crew = { ...mapped, workers: [{ ...mapped.workers[0], stats: { ...mapped.workers[0].stats, geology: 100 } }] };
  view.rerender(<Board snapshot={crew} minutes={60} />); expect(calculate).toHaveBeenCalledTimes(20);
  expect(calculate.mock.calls.at(-1)?.[0]).toMatchObject({ world: mapped.world, workers: crew.workers, minutes: 60 });
  expect(onSelect).not.toHaveBeenCalled();
});


function mappedSurveyEntrance() {
  const data = phaseThreeSnapshot();
  const cells = new Map<string, NonNullable<DeepClaimSnapshot['world']>['tiles'][number]>();
  // The entry's entire local footprint is known, but only the central shaft is
  // excavated. Revealed seams beside it are deposits rather than walkways.
  for (let x = 46; x <= 50; x++) for (let y = 1; y <= 3; y++) {
    if (Math.abs(x - 48) + Math.abs(y - 1) <= 2) cells.set(`${x}:${y}`, { x, y, terrain: 'stone', material: 'coal', remaining: 10, initial_amount: 10 });
  }
  for (let y = 1; y <= 10; y++) cells.set(`48:${y}`, { x: 48, y, terrain: 'excavated', material: null, remaining: 0, initial_amount: 0 });
  // A disconnected revealed cavity must not become a suggested worksite.
  cells.set('20:20', { x: 20, y: 20, terrain: 'excavated', material: null, remaining: 0, initial_amount: 0 });
  data.world!.tiles = [...cells.values()];
  return data;
}

it('starts an unselected scouting plan at the first useful connected site beyond a mapped entrance', () => {
  const data = mappedSurveyEntrance(), original = JSON.stringify(data);
  const { preview, dispatch } = plan({ data });
  expect(selectedSite()).toHaveAttribute('data-dc-worksite', '48:2');
  expect(selectedSite()).toHaveAccessibleName(/[1-9]\d* unseen tiles/);
  expect(advice()).toHaveAttribute('data-tone', 'useful'); expect(advice()).not.toHaveTextContent('Already surveyed');
  expect(screen.getByRole('group', { name: 'Expedition worksite' }).querySelector('[data-dc-worksite="20:20"]')).not.toBeInTheDocument();
  expect(JSON.stringify(data)).toBe(original); expect(preview).not.toHaveBeenCalled(); expect(dispatch).not.toHaveBeenCalled();
});

it('keeps an explicitly chosen mapped entrance and explains its empty scouting footprint', () => {
  const data = mappedSurveyEntrance(), original = JSON.stringify(data);
  const { preview, dispatch } = plan({ data, initialTarget: { x: 48, y: 1 } });
  expect(selectedSite()).toHaveAttribute('data-dc-worksite', '48:1'); expect(selectedSite()).toHaveAccessibleName(/Already mapped/);
  expect(advice()).toHaveAttribute('data-tone', 'caution'); expect(advice()).toHaveTextContent('Already surveyed');
  expect(screen.getByRole('button', { name: 'Review dispatch' })).toBeEnabled();
  expect(JSON.stringify(data)).toBe(original); expect(preview).not.toHaveBeenCalled(); expect(dispatch).not.toHaveBeenCalled();
});


it.each(['explore', 'extract'] as const)('chooses useful scouting ground when a %s worksite is incompatible with an open passage', mode => {
  const data = mappedSurveyEntrance(), original = JSON.stringify(data);
  const { preview, dispatch } = plan({ mode, data });
  expect(selectedSite()).not.toHaveAttribute('data-dc-worksite', '48:2');
  fireEvent.click(within(screen.getByRole('group', { name: 'Expedition type' })).getByRole('button', { name: 'Scout the area' }));
  expect(selectedSite()).toHaveAttribute('data-dc-worksite', '48:2'); expect(selectedSite()).toHaveAccessibleName(/[1-9]\d* unseen tiles/);
  expect(advice()).toHaveAttribute('data-tone', 'useful'); expect(advice()).not.toHaveTextContent('Already surveyed');
  expect(preview).not.toHaveBeenCalled(); expect(dispatch).not.toHaveBeenCalled(); expect(JSON.stringify(data)).toBe(original);
});

it('retains a legal chosen passage when switching from improvements to scouting', () => {
  plan({ mode: 'infrastructure', data: mappedSurveyEntrance(), initialTarget: { x: 48, y: 1 } });
  fireEvent.click(within(screen.getByRole('group', { name: 'Expedition type' })).getByRole('button', { name: 'Scout the area' }));
  expect(selectedSite()).toHaveAttribute('data-dc-worksite', '48:1'); expect(selectedSite()).toHaveAccessibleName(/Already mapped/);
  expect(advice()).toHaveTextContent('Already surveyed');
});
