import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeepClaimRewardReceipt, type RewardReceiptData } from '@/components/deepClaim/DeepClaimRewardReceipt';

afterEach(cleanup);
function receipt(reward: RewardReceiptData, options: { reducedMotion?: boolean; nextShiftDisabled?: boolean; next?: boolean } = {}) {
  const onClose = vi.fn(), onNextShift = vi.fn();
  const ui = render(<DeepClaimRewardReceipt reward={reward} onClose={onClose} onNextShift={options.next ? onNextShift : undefined} reducedMotion={options.reducedMotion} nextShiftDisabled={options.nextShiftDisabled} />);
  return { ...ui, onClose, onNextShift };
}

describe('Deep Claim confirmed reward ceremonies', () => {
  it('presents exact moved resources without changing or automatically claiming the receipt', () => {
    const reward: RewardReceiptData = { title: 'Haul secured.', description: 'Cargo added to your warehouse.', resources: { coal: 10, stone: 12, quartz: 0 } };
    const original = structuredClone(reward), ui = receipt(reward);
    const dialog = screen.getByRole('dialog', { name: 'Haul secured.' });
    const list = within(dialog).getByRole('list', { name: 'Materials added to storage' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(list.querySelector('[data-dc-reward-resource="coal"]')).toHaveTextContent('10Coal');
    expect(list.querySelector('[data-dc-reward-resource="stone"]')).toHaveTextContent('12Stone');
    expect(list.querySelector('[data-dc-reward-resource="quartz"]')).toBeNull();
    expect(ui.onClose).not.toHaveBeenCalled(); expect(ui.onNextShift).not.toHaveBeenCalled(); expect(reward).toEqual(original);
  });

  it('keeps untransferred cargo explicit beside the actual transferred amount', () => {
    receipt({ title: 'Haul secured.', description: 'Cargo added to your warehouse.', resources: { copper_ore: 15 }, remaining: 5 });
    expect(screen.getByRole('listitem')).toHaveTextContent('15Copper ore');
    expect(screen.getByRole('status')).toHaveTextContent('5 units remain staged.');
    expect(screen.getByRole('status')).toHaveTextContent('Sell stock or add storage space');
    expect(screen.queryByText('20')).not.toBeInTheDocument();
  });

  it('labels the supplied cash as a company balance rather than an earned or multiplied amount', () => {
    receipt({ title: 'Trade recorded.', description: 'Warehouse and balance updated.', cash: 217 });
    const balance = screen.getByRole('region', { name: 'Company balance' });
    expect(balance).toHaveTextContent('217 company credits');
    expect(balance).not.toHaveTextContent(/\+217|earned|profit|bonus/i);
  });

  it('retains an actual zero balance without substituting a reward', () => {
    receipt({ title: 'Camp updated.', description: 'Company report confirmed.', cash: 0 });
    expect(screen.getByRole('region', { name: 'Company balance' })).toHaveTextContent('0 company credits');
  });

  it('shows actual new equipment identities, tiers and artwork without marking past output as staged', () => {
    receipt({ title: 'Production secured.', description: 'Collected output is now owned by your company.', equipment: [
      { id: 'owned-server-a', key: 'copper_pickaxe', name: 'Copper Pickaxe', tier: 1 },
      { id: 'owned-server-b', key: 'steel_pickaxe', name: 'Steel Pickaxe', tier: 2 },
    ] });
    const gear = screen.getByRole('region', { name: 'Equipment added to company' });
    expect(gear.querySelector('[data-dc-receipt-equipment="owned-server-a"]')).toHaveTextContent('Copper PickaxeTier 1');
    expect(gear.querySelector('[data-dc-receipt-equipment="owned-server-b"]')).toHaveTextContent('Steel PickaxeTier 2');
    expect(gear).toHaveTextContent('Owned equipment'); expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('uses the supplied before/after building levels and confirmed effect instead of assuming a next level', () => {
    const reward: RewardReceiptData = { title: 'Warehouse upgraded.', description: 'Your camp just grew.', buildingChange: { key: 'warehouse', fromLevel: 1, toLevel: 3, effect: '480 resource units of storage' } };
    const original = structuredClone(reward); receipt(reward);
    const change = screen.getByRole('region', { name: 'Confirmed building change' });
    expect(within(change).getByRole('img', { name: 'Warehouse · level 1' })).toHaveAttribute('data-level', '1');
    expect(within(change).getByRole('img', { name: 'Warehouse · level 3' })).toHaveAttribute('data-level', '3');
    expect(change).toHaveAttribute('data-from-level', '1'); expect(change).toHaveAttribute('data-to-level', '3');
    expect(change).toHaveTextContent('480 resource units of storage'); expect(change).not.toHaveTextContent('Level 2'); expect(reward).toEqual(original);
  });

  it('shows an actual unbuilt plot when construction begins from level zero', () => {
    receipt({ title: 'Smeltery built.', description: 'Your camp just grew.', buildingChange: { key: 'smeltery', fromLevel: 0, toLevel: 1, effect: 'Smelt collected ore.' } });
    expect(screen.getByRole('img', { name: 'Smeltery · unbuilt plot' })).toHaveAttribute('data-level', '0');
    expect(screen.getByRole('region', { name: 'Confirmed building change' })).toHaveTextContent('Before Unbuilt');
  });

  it('does not invent a building improvement from an unchanged or invalid level pair', () => {
    receipt({ title: 'Camp updated.', description: 'Company report confirmed.', buildingChange: { key: 'warehouse', fromLevel: 2, toLevel: 2, effect: 'Existing storage.' } });
    expect(screen.queryByRole('region', { name: 'Confirmed building change' })).not.toBeInTheDocument();
    expect(document.querySelector('[data-dc-reward-kind="confirmation"]')).toBeInTheDocument();
  });

  it('keeps closing and planning separate and does neither automatically', () => {
    const ui = receipt({ title: 'Haul secured.', description: 'Cargo added to your warehouse.', resources: { coal: 10 } }, { next: true });
    expect(ui.onClose).not.toHaveBeenCalled(); expect(ui.onNextShift).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Plan next shift' }));
    expect(ui.onNextShift).toHaveBeenCalledOnce(); expect(ui.onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Back to the claim' })); expect(ui.onClose).toHaveBeenCalledOnce();
  });

  it('honors reduced motion and the parent’s next-shift availability without hiding the close control', () => {
    const ui = receipt({ title: 'Haul secured.', description: 'Cargo added to your warehouse.', resources: { coal: 10 } }, { next: true, nextShiftDisabled: true, reducedMotion: true });
    expect(screen.getByRole('dialog')).toHaveClass('is-reduced');
    const next = screen.getByRole('button', { name: 'Plan next shift' }); expect(next).toBeDisabled(); fireEvent.click(next); expect(ui.onNextShift).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Back to the claim' })).toBeEnabled();
    expect(screen.getByRole('listitem')).toHaveTextContent('10Coal');
  });

  it('does not render a materials award from an empty transfer', () => {
    receipt({ title: 'Camp updated.', description: 'No cargo moved. Check your staged haul.', resources: { coal: 0 }, remaining: 10 });
    expect(screen.queryByRole('list', { name: 'Materials added to storage' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('10 units remain staged.');
  });
});
