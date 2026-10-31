import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PreDraftCeremony } from '@/components/draft/PreDraftCeremony';

const motion = vi.hoisted(() => ({ reduced: false }));
vi.mock('framer-motion', async (importOriginal) => ({
  ...await importOriginal<typeof import('framer-motion')>(),
  useReducedMotion: () => motion.reduced,
}));

const participants = [
  { user_id: 'b', pick_order: 2, profiles: { display_name: 'Blair' } },
  { user_id: 'a', pick_order: 1, profiles: { display_name: '👩🏽‍🚀 Alex' } },
  { user_id: 'c', pick_order: 3, profiles: { display_name: 'Chris' } },
];
const props = {
  topic: 'The opening night', participants, revealIndex: 0,
  canManage: true, busy: false, onRevealNext: vi.fn(), onBegin: vi.fn(),
};
const current = () => screen.getByRole('status');

beforeEach(() => { vi.clearAllMocks(); motion.reduced = false; });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('Persisted draft order ceremony presentation', () => {
  it('keeps the stored order private until its persisted reveal arrives, without mutating participants', () => {
    const before = structuredClone(participants);
    const view = render(<PreDraftCeremony {...props} />);
    const progress = screen.getByRole('progressbar', { name: 'Draft positions revealed' });
    expect(progress).toHaveAttribute('aria-valuenow', '0');
    expect(progress).toHaveAttribute('aria-valuemax', '3');
    expect(current()).toHaveTextContent('The first pick awaits');
    expect(screen.queryByText('👩🏽‍🚀 Alex')).not.toBeInTheDocument();
    expect(screen.queryByText('Blair')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reveal pick 1' }));
    expect(props.onRevealNext).toHaveBeenCalledOnce();
    expect(progress).toHaveAttribute('aria-valuenow', '0');
    view.rerender(<PreDraftCeremony {...props} revealIndex={1} />);
    expect(current()).toHaveTextContent('#1');
    expect(current()).toHaveTextContent('👩🏽‍🚀 Alex');
    expect(progress).toHaveAttribute('aria-valuenow', '1');
    const rows = within(screen.getByRole('region', { name: 'Draft order lineup' })).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('👩🏽‍🚀 Alex');
    expect(rows[1]).toHaveTextContent('Awaiting reveal');
    expect(participants).toEqual(before);
    expect(props.onBegin).not.toHaveBeenCalled();
  });

  it.each([false, true])('shows the latest controlled position immediately during rapid reveals (projector=%s)', (projector) => {
    const view = render(<PreDraftCeremony {...props} revealIndex={1} projector={projector} />);
    expect(current()).toHaveTextContent('👩🏽‍🚀 Alex');
    view.rerender(<PreDraftCeremony {...props} revealIndex={2} projector={projector} />);
    expect(current()).toHaveTextContent('#2');
    expect(current()).toHaveTextContent('Blair');
    expect(current()).not.toHaveTextContent('👩🏽‍🚀 Alex');
    view.rerender(<PreDraftCeremony {...props} revealIndex={3} projector={projector} />);
    expect(current()).toHaveTextContent('#3');
    expect(current()).toHaveTextContent('Chris');
    expect(current()).not.toHaveTextContent('Blair');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3');
    expect(props.onRevealNext).not.toHaveBeenCalled();
    expect(props.onBegin).not.toHaveBeenCalled();
  });

  it('preserves busy, skip and begin callbacks without advancing anything itself', () => {
    const view = render(<PreDraftCeremony {...props} revealIndex={1} busy />);
    const reveal = screen.getByRole('button', { name: 'Reveal pick 2' });
    const skip = screen.getByRole('button', { name: 'Skip ceremony' });
    expect(reveal).toBeDisabled();
    expect(skip).toBeDisabled();
    fireEvent.click(reveal);
    fireEvent.click(skip);
    expect(props.onRevealNext).not.toHaveBeenCalled();
    expect(props.onBegin).not.toHaveBeenCalled();
    view.rerender(<PreDraftCeremony {...props} revealIndex={1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip ceremony' }));
    expect(props.onBegin).toHaveBeenCalledOnce();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
    view.rerender(<PreDraftCeremony {...props} revealIndex={3} />);
    expect(screen.queryByRole('button', { name: /Reveal pick/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Skip ceremony' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Begin Draft' }));
    expect(props.onBegin).toHaveBeenCalledTimes(2);
    expect(props.onRevealNext).not.toHaveBeenCalled();
  });

  it('keeps a long lineup keyboard reachable while retaining an independent current-position stage', () => {
    const large = Array.from({ length: 20 }, (_, i) => ({ user_id: `p-${i}`, pick_order: i + 1, profiles: { display_name: `Player-${i + 1}-${'界'.repeat(50)}` } })).reverse();
    render(<PreDraftCeremony {...props} participants={large} revealIndex={7} canManage={false} />);
    const lineup = screen.getByRole('region', { name: 'Draft order lineup' });
    expect(lineup).toHaveAttribute('tabindex', '0');
    act(() => lineup.focus());
    expect(lineup).toHaveFocus();
    const rows = within(lineup).getAllByRole('listitem');
    expect(rows).toHaveLength(20);
    expect(rows[19]).toHaveAttribute('data-ceremony-position', '20');
    expect(rows[19]).toHaveTextContent('Awaiting reveal');
    expect(current()).toHaveTextContent('Player-7-');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '7');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('The host controls the reveal.')).toBeVisible();
  });

  it('keeps the projector read-only and never advances the reveal with elapsed time', () => {
    vi.useFakeTimers();
    render(<PreDraftCeremony {...props} projector revealIndex={2} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(30_000));
    expect(current()).toHaveTextContent('#2');
    expect(current()).toHaveTextContent('Blair');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2');
    expect(props.onRevealNext).not.toHaveBeenCalled();
    expect(props.onBegin).not.toHaveBeenCalled();
  });

  it('renders the controlled name immediately without positional travel under reduced motion', () => {
    motion.reduced = true;
    const view = render(<PreDraftCeremony {...props} revealIndex={1} />);
    const stage = current().querySelector('.da-ceremony-current');
    expect(stage).toHaveStyle({ opacity: '1', transform: 'none' });
    view.rerender(<PreDraftCeremony {...props} revealIndex={2} />);
    expect(current()).toHaveTextContent('Blair');
    expect(current().querySelector('.da-ceremony-current')).toHaveStyle({ opacity: '1', transform: 'none' });
  });
});
