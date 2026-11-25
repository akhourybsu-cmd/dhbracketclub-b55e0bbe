import { AFFINITY_MULTIPLIERS, MOVES, SPECIES } from './data/species';
import type { BattleAction, BattleState, BondedMesomon, Fighter, SpeciesId } from './types';

export function makeCompanion(speciesId: Exclude<SpeciesId, 'rift-wretch'>, id = `${speciesId}-bond`): BondedMesomon {
  const species = SPECIES[speciesId];
  return { id, speciesId, level: 5, vitality: species.vitality, maxVitality: species.vitality, experience: 0, moves: [...species.moves] };
}

function fighter(speciesId: SpeciesId, id: string, vitality?: number): Fighter {
  const species = SPECIES[speciesId];
  return { id, speciesId, vitality: vitality ?? species.vitality, maxVitality: species.vitality, power: species.power, guard: species.guard, agility: species.agility, resonance: species.resonance, moves: [...species.moves] };
}

export function createBattle(party: BondedMesomon[], enemySpecies: SpeciesId, id: BattleState['id'] = 'passage-encounter', seed = 729431): BattleState {
  const allies = party.map(member => ({ ...fighter(member.speciesId, member.id, member.vitality), maxVitality: member.maxVitality, moves: [...member.moves] }));
  return { id, allies, activeIndex: Math.max(0, allies.findIndex(member => member.vitality > 0)), enemy: fighter(enemySpecies, `${id}-wild`), agitation: enemySpecies === 'gleamwing' ? 48 : 68, stability: enemySpecies === 'rift-wretch' ? 64 : 0, maxStability: enemySpecies === 'rift-wretch' ? 64 : 0, frenzy: false, seed: seed >>> 0, turn: 0, guarded: false, evasion: false, mudbound: 0, phase: 'choosing', log: [enemySpecies === 'rift-wretch' ? 'Its edges will not stay still. Break its stability; then seal the tear.' : `${SPECIES[enemySpecies].name} is frightened. A quieter voice may help.`], usedTinctures: 0 };
}

export function resonanceEligibility(battle: BattleState, emptyBuds = 1, storyAllowed = true): { eligible: boolean; reason: string } {
  if (SPECIES[battle.enemy.speciesId].category === 'demon') return { eligible: false, reason: 'Rift-born. There is no living pattern to bond with.' };
  if (battle.phase !== 'choosing') return { eligible: false, reason: 'This encounter has ended.' };
  if (!storyAllowed) return { eligible: false, reason: 'Give it a little room first.' };
  if (battle.frenzy) return { eligible: false, reason: 'The rift is still drowning out its own voice.' };
  if (emptyBuds < 1) return { eligible: false, reason: 'No empty crystal bud. Your existing bonds are safe.' };
  if (battle.allies.length >= 3) return { eligible: false, reason: 'Your three resting crystals are occupied.' };
  const tired = battle.enemy.vitality <= Math.ceil(battle.enemy.maxVitality * 0.35);
  // Vitality alone is never consent. Even a tired creature must have stopped
  // pulling away; Cry is the gentle, reliable route through that threshold.
  if (battle.agitation > 28 && !(tired && battle.agitation <= 44)) return { eligible: false, reason: tired ? 'Tired, but still pulling away. Try Resonant Cry.' : 'Still frightened. Try Resonant Cry before offering a bond.' };
  return { eligible: true, reason: 'It has stopped pulling away. Offer a bond; let it choose.' };
}

function random(state: BattleState): number {
  let value = state.seed || 729431;
  value ^= value << 13; value ^= value >>> 17; value ^= value << 5;
  state.seed = value >>> 0;
  return state.seed / 4294967296;
}

