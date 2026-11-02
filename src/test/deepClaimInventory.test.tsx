import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeepClaimStores } from '@/components/deepClaim/DeepClaimInventory';
import { phaseTwoSnapshot } from './fixtures/deepClaimPhase2';
import { resourceCatalogForSchema } from '@/lib/deepClaim/catalog';
import type { DeepClaimExpedition } from '@/lib/deepClaim/types';

afterEach(cleanup);

describe('Deep Claim warehouse inventory', () => {
  it('pages the catalog without hiding available materials and bounds pages when stock changes', () => {
    const snapshot = phaseTwoSnapshot();
    const sell = vi.fn();
    const view = render(<DeepClaimStores snapshot={snapshot} readOnly={false} busy={false} onSell={sell} />);
    const resources = resourceCatalogForSchema(snapshot.schema_version);
    const seen = new Set<string>();
    for (let page = 0; page < resources.length; page++) {
      const slots = screen.getAllByRole('button', { name: /^Inspect / });
      expect(slots.length).toBeLessThanOrEqual(6);
      for (const slot of slots) seen.add(slot.getAttribute('aria-label')!);
      if ((screen.getByRole('button', { name: 'Next materials' }) as HTMLButtonElement).disabled) break;
      fireEvent.click(screen.getByRole('button', { name: 'Next materials' }));
    }
    expect(seen.size).toBe(resources.length);
    expect(screen.getByRole('button', { name: 'Next materials' })).toBeDisabled();
    snapshot.resources = { coal: 3 };
    view.rerender(<DeepClaimStores snapshot={snapshot} readOnly={false} busy={false} onSell={sell} inStockOnly />);
    expect(screen.getAllByRole('button', { name: /^Inspect / })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Inspect Coal' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous materials' })).toBeDisabled();
    expect(sell).not.toHaveBeenCalled();
  });

  it('filters by material identity, keeps empty entries inspectable, and never offers a zero-stock sale', () => {
    const snapshot = phaseTwoSnapshot();
    const sell = vi.fn();
    render(<DeepClaimStores snapshot={snapshot} readOnly={false} busy={false} onSell={sell} />);
    fireEvent.click(screen.getByRole('button', { name: /^Crystals/ }));
    expect(screen.getByRole('button', { name: 'Inspect Amethyst' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Inspect Coal' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Inspect Cut amethyst' }));
    const detail = screen.getByRole('dialog', { name: 'Cut amethyst' });
    expect(within(detail).getByRole('button', { name: 'Sell Cut amethyst' })).toBeDisabled();
    expect(detail).toHaveTextContent('No collected stock');
    expect(sell).not.toHaveBeenCalled();
  });

  it('shows actual stock, current value and recipe uses while preserving the existing sale review', () => {
    const snapshot = phaseTwoSnapshot();
    snapshot.resources = { coal: 7 };
    const sell = vi.fn();
    render(<DeepClaimStores snapshot={snapshot} readOnly={false} busy={false} onSell={sell} inStockOnly />);
    fireEvent.click(screen.getByRole('button', { name: 'Inspect Coal' }));
    const detail = screen.getByRole('dialog', { name: 'Coal' });
    const scrollableDetails = within(detail).getByRole('region', { name: 'Coal details' });
    scrollableDetails.focus();
    expect(scrollableDetails).toHaveFocus();
    expect(detail).toHaveTextContent('7 in storage');
    expect(detail).toHaveTextContent('4 cr / unit');
    expect(detail).toHaveTextContent('28 cr');
    expect(within(detail).getByRole('region', { name: 'Used in production' })).toHaveTextContent('Smelt Copper');
    expect(sell).not.toHaveBeenCalled();
    fireEvent.click(within(detail).getByRole('button', { name: 'Sell Coal' }));
    expect(sell).toHaveBeenCalledOnce();
    expect(sell).toHaveBeenCalledWith('coal');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it.each([{ readOnly: true, busy: false }, { readOnly: false, busy: true }])('blocks sale controls for protected state %j', state => {
    const snapshot = phaseTwoSnapshot();
    snapshot.resources = { coal: 2 };
    const sell = vi.fn();
    render(<DeepClaimStores snapshot={snapshot} {...state} onSell={sell} inStockOnly />);
    expect(screen.getByRole('button', { name: 'Sell Coal' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Inspect Coal' }));
    const detail = screen.getByRole('dialog', { name: 'Coal' });
    expect(within(detail).getByRole('button', { name: 'Sell Coal' })).toBeDisabled();
    fireEvent.click(within(detail).getByRole('button', { name: 'Sell Coal' }));
    expect(sell).not.toHaveBeenCalled();
  });

  it('keeps pending hauls actionable and reports confirmed warehouse capacity without manufacturing resources', () => {
    const snapshot = phaseTwoSnapshot();
    snapshot.resources = {};
    snapshot.company!.warehouse_used = snapshot.company!.warehouse_capacity;
    const haul = { id: 'staged-cargo', target: { x: 48, y: 36 } } as DeepClaimExpedition;
    const open = vi.fn();
    render(<DeepClaimStores snapshot={snapshot} readOnly={false} busy={false} onSell={vi.fn()} readyHauls={[haul]} onOpenHaul={open} inStockOnly />);
    expect(screen.getByRole('progressbar', { name: 'Warehouse capacity' })).toHaveAttribute('aria-valuenow', String(snapshot.company!.warehouse_capacity));
    expect(screen.getByText('Full')).toBeInTheDocument();
    expect(screen.getByText('Your stores are clear.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open haul from 36m' }));
    expect(open).toHaveBeenCalledWith('staged-cargo');
    expect(snapshot.resources).toEqual({});
  });
});
