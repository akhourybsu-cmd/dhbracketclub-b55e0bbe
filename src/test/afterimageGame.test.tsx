import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AfterimageGame, type AfterimageGameProps } from '@/components/showdown/afterimage/AfterimageGame';
import { sanitizeScene } from '@/lib/showdown/afterimage/engine';
import type { AfterimagePhase, AfterimagePlacement, AfterimageSceneView } from '@/lib/showdown/afterimage/types';
import { afterimageFixtureScene } from './fixtures/afterimage';

let monotonic = 1000;
let visibility: DocumentVisibilityState = 'visible';
const originalVisibility = Object.getOwnPropertyDescriptor(document, 'visibilityState');
function scene(phase: AfterimagePhase = 'reconstruct', milliseconds = 7000, round = 1): AfterimageSceneView {
  return sanitizeScene(afterimageFixtureScene(round), phase, phase === 'study' ? {
    study_started_at: '2026-11-01T00:00:00.000Z', study_expires_at: '2026-11-01T00:00:07.000Z', server_now: '2026-11-01T00:00:00.000Z',
    observation_remaining_ms: milliseconds, observation_received_at: monotonic,
  } : {});
}
const base = {
  attemptKey: 'memory-a:member-a', roundNumber: 1 as const, opponent: { displayName: 'Blair' },
  onLeave: vi.fn(), onStartStudy: vi.fn().mockResolvedValue(undefined), onStudyExpired: vi.fn().mockResolvedValue(undefined),
  onSubmit: vi.fn().mockResolvedValue(undefined),
};
function Harness({ initialPlacements = [], onChange, ...overrides }: Partial<AfterimageGameProps> & { initialPlacements?: AfterimagePlacement[]; onChange?: (value: AfterimagePlacement[]) => void }) {
  const [placements, setPlacements] = useState(initialPlacements);
  return <AfterimageGame {...base} scene={scene()} {...overrides} placements={placements} onPlacementsChange={next => { setPlacements(next); onChange?.(next); }} />;
}
const piece = (label: string) => screen.getByRole('button', { name: new RegExp(`^Select ${label}(,|$)`) });
const position = (number: number) => screen.getByRole('button', { name: new RegExp(`^Position ${number}:`) });
async function advance(milliseconds: number) { await act(async () => { monotonic += milliseconds; vi.advanceTimersByTime(milliseconds); }); }
async function settle() { await act(async () => {}); }
function changeVisibility(value: DocumentVisibilityState) {
  act(() => { visibility = value; document.dispatchEvent(new Event('visibilitychange')); });
}
beforeEach(() => {
  monotonic = 1000; visibility = 'visible';
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  vi.spyOn(performance, 'now').mockImplementation(() => monotonic);
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
});
afterEach(() => {
  cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.clearAllMocks();
  if (originalVisibility) Object.defineProperty(document, 'visibilityState', originalVisibility);
  else delete (document as unknown as Record<string, unknown>).visibilityState;
});

