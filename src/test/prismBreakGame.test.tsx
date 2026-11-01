import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismBoard } from '@/components/showdown/PrismBoard';
import { PrismBreakGame, type PrismBreakGameProps } from '@/components/showdown/PrismBreakGame';
import type { PrismAction, PrismPuzzle } from '@/lib/showdown/prism/types';

const preferences = vi.hoisted(() => ({ reduced: false }));
vi.mock('framer-motion', () => ({ useReducedMotion: () => preferences.reduced }));

const puzzle: PrismPuzzle = {
  id: 'ui-two-turn-circuit', version: 1, difficulty: 'easy', width: 5, height: 5,
  tiles: Array.from({ length: 25 }, (_, cell) => cell === 10 ? { kind: 'emitter', direction: 'E', color: 'cyan' } : cell === 4 ? { kind: 'receiver', color: 'cyan', label: 'A' } : cell === 2 || cell === 12 ? { kind: 'mirror', orientation: '\\', rotatable: true } : { kind: 'empty' }),
};
const base = { attemptKey: 'match-a:member-a', puzzle, roundNumber: 1 as const, opponent: { displayName: 'Blair' }, onLeave: vi.fn() };
function Harness({ onSubmit = vi.fn().mockResolvedValue(undefined), initialActions = [], onChange, ...overrides }: Partial<PrismBreakGameProps> & { initialActions?: PrismAction[]; onChange?: (actions: PrismAction[]) => void }) {
  const [actions, setActions] = useState<PrismAction[]>(initialActions);
  return <PrismBreakGame {...base} {...overrides} actions={actions} onActionsChange={next => { setActions(next); onChange?.(next); }} onSubmit={onSubmit} />;
}
const firstMirror = () => screen.getByRole('button', { name: /Row 3, column 3: Rotatable/ });
const secondMirror = () => screen.getByRole('button', { name: /Row 1, column 3: Rotatable/ });
function align() { fireEvent.click(firstMirror()); fireEvent.click(secondMirror()); }
beforeEach(() => { preferences.reduced = false; vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); });

