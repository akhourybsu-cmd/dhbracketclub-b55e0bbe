import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { DeepClaimWorksitePicker } from '@/components/deepClaim/DeepClaimWorksitePicker';
import type { DeepClaimPoint } from '@/lib/deepClaim/types';
import { phaseThreeSnapshot } from './fixtures/deepClaimPhase3';

afterEach(cleanup);

const sites: DeepClaimPoint[] = [
  { x: 48, y: 1 }, { x: 48, y: 2 }, { x: 48, y: 3 },
  { x: 48, y: 48 }, { x: 48, y: 49 }, { x: 47, y: 5 }, { x: 0, y: 6 },
];

function pickerData() {
  const data = phaseThreeSnapshot();
  data.world!.tiles = sites.map(point => ({ ...point, terrain: 'stone', material: 'coal', remaining: 10, initial_amount: 10 }));
  return data.world;
}

const shownSites = () => Array.from(screen.getByRole('group', { name: 'Expedition worksite' }).querySelectorAll('[data-dc-worksite]'), button => button.getAttribute('data-dc-worksite'));

it('finds disclosed depths without matching hidden shaft coordinates and retains explicit coordinate searches', () => {
  const onSelect = vi.fn();
  render(<DeepClaimWorksitePicker world={pickerData()} sites={sites} selected={null} mode="extract" disabled={false} onSelect={onSelect} />);
  const search = screen.getByRole('searchbox', { name: 'Depth or material' });

  fireEvent.change(search, { target: { value: '48' } });
  expect(shownSites()).toEqual(['48:48']);
  fireEvent.click(screen.getByRole('button', { name: 'Coal, 48m deep, Main shaft, 10 left' }));
  expect(onSelect).toHaveBeenCalledExactlyOnceWith({ x: 48, y: 48 });

  fireEvent.change(search, { target: { value: '48:49' } });
  expect(shownSites()).toEqual(['48:49']);
  fireEvent.change(search, { target: { value: 'west 1m' } });
  expect(shownSites()).toEqual(['47:5']);
});

it('keeps an active search visible and applied when available sites cross the pagination threshold', () => {
  const world = pickerData(), onSelect = vi.fn();
  const view = render(<DeepClaimWorksitePicker world={world} sites={sites} selected={null} mode="extract" disabled={false} onSelect={onSelect} />);
  fireEvent.change(screen.getByRole('searchbox', { name: 'Depth or material' }), { target: { value: '49m' } });
  expect(shownSites()).toEqual(['48:49']);

  view.rerender(<DeepClaimWorksitePicker world={world} sites={sites.slice(0, 3)} selected={null} mode="extract" disabled={false} onSelect={onSelect} />);
  expect(screen.getByRole('searchbox', { name: 'Depth or material' })).toHaveValue('49m');
  expect(shownSites()).toEqual([]);
  expect(screen.getByRole('status')).toHaveTextContent('No matching sites');

  view.rerender(<DeepClaimWorksitePicker world={world} sites={sites} selected={null} mode="extract" disabled={false} onSelect={onSelect} />);
  expect(shownSites()).toEqual(['48:49']);
  fireEvent.change(screen.getByRole('searchbox', { name: 'Depth or material' }), { target: { value: '' } });
  expect(shownSites()).toEqual(['48:1', '48:2', '48:3', '48:48']);
  expect(onSelect).not.toHaveBeenCalled();
});
