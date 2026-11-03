import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeepClaimWorkforce, type DeepClaimWorkforceActions } from '@/components/deepClaim/DeepClaimWorkforce';
import type { ClaimWorkerInspectRequest } from '@/components/deepClaim/DeepClaimPanels';
import type { DeepClaimCandidate, DeepClaimEquipment, DeepClaimSnapshot } from '@/lib/deepClaim/types';
import { phaseTwoSnapshot } from './fixtures/deepClaimPhase2';

const confirmed = vi.fn();
const actions: DeepClaimWorkforceActions = { hire: vi.fn(), train: vi.fn(), assignEquipment: vi.fn(), repairEquipment: vi.fn(), retireEquipment: vi.fn() };
function workforce(snapshot: DeepClaimSnapshot, extra: { busy?: boolean; readOnly?: boolean; inspectRequest?: ClaimWorkerInspectRequest } = {}) {
  return <DeepClaimWorkforce snapshot={snapshot} actions={actions} busy={false} readOnly={false} onConfirmed={confirmed} onQuarters={vi.fn()} {...extra} />;
}
function openWorker(view: 'Training' | 'Gear') {
  fireEvent.click(screen.getAllByRole('button', { name: 'Crew file' })[0]);
  fireEvent.click(screen.getByRole('button', { name: view }));
}
function gear(data: DeepClaimSnapshot, changes: Partial<DeepClaimEquipment> = {}): DeepClaimEquipment {
  return { id: 'pick-1', definition_key: data.equipment_catalog![0].key, worker_id: null, durability: 40, max_durability: 100, repair_cost: 11, repair_materials: { stone: 2 }, ...changes };
}
function applicant(data: DeepClaimSnapshot): DeepClaimCandidate {
  return { id: 'applicant-1', name: 'Iris Slate', specialty: 'engineer', traits: [], stats: { ...data.workers[0].stats }, wage: 4, hire_cost: 90, operating_day: data.company!.energy_day, hired: false };
}
beforeEach(() => {
  vi.clearAllMocks();
  for (const action of Object.values(actions)) vi.mocked(action).mockResolvedValue(phaseTwoSnapshot(3));
});
afterEach(cleanup);

