import type { MoveDefinition, MoveId, SpeciesDefinition, SpeciesId } from '../types';

export const MOVES: Record<MoveId, MoveDefinition> = {
  'brine-snap': { id: 'brine-snap', name: 'Brine Snap', affinity: 'Tide', kind: 'attack', power: 11, priority: 0, description: 'A narrow jet of brine strikes from a distance.' },
  reedstep: { id: 'reedstep', name: 'Reedstep', affinity: 'Tide', kind: 'evade', power: 0, priority: 5, description: 'Try to slip the first hit. On a clean dodge, a wild opponent calms down.' },
  'resonant-cry': { id: 'resonant-cry', name: 'Resonant Cry', affinity: 'Tide', kind: 'calm', power: 0, priority: 1, description: 'A low call calms a wild Mesomon. Against the Wretch, it drains stability.' },
  'tidal-veil': { id: 'tidal-veil', name: 'Tidal Veil', affinity: 'Tide', kind: 'guard', power: 0, priority: 6, description: 'A sheet of water washes off Mudbound and softens every hit this turn.' },
  'bank-break': { id: 'bank-break', name: 'Bank Break', affinity: 'Stone', kind: 'attack', power: 11, priority: -1, description: 'Drive a ridge of stone under the opponent. It hits hard and usually lands last.' },
  'mud-wrap': { id: 'mud-wrap', name: 'Mud Wrap', affinity: 'Stone', kind: 'guard', power: 0, priority: 6, description: 'Shed Mudbound. A shell of packed mud softens the first hit, then cracks.' },
  'lantern-dust': { id: 'lantern-dust', name: 'Lantern Dust', affinity: 'Lumen', kind: 'calm', power: 0, priority: 1, description: 'Luminous dust calms a wild Mesomon. Against the Wretch, it drains stability.' },
  'quick-tackle': { id: 'quick-tackle', name: 'Quick Tackle', affinity: 'Gale', kind: 'attack', power: 8, priority: 2, description: 'A light hit that lands before ordinary strikes.' },
  'splinter-swipe': { id: 'splinter-swipe', name: 'Splinter Swipe', affinity: 'Stone', kind: 'attack', power: 7, priority: 0, description: 'Uncoil the tail in one sharp sweep.' },
  'rift-lash': { id: 'rift-lash', name: 'Broken Current', affinity: 'Rift', kind: 'attack', power: 1, priority: 0, description: 'The tear sends one pulse on most turns, two on every third turn.' },
};

export const SPECIES: Record<SpeciesId, SpeciesDefinition> = {
  rillik: { id: 'rillik', name: 'Rillik', category: 'mesomon', affinities: ['Tide'], description: 'Rillik tests a new plank with one paw. Flash a brass button and all four paws are across.', vitality: 48, power: 15, guard: 13, agility: 15, resonance: 19, variation: { maxVitality: 4, power: 2, guard: 2, agility: 1, resonance: 2 }, moves: ['brine-snap', 'reedstep', 'resonant-cry', 'tidal-veil'] },
  muddren: { id: 'muddren', name: 'Muddren', category: 'mesomon', affinities: ['Stone', 'Tide'], description: 'Muddren digs into the bank, then backs out and tamps the mud flat. Reeds take root in its tracks.', vitality: 42, power: 15, guard: 20, agility: 7, resonance: 13, variation: { maxVitality: 4, power: 2, guard: 3, agility: 1, resonance: 2 }, moves: ['bank-break', 'mud-wrap', 'resonant-cry', 'tidal-veil'] },
  gleamwing: { id: 'gleamwing', name: 'Gleamwing', category: 'mesomon', affinities: ['Gale', 'Lumen'], description: 'Look for two lights in a lantern after dusk. The smaller one opens its wings and flies away.', vitality: 34, power: 11, guard: 9, agility: 22, resonance: 20, variation: { maxVitality: 3, power: 2, guard: 1, agility: 2, resonance: 3 }, moves: ['quick-tackle', 'lantern-dust', 'reedstep', 'tidal-veil'] },
  tressel: { id: 'tressel', name: 'Tressel', category: 'mesomon', affinities: ['Stone'], description: 'Tressel hooks driftwood with the curl of its tail. Look between the quay timbers for its nest.', vitality: 34, power: 13, guard: 12, agility: 18, resonance: 12, variation: { maxVitality: 3, power: 2, guard: 2, agility: 1, resonance: 1 }, moves: ['splinter-swipe', 'reedstep', 'resonant-cry', 'mud-wrap'] },
  'rift-wretch': { id: 'rift-wretch', name: 'Rift Wretch', category: 'demon', affinities: ['Rift'], description: 'Watch a loose shard. It hangs still between beats, then jerks back into place. The cuff hears only the tear.', vitality: 66, power: 18, guard: 13, agility: 12, resonance: 0, variation: { maxVitality: 4, power: 2, guard: 2, agility: 1, resonance: 0 }, moves: ['rift-lash'] },
};

// Deliberately small first-chapter table; omitted pairs are neutral.
export const AFFINITY_MULTIPLIERS: Partial<Record<`${string}:${string}`, number>> = {
  'Tide:Stone': 1.15, 'Lumen:Rift': 1.3, 'Tide:Rift': 1.1, 'Stone:Gale': 0.9,
};