describe('Afterimage one-window study and privacy', () => {
  it('starts only on Ready and checks a lost response without automatically starting another window', async () => {
    const start = vi.fn().mockRejectedValue(new Error('Response interrupted'));
    const refresh = vi.fn().mockResolvedValue(undefined);
    render(<Harness scene={scene('ready')} onStartStudy={start} onStudyExpired={refresh} />);
    expect(start).not.toHaveBeenCalled();
    expect(screen.queryByTestId('afterimage-study')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ready to study' }));
    await settle();
    expect(start).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert')).toHaveTextContent('Response interrupted');
    expect(screen.queryByRole('button', { name: 'Ready to study' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Check study status' }));
    await settle();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Ready to study' })).toBeEnabled();
  });

  it('conceals the complete scene at seven seconds even when the phase refresh fails', async () => {
    const refresh = vi.fn().mockRejectedValue(new Error('You are offline'));
    render(<Harness scene={scene('study')} onStudyExpired={refresh} />);
    expect(screen.getByTestId('afterimage-study').querySelectorAll('[data-afterimage-object]')).toHaveLength(9);
    expect(screen.queryByRole('group', { name: 'Objects to place' })).toBeNull();
    await advance(6950);
    expect(screen.getByTestId('afterimage-study')).toBeVisible();
    await advance(50);
    expect(screen.queryByTestId('afterimage-study')).toBeNull();
    expect(document.querySelectorAll('[data-afterimage-object]')).toHaveLength(0);
    expect(screen.getByTestId('afterimage-game')).toHaveAttribute('data-afterimage-phase', 'concealed');
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Retry scene refresh' })).toBeVisible();
    await advance(20000);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /Ready|study again/i })).toBeNull();
  });

  it('resumes only the observed remaining time and ignores changes to the device wall clock', async () => {
    render(<Harness scene={scene('study', 2300)} onStudyExpired={vi.fn().mockRejectedValue(new Error('offline'))} />);
    expect(screen.getByRole('timer')).toHaveAccessibleName('3 seconds of study remaining');
    vi.setSystemTime(new Date('2001-01-01T00:00:00Z'));
    await advance(2250);
    expect(screen.getByTestId('afterimage-study')).toBeVisible();
    vi.setSystemTime(new Date('2099-01-01T00:00:00Z'));
    await advance(50);
    expect(screen.queryByTestId('afterimage-study')).toBeNull();
  });

  it('keeps exactly one study clock outside the canonical board so all fifteen hard-round objects remain visible', () => {
    render(<Harness scene={scene('study', 7000, 3)} roundNumber={3} />);
    const timers = screen.getAllByRole('timer');
    expect(timers).toHaveLength(1);
    expect(timers[0].closest('.ai-game-footer')).not.toBeNull();
    expect(screen.getByTestId('afterimage-board')).not.toContainElement(timers[0]);
    expect(screen.getByTestId('afterimage-study').querySelectorAll('[data-afterimage-object]')).toHaveLength(15);
  });

  it('never extends the first deadline when polling returns a later observation', async () => {
    const refresh = vi.fn().mockRejectedValue(new Error('offline'));
    const view = render(<Harness scene={scene('study')} onStudyExpired={refresh} />);
    await advance(5000);
    view.rerender(<Harness scene={scene('study', 7000)} onStudyExpired={refresh} />);
    expect(screen.getByRole('timer')).toHaveAccessibleName('2 seconds of study remaining');
    await advance(2000);
    expect(screen.queryByTestId('afterimage-study')).toBeNull();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('keeps early-cutoff artwork masked and retries safe refreshes until the server unlocks reconstruction', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const view = render(<Harness scene={scene('study', 100)} onStudyExpired={refresh} />);
    await advance(100);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('afterimage-study')).toBeNull();
    view.rerender(<Harness scene={scene('study', 300)} onStudyExpired={refresh} />);
    for (let index = 0; index < 4; index++) await advance(250);
    expect(refresh).toHaveBeenCalledTimes(5);
    expect(screen.queryByTestId('afterimage-study')).toBeNull();
    view.rerender(<Harness scene={scene('reconstruct')} onStudyExpired={refresh} />);
    expect(screen.getByTestId('afterimage-recall')).toBeVisible();
    await advance(1000);
    expect(refresh).toHaveBeenCalledTimes(5);
  });

  it('conceals immediately when hidden and requires a fresh return-time observation before revealing again', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const view = render(<Harness scene={scene('study')} onStudyExpired={refresh} />);
    await advance(500);
    changeVisibility('hidden');
    expect(screen.queryByTestId('afterimage-study')).toBeNull();
    expect(screen.getByTestId('afterimage-board')).toHaveAttribute('data-afterimage-concealed', 'true');
    await advance(500);
    const receivedWhileHidden = scene('study', 6000);
    view.rerender(<Harness scene={receivedWhileHidden} onStudyExpired={refresh} />);
    await advance(500);
    changeVisibility('visible');
    await settle();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('afterimage-study')).toBeNull();
    await advance(1);
    view.rerender(<Harness scene={scene('study', 5499)} onStudyExpired={refresh} />);
    expect(screen.getByTestId('afterimage-study')).toBeVisible();
    await advance(5499);
    expect(screen.queryByTestId('afterimage-study')).toBeNull();
  });

  it('does not display study objects without a conservative monotonic observation', async () => {
    const refresh = vi.fn().mockRejectedValue(new Error('Check connection'));
    const unobserved = scene('study');
    delete unobserved.observation_received_at; delete unobserved.observation_remaining_ms;
    render(<Harness scene={unobserved} onStudyExpired={refresh} />);
    await settle();
    expect(screen.queryByTestId('afterimage-study')).toBeNull();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Retry scene refresh' })).toBeVisible();
  });
});

