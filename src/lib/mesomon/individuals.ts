import { AFFINITY_MULTIPLIERS, SPECIES } from './data/species';
import type { IndividualStats, MesomonSaveV1, MoveDefinition, SpeciesId } from './types';

export function newJourneySeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

// Domain-separated 32-bit rolls keep creature identity independent of battle RNG.
export function deriveSeed(seed: number, key: string): number {
  let value = (seed ^ 2166136261) >>> 0;
  for (let i = 0; i < key.length; i++) {
    value = Math.imul(value ^ key.charCodeAt(i), 16777619);
  }
  value = Math.imul(value ^ (value >>> 16), 0x85ebca6b);
  value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
  return (value ^ (value >>> 16)) >>> 0;
}

export function habitatSeed(save: MesomonSaveV1, habitat: string): number {
  // A pre-individuals chapter acquires a reproducible seed on its first new encounter.
  save.journeySeed ??= deriveSeed(save.slot, save.savedAt);
  return deriveSeed(save.journeySeed, habitat);
}

export function statBounds(speciesId: SpeciesId, stat: keyof IndividualStats): readonly [number, number] {
  const species = SPECIES[speciesId];
  const center = stat === 'maxVitality' ? species.vitality : species[stat];
  const spread = species.variation[stat];
  return [center - spread, center + spread];
}

export function individualStats(speciesId: SpeciesId, seed: number): IndividualStats {
  const roll = (stat: keyof IndividualStats) => {
    const [min, max] = statBounds(speciesId, stat);
    const fraction = deriveSeed(seed, `${speciesId}/${stat}`) / 0x100000000;
    return min + Math.floor(fraction * (max - min + 1));
  };
  return {
    maxVitality: roll('maxVitality'), power: roll('power'), guard: roll('guard'),
    agility: roll('agility'), resonance: roll('resonance'),
  };
}

export function strikeDamage(
  move: Pick<MoveDefinition, 'power' | 'affinity'> | undefined,
  attacker: IndividualStats,
  defender: IndividualStats & { speciesId: SpeciesId },
  roll: number,
): number {
  // An unarmed strike is used only when a fighter has no attacking move.
  const power = move?.power ?? 2;
  const affinity = SPECIES[defender.speciesId].affinities[0];
  const multiplier = move ? AFFINITY_MULTIPLIERS[`${move.affinity}:${affinity}`] ?? 1 : 1;
  const strength = power + attacker.power * 0.5 - defender.guard * 0.3;
  return Math.max(2, Math.round(strength * (0.92 + roll * 0.16) * multiplier));
}
