import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeepClaimCrewDeparture } from '@/components/deepClaim/DeepClaimCrewDeparture';
import type { DeepClaimExpedition } from '@/lib/deepClaim/types';
import { phaseFourSnapshot } from './fixtures/deepClaimPhase4';

function job(overrides: Partial<DeepClaimExpedition> = {}): DeepClaimExpedition {
  return { id: 'job-a', mode: 'extract', status: 'active', worker_ids: ['worker-a'], target: { x: 47, y: 1 }, path: [{ x: 48, y: 1 }, { x: 47, y: 1 }], stages: [], stage: 'travel', started_at: '2026-11-01T12:00:00Z', completes_at: '2026-11-01T12:00:30Z', duration_minutes: 20, duration_seconds: 30, tutorial: true, wages: 3, energy_per_worker: 1, config_version: 3, cargo: null, ...overrides };
}
function setup(overrides: Partial<Parameters<typeof DeepClaimCrewDeparture>[0]> = {}) {
  const props = { job: job(), workers: phaseFourSnapshot().workers, onDone: vi.fn(), onFollow: vi.fn(), reducedMotion: false, ...overrides };
  return { props, ...render(<DeepClaimCrewDeparture {...props} />) };
}
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe('Deep Claim confirmed crew departure', () => {
  it('shows the actual assigned crew, source stage and induction duration without exposing unrelated workers', () => {
    const data = phaseFourSnapshot(), first = data.workers[0];
    const source = job({ worker_ids: [first.id, first.id, 'unknown-worker'], stage: 'setup' });
    const before = structuredClone({ source, workers: data.workers });
    const ui = setup({ job: source, workers: [...data.workers, first] });
    expect(screen.getByRole('status', { name: 'Crew departure' })).toHaveTextContent('Shift underway');
    expect(screen.getByText('Extraction · 1m · 30s')).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: first.name })).toHaveLength(1);
    expect(screen.queryByText(data.workers[1].name)).not.toBeInTheDocument();
    expect(ui.container.querySelector('[data-dc-departure]')).toHaveAttribute('data-dc-departure-stage', 'setup');
    expect({ source, workers: data.workers }).toEqual(before);
  });
  it('does not steal keyboard focus, trap the game in a dialog or complete a job', () => {
    const button = document.createElement('button'); document.body.append(button); button.focus();
    const source = job(), ui = setup({ job: source });
    expect(button).toHaveFocus(); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1799)); expect(ui.props.onDone).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1)); expect(ui.props.onDone).toHaveBeenCalledOnce();
    expect(source.status).toBe('active'); expect(source.cargo).toBeNull(); button.remove();
  });
  it('uses the latest callback while clock/worker rerenders do not restart its finite lifecycle', () => {
    const ui = setup(); act(() => vi.advanceTimersByTime(1200));
    const latest = vi.fn(); ui.rerender(<DeepClaimCrewDeparture {...ui.props} workers={[...ui.props.workers]} onDone={latest} />);
    act(() => vi.advanceTimersByTime(600));
    expect(latest).toHaveBeenCalledOnce(); expect(ui.props.onDone).not.toHaveBeenCalled();
  });
  it('resets the lifetime for a distinct confirmed job and cancels the previous timer', () => {
    const ui = setup(); act(() => vi.advanceTimersByTime(1700));
    ui.rerender(<DeepClaimCrewDeparture {...ui.props} job={job({ id: 'job-b' })} />);
    act(() => vi.advanceTimersByTime(100)); expect(ui.props.onDone).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1700)); expect(ui.props.onDone).toHaveBeenCalledOnce();
    expect(ui.container.querySelector('[data-dc-departure]')).toHaveAttribute('data-dc-departure', 'job-b');
  });
  it('cancels its lifecycle when the presentation unmounts', () => {
    const ui = setup(); ui.unmount(); act(() => vi.advanceTimersByTime(5000));
    expect(ui.props.onDone).not.toHaveBeenCalled(); expect(ui.props.onFollow).not.toHaveBeenCalled();
  });
  it('dismisses immediately once and never turns dismissal into follow or a second timeout callback', () => {
    const ui = setup(); fireEvent.click(screen.getByRole('button', { name: 'Dismiss departure' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss departure' })); act(() => vi.advanceTimersByTime(5000));
    expect(ui.props.onDone).toHaveBeenCalledOnce(); expect(ui.props.onFollow).not.toHaveBeenCalled();
  });
  it('follows only through the explicit callback and suppresses the pending automatic dismissal', () => {
    const ui = setup(); fireEvent.click(screen.getByRole('button', { name: 'Follow crew' }));
    act(() => vi.advanceTimersByTime(5000)); expect(ui.props.onFollow).toHaveBeenCalledOnce(); expect(ui.props.onDone).not.toHaveBeenCalled();
  });
  it('shows a static short presentation when reduced motion is selected', () => {
    const ui = setup({ reducedMotion: true }); expect(ui.container.firstElementChild).toHaveClass('is-reduced');
    act(() => vi.advanceTimersByTime(899)); expect(ui.props.onDone).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1)); expect(ui.props.onDone).toHaveBeenCalledOnce();
  });
  it('honors the system reduced-motion preference even when the in-game prop is false', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ matches: true, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
    const ui = setup(); expect(ui.container.firstElementChild).toHaveClass('is-reduced');
    act(() => vi.advanceTimersByTime(900)); expect(ui.props.onDone).toHaveBeenCalledOnce();
  });
  it('does not replay a dismissed job when motion settings change, but permits a genuinely new job', () => {
    const ui = setup(); fireEvent.click(screen.getByRole('button', { name: 'Dismiss departure' }));
    ui.rerender(<DeepClaimCrewDeparture {...ui.props} reducedMotion />); act(() => vi.advanceTimersByTime(3000));
    expect(ui.props.onDone).toHaveBeenCalledOnce();
    ui.rerender(<DeepClaimCrewDeparture {...ui.props} reducedMotion job={job({ id: 'job-b' })} />); act(() => vi.advanceTimersByTime(900));
    expect(ui.props.onDone).toHaveBeenCalledTimes(2);
  });
  it('removes a departure once an authoritative record is no longer active', () => {
    const ui = setup(); act(() => vi.advanceTimersByTime(400));
    ui.rerender(<DeepClaimCrewDeparture {...ui.props} job={job({ status: 'ready', stage: 'ready' })} />);
    expect(screen.queryByRole('status', { name: 'Crew departure' })).not.toBeInTheDocument();
    expect(ui.props.onDone).toHaveBeenCalledOnce(); act(() => vi.advanceTimersByTime(5000)); expect(ui.props.onDone).toHaveBeenCalledOnce();
  });
});
