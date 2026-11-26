import { MOVES, SPECIES } from './data/species';
import { deriveSeed, individualStats, strikeDamage } from './individuals';
import type { BattleAction, BattleBeat, BattleState, BondedMesomon, Fighter, SpeciesId } from './types';

export function makeCompanion(
  speciesId: BondedMesomon['speciesId'],
  id = `${speciesId}-bond`,
  seed = deriveSeed(0, id),
): BondedMesomon {
  const stats = individualStats(speciesId, seed);
  return { ...stats, id, speciesId, level: 5, vitality: stats.maxVitality, experience: 0, moves: [...SPECIES[speciesId].moves] };
}

export function bondFighter(enemy: Fighter): BondedMesomon | null {
  if (enemy.speciesId === 'rift-wretch') return null;
  const { speciesId, id, maxVitality, power, guard, agility, resonance, moves } = enemy;
  return { speciesId, id, maxVitality, power, guard, agility, resonance, moves: [...moves], level: 5, experience: 0, vitality: maxVitality };
}

export function createBattle(party: BondedMesomon[], enemySpecies: SpeciesId, id: BattleState['id'] = 'passage-encounter', seed = 729431): BattleState {
  const allies: Fighter[] = party.map(({ id, speciesId, vitality, maxVitality, power, guard, agility, resonance, moves }) =>
    ({ id, speciesId, vitality, maxVitality, power, guard, agility, resonance, moves: [...moves] }));
  const stats = individualStats(enemySpecies, seed);
  const enemy: Fighter = {
    ...stats, id: `${id}-${(seed >>> 0).toString(36)}`, speciesId: enemySpecies,
    vitality: stats.maxVitality, moves: [...SPECIES[enemySpecies].moves],
  };
  return { id, allies, activeIndex: Math.max(0, allies.findIndex(member => member.vitality > 0)), enemy, agitation: enemySpecies === 'gleamwing' ? 48 : 68, stability: enemySpecies === 'rift-wretch' ? 64 : 0, maxStability: enemySpecies === 'rift-wretch' ? 64 : 0, frenzy: false, seed: seed >>> 0, turn: 0, guarded: false, evasion: false, mudbound: 0, phase: 'choosing', log: [enemySpecies === 'rift-wretch' ? 'The Rift Wretch has a hold on the tear. Bring its stability to zero so Tavian can seal it.' : `${SPECIES[enemySpecies].name} backs away from Tavian. Use a calming move to lower its agitation.`], usedTinctures: 0 };
}

export function resonanceEligibility(battle: BattleState, emptyBuds = 1, storyAllowed = true): { eligible: boolean; reason: string } {
  if (SPECIES[battle.enemy.speciesId].category === 'demon') return { eligible: false, reason: 'The Rift Wretch has no living voice for the cuff to answer.' };
  if (battle.phase !== 'choosing') return { eligible: false, reason: 'This encounter has ended.' };
  if (!storyAllowed) return { eligible: false, reason: 'Give it a little room first.' };
  if (battle.frenzy) return { eligible: false, reason: 'The rift drowns out the creature’s call.' };
  if (emptyBuds < 1) return { eligible: false, reason: 'A new bond needs an empty crystal bud.' };
  if (battle.allies.length >= 3) return { eligible: false, reason: 'All three resting crystals hold companions.' };
  const tired = battle.enemy.vitality <= Math.ceil(battle.enemy.maxVitality * 0.35);
  // Vitality alone is never consent. Even a tired creature must have stopped
  // pulling away; Cry is the gentle, reliable route through that threshold.
  if (battle.agitation > 28 && !(tired && battle.agitation <= 44)) {
    const calmMove = battle.allies[battle.activeIndex]?.moves.find(id => MOVES[id].kind === 'calm');
    const hint = calmMove ? `Try ${MOVES[calmMove].name}.` : 'Use a calming move.';
    return { eligible: false, reason: `${tired ? 'It’s tired, but still pulling away.' : 'It’s still frightened.'} ${hint}` };
  }
  return { eligible: true, reason: 'It stays close. Choose Resonate to offer a bond.' };
}

function random(state: BattleState): number {
  let value = state.seed || 729431;
  value ^= value << 13; value ^= value >>> 17; value ^= value << 5;
  state.seed = value >>> 0;
  return state.seed / 4294967296;
}

interface TurnOptions { tinctures?: number; emptyBuds?: number; storyAllowed?: boolean; }

/** Commit the outcome once. Only the cursor changes while a player watches the turn. */
export function startBattleTurn(previous: BattleState, action: BattleAction, options: TurnOptions): BattleState {
  const beats: BattleBeat[] = [];
  const resolved = resolveBattleTurn(previous, action, options, beat => beats.push(beat));
  return beats.length ? { ...resolved, playback: { index: 0, beats } } : resolved;
}

