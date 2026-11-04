import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { DraftBoard } from '@/components/draft/DraftBoard';

afterEach(cleanup);

it('keeps the chosen round when the hidden mobile track emits a layout scroll event', () => {
  const participants = Array.from({ length: 3 }, (_, index) => ({
    user_id: `player-${index}`, pick_order: index + 1, profiles: { display_name: `Player ${index}` },
  }));
  const view = render(<DraftBoard participants={participants} picks={[]} numRounds={10}
    currentPickNumber={19} enrichments={new Map()} newPickIds={new Set()} />);
  const selected = screen.getByRole('tab', { name: 'View round 7, current round' });
  expect(selected).toHaveAttribute('aria-selected', 'true');
  const track = view.container.querySelector('.dl-rounds-track')!;
  Object.defineProperty(track, 'clientWidth', { value: 0 });
  fireEvent.scroll(track);
  expect(selected).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('tab', { name: 'View round 1' })).toHaveAttribute('aria-selected', 'false');
});

it('identifies mobile picks by their full owner name and preserves snake numbering', () => {
  const participants = ['Alex Carter', 'Avery Cole', 'Jordan Hill'].map((display_name, index) => ({
    user_id: `player-${index}`, pick_order: index + 1, profiles: { display_name },
  }));
  const title = 'The Assassination of Jesse James by the Coward Robert Ford';
  render(<DraftBoard participants={participants}
    picks={[{ id: 'pick-4', user_id: 'player-2', pick_text: title, pick_number: 4, round: 2 }]}
    numRounds={2} currentPickNumber={5} enrichments={new Map()} newPickIds={new Set()} />);

  const first = within(screen.getByRole('region', { name: 'Round 1' }));
  // These owners have identical initials, so their names must be visible together with the pick.
  expect(first.getByText('Alex Carter')).toBeVisible();
  expect(first.getByText('Avery Cole')).toBeVisible();
  expect(first.getByLabelText('Pick 1').closest('.dl-mobile-pick-row')).toHaveTextContent('Alex Carter');
  expect(first.getByLabelText('Pick 2').closest('.dl-mobile-pick-row')).toHaveTextContent('Avery Cole');

  const second = within(screen.getByRole('region', { name: 'Round 2' }));
  const reversedFirst = second.getByLabelText('Pick 4').closest('.dl-mobile-pick-row')!;
  expect(reversedFirst).toHaveTextContent('Jordan Hill');
  expect(reversedFirst).toHaveTextContent(title);
  expect(second.getByLabelText('Pick 6').closest('.dl-mobile-pick-row')).toHaveTextContent('Alex Carter');
});

it('shows a passed mobile slot without identifying it as the current pick', () => {
  render(<DraftBoard participants={[{ user_id: 'alex', pick_order: 1, profiles: { display_name: 'Alex Carter' } }]}
    picks={[]} numRounds={2} currentPickNumber={1} skippedSlots={new Set(['1:alex'])}
    enrichments={new Map()} newPickIds={new Set()} />);
  const first = screen.getByRole('region', { name: 'Round 1' });
  expect(within(first).getByText('Passed')).toBeVisible();
  expect(first.querySelector('.dl-cell-current')).toBeNull();
  expect(within(first).getByLabelText('Pick 1')).toBeVisible();
});
