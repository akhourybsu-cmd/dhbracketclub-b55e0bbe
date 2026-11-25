import type { MoveDefinition, MoveId, SpeciesDefinition, SpeciesId } from '../types';

export const MOVES: Record<MoveId, MoveDefinition> = {
  'brine-snap': { id: 'brine-snap', name: 'Brine Snap', affinity: 'Tide', kind: 'attack', power: 10, priority: 0, description: 'A reliable jet of brine. Pushes back unstable resonance.' },
  reedstep: { id: 'reedstep', name: 'Reedstep', affinity: 'Tide', kind: 'evade', power: 0, priority: 5, description: 'A strong chance to evade the next strike. A second hit can still land.' },
  'resonant-cry': { id: 'resonant-cry', name: 'Resonant Cry', affinity: 'Tide', kind: 'calm', power: 0, priority: 1, description: 'Calm a frightened Mesomon, or loosen a demon’s stability.' },
  'tidal-veil': { id: 'tidal-veil', name: 'Tidal Veil', affinity: 'Tide', kind: 'guard', power: 0, priority: 6, description: 'Soften the next hit and wash away Mudbound.' },
  'bank-break': { id: 'bank-break', name: 'Bank Break', affinity: 'Stone', kind: 'attack', power: 11, priority: -1, description: 'A slow, heavy shove of river stone.' },
  'mud-wrap': { id: 'mud-wrap', name: 'Mud Wrap', affinity: 'Stone', kind: 'guard', power: 0, priority: 6, description: 'Settle into a protective bank of mud.' },
  'lantern-dust': { id: 'lantern-dust', name: 'Lantern Dust', affinity: 'Lumen', kind: 'calm', power: 0, priority: 1, description: 'Cool light eases agitation and frays rift energy.' },
  'quick-tackle': { id: 'quick-tackle', name: 'Quick Tackle', affinity: 'Gale', kind: 'attack', power: 8, priority: 2, description: 'A small, precise strike before the current turns.' },
  'splinter-swipe': { id: 'splinter-swipe', name: 'Splinter Swipe', affinity: 'Stone', kind: 'attack', power: 9, priority: 0, description: 'A quick swipe of a rope-strong tail.' },
  'rift-lash': { id: 'rift-lash', name: 'Broken Current', affinity: 'Rift', kind: 'attack', power: 9, priority: 0, description: 'A pulse from the tear. It lands in an uneven rhythm.' },
};

export const SPECIES: Record<SpeciesId, SpeciesDefinition> = {
  rillik: { id: 'rillik', name: 'Rillik', category: 'mesomon', affinities: ['Tide'], description: 'An estuary companion with reed-shaped fins and a sea-glass tail ring. It tests new ground with one paw.', vitality: 48, power: 15, guard: 13, agility: 15, resonance: 19, moves: ['brine-snap', 'reedstep', 'resonant-cry', 'tidal-veil'] },
  muddren: { id: 'muddren', name: 'Muddren', category: 'mesomon', affinities: ['Stone', 'Tide'], description: 'A broad-backed burrower. Its banks hold the marsh together.', vitality: 42, power: 15, guard: 20, agility: 7, resonance: 13, moves: ['bank-break', 'mud-wrap', 'resonant-cry', 'tidal-veil'] },
  gleamwing: { id: 'gleamwing', name: 'Gleamwing', category: 'mesomon', affinities: ['Gale', 'Lumen'], description: 'A dusk moth that gathers at clean lantern glass. Its wing markings carry their own soft light.', vitality: 34, power: 11, guard: 9, agility: 22, resonance: 20, moves: ['quick-tackle', 'lantern-dust', 'reedstep', 'tidal-veil'] },
  tressel: { id: 'tressel', name: 'Tressel', category: 'mesomon', affinities: ['Stone'], description: 'A quay scavenger with a long rope-like tail. It nests among warm timber and keeps what the tide forgets.', vitality: 34, power: 13, guard: 12, agility: 18, resonance: 12, moves: ['splinter-swipe', 'reedstep', 'resonant-cry', 'mud-wrap'] },
  'rift-wretch': { id: 'rift-wretch', name: 'Rift Wretch', category: 'demon', affinities: ['Rift'], description: 'An incomplete shape forced through the second voice. It has no living resonance to bond with.', vitality: 66, power: 18, guard: 13, agility: 12, resonance: 0, moves: ['rift-lash'] },
};

// Deliberately small first-chapter table; omitted pairs are neutral.
export const AFFINITY_MULTIPLIERS: Partial<Record<`${string}:${string}`, number>> = {
  'Tide:Stone': 1.15, 'Lumen:Rift': 1.3, 'Tide:Rift': 1.1, 'Stone:Gale': 0.9,
};
