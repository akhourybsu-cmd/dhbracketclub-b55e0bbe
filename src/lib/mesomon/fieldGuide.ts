import type { MesomonSaveV1, SpeciesId } from './types';

interface FieldSite {
  species: SpeciesId;
  site: string;
  sightings: readonly string[];
}

// The plate numbers follow the route from the tide stairs to the rift. Old
// files already record these visits, including encounters the player left.
const fieldSites: readonly FieldSite[] = [
  { species: 'rillik', site: 'Old tide stairs', sightings: ['visited:rillik-bond', 'rillik_bonded'] },
  { species: 'muddren', site: 'Lower quay', sightings: ['visited:fisher', 'wrong_catch'] },
  { species: 'tressel', site: 'Under-wharf crossing', sightings: ['visited:tressel', 'tutorial_complete'] },
  { species: 'gleamwing', site: 'Lantern alcove', sightings: ['visited:gleamwing', 'gleamwing_complete'] },
  { species: 'rift-wretch', site: 'Rift chamber', sightings: ['visited:rift', 'boss_introduced', 'boss_defeated', 'rift_sealed'] },
];

export function fieldGuideEntries(save: MesomonSaveV1) {
  const bonded = new Set<SpeciesId>(Object.values(save.collection).map(member => member.speciesId));
  return fieldSites.map(({species, site, sightings}, index) => ({
    species, site, number: index + 1,
    bonded: bonded.has(species),
    seen: bonded.has(species) || save.battle?.enemy.speciesId === species ||
      sightings.some(flag => save.questFlags[flag] === true),
  }));
}
