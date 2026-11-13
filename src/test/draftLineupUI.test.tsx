import { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SlotPicker } from '@/components/draft/lineup/SlotPicker';
import { LineupRoster } from '@/components/draft/lineup/LineupRoster';
import { MakePickSheet, PickComposerFields } from '@/components/draft/MakePickSheet';
import { createLineupConfig } from '@/lib/draft/lineup';
import type { LineupPick } from '@/hooks/useLineupDraft';

vi.mock('@/components/draft/PersonalDraftDesk', () => ({
  PersonalDraftDesk: ({ onChoose }: { onChoose?: (text: string) => void }) => <section>Saved ideas
    {onChoose && <button type="button" onClick={() => onChoose('Waffles')}>Choose desk idea</button>}
  </section>,
}));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const coffee: LineupPick = {
  id: 'coffee', draft_id: 'breakfast', user_id: 'alice', pick_text: 'Iced Coffee', pick_number: 5,
  round: 3, picked_at: '2026-11-12T12:00:00Z', lineup_slot_id: 'drink',
};

describe('Choosing a lineup slot', () => {
  it('exposes focusable native choices and prevents choosing an occupied role', () => {
    const select = vi.fn();
    function Harness() {
      const [selected, setSelected] = useState('');
      return <SlotPicker config={createLineupConfig('breakfast')} picks={[coffee]} selected={selected}
        onSelect={value => { setSelected(value); select(value); }} />;
    }
    render(<Harness />);
    const filled = screen.getByRole('button', { name: 'Drink, filled' });
    expect(filled).toBeDisabled();
    fireEvent.click(filled);
    expect(select).not.toHaveBeenCalled();
    const dessert = screen.getByRole('button', { name: 'Dessert' });
    expect(dessert.tagName).toBe('BUTTON');
    expect(dessert).toHaveAttribute('type', 'button');
    dessert.focus();
    expect(dessert).toHaveFocus();
    fireEvent.click(dessert, { detail: 0 });
    expect(dessert).toHaveAttribute('aria-pressed', 'true');
    expect(select).toHaveBeenCalledExactlyOnceWith('sweet');
    expect(screen.getByRole('button', { name: 'Entrée' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('locks every slot while a confirmed pick is being sent', () => {
    const select = vi.fn();
    render(<SlotPicker config={createLineupConfig('breakfast')} picks={[]} selected="side" onSelect={select} disabled />);
    for (const button of screen.getAllByRole('button')) { expect(button).toBeDisabled(); fireEvent.click(button); }
    expect(select).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Side' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('Saved lineup presentation', () => {
  it('puts the pick in its assigned role rather than its selection round, and keeps the other roles usable', () => {
    const choose = vi.fn(), edit = vi.fn();
    render(<LineupRoster config={createLineupConfig('breakfast')} picks={[coffee]} name="Your" artwork={new Map()}
      canChoose onChooseSlot={choose} onEditPick={edit} />);
    const roster = screen.getByRole('region', { name: 'Your lineup' });
    expect(within(roster).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
    expect(within(roster).getByRole('progressbar')).toHaveAttribute('aria-valuemax', '4');
    const drink = within(roster).getByRole('heading', { name: 'Drink' }).closest('li')!;
    expect(within(drink).getByText('Iced Coffee')).toBeVisible();
    expect(within(drink).getByText('Pick #5')).toBeVisible();
    expect(within(drink).getByRole('img', { name: 'Artwork unavailable for Iced Coffee' })).toBeVisible();
    expect(within(drink).queryByRole('button', { name: /draft/i })).toBeNull();
    fireEvent.click(within(roster).getByRole('button', { name: 'Draft Dessert' }));
    expect(choose).toHaveBeenCalledExactlyOnceWith('sweet');
    fireEvent.click(within(drink).getByRole('button', { name: 'Edit Iced Coffee' }));
    expect(edit).toHaveBeenCalledExactlyOnceWith(coffee);
  });

  it('shows the saved role score and explanation while read-only slots cannot start a pick', () => {
    const choose = vi.fn();
    const explanation = 'Merit 8.0/10 · Role fit 9.0/10 (60/40). A strong breakfast drink.';
    render(<LineupRoster config={createLineupConfig('breakfast')} picks={[coffee]} name="Alice" artwork={new Map()}
      onChooseSlot={choose} ratings={new Map([['coffee', { score: 8.4, explanation }]])} />);
    expect(screen.getByText('8.4')).toBeVisible();
    expect(screen.getByText(explanation)).toBeVisible();
    const openSlot = screen.getByRole('button', { name: 'Draft Entrée' });
    expect(openSlot).toBeDisabled();
    fireEvent.click(openSlot);
    expect(choose).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Edit Iced Coffee' })).toBeNull();
  });
});

describe('Slot-aware pick submission', () => {
  const base = {
    pickText: 'Pancakes', onTextChange: vi.fn(), submitting: false, localDuplicate: false,
    suggestion: null, onApplyCorrection: vi.fn(), onDismissSuggestion: vi.fn(), topic: 'Breakfast',
  };
  it('blocks both Enter and the send button until the parent confirms an available selected slot', () => {
    const submit = vi.fn();
    const view = render(<PickComposerFields {...base} onSubmit={submit} canSubmit={false}
      slotPicker={<span>Choose an available role</span>} />);
    const input = screen.getByRole('textbox', { name: 'Your draft pick' });
    const send = screen.getByRole('button', { name: 'Submit pick' });
    expect(screen.getByText('Choose an available role')).toBeVisible();
    expect(send).toBeDisabled();
    fireEvent.click(send);
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 13 });
    expect(submit).not.toHaveBeenCalled();
    view.rerender(<PickComposerFields {...base} onSubmit={submit} canSubmit slotPicker={<span>Entrée selected</span>} />);
    expect(input).toHaveValue('Pancakes');
    expect(send).toBeEnabled();
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 13 });
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('retains the classic composer behavior when no slot controls are supplied', () => {
    const submit = vi.fn();
    render(<PickComposerFields {...base} onSubmit={submit} />);
    expect(screen.getByRole('button', { name: 'Submit pick' })).toBeEnabled();
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Your draft pick' }), { key: 'Enter', keyCode: 13 });
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('keeps an unconfirmed pick immutable through the input and saved-idea controls until recovery finishes', () => {
    const change = vi.fn(), submit = vi.fn();
    const sheet = {
      ...base, open: true, onClose: vi.fn(), currentRound: 2, currentPickNumber: 5,
      onTextChange: change, onSubmit: submit,
    };
    const view = render(<MakePickSheet {...sheet} readOnly canSubmit={false} />);
    const input = screen.getByRole('textbox', { name: 'Your draft pick' });
    expect(input).toHaveProperty('readOnly', true);
    expect(input).toHaveValue('Pancakes');
    expect(screen.queryByRole('button', { name: 'Choose desk idea' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Submit pick' })).toBeDisabled();
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 13 });
    expect(submit).not.toHaveBeenCalled();
    expect(change).not.toHaveBeenCalled();

    view.rerender(<MakePickSheet {...sheet} readOnly={false} canSubmit />);
    expect(input).toHaveProperty('readOnly', false);
    expect(input).toHaveValue('Pancakes');
    fireEvent.click(screen.getByRole('button', { name: 'Choose desk idea' }));
    expect(change).toHaveBeenCalledExactlyOnceWith('Waffles');
  });
});