describe('Deep Claim workforce refresh and request safety', () => {
  it.each(['housing', 'credits', 'read-only'] as const)('keeps applicant details inspectable when hiring is blocked by %s', blockedBy => {
    const data = phaseTwoSnapshot(); data.company!.worker_capacity = blockedBy === 'housing' ? 3 : 6;
    data.company!.cash = blockedBy === 'credits' ? 5 : 180;
    data.candidates = [{ ...applicant(data), traits: ['ore_eye'] }];
    const saved = JSON.stringify(data);
    render(workforce(data, { readOnly: blockedBy === 'read-only' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hire' }));
    expect(screen.getByRole('button', { name: 'Hire Iris Slate' })).toBeDisabled();
    const details = screen.getByRole('button', { name: 'View applicant Iris Slate' }); expect(details).toBeEnabled();
    fireEvent.click(details);
    const dialog = screen.getByRole('dialog', { name: 'Hire Iris Slate' });
    expect(dialog).toHaveTextContent('Reveals one additional cell while exploring.');
    expect(within(dialog).getByRole('button', { name: 'Confirm hire' })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm hire' }));
    expect(actions.hire).not.toHaveBeenCalled(); expect(JSON.stringify(data)).toBe(saved);
  });

  it('opens repair requirements without funds and rechecks the paid action after resources arrive', async () => {
    const data = phaseTwoSnapshot(); data.company!.cash = 5; data.resources = { stone: 1 }; data.equipment = [gear(data)];
    const view = render(workforce(data)); openWorker('Gear');
    const repair = screen.getByRole('button', { name: 'Repair Copper Pickaxe' }); expect(repair).toBeEnabled(); fireEvent.click(repair);
    const dialog = screen.getByRole('dialog', { name: 'Repair Copper Pickaxe' });
    expect(dialog).toHaveTextContent('Missing: 1 Stone.'); expect(dialog).toHaveTextContent('Need 8 more credits · 2 cr reserve.');
    expect(within(dialog).getByRole('button', { name: 'Confirm repair' })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm repair' })); expect(actions.repairEquipment).not.toHaveBeenCalled();
    const replenished = structuredClone(data); replenished.revision++; replenished.company!.cash = 13; replenished.resources = { stone: 2 };
    view.rerender(workforce(replenished));
    expect(within(dialog).getByRole('button', { name: 'Confirm repair' })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Review current details' }));
    expect(within(dialog).getByRole('button', { name: 'Confirm repair' })).toBeEnabled();
    expect(dialog).not.toHaveTextContent('Missing:');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm repair' }));
    await waitFor(() => expect(actions.repairEquipment).toHaveBeenCalledExactlyOnceWith('pick-1'));
  });

  it('explains the exact training credit shortfall without enabling a paid course', () => {
    const data = phaseTwoSnapshot(); data.company!.cash = 10;
    render(workforce(data)); openWorker('Training');
    expect(screen.getByRole('dialog', { name: 'Worker a' })).toHaveTextContent('Need 22 more credits · 2 cr reserve.');
    expect(screen.getByRole('button', { name: 'Review training' })).toBeDisabled();
    expect(actions.train).not.toHaveBeenCalled();
  });

  it('requires a fresh review after a training fee changes and confirms the selected course only once', async () => {
    const data = phaseTwoSnapshot();
    const view = render(workforce(data)); openWorker('Training');
    fireEvent.click(within(screen.getByRole('group', { name: 'Training skill' })).getByRole('button', { name: 'Geology' }));
    fireEvent.click(screen.getByRole('button', { name: 'Review training' }));
    const updated = structuredClone(data); updated.revision++; updated.workers[0].training_cost = 55;
    view.rerender(workforce(updated));
    const dialog = screen.getByRole('dialog', { name: 'Train Worker a' });
    expect(dialog).toHaveTextContent('55 cr');
    expect(within(dialog).getByRole('button', { name: 'Confirm training' })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm training' })); expect(actions.train).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Review current details' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm training' }));
    await waitFor(() => expect(actions.train).toHaveBeenCalledExactlyOnceWith('worker-a', 'geology'));
  });

  it('rechecks same-day training eligibility and active assignments after a refresh', () => {
    const data = phaseTwoSnapshot(); const view = render(workforce(data)); openWorker('Training');
    fireEvent.click(screen.getByRole('button', { name: 'Review training' }));
    const updated = structuredClone(data); updated.revision++; updated.workers[0].trained_day = updated.company!.energy_day; updated.workers[0].assigned_job_id = 'shift-a';
    view.rerender(workforce(updated));
    fireEvent.click(screen.getByRole('button', { name: 'Review current details' }));
    expect(screen.getByRole('button', { name: 'Confirm training' })).toBeDisabled();
    expect(screen.getByRole('dialog', { name: 'Train Worker a' })).toHaveTextContent('On shift. Available on return.');
    expect(actions.train).not.toHaveBeenCalled();
  });

  it('cannot equip a spare item that another worker received while confirmation was open', () => {
    const data = phaseTwoSnapshot(); data.equipment = [gear(data)]; const view = render(workforce(data)); openWorker('Gear');
    fireEvent.click(screen.getByRole('button', { name: 'Equip Copper Pickaxe' }));
    const updated = structuredClone(data); updated.revision++; updated.equipment![0].worker_id = 'worker-b';
    view.rerender(workforce(updated)); fireEvent.click(screen.getByRole('button', { name: 'Review current details' }));
    expect(screen.getByRole('button', { name: 'Confirm equipment' })).toBeDisabled();
    expect(screen.getByRole('dialog', { name: 'Confirm equipment' })).toHaveTextContent('Assigned to another worker.');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm equipment' })); expect(actions.assignEquipment).not.toHaveBeenCalled();
  });

  it('does not repair or retire equipment that disappeared while its details were open', () => {
    const data = phaseTwoSnapshot(); data.equipment = [gear(data)]; const view = render(workforce(data)); openWorker('Gear');
    fireEvent.click(screen.getByRole('button', { name: 'Repair Copper Pickaxe' }));
    const updated = structuredClone(data); updated.revision++; updated.equipment = [];
    view.rerender(workforce(updated)); fireEvent.click(screen.getByRole('button', { name: 'Review current details' }));
    expect(screen.getByRole('dialog', { name: 'Repair equipment' })).toHaveTextContent('This equipment is no longer available.');
    expect(screen.getByRole('button', { name: 'Confirm repair' })).toBeDisabled();
    expect(actions.repairEquipment).not.toHaveBeenCalled(); expect(actions.retireEquipment).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('dialog', { name: 'Worker a' })).toBeInTheDocument();
  });

  it('rechecks hiring fee, housing and applicant availability after a refresh', () => {
    const data = phaseTwoSnapshot(); data.company!.worker_capacity = 6; data.candidates = [applicant(data)];
    const view = render(workforce(data)); fireEvent.click(screen.getByRole('button', { name: 'Hire' })); fireEvent.click(screen.getByRole('button', { name: 'Hire Iris Slate' }));
    const updated = structuredClone(data); updated.revision++; updated.company!.worker_capacity = 3; updated.candidates![0].hire_cost = 110;
    view.rerender(workforce(updated)); const dialog = screen.getByRole('dialog', { name: 'Hire Iris Slate' });
    expect(dialog).toHaveTextContent('110 cr'); expect(within(dialog).getByRole('button', { name: 'Confirm hire' })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Review current details' }));
    expect(within(dialog).getByRole('button', { name: 'Confirm hire' })).toBeDisabled();
    updated.candidates = []; updated.revision++; view.rerender(workforce(updated));
    expect(screen.getByRole('dialog', { name: 'Applicant unavailable' })).toHaveTextContent('This applicant is no longer available.');
    expect(screen.queryByRole('button', { name: 'Confirm hire' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to applicants' })); expect(actions.hire).not.toHaveBeenCalled();
  });

  it('blocks duplicate training requests and modal exits until the pending request settles', async () => {
    let complete!: (snapshot: DeepClaimSnapshot) => void;
    vi.mocked(actions.train).mockReturnValue(new Promise(resolve => { complete = resolve; }));
    const data = phaseTwoSnapshot(); render(workforce(data)); openWorker('Training');
    fireEvent.click(screen.getByRole('button', { name: 'Review training' }));
    const submit = screen.getByRole('button', { name: 'Confirm training' }); fireEvent.click(submit); fireEvent.click(submit);
    expect(actions.train).toHaveBeenCalledTimes(1); expect(submit).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
    complete(phaseTwoSnapshot(3)); await waitFor(() => expect(confirmed).toHaveBeenCalledTimes(1));
  });

  it('keeps review-only modes from issuing a pending purchase', () => {
    const data = phaseTwoSnapshot(); const view = render(workforce(data)); openWorker('Training'); fireEvent.click(screen.getByRole('button', { name: 'Review training' }));
    view.rerender(workforce(data, { readOnly: true })); expect(screen.getByRole('button', { name: 'Confirm training' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm training' })); expect(actions.train).not.toHaveBeenCalled();
  });
});

describe('Deep Claim bounded crew and equipment navigation', () => {
  it('pages six spare items at a time, clamps a shrinking page, and retains source item IDs', async () => {
    const data = phaseTwoSnapshot(); data.equipment = Array.from({ length: 13 }, (_, index) => gear(data, { id: `pick-${index}` }));
    const view = render(workforce(data)); openWorker('Gear');
    expect(screen.getAllByRole('button', { name: 'Equip Copper Pickaxe' })).toHaveLength(6);
    fireEvent.click(screen.getByRole('button', { name: 'Next available equipment page' })); fireEvent.click(screen.getByRole('button', { name: 'Next available equipment page' }));
    expect(screen.getAllByRole('button', { name: 'Equip Copper Pickaxe' })).toHaveLength(1);
    expect(screen.getByRole('group', { name: 'Available equipment pages' })).toHaveTextContent('3 / 3');
    const shrunk = structuredClone(data); shrunk.revision++; shrunk.equipment = data.equipment.slice(0, 7); view.rerender(workforce(shrunk));
    expect(screen.getByRole('group', { name: 'Available equipment pages' })).toHaveTextContent('2 / 2');
    fireEvent.click(screen.getByRole('button', { name: 'Equip Copper Pickaxe' })); fireEvent.click(screen.getByRole('button', { name: 'Confirm equipment' }));
    await waitFor(() => expect(actions.assignEquipment).toHaveBeenCalledExactlyOnceWith('pick-6', 'worker-a'));
  });

  it('opens direct worker requests on their roster page and preserves keyboard skill inspection', () => {
    const data = phaseTwoSnapshot(); data.company!.worker_capacity = 12;
    data.workers = Array.from({ length: 12 }, (_, index) => ({ ...data.workers[0], id: `worker-${index}`, name: `Worker ${index}` }));
    const view = render(workforce(data)); expect(screen.getAllByRole('button', { name: 'Crew file' })).toHaveLength(6); expect(screen.queryByRole('heading', { name: 'Worker 10' })).not.toBeInTheDocument();
    view.rerender(workforce(data, { inspectRequest: { id: 'go-worker-10', workerId: 'worker-10', view: 'overview' } }));
    const dialog = screen.getByRole('dialog', { name: 'Worker 10' });
    const geology = within(dialog).getByRole('button', { name: 'Inspect Geology' }); fireEvent.keyDown(geology, { key: 'Enter' }); expect(geology).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Back to crew' }));
    expect(screen.getByRole('group', { name: 'Crew roster pages' })).toHaveTextContent('2 / 2'); expect(screen.getByRole('heading', { name: 'Worker 10' })).toBeInTheDocument();
    expect(actions.train).not.toHaveBeenCalled();
  });
});
