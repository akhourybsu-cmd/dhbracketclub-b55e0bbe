import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeepClaimFieldLog } from '@/components/deepClaim/DeepClaimField';
import type { DeepClaimDiscovery, DeepClaimSnapshot } from '@/lib/deepClaim/types';
import { phaseThreeSnapshot } from './fixtures/deepClaimPhase3';

afterEach(cleanup);
const noop = () => {};
function savedFind(status: DeepClaimDiscovery['status'] = 'pending') {
  const snapshot = phaseThreeSnapshot();
  snapshot.discoveries = [{ id: 'find-a', job_id: 'job-a', x: 47, y: 3, kind: 'banded_geode', name: 'Banded Geode', quality: 'fine',
    detail: 'Pale quartz bands run through the stone.', sale_value: 42, salvage: { quartz: 2 }, status,
    discovered_at: snapshot.server_now, resolved_at: status === 'pending' ? null : snapshot.server_now }];
  snapshot.discovery_summary = { pending: Number(status === 'pending'), kept: Number(status === 'kept'), sold: Number(status === 'sold'), salvaged: Number(status === 'salvaged') };
  return snapshot;
}
function Review({ snapshot, resolve = vi.fn().mockResolvedValue(snapshot), readOnly = false }: {
  snapshot: DeepClaimSnapshot; resolve?: (id: string, choice: 'keep' | 'sell' | 'salvage', revision?: number) => Promise<DeepClaimSnapshot>; readOnly?: boolean;
}) {
  const [selection, setSelection] = useState<string | null>('find-a');
  return <DeepClaimFieldLog snapshot={snapshot} view="finds" onView={noop} selectedFindId={selection} onSelectFind={setSelection}
    onLocate={noop} resolveDiscovery={resolve} readOnly={readOnly} busy={false} onConfirmed={noop} />;
}

describe('Deep Claim discovery decisions stay reachable and deliberate', () => {
  it('puts Back and disabled initial confirmation outside the scroll body, without resolving anything', () => {
    const resolve = vi.fn(); render(<Review snapshot={savedFind()} resolve={resolve} />);
    const body = screen.getByRole('region', { name: 'Banded Geode details' });
    const back = screen.getByRole('button', { name: 'Back to finds' });
    const confirm = screen.getByRole('button', { name: 'Confirm decision' });
    expect(confirm).toBeDisabled(); expect(body).not.toContainElement(confirm); expect(body).not.toContainElement(back);
    expect(back.closest('.dcl-dialog-fixed-footer')).toContainElement(confirm);
    fireEvent.click(confirm); expect(resolve).not.toHaveBeenCalled();
  });

  it.each([
    ['Keep in cabinet', 'Confirm keep', 'keep'], ['Sell specimen', 'Confirm sale', 'sell'], ['Salvage materials', 'Confirm salvage', 'salvage'],
  ] as const)('reviews %s and submits only its explicit final confirmation', async (label, confirmLabel, choice) => {
    const snapshot = savedFind(), resolve = vi.fn().mockResolvedValue(snapshot);
    render(<Review snapshot={snapshot} resolve={resolve} />);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${label}`) }));
    expect(screen.getByRole('region', { name: 'Reviewed find decision' })).toHaveTextContent('This decision is final.');
    const footer = screen.getByRole('group', { name: 'Transaction summary' }); expect(footer).toHaveTextContent('Final choice');
    expect(resolve).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: confirmLabel })); });
    expect(resolve).toHaveBeenCalledExactlyOnceWith('find-a', choice, snapshot.revision);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('cancels back to the collection and reopens with an unreviewed decision', () => {
    const resolve = vi.fn(); render(<Review snapshot={savedFind()} resolve={resolve} />);
    fireEvent.click(screen.getByRole('button', { name: /^Sell specimen/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Back to finds' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(resolve).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Inspect Banded Geode' }));
    expect(screen.getByRole('button', { name: 'Confirm decision' })).toBeDisabled();
    expect(screen.queryByRole('region', { name: 'Reviewed find decision' })).not.toBeInTheDocument();
  });

  it('keeps changed company and salvage space blockers next to the disabled footer action', () => {
    const snapshot = savedFind(), resolve = vi.fn(); snapshot.company!.warehouse_used = snapshot.company!.warehouse_capacity - 1;
    const page = render(<Review snapshot={snapshot} resolve={resolve} />);
    fireEvent.click(screen.getByRole('button', { name: /^Salvage materials/ }));
    expect(screen.getByRole('group', { name: 'Transaction summary' })).toHaveTextContent('Needs 2 units · 1 free');
    expect(screen.getByRole('button', { name: 'Confirm salvage' })).toBeDisabled();
    page.rerender(<Review snapshot={{ ...snapshot, revision: snapshot.revision + 1, company: { ...snapshot.company!, warehouse_used: 0 } }} resolve={resolve} />);
    expect(screen.getByRole('group', { name: 'Transaction summary' })).toHaveTextContent('Company changed. Choose again.');
    expect(screen.getByRole('button', { name: 'Confirm salvage' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /^Salvage materials/ }));
    expect(screen.getByRole('button', { name: 'Confirm salvage' })).toBeEnabled(); expect(resolve).not.toHaveBeenCalled();
  });

  it('locks Back while a decision is in flight, then restores the reviewed retry after failure', async () => {
    let reject!: (error: Error) => void;
    const resolve = vi.fn(() => new Promise<DeepClaimSnapshot>((_done, fail) => { reject = fail; }));
    render(<Review snapshot={savedFind()} resolve={resolve} />);
    fireEvent.click(screen.getByRole('button', { name: /^Keep in cabinet/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm keep' }));
    const back = screen.getByRole('button', { name: 'Back to finds' }); expect(back).toBeDisabled(); fireEvent.click(back);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await act(async () => reject(new Error('Connection interrupted.')));
    expect(screen.getByRole('group', { name: 'Transaction summary' })).toHaveTextContent('Not confirmed. Try again.');
    expect(back).toBeEnabled(); expect(screen.getByRole('button', { name: 'Confirm keep' })).toBeEnabled();
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it('lets a preserved specimen close without offering another decision', () => {
    render(<Review snapshot={savedFind('kept')} />);
    expect(screen.getByRole('button', { name: 'Back to finds' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /^Confirm/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Find decision' })).not.toBeInTheDocument();
  });
});