describe('Prism Break ranked round interaction', () => {
  it('updates the real beam immediately and never refunds rotations on reset', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(firstMirror());
    expect(screen.getByTestId('prism-rotations')).toHaveTextContent('1');
    expect(firstMirror()).toHaveAccessibleName(/slash mirror/);
    fireEvent.click(screen.getByRole('button', { name: 'Reset board' }));
    expect(firstMirror()).toHaveAccessibleName(/backslash mirror/);
    expect(screen.getByTestId('prism-rotations')).toHaveTextContent('1');
    expect(screen.getByText('Board reset. Every rotation still counts.')).toBeVisible();
    fireEvent.click(firstMirror());
    expect(screen.getByTestId('prism-rotations')).toHaveTextContent('2');
    expect(onChange.mock.calls.at(-1)?.[0]).toEqual([{ type: 'rotate', cell: 12 }, { type: 'reset' }, { type: 'rotate', cell: 12 }]);
  });

  it('automatically submits one solved action log after a short reveal and waits for the server to advance', async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    render(<Harness onSubmit={submit} />);
    align();
    expect(screen.getByTestId('prism-board')).toHaveAttribute('data-prism-solved', 'true');
    expect(screen.getByText('Prism aligned')).toBeVisible();
    expect(submit).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(450); });
    expect(submit).toHaveBeenCalledExactlyOnceWith([{ type: 'rotate', cell: 12 }, { type: 'rotate', cell: 2 }], 'solved');
    expect(screen.getByTestId('prism-game')).toHaveAttribute('data-prism-round', '1');
    expect(screen.getByRole('button', { name: 'Reset board' })).toBeDisabled();
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('keeps a failed terminal attempt frozen and retries the identical action log', async () => {
    const submit = vi.fn().mockRejectedValueOnce(new Error('Connection interrupted')).mockResolvedValueOnce(undefined);
    render(<Harness onSubmit={submit} />);
    align();
    await act(async () => { vi.advanceTimersByTime(450); });
    expect(screen.getByRole('alert')).toHaveTextContent('Connection interrupted');
    expect(firstMirror()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Skip puzzle' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Retry round submission' }));
    await act(async () => {});
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]).toEqual(submit.mock.calls[0]);
  });

  it('requires explicit zero-point skip confirmation and never manufactures a score', async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    render(<Harness onSubmit={submit} />);
    fireEvent.click(firstMirror());
    fireEvent.click(screen.getByRole('button', { name: 'Skip puzzle' }));
    expect(screen.getByRole('group', { name: 'Confirm puzzle skip' })).toHaveTextContent('0 points');
    expect(submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Keep playing' }));
    expect(submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Skip puzzle' }));
    fireEvent.click(screen.getByRole('button', { name: 'Skip for 0 points' }));
    await act(async () => {});
    expect(submit).toHaveBeenCalledExactlyOnceWith([{ type: 'rotate', cell: 12 }], 'skipped');
  });

  it('provides full-size selected-piece controls as an alternative to touching small grid cells', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Select next mirror' }));
    const selected = screen.getByRole('button', { name: /Rotate mirror 2/ });
    expect(selected).toHaveTextContent('Row 3 · Col 3');
    fireEvent.click(selected);
    expect(onChange).toHaveBeenLastCalledWith([{ type: 'rotate', cell: 12 }]);
    expect(screen.getByTestId('prism-rotations')).toHaveTextContent('1');
  });

  it('retires an old round success timer when the player changes matches', async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    const view = render(<PrismBreakGame {...base} actions={[{ type: 'rotate', cell: 12 }, { type: 'rotate', cell: 2 }]} onActionsChange={vi.fn()} onSubmit={submit} />);
    view.rerender(<PrismBreakGame {...base} attemptKey="match-b:member-a" actions={[]} onActionsChange={vi.fn()} onSubmit={submit} />);
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByTestId('prism-rotations')).toHaveTextContent('0');
    expect(screen.queryByText('Prism aligned')).toBeNull();
  });

  it('does not let a previous match response lock the new round', async () => {
    let resolve!: () => void;
    const submit = vi.fn().mockReturnValue(new Promise<void>(done => { resolve = done; }));
    const view = render(<PrismBreakGame {...base} actions={[{ type: 'rotate', cell: 12 }, { type: 'rotate', cell: 2 }]} onActionsChange={vi.fn()} onSubmit={submit} />);
    await act(async () => { vi.advanceTimersByTime(450); });
    view.rerender(<PrismBreakGame {...base} roundNumber={2} actions={[]} onActionsChange={vi.fn()} onSubmit={submit} />);
    await act(async () => { resolve(); });
    expect(screen.getByTestId('prism-game')).toHaveAttribute('data-prism-round', '2');
    expect(firstMirror()).toBeEnabled();
  });

  it('shortens the success presentation for reduced-motion players', async () => {
    preferences.reduced = true;
    const submit = vi.fn().mockResolvedValue(undefined);
    render(<Harness onSubmit={submit} />);
    align();
    await act(async () => { vi.advanceTimersByTime(120); });
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('keeps zero-point skipping available at the action cap', async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    render(<Harness initialActions={Array.from({ length: 512 }, () => ({ type: 'reset' as const }))} onSubmit={submit} />);
    expect(firstMirror()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reset board' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Skip puzzle' }));
    fireEvent.click(screen.getByRole('button', { name: 'Skip for 0 points' }));
    await act(async () => {});
    expect(submit.mock.calls[0][0]).toHaveLength(512);
    expect(submit.mock.calls[0][1]).toBe('skipped');
  });

  it('offers checkpoint recovery without submitting an unverifiable client log', () => {
    const submit = vi.fn(), retry = vi.fn();
    render(<Harness initialActions={[{ type: 'rotate', cell: 0 }]} onSubmit={submit} onRetrySave={retry} />);
    expect(screen.getByRole('heading', { name: 'Recovering this round' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh saved round' }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(submit).not.toHaveBeenCalled();
  });

  it('renders a completed solution with named receiver activation and no replay controls', () => {
    render(<PrismBoard puzzle={puzzle} actions={[{ type: 'rotate', cell: 12 }, { type: 'rotate', cell: 2 }]} readOnly label="Alex final board" />);
    expect(screen.getByRole('group', { name: 'Alex final board' })).toBeVisible();
    expect(screen.getByRole('img', { name: /receiver A, activated/ })).toBeVisible();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByTestId('prism-board')).toHaveAttribute('data-prism-solved', 'true');
  });
});