export function resolveBattleTurn(previous: BattleState, action: BattleAction, options: { tinctures?: number; emptyBuds?: number; storyAllowed?: boolean } = {}): BattleState {
  if (previous.phase !== 'choosing') return previous;
  const battle: BattleState = { ...previous, allies: previous.allies.map(member => ({ ...member, moves: [...member.moves] })), enemy: { ...previous.enemy, moves: [...previous.enemy.moves] }, log: [], guarded: false, evasion: false };
  const active = battle.allies[battle.activeIndex];
  const append = (line: string) => { battle.log.push(line); };
  if (!active) return { ...battle, phase: 'lost', log: ['No companion can continue. Return to the tide stairs.'] };
  if (action.type === 'move' && (!active.moves.includes(action.moveId) || !MOVES[action.moveId])) return previous;
  if (action.type === 'switch' && (!battle.allies[action.index] || action.index === battle.activeIndex || battle.allies[action.index].vitality <= 0)) return previous;
  if (action.type === 'item' && ((options.tinctures ?? 0) < 1 || active.vitality >= active.maxVitality)) return { ...previous, log: [(options.tinctures ?? 0) < 1 ? 'No tinctures left.' : 'Already rested. Keep the tincture.'] };
  if (action.type === 'resonate') {
    const eligibility = resonanceEligibility(battle, options.emptyBuds ?? 1, options.storyAllowed ?? true);
    if (!eligibility.eligible) return { ...previous, log: [eligibility.reason] };
    return { ...battle, phase: 'resonated', turn: battle.turn + 1, log: [`${SPECIES[battle.enemy.speciesId].name} steps closer. Tavian holds still.`, 'A small crystal forms. This bond was offered, and answered.'] };
  }
  if (action.type === 'flee') {
    if (battle.enemy.speciesId === 'rift-wretch') return { ...previous, log: ['The passage behind you is clear. Guard, heal, or try again after a setback.'] };
    return { ...battle, phase: 'escaped', log: ['Tavian gives the creature room. The way remains open.'] };
  }
  battle.turn++;
  battle.mudbound = Math.max(0, battle.mudbound - 1);
  const playerPriority = action.type === 'switch' ? 8 : action.type === 'item' ? 7 : action.type === 'guard' ? 6 : action.type === 'move' ? MOVES[action.moveId].priority : 0;
  const playerFirst = playerPriority > 0 || (playerPriority === 0 && active.agility - (battle.mudbound ? 6 : 0) >= battle.enemy.agility);
  const endCheck = () => {
    const pushedBack = battle.enemy.speciesId === 'rift-wretch' ? battle.stability <= 0 : battle.enemy.vitality <= 0;
    if (pushedBack) {
      battle.phase = 'won'; append(battle.enemy.speciesId === 'rift-wretch' ? 'The Wretch loses its hold. The rift is still open.' : 'The frightened creature backs into a safe gap. The passage is clear.'); return true;
    }
    if (battle.allies.every(member => member.vitality <= 0)) { battle.phase = 'lost'; append('Rillik nudges the cuff. Time to pull back, not push harder.'); return true; }
    const current = battle.allies[battle.activeIndex];
    if (current.vitality <= 0) { battle.activeIndex = battle.allies.findIndex(member => member.vitality > 0); append(`${SPECIES[battle.allies[battle.activeIndex].speciesId].name} steps forward.`); }
    return false;
  };
  const playerTurn = () => {
    const member = battle.allies[battle.activeIndex];
    if (action.type === 'switch') { battle.activeIndex = action.index; append(`${SPECIES[battle.allies[action.index].speciesId].name}, with me.`); return; }
    if (action.type === 'item') { const restored = Math.min(26, member.maxVitality - member.vitality); member.vitality += restored; battle.usedTinctures++; append(`Tincture restores ${restored} vitality.`); return; }
    if (action.type === 'guard') { battle.guarded = true; append(`${SPECIES[member.speciesId].name} braces. The next hit is softened.`); return; }
    if (action.type !== 'move') return;
    const move = MOVES[action.moveId];
    if (move.kind === 'guard') { battle.guarded = true; battle.mudbound = 0; append(`${move.name}. The current settles around you.`); return; }
    if (move.kind === 'evade') { battle.evasion = true; append(`${move.name}. Keep clear of the next strike.`); return; }
    if (move.kind === 'calm') {
      if (battle.enemy.speciesId === 'rift-wretch') { const pressure = 12 + Math.floor(member.resonance / 5); battle.stability = Math.max(0, battle.stability - pressure); battle.enemy.vitality = Math.ceil(battle.enemy.maxVitality * battle.stability / battle.maxStability); append(`${move.name} loosens stability by ${pressure}.`); }
      else { battle.agitation = Math.max(0, battle.agitation - (24 + Math.floor(member.resonance / 5))); append(`${move.name}. Its breathing slows.`); if (battle.agitation <= 28) append('It is listening. Resonate is ready.'); }
      return;
    }
    const affinity = SPECIES[battle.enemy.speciesId].affinities[0];
    const multiplier = AFFINITY_MULTIPLIERS[`${move.affinity}:${affinity}`] ?? 1;
    const amount = Math.max(3, Math.round((move.power + member.power * 0.44 - battle.enemy.guard * 0.22 + random(battle) * 2) * multiplier));
    battle.agitation = Math.max(0, battle.agitation - 6);
    if (battle.enemy.speciesId === 'rift-wretch') {
      const pressure = Math.ceil(amount * 0.75);
      battle.stability = Math.max(0, battle.stability - pressure);
      battle.enemy.vitality = Math.ceil(battle.enemy.maxVitality * battle.stability / battle.maxStability);
      append(`${move.name} · ${pressure} stability. Its hold weakens.`);
    } else {
      battle.enemy.vitality = Math.max(0, battle.enemy.vitality - amount);
      append(`${move.name} · ${amount} vitality.`);
    }
  };
  const enemyTurn = () => {
    const member = battle.allies[battle.activeIndex];
    const burst = battle.enemy.speciesId === 'rift-wretch' && battle.turn % 3 === 0;
    const base = Math.max(3, Math.round(battle.enemy.power * 0.48 - member.guard * 0.2 + 2 + random(battle) * 2));
    const protection = battle.guarded ? 0.3 : 1;
    const hits = burst ? 2 : 1;
    let damage = 0;
    let evaded = false;
    for (let hit = 0; hit < hits && member.vitality > 0; hit++) {
      // Reedstep can evade the first strike. Veil reliably softens every hit,
      // making it the safer response to the Wretch's third-turn double pulse.
      if (battle.evasion && hit === 0 && random(battle) < 0.72) { evaded = true; continue; }
      const amount = Math.min(member.vitality, Math.max(1, Math.round(base * (burst ? 0.7 : 1) * protection)));
      member.vitality -= amount; damage += amount;
    }
    if (evaded) append('Reedstep carries you clear of the first strike.');
    append(`${SPECIES[battle.enemy.speciesId].name}${burst ? ' · two broken strikes' : ' strikes'} · ${damage} vitality.`);
    if (battle.enemy.speciesId === 'muddren' && battle.turn % 2 === 0 && !battle.guarded) { battle.mudbound = 2; append('Mudbound · movement slowed for two turns.'); }
  };
  if (playerFirst) { playerTurn(); if (!endCheck()) { enemyTurn(); endCheck(); } }
  else {
    enemyTurn();
    if (!endCheck()) {
      // An incoming companion did not choose the fainted ally's queued move.
      // It gets its own choice on the next turn rather than inheriting intent.
      if (battle.allies[battle.activeIndex].id === active.id) { playerTurn(); endCheck(); }
    }
  }
  battle.log = battle.log.slice(-5);
  return battle;
}