describe('Afterimage neutral reconstruction', () => {
  it('supports piece-first and position-first placement, swapping, returning and resetting without hints', () => {
    const changed = vi.fn();
    const { container } = render(<Harness onChange={changed} />);
    fireEvent.click(piece('book')); fireEvent.click(position(1));
    expect(position(1)).toHaveAccessibleName('Position 1: book');
    fireEvent.click(position(2)); fireEvent.click(piece('lantern'));
    expect(position(2)).toHaveAccessibleName('Position 2: lantern');
    fireEvent.click(piece('book')); fireEvent.click(position(2));
    expect(position(1)).toHaveAccessibleName('Position 1: lantern');
    expect(position(2)).toHaveAccessibleName('Position 2: book');
    fireEvent.click(position(2));
    fireEvent.click(screen.getByRole('button', { name: 'Return selected object to tray' }));
    expect(position(2)).toHaveAccessibleName('Position 2: empty');
    fireEvent.click(screen.getByRole('button', { name: 'Reset placements' }));
    expect(changed).toHaveBeenLastCalledWith([]);
    expect(position(1)).toHaveAccessibleName('Position 1: empty');
    expect(container.querySelector('[class*="--correct"],[class*="--wrong"],.ai-scene-slot-grade')).toBeNull();
    expect(screen.queryByText(/\d+ points|correct objects/i)).toBeNull();
  });

  it('keeps distractors selectable with the same neutral feedback as genuine pieces', () => {
    const changed = vi.fn();
    render(<Harness scene={scene('reconstruct', 7000, 3)} roundNumber={3} onChange={changed} />);
    expect(screen.getByRole('group', { name: 'Objects to place' }).querySelectorAll('button')).toHaveLength(7);
    fireEvent.click(piece('teapot')); fireEvent.click(position(1));
    expect(position(1)).toHaveAccessibleName('Position 1: teapot');
    expect(changed).toHaveBeenLastCalledWith([{ object_id: 'object-teapot', slot_id: 'place-1' }]);
    expect(screen.getByText('No hints until you seal it.')).toBeVisible();
  });

  it('provides keyboard-focus routing between tray objects and neutral positions', () => {
    render(<Harness />);
    fireEvent.click(piece('key'), { detail: 0 });
    expect(position(1)).toHaveFocus();
    fireEvent.click(position(3), { detail: 0 });
    expect(position(3)).toHaveAccessibleName('Position 3: key');
    fireEvent.click(position(1), { detail: 0 });
    expect(piece('key')).toHaveFocus(); // The frozen tray order is reversed.
    fireEvent.click(piece('book'), { detail: 0 });
    expect(position(1)).toHaveAccessibleName('Position 1: book');
  });

  it('accepts native drag/drop and ignores IDs outside the frozen tray', () => {
    const changed = vi.fn();
    render(<Harness onChange={changed} />);
    const content = new Map<string, string>();
    const dataTransfer = { setData: (type: string, value: string) => content.set(type, value), getData: (type: string) => content.get(type) ?? '', effectAllowed: '', dropEffect: '' };
    fireEvent.dragStart(piece('lantern'), { dataTransfer });
    fireEvent.dragOver(position(2), { dataTransfer });
    fireEvent.drop(position(2), { dataTransfer });
    expect(position(2)).toHaveAccessibleName('Position 2: lantern');
    expect(changed).toHaveBeenCalledTimes(1);
    content.set('application/x-dh-afterimage-piece', 'other-club-piece');
    fireEvent.drop(position(1), { dataTransfer });
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('supports touch dragging with a floating miniature and keeps the next deliberate tap usable', async () => {
    const changed = vi.fn();
    render(<Harness onChange={changed} />);
    const original = Object.getOwnPropertyDescriptor(document, 'elementFromPoint');
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => position(2) });
    function pointer(target: HTMLElement, type: string, x: number, y: number) {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.assign(event, { isPrimary: true, pointerType: 'touch', pointerId: 1, clientX: x, clientY: y });
      fireEvent(target, event);
    }
    try {
      pointer(piece('book'), 'pointerdown', 40, 400);
      pointer(piece('book'), 'pointermove', 70, 320);
      expect(screen.getByTestId('afterimage-drag-preview')).toBeVisible();
      pointer(piece('book'), 'pointerup', 130, 200);
      expect(screen.queryByTestId('afterimage-drag-preview')).toBeNull();
      expect(position(2)).toHaveAccessibleName('Position 2: book');
      expect(changed).toHaveBeenCalledTimes(1);
      fireEvent.click(piece('book'), { detail: 1 }); // Ignore the touch compatibility click.
      expect(piece('book')).toHaveAttribute('aria-pressed', 'false');
      await advance(450);
      fireEvent.click(piece('key'), { detail: 1 });
      fireEvent.click(position(1));
      expect(position(1)).toHaveAccessibleName('Position 1: key');
    } finally {
      if (original) Object.defineProperty(document, 'elementFromPoint', original);
      else delete (document as unknown as Record<string, unknown>).elementFromPoint;
    }
  });

  it('requires final confirmation, freezes the attempt, and retries a lost submission without fake advancement', async () => {
    const submit = vi.fn().mockRejectedValueOnce(new Error('Submission interrupted')).mockResolvedValueOnce(undefined);
    const saved = [{ object_id: 'object-key', slot_id: 'place-1' }];
    render(<Harness initialPlacements={saved} onSubmit={submit} bankedScore={125} />);
    fireEvent.click(screen.getByRole('button', { name: 'Submit memory' }));
    expect(screen.getByRole('group', { name: 'Confirm final memory' })).toHaveTextContent('Seal 1 of 3 positions?');
    expect(submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Keep arranging' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit memory' }));
    fireEvent.click(screen.getByRole('button', { name: 'Seal this memory' }));
    await settle();
    expect(submit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert')).toHaveTextContent('Submission interrupted');
    expect(piece('book')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reset placements' })).toBeDisabled();
    expect(screen.getByRole('img', { name: 'Position 1: key' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Retry memory submission' }));
    await settle();
    expect(submit).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('afterimage-game')).toHaveAttribute('data-afterimage-round', '1');
    expect(screen.getByText('125')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Memory sealed' })).toBeDisabled();
  });

  it('protects against duplicate sealing while a response is still in flight', async () => {
    let complete!: () => void;
    const submit = vi.fn().mockReturnValue(new Promise<void>(resolve => { complete = resolve; }));
    render(<Harness onSubmit={submit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Submit memory' }));
    const seal = screen.getByRole('button', { name: 'Seal this memory' });
    fireEvent.click(seal); fireEvent.click(seal);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Sealing memory…' })).toBeDisabled();
    await act(async () => { complete(); });
    expect(screen.getByRole('button', { name: 'Memory sealed' })).toBeDisabled();
  });

  it('retains restored placements on reload and accepts server reconciliation after a conflict', async () => {
    const submit = vi.fn().mockRejectedValue(new Error('A different device saved a newer layout.'));
    const props: AfterimageGameProps = { ...base, scene: scene(), placements: [{ object_id: 'object-book', slot_id: 'place-2' }], onPlacementsChange: vi.fn(), onSubmit: submit };
    const view = render(<AfterimageGame {...props} />);
    expect(position(2)).toHaveAccessibleName('Position 2: book');
    fireEvent.click(screen.getByRole('button', { name: 'Submit memory' })); fireEvent.click(screen.getByRole('button', { name: 'Seal this memory' }));
    await settle();
    view.rerender(<AfterimageGame {...props} placements={[{ object_id: 'object-lantern', slot_id: 'place-3' }]} />);
    expect(position(3)).toHaveAccessibleName('Position 3: lantern');
    expect(screen.getByRole('button', { name: 'Submit memory' })).toBeEnabled();
    expect(screen.getByText('Another saved layout was restored. Review it before submitting.')).toBeInTheDocument();
  });

  it('retires in-flight operation state when navigating to a different match or round', async () => {
    let complete!: () => void;
    const start = vi.fn().mockReturnValue(new Promise<void>(resolve => { complete = resolve; }));
    const view = render(<Harness scene={scene('ready')} onStartStudy={start} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ready to study' }));
    view.rerender(<Harness attemptKey="memory-b:member-a" scene={scene()} />);
    await act(async () => { complete(); });
    expect(screen.getByRole('button', { name: 'Submit memory' })).toBeEnabled();
    expect(piece('book')).toBeEnabled();
  });
});
