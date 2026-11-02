import { useCallback, useState, type ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeepClaimTutorialDirector, type DeepClaimTrainingRequest } from '@/components/deepClaim/tutorial/DeepClaimTutorialDirector';
import {
  FIRST_SHIFT_GUIDE, firstShiftLesson, firstShiftResume, firstShiftStage,
  isFirstShiftGuideComplete, nextFirstShiftStage, resolveTutorialStep,
} from '@/lib/deepClaim/tutorial/firstShiftGuide';
import { getTutorialStep, TUTORIAL_LESSONS, TUTORIAL_STEP_IDS } from '@/lib/deepClaim/tutorial/chapters';
import { applyTutorialPatch, createTutorialProgress, isFirstDescentComplete } from '@/lib/deepClaim/tutorial/progress';
import type { TutorialEvent, TutorialProgress, TutorialProgressPatch, TutorialScope } from '@/lib/deepClaim/tutorial/types';
import type { DeepClaimAudio } from '@/lib/deepClaim/audio';
import type { DeepClaimExpedition, DeepClaimSnapshot } from '@/lib/deepClaim/types';
import { phaseFourSnapshot } from './fixtures/deepClaimPhase4';

const wire = vi.hoisted(() => ({ navigate: vi.fn(), update: vi.fn(), play: vi.fn(), modal: vi.fn(), continue: vi.fn(), retry: vi.fn() }));

// Isolate the director's transition contract. Actual spotlight placement, focus,
// instruction visibility and pointer-through behavior have their own UI suite.
vi.mock('@/components/deepClaim/tutorial/DeepClaimTutorialOverlay', () => ({
  DeepClaimTutorialOverlay: (props: {
    title: string; instruction: string; stepId?: string; stepLabel: string; children?: ReactNode;
    onNext?: () => void; onSkip: () => void; onExit: () => void; onKeepMaterials?: () => void;
  }) => <section aria-label="Guide contract" data-testid="guide" data-step-id={props.stepId}>
    <h2>{props.title}</h2><p>{props.instruction}</p><p>{props.stepLabel}</p>{props.children}
    {props.onNext && <button type="button" onClick={props.onNext}>Next tutorial step</button>}
    {props.onKeepMaterials && <button type="button" onClick={props.onKeepMaterials}>Keep materials</button>}
    <button type="button" onClick={props.onSkip}>Skip guided task</button>
    <button type="button" onClick={props.onExit}>Pause guide</button>
  </section>,
}));

