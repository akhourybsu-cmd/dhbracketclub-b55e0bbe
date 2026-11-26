import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FieldGuide } from '@/components/mesomon/FieldGuide';
import { makeCompanion, createBattle } from '@/lib/mesomon/battle';
import { createNewSave } from '@/lib/mesomon/engine';
import { fieldGuideEntries } from '@/lib/mesomon/fieldGuide';
import { fieldPlateUrl } from '@/lib/mesomon/assets';

afterEach(cleanup);

describe('Port Marche Field Guide', () => {
  it('keeps undiscovered names, species descriptions and image URLs out of the page', () => {
    const { container } = render(<FieldGuide save={createNewSave()} />);
    expect(screen.getByText('0 / 5 seen')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'No sightings yet' })).toBeVisible();
    expect(screen.getByRole('list', {name: 'Field plates'}).children).toHaveLength(5);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(container.querySelector('img')).toBeNull();
    expect(container.innerHTML).not.toMatch(/rillik|muddren|tressel|gleamwing|rift-wretch/i);
  });

  it('keeps sightings after leaving a wild encounter, independently of bonding', () => {
    const save = createNewSave();
    save.questFlags['visited:gleamwing'] = true;
    const member = makeCompanion('rillik');
    save.collection[member.id] = member;
    render(<FieldGuide save={save} />);
    expect(screen.getByText('2 / 5 seen')).toBeVisible();
    const rillik = screen.getByRole('figure', {name: 'Rillik'});
    expect(within(rillik).getByText('Bonded')).toBeVisible();
    expect(within(rillik).getByRole('img', {name: 'Rillik'})).toHaveAttribute('src', fieldPlateUrl('rillik'));
    const next = screen.getByRole('button', {name: 'View Gleamwing'});
    fireEvent.click(next);
    expect(next).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('figure', {name: 'Rillik'})).toBeNull();
    const gleamwing = screen.getByRole('figure', {name: 'Gleamwing'});
    expect(within(gleamwing).getByRole('img', {name: 'Gleamwing'})).toHaveAttribute('src', fieldPlateUrl('gleamwing'));
    expect(within(gleamwing).getByText('Lantern alcove')).toBeVisible();
    expect(within(gleamwing).queryByText('Bonded')).toBeNull();
    expect(screen.queryByRole('button', {name: 'View Tressel'})).toBeNull();
    next.focus();
    fireEvent.keyDown(next, {key: 'ArrowRight'});
    const first = screen.getByRole('button', {name: 'View Rillik'});
    expect(first).toHaveFocus();
    expect(first).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('figure', {name: 'Rillik'})).toBeVisible();
    fireEvent.keyDown(first, {key: 'End'});
    expect(next).toHaveFocus();
    expect(next).toHaveAttribute('aria-pressed', 'true');
  });

  it('recognizes earlier chapters’ saved encounters without recording sightings just from story progress', () => {
    const save = createNewSave();
    save.questFlags = { clues_complete: true, currents_followed: true, page_found: true };
    expect(fieldGuideEntries(save).filter(entry => entry.seen)).toHaveLength(0);
    save.questFlags = { rillik_bonded: true, 'visited:fisher': true, tutorial_complete: true, gleamwing_complete: true, boss_introduced: true };
    const entries = fieldGuideEntries(save);
    expect(entries.filter(entry => entry.seen).map(entry => entry.species)).toEqual(['rillik', 'muddren', 'tressel', 'gleamwing', 'rift-wretch']);
  });

  it('reveals an opponent during battle and identifies the Rift Wretch as a demon', () => {
    const save = createNewSave();
    const member = makeCompanion('rillik');
    save.collection[member.id] = member;
    save.battle = createBattle([member], 'rift-wretch', 'chamber-boss');
    render(<FieldGuide save={save} />);
    fireEvent.click(screen.getByRole('button', {name: 'View Rift Wretch'}));
    const wretch = screen.getByRole('figure', {name: 'Rift Wretch'});
    expect(within(wretch).getByText('Demon')).toBeVisible();
    expect(within(wretch).queryByText('Bonded')).toBeNull();
  });
});