export function resolveBattleTurn(
  previous: BattleState,
  action: BattleAction,
  options: TurnOptions = {},
  onBeat?: (beat: BattleBeat) => void,
): BattleState {
  if (previous.phase !== 'choosing' || previous.playback) return previous;
  const battle: BattleState = { ...previous, allies: previous.allies.map(member => ({ ...member, moves: [...member.moves] })), enemy: { ...previous.enemy, moves: [...previous.enemy.moves] }, log: [], guarded: false, evasion: false };
  const active = battle.allies[battle.activeIndex];
  const enemyName = battle.enemy.speciesId === 'rift-wretch' ? 'the Rift Wretch' : `the wild ${SPECIES[battle.enemy.speciesId].name}`;
  const enemyLabel = SPECIES[battle.enemy.speciesId].name;
  const present = (side: BattleBeat['side'], kind: BattleBeat['kind'], text: string) => {
    onBeat?.({
      side, kind, text,
      activeIndex: battle.activeIndex,
      allyVitality: battle.allies.map(member => member.vitality),
      enemyVitality: battle.enemy.vitality,
      agitation: battle.agitation,
      stability: battle.stability,
    });
  };
  const append = (line: string) => { battle.log.push(line); };
  const describe = (side: BattleBeat['side'], line: string) => {
    append(line);
    present(side, 'notice', line);
  };
  if (!active) return { ...battle, phase: 'lost', log: ['No companion can continue. Return to the tide stairs.'] };
  if (action.type === 'move' && (!active.moves.includes(action.moveId) || !MOVES[action.moveId])) return previous;
  if (action.type === 'switch' && (!battle.allies[action.index] || action.index === battle.activeIndex || battle.allies[action.index].vitality <= 0)) return previous;
  if (action.type === 'item' && ((options.tinctures ?? 0) < 1 || active.vitality >= active.maxVitality)) return { ...previous, log: [(options.tinctures ?? 0) < 1 ? 'No tinctures left.' : 'Your companion already has full vitality.'] };
  if (action.type === 'resonate') {
    const eligibility = resonanceEligibility(battle, options.emptyBuds ?? 1, options.storyAllowed ?? true);
    if (!eligibility.eligible) return { ...previous, log: [eligibility.reason] };
    present('ally', 'notice', 'Tavian holds out an empty crystal bud.');
    present('enemy', 'notice', `${enemyLabel} steps close enough to touch it.`);
    return { ...battle, phase: 'resonated', turn: battle.turn + 1, log: [`${SPECIES[battle.enemy.speciesId].name} steps closer. Tavian holds still.`, 'The empty crystal bud rings once. The creature stays with him.'] };
  }
  if (action.type === 'flee') {
    if (battle.enemy.speciesId === 'rift-wretch') return { ...previous, log: ['The Rift Wretch blocks the way out. Bring its stability to zero.'] };
    present('field', 'notice', 'Tavian lowers his cuff and steps back.');
    return { ...battle, turn: battle.turn + 1, phase: 'escaped', log: ['Tavian gives the creature room. The way remains open.'] };
  }
  battle.turn++;
  battle.mudbound = Math.max(0, battle.mudbound - 1);
  const playerPriority = action.type === 'switch' ? 8 : action.type === 'item' ? 7 : action.type === 'guard' ? 6 : action.type === 'move' ? MOVES[action.moveId].priority : 0;
  const enemyMove = battle.enemy.moves.map(id => MOVES[id]).find(move => move.kind === 'attack');
  const enemyPriority = enemyMove?.priority ?? 0;
  const speed = active.agility - (battle.mudbound ? 6 : 0);
  const playerFirst = playerPriority > enemyPriority || (playerPriority === enemyPriority && (
    speed === battle.enemy.agility ? random(battle) < 0.5 : speed > battle.enemy.agility
  ));
  const endCheck = () => {
    const pushedBack = battle.enemy.speciesId === 'rift-wretch' ? battle.stability <= 0 : battle.enemy.vitality <= 0;
    if (pushedBack) {
      battle.phase = 'won'; append(battle.enemy.speciesId === 'rift-wretch' ? 'The Wretch loses its hold. The rift is still open.' : 'The wild Mesomon slips into a gap in the stone. Tavian can pass.'); return true;
    }
    if (battle.allies.every(member => member.vitality <= 0)) { battle.phase = 'lost'; append('The last companion tires. Tavian calls everyone back to the cuff.'); return true; }
    const current = battle.allies[battle.activeIndex];
    if (current.vitality <= 0) { battle.activeIndex = battle.allies.findIndex(member => member.vitality > 0); describe('field', `${SPECIES[battle.allies[battle.activeIndex].speciesId].name} steps forward.`); }
    return false;
  };
  const playerTurn = () => {
    const member = battle.allies[battle.activeIndex];
    const name = SPECIES[member.speciesId].name;
    if (action.type === 'switch') { battle.activeIndex = action.index; describe('ally', `${SPECIES[battle.allies[action.index].speciesId].name} takes the lead.`); return; }
    if (action.type === 'item') { const restored = Math.min(26, member.maxVitality - member.vitality); member.vitality += restored; battle.usedTinctures++; describe('ally', `Tavian gives ${name} a tincture. ${name} recovers ${restored} vitality.`); return; }
    if (action.type === 'guard') { battle.guarded = true; describe('ally', `${name} braces for the attack.`); return; }
    if (action.type !== 'move') return;
    const move = MOVES[action.moveId];
    if (move.kind === 'guard') { battle.guarded = true; battle.mudbound = 0; describe('ally', `${name} uses ${move.name} to soften incoming strikes.`); return; }
    if (move.kind === 'evade') { battle.evasion = true; describe('ally', `${name} uses ${move.name} to try to dodge.`); return; }
    present('ally', 'action', `${name} uses ${move.name}.`);
    if (move.kind === 'calm') {
      if (battle.enemy.speciesId === 'rift-wretch') {
        const pressure = Math.min(battle.stability, 12 + Math.floor(member.resonance / 5));
        battle.stability -= pressure;
        battle.enemy.vitality = Math.ceil(battle.enemy.maxVitality * battle.stability / battle.maxStability);
        const result = `The Rift Wretch loses ${pressure} stability.`;
        append(`${name} uses ${move.name}. ${result}`);
        present('ally', 'impact', result);
      } else {
        battle.agitation = Math.max(0, battle.agitation - (24 + Math.floor(member.resonance / 5)));
        const result = `${enemyLabel} begins to relax.`;
        append(`${name} uses ${move.name}. ${result}`);
        present('ally', 'impact', result);
        if (resonanceEligibility(battle, options.emptyBuds, options.storyAllowed).eligible) append('It stays close. Tavian can offer a bond.');
      }
      return;
    }
    const amount = strikeDamage(move, member, battle.enemy, random(battle));
    battle.agitation = Math.max(0, battle.agitation - 6);
    if (battle.enemy.speciesId === 'rift-wretch') {
      const pressure = Math.min(battle.stability, Math.ceil(amount * 0.9));
      battle.stability = Math.max(0, battle.stability - pressure);
      battle.enemy.vitality = Math.ceil(battle.enemy.maxVitality * battle.stability / battle.maxStability);
      append(`${name} uses ${move.name}. The Rift Wretch loses ${pressure} stability.`);
      present('ally', 'impact', `The Rift Wretch loses ${pressure} stability.`);
    } else {
      const damage = Math.min(amount, battle.enemy.vitality);
      battle.enemy.vitality -= damage;
      append(`${name} hits ${enemyName} with ${move.name} for ${damage} vitality.`);
      present('ally', 'impact', `${enemyLabel} loses ${damage} vitality.`);
    }
  };
  const enemyTurn = () => {
    const member = battle.allies[battle.activeIndex];
    const burst = battle.enemy.speciesId === 'rift-wretch' && battle.turn % 3 === 0;
    // The chapter's startled creatures attack defensively. Their strikes use
    // the same stat formula with a smaller move-power contribution.
    const base = strikeDamage(enemyMove, battle.enemy, member, random(battle));
    const protection = battle.guarded ? 0.3 : 1;
    const hits = burst ? 2 : 1;
    const target = SPECIES[member.speciesId].name;
    const attack = enemyMove ? `uses ${enemyMove.name}` : 'strikes';
    const declaration = `${enemyLabel} ${attack}${burst ? ' in a double pulse' : ''}.`;
    present('enemy', 'action', declaration);
    let damage = 0;
    let evaded = false;
    for (let hit = 0; hit < hits && member.vitality > 0; hit++) {
      // Reedstep can evade the first strike. Veil reliably softens every hit,
      // making it the safer response to the Wretch's third-turn double pulse.
      if (battle.evasion && hit === 0 && random(battle) < 0.72) {
        evaded = true;
        present('enemy', 'impact', `${target} slips past the strike.`);
        continue;
      }
      const amount = Math.min(member.vitality, Math.max(1, Math.round(base * (burst ? 0.7 : 1) * protection)));
      member.vitality -= amount; damage += amount;
      present('enemy', 'impact', `${target} loses ${amount} vitality.`);
    }
    if (evaded) append(`${target} dodges the first strike from ${enemyName}.`);
    if (damage > 0) append(`${declaration} ${target} loses ${damage} vitality.`);
    if (battle.enemy.speciesId === 'muddren' && battle.turn % 2 === 0 && !battle.guarded) { battle.mudbound = 2; describe('field', 'Mud clings to the party’s feet. Mudbound slows their next move.'); }
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
