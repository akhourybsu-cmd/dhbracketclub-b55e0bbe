import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