const noEvents: readonly TutorialEvent[] = [];
const audio = { play: wire.play } as unknown as DeepClaimAudio;
const scopeFor = (snapshot: DeepClaimSnapshot): TutorialScope => ({
  user_id: snapshot.company!.user_id, club_id: snapshot.company!.club_id, company_id: snapshot.company!.id,
});
function notes(snapshot: DeepClaimSnapshot, stepId?: string, patch: TutorialProgressPatch = {}): TutorialProgress {
  const stage = firstShiftStage(stepId);
  return applyTutorialPatch(createTutorialProgress(scopeFor(snapshot), snapshot.server_now), {
    commentary_enabled: false,
    ...(stage ? { active_lesson_id: stage.lessonId, active_step_id: stage.stepId, campaign_status: 'active' as const } : {}),
    ...patch,
  });
}
function observation(snapshot: DeepClaimSnapshot, type: TutorialEvent['type'], detail?: TutorialEvent['detail'], revision?: number): TutorialEvent {
  return { ...scopeFor(snapshot), type, at: snapshot.server_now, ...(detail ? { detail } : {}), ...(revision === undefined ? {} : { snapshot_revision: revision }) };
}
function job(snapshot: DeepClaimSnapshot, status: DeepClaimExpedition['status'] = 'active'): DeepClaimExpedition {
  return {
    id: 'one-real-intro', mode: 'extract', status, worker_ids: snapshot.workers.map(worker => worker.id),
    target: { x: 47, y: 1 }, path: [{ x: 48, y: 0 }, { x: 47, y: 1 }], stages: [],
    stage: status === 'active' ? 'work' : status, started_at: snapshot.server_now,
    completes_at: '2026-11-01T12:00:30Z', duration_minutes: 20, duration_seconds: 30,
    tutorial: true, wages: 7, energy_per_worker: 1, config_version: 1,
    cargo: status === 'ready' ? { coal: 10 } : null,
  };
}
function Harness({ snapshot, initial, events = noEvents, request = null, receiptOpen = false }: {
  snapshot: DeepClaimSnapshot; initial: TutorialProgress; events?: readonly TutorialEvent[];
  request?: DeepClaimTrainingRequest | null; receiptOpen?: boolean;
}) {
  const [progress, setProgress] = useState(initial);
  const update = useCallback((patch: TutorialProgressPatch) => {
    wire.update(patch);
    setProgress(current => applyTutorialPatch(current, patch, current.server_now, current.revision + 1));
  }, []);
  return <><output data-testid="saved-guide">{JSON.stringify(progress)}</output>
    <DeepClaimTutorialDirector snapshot={snapshot} scope={scopeFor(snapshot)} progress={progress} events={events}
      update={update} request={request} active reducedMotion navigate={wire.navigate} onModalChange={wire.modal}
      audio={audio} onRetry={wire.retry} onContinue={wire.continue} receiptOpen={receiptOpen} />
  </>;
}
const saved = (): TutorialProgress => JSON.parse(screen.getByTestId('saved-guide').textContent!);
const expectStep = async (stepId: string) => waitFor(() => expect(saved().active_step_id).toBe(stepId));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('First-shift route and saved learning records', () => {
  it('uses existing step identities and resumes the next unfinished task without changing optional notes', () => {
    expect(FIRST_SHIFT_GUIDE).toHaveLength(6);
    expect(TUTORIAL_LESSONS).toHaveLength(42);
    for (const stage of FIRST_SHIFT_GUIDE) {
      expect(TUTORIAL_STEP_IDS).toContain(stage.stepId);
      expect(getTutorialStep(stage.stepId)?.id).toBe(stage.stepId);
      expect(firstShiftLesson(stage.lessonId)).toEqual(stage);
    }
    const data = phaseFourSnapshot();
    const progress = notes(data, undefined, {
      active_lesson_id: 'beginner.crew', active_step_id: 'beginner.crew.mara',
      completed_steps: ['beginner.plan.quote'], reviewed_lessons: ['beginner.descent', 'workforce.hiring'],
      practiced_lessons: ['beginner.waiting'], skipped_lessons: ['beginner.haul'],
    });
    const before = JSON.stringify(progress);
    expect(firstShiftResume(progress).stepId).toBe('beginner.sale.sale');
    expect(firstShiftStage('beginner.crew.mara')).toBeUndefined();
    expect(nextFirstShiftStage('beginner.sale.sale')?.stepId).toBe('beginner.upgrade.review');
    expect(nextFirstShiftStage('beginner.upgrade.review')).toBeNull();
    expect(nextFirstShiftStage('unknown')).toBeNull();
    expect(JSON.stringify(progress)).toBe(before);
  });

  it('repairs old navigation without mutating the persisted curriculum or reopening the deed', () => {
    const data = phaseFourSnapshot();
    const upgrade = getTutorialStep('beginner.upgrade.review')!;
    const before = JSON.stringify(upgrade);
    const resolved = resolveTutorialStep(upgrade, data);
    expect(resolved.id).toBe(upgrade.id);
    expect(resolved.open).toEqual({ type: 'tab', tab: 'surface', view: 'buildings' });
    expect(resolved.fallback_targets).toContain('buildings-list');
    expect(JSON.stringify(upgrade)).toBe(before);
    const deed = getTutorialStep('beginner.claim.deed')!;
    expect(resolveTutorialStep(deed, data)).toMatchObject({ target: 'nav-surface', open: { type: 'tab', tab: 'surface' } });
    expect(resolveTutorialStep(deed, null)).toBe(deed);
  });

  it('distinguishes finishing the short guide from learning all optional reference chapters', () => {
    const data = phaseFourSnapshot();
    const progress = notes(data, undefined, { skipped_lessons: FIRST_SHIFT_GUIDE.map(stage => stage.lessonId) });
    expect(isFirstShiftGuideComplete(progress)).toBe(true);
    expect(isFirstDescentComplete(progress)).toBe(false);
    expect(progress.completed_steps).toEqual([]);
    expect(progress.practiced_lessons).toEqual([]);
    expect(isFirstShiftGuideComplete(notes(data))).toBe(false);
  });
});

