import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LocationChart } from '@/components/mesomon/LocationChart';
import { MAPS } from '@/lib/mesomon/data/maps';
import { createNewSave } from '@/lib/mesomon/engine';
import type { MapId } from '@/lib/mesomon/types';

afterEach(cleanup);

function at(mapId: MapId) {
  const save = createNewSave();
  save.player = { ...save.player, mapId, ...MAPS[mapId].spawn };
  return save;
}

describe('Port Marche pocket charts', () => {
  it.each(Object.values(MAPS))('engraves $id in its own logical coordinates with an accessible bearing', map => {
    const save = at(map.id);
    save.player.facing = 'left';
    render(<LocationChart save={save} />);
    const chart = screen.getByRole('img', { name: map.name + ' walking chart' });
    expect(chart).toHaveAttribute('viewBox', `0 0 ${map.width} ${map.height}`);
    expect(chart).toHaveAccessibleDescription(/You are facing west/);
    expect(chart.querySelector('[data-survey]')).toHaveAttribute('data-survey', map.id);
    expect(chart.querySelector('.meso-chart-position')).toHaveAttribute('transform', expect.stringContaining('rotate(270)'));
  });

  it('shows the quay exits as they open and keeps the next stop marked once', () => {
    const save = at('harbor');
    save.questFlags = { captain_met: true, disembarked: true, nia_met: true };
    const view = render(<LocationChart save={save} />);
    const chart = screen.getByRole('img');
    expect(chart).toHaveAccessibleDescription(/Next stop: Edda’s workshop\. Open exits: Edda’s workshop\./);
    expect(chart).not.toHaveAccessibleDescription(/Old tide stairs/);
    expect(chart.querySelectorAll('[data-exit]')).toHaveLength(0);
    expect(chart.querySelectorAll('.meso-chart-stop')).toHaveLength(1);
    view.rerender(<LocationChart save={{ ...save, questFlags: { ...save.questFlags, bram_met: true } }} />);
    expect(chart).toHaveAccessibleDescription(/Open exits: Edda’s workshop, Old tide stairs/);
    expect(chart.querySelector('[data-exit="tide-door"]')).toBeInTheDocument();
    expect(screen.getByText('Open exit')).toBeVisible();
  });

  it('prints the same flooded or drained crossing that the walking route uses', () => {
    const save = at('passage');
    const view = render(<LocationChart save={save} />);
    const chart = screen.getByRole('img');
    expect(chart.querySelector('[data-crossing="flooded"]')).toBeInTheDocument();
    expect(chart).not.toHaveAccessibleDescription(/Old tide chamber/);
    view.rerender(<LocationChart save={{ ...save, questFlags: { sluice_open: true, tutorial_complete: true, currents_followed: true } }} />);
    expect(chart.querySelector('[data-crossing="drained"]')).toBeInTheDocument();
    expect(chart.querySelector('[data-crossing="flooded"]')).not.toBeInTheDocument();
    expect(chart).toHaveAccessibleDescription(/Old tide chamber/);
  });
});