describe('First-shift director proof and player decisions', () => {
  it('welcomes an actually founded company at its first useful quote rather than a missing name field', async () => {
    const data = phaseFourSnapshot();
    const before = JSON.stringify(data);
    const initial = notes(data, undefined, { reviewed_lessons: ['workforce.hiring'], practiced_lessons: ['workforce.stats'] });
    render(<Harness snapshot={data} initial={initial} request={{ id: 'welcome-once', kind: 'welcome' }} />);
    await expectStep('beginner.plan.quote');
    expect(saved().reviewed_lessons).toContain('beginner.claim');
    expect(saved().practiced_lessons).toContain('beginner.claim');
    expect(saved().completed_steps).toEqual(expect.arrayContaining(['beginner.claim.deed', 'beginner.claim.founded']));
    expect(saved().reviewed_lessons).not.toContain('beginner.crew');
    expect(saved().reviewed_lessons).toContain('workforce.hiring');
    expect(saved().practiced_lessons).toContain('workforce.stats');
    expect(wire.navigate).toHaveBeenCalledWith({ type: 'dispatch' });
    expect(wire.navigate).not.toHaveBeenCalledWith({ type: 'found_company' });
    expect(wire.navigate.mock.calls.flat().some(action => action.type === 'worker')).toBe(false);
    expect(JSON.stringify(data)).toBe(before);
  });

  it('keeps blocked quotes on review and advances an allowed quote without another Next or a paid dispatch', async () => {
    const data = phaseFourSnapshot(), initial = notes(data, 'beginner.plan.quote');
    const view = render(<Harness snapshot={data} initial={initial} />);
    expect(screen.queryByRole('button', { name: 'Next tutorial step' })).not.toBeInTheDocument();
    expect(saved().active_step_id).toBe('beginner.plan.quote');
    const blocked = [observation(data, 'quote_reviewed', { allowed: false, company_revision: data.revision })];
    view.rerender(<Harness snapshot={data} initial={initial} events={blocked} />);
    expect(saved().active_step_id).toBe('beginner.plan.quote');
    expect(screen.queryByRole('button', { name: 'Next tutorial step' })).not.toBeInTheDocument();
    expect(data.expeditions).toHaveLength(0);
    const allowed = [observation(data, 'quote_reviewed', { allowed: true, company_revision: data.revision })];
    view.rerender(<Harness snapshot={data} initial={initial} events={allowed} />);
    await expectStep('beginner.descent.confirmed');
    expect(screen.queryByRole('button', { name: 'Next tutorial step' })).not.toBeInTheDocument();
    expect(saved().practiced_lessons).not.toContain('beginner.descent');
    expect(data.expeditions).toHaveLength(0);
  });

  it('waits for a confirmed expedition and a closed receipt, then reloads the same in-flight job', async () => {
    const data = phaseFourSnapshot(), initial = notes(data, 'beginner.descent.confirmed');
    const view = render(<Harness snapshot={data} initial={initial} receiptOpen />);
    expect(saved().active_step_id).toBe('beginner.descent.confirmed');
    const active = { ...data, expeditions: [job(data)] };
    view.rerender(<Harness snapshot={active} initial={initial} receiptOpen />);
    expect(saved().active_step_id).toBe('beginner.descent.confirmed');
    expect(saved().practiced_lessons).not.toContain('beginner.descent');
    view.rerender(<Harness snapshot={active} initial={initial} />);
    await expectStep('beginner.waiting.returned');
    expect(saved().practiced_lessons).toContain('beginner.descent');
    const persisted = JSON.parse(JSON.stringify(saved()));
    view.unmount(); wire.navigate.mockClear();
    render(<Harness snapshot={active} initial={persisted} />);
    await expectStep('beginner.waiting.returned');
    expect(wire.navigate).toHaveBeenCalledWith({ type: 'tab', tab: 'surface' });
    expect(wire.navigate.mock.calls.flat().some(action => action.type === 'dispatch')).toBe(false);
    expect(active.expeditions.map(item => item.id)).toEqual(['one-real-intro']);
  });

  it('uses returned and collected facts while keeping collection receipts open until the player is done', async () => {
    const data = phaseFourSnapshot(), initial = notes(data, 'beginner.waiting.returned');
    const active = { ...data, expeditions: [job(data)] };
    const view = render(<Harness snapshot={active} initial={initial} />);
    expect(saved().active_step_id).toBe('beginner.waiting.returned');
    const returned = { ...data, expeditions: [job(data, 'ready')] };
    view.rerender(<Harness snapshot={returned} initial={initial} />);
    await expectStep('beginner.haul.collected');
    expect(saved().practiced_lessons).toContain('beginner.waiting');
    expect(saved().practiced_lessons).not.toContain('beginner.haul');
    const collected = { ...data, resources: { coal: 10 }, expeditions: [job(data, 'collected')] };
    view.rerender(<Harness snapshot={collected} initial={initial} receiptOpen />);
    expect(saved().active_step_id).toBe('beginner.haul.collected');
    view.rerender(<Harness snapshot={collected} initial={initial} />);
    await expectStep('beginner.sale.sale');
    expect(saved().practiced_lessons).toContain('beginner.haul');
    expect(collected.resources).toEqual({ coal: 10 });
  });

  it('pauses and resumes the same in-flight shift without losing the cursor or reopening dispatch', async () => {
    const data = phaseFourSnapshot(); data.expeditions = [job(data)];
    const initial = notes(data, 'beginner.waiting.returned', { reviewed_lessons: ['workforce.hiring'] });
    const before = JSON.stringify(data);
    const view = render(<Harness snapshot={data} initial={initial} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pause guide' }));
    expect(saved().campaign_status).toBe('paused');
    expect(saved().active_step_id).toBe('beginner.waiting.returned');
    expect(saved().reviewed_lessons).toContain('workforce.hiring');
    wire.navigate.mockClear();
    view.rerender(<Harness snapshot={data} initial={initial} request={{ id: 'resume-the-shift', kind: 'lesson', lessonId: 'beginner.waiting' }} />);
    await waitFor(() => expect(saved().campaign_status).toBe('active'));
    expect(saved().active_step_id).toBe('beginner.waiting.returned');
    expect(wire.navigate.mock.calls.flat().some(action => action.type === 'dispatch')).toBe(false);
    expect(JSON.stringify(data)).toBe(before);
  });

  it.each(['beginner.descent.confirmed', 'beginner.haul.collected', 'beginner.sale.sale'])(
    'never advances %s from a balance, stocked material or an unconfirmed interaction', async stepId => {
      const data = phaseFourSnapshot(); data.company!.cash = 9999; data.resources = { coal: 500 };
      const initial = notes(data, stepId);
      const events = [observation(data, 'quote_reviewed', { allowed: true, company_revision: data.revision }),
        observation(data, 'sale_confirmed', undefined, data.revision + 1)];
      render(<Harness snapshot={data} initial={initial} events={events} />);
      await waitFor(() => expect(wire.navigate).toHaveBeenCalled());
      expect(saved().active_step_id).toBe(stepId);
      expect(screen.queryByRole('button', { name: 'Next tutorial step' })).not.toBeInTheDocument();
      expect(saved().practiced_lessons).toEqual([]);
      expect(wire.update).not.toHaveBeenCalled();
    },
  );

  it('lets the player keep all materials without recording a sale, spending stock or claiming profit', async () => {
    const data = phaseFourSnapshot(); data.resources = { coal: 10, stone: 12 };
    const before = JSON.stringify(data);
    const initial = notes(data, 'beginner.sale.sale', { reviewed_lessons: ['workforce.hiring'] });
    render(<Harness snapshot={data} initial={initial} />);
    fireEvent.click(screen.getByRole('button', { name: 'Keep materials' }));
    await expectStep('beginner.upgrade.review');
    expect(saved().reviewed_lessons).toEqual(expect.arrayContaining(['beginner.sale', 'workforce.hiring']));
    expect(saved().practiced_lessons).not.toContain('beginner.sale');
    expect(saved().completed_steps).not.toContain('beginner.sale.sale');
    expect(wire.navigate).toHaveBeenLastCalledWith({ type: 'tab', tab: 'surface', view: 'buildings' });
    expect(JSON.stringify(data)).toBe(before);
  });

  it('defers sale navigation and Keep/Skip actions while an operation or receipt is open, then resumes', async () => {
    const data = phaseFourSnapshot(); data.resources = { coal: 10 };
    const initial = notes(data, 'beginner.sale.sale');
    const view = render(<Harness snapshot={data} initial={initial} receiptOpen />);
    expect(saved().active_step_id).toBe('beginner.sale.sale');
    expect(wire.navigate).not.toHaveBeenCalled();
    expect(screen.queryByTestId('guide')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Keep materials' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Skip guided task' })).not.toBeInTheDocument();
    expect(wire.update).not.toHaveBeenCalled();

    view.rerender(<Harness snapshot={data} initial={initial} />);
    await waitFor(() => expect(wire.navigate).toHaveBeenCalledWith({ type: 'tab', tab: 'stores', view: 'stock' }));
    expect(await screen.findByRole('button', { name: 'Keep materials' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Skip guided task' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Keep materials' }));
    await expectStep('beginner.upgrade.review');
    expect(wire.navigate).toHaveBeenLastCalledWith({ type: 'tab', tab: 'surface', view: 'buildings' });
    expect(saved().reviewed_lessons).toContain('beginner.sale');
    expect(saved().practiced_lessons).not.toContain('beginner.sale');
    expect(data.resources).toEqual({ coal: 10 });
  });

  it('waits for a confirmed sale receipt to close before navigating to the upgrade exactly once', async () => {
    const data = phaseFourSnapshot(); data.resources = { coal: 10 };
    const initial = notes(data, 'beginner.sale.sale');
    const view = render(<Harness snapshot={data} initial={initial} receiptOpen />);
    const confirmed = [observation(data, 'sale_confirmed', undefined, data.revision)];
    view.rerender(<Harness snapshot={data} initial={initial} events={confirmed} receiptOpen />);
    expect(saved().active_step_id).toBe('beginner.sale.sale');
    expect(saved().practiced_lessons).not.toContain('beginner.sale');
    expect(wire.navigate).not.toHaveBeenCalled();
    expect(screen.queryByTestId('guide')).not.toBeInTheDocument();

    view.rerender(<Harness snapshot={data} initial={initial} events={confirmed} />);
    await expectStep('beginner.upgrade.review');
    expect(saved().completed_steps).toContain('beginner.sale.sale');
    expect(saved().practiced_lessons).toContain('beginner.sale');
    const upgradeCalls = () => wire.navigate.mock.calls.filter(([action]) => action.type === 'tab' && action.view === 'buildings');
    expect(upgradeCalls()).toHaveLength(1);
    view.rerender(<Harness snapshot={data} initial={initial} events={confirmed} />);
    expect(upgradeCalls()).toHaveLength(1);
    expect(wire.navigate).toHaveBeenLastCalledWith({ type: 'tab', tab: 'surface', view: 'buildings' });
  });

  it('finishes after a deliberate upgrade review without buying or requiring the optional inspection chapters', async () => {
    const data = phaseFourSnapshot();
    const initial = notes(data, 'beginner.upgrade.review', {
      reviewed_lessons: FIRST_SHIFT_GUIDE.slice(0, -1).map(stage => stage.lessonId),
      completed_steps: ['beginner.plan.quote', 'beginner.descent.confirmed', 'beginner.waiting.returned', 'beginner.haul.collected'],
    });
    const before = JSON.stringify(data);
    const view = render(<Harness snapshot={data} initial={initial} />);
    expect(screen.queryByRole('button', { name: 'Next tutorial step' })).not.toBeInTheDocument();
    const events = [observation(data, 'building_inspected', { building_key: 'warehouse' })];
    view.rerender(<Harness snapshot={data} initial={initial} events={events} />);
    expect(saved().campaign_status).toBe('active');
    fireEvent.click(await screen.findByRole('button', { name: 'Next tutorial step' }));
    await waitFor(() => expect(saved().campaign_status).toBe('completed'));
    expect(isFirstShiftGuideComplete(saved())).toBe(true);
    expect(isFirstDescentComplete(saved())).toBe(false);
    expect(saved().practiced_lessons).not.toContain('beginner.upgrade');
    for (const optional of ['beginner.camp', 'beginner.crew', 'beginner.mine']) expect(saved().reviewed_lessons).not.toContain(optional);
    expect(JSON.stringify(data)).toBe(before);
  });

  it('allows an honest skip through the guide without manufacturing practical marks or economic outcomes', async () => {
    const data = phaseFourSnapshot(), initial = notes(data, FIRST_SHIFT_GUIDE[0].stepId);
    const before = JSON.stringify(data);
    render(<Harness snapshot={data} initial={initial} />);
    for (const stage of FIRST_SHIFT_GUIDE) {
      await expectStep(stage.stepId);
      fireEvent.click(screen.getByRole('button', { name: 'Skip guided task' }));
    }
    await waitFor(() => expect(saved().campaign_status).toBe('completed'));
    expect(saved().skipped_lessons).toEqual(FIRST_SHIFT_GUIDE.map(stage => stage.lessonId));
    expect(saved().reviewed_lessons).toEqual([]);
    expect(saved().practiced_lessons).toEqual([]);
    expect(saved().completed_steps).toEqual([]);
    expect(isFirstDescentComplete(saved())).toBe(false);
    expect(JSON.stringify(data)).toBe(before);
  });
});
