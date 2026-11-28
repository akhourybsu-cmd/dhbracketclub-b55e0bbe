import { bondFighter, createBattle, makeCompanion, startBattleTurn, tinctureRecovery } from './battle';
import { advanceBattleBeat } from './battlePlayback';
import { CLOSING_CHOICES } from './data/dialogue';
import { beginNarrativeBeat } from './narrative';
import { MAPS, WALKABLE_TILES } from './data/maps';
import { fieldObstacleAt } from './data/fieldObstacles';
import { rillikGangway, rillikLanding } from './data/tideObstacles';
import { missingTideRequirement } from './tideAccess';
import { habitatSeed, newJourneySeed } from './individuals';
import { SPECIES } from './data/species';
import type { ApproachingNpc, NpcPosition, DialogueLine, DialogueState, Direction, GameAction, GameSession, MapDefinition, MapId, MapObject, MesomonSaveV1, StoryEvent } from './types';

export { SPECIES, MOVES } from './data/species';
export const CHAPTER_TITLE = 'The Harbor in Two Voices';
export const DELTAS: Record<Direction, { x: number; y: number }> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const flag = (save: MesomonSaveV1, key: string) => save.questFlags[key] === true;
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export function createNewSave(slot: 1 | 2 | 3 = 1, journeySeed = newJourneySeed()): MesomonSaveV1 {
  return { schemaVersion: 1, slot, journeySeed, player: { name: 'Tavian', mapId: 'ship', x: 8, y: 9, facing: 'up' }, party: [], collection: {}, inventory: { tincture: 2, 'crystal-bud': 2 }, questFlags: {}, activeQuestId: 'harbor-two-voices', rifts: { 'port-marche': 'unseen' }, settings: { textSpeed: 'normal', battleSpeed: 'normal', reducedMotion: false, haptics: false, mute: true, sealAssist: false, musicVolume: 0.35, ambientVolume: 0.3 }, playtimeSeconds: 0, savedAt: new Date().toISOString(), battle: null, seal: { active: false, pulses: 0, attempts: 0 }, dialogue: null, dialogueHistory: [] };
}

function copySession(save: MesomonSaveV1, notice = ''): GameSession {
  const restored = clone(save);
  return { save: restored, dialogue: restored.dialogue, notice };
}

/** Repair the playable copy only. A pending cloud retry must keep its original payload. */
export function createSession(save: MesomonSaveV1): GameSession {
  const session = copySession(save);
  restoreTideAccess(session);
  restoreFieldPositions(session.save);
  return session;
}
export function getMap(value: MapId | MesomonSaveV1): MapDefinition { return MAPS[typeof value === 'string' ? value : value.player.mapId]; }
export function getVisibleObjects(save: MesomonSaveV1): MapObject[] {
  return getMap(save).objects.filter(object => {
    if (object.id === 'nia') return !flag(save, 'workshop_entered');
    if (object.id === 'nia-stairs') return flag(save, 'bram_met') && !flag(save, 'page_found');
    if (object.id === 'closing') return flag(save, 'page_found') || (flag(save, 'workshop_entered') && !flag(save, 'bram_met'));
    if (object.id === 'whistle-reeds') return flag(save, 'whistle_accepted') && !flag(save, 'whistle_found');
    if (object.id === 'gate-brace') return !flag(save, 'brace_found');
    if (object.id === 'rillik-bond') return !flag(save, 'rillik_bonded');
    if (object.id === 'tressel') return !flag(save, 'tutorial_complete');
    if (object.id === 'gleamwing') return !flag(save, 'gleamwing_complete');
    if (object.id === 'pickup-tincture') return !flag(save, 'passage_tincture');
    if (object.id === 'page') return save.rifts['port-marche'] === 'sealed';
    if (object.id === 'muddren-catch') return !flag(save, 'wrong_catch');
    return !object.hidden;
  }).map(object => {
    const position = object.id === 'nia' || object.id === 'bram' ? save.quayResidents?.[object.id] : undefined;
    return position ? { ...object, x: position.x, y: position.y, direction: position.facing } : object;
  });
}

export function canWalk(save: MesomonSaveV1, x: number, y: number, occupants?: readonly MapObject[]): boolean {
  const map = getMap(save);
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= map.width || y >= map.height || !WALKABLE_TILES.has(map.tiles[y][x])) return false;
  if (map.id === 'tide-stairs' && !flag(save, 'gate_opened') && x === rillikGangway.x && y === rillikGangway.y) return false;
  if (map.id === 'passage' && !flag(save, 'sluice_open') && x >= 10 && x <= 11 && y >= 11 && y <= 14) return false;
  if (fieldObstacleAt(map.id, x, y)) return false;
  return !(occupants ?? getVisibleObjects(save)).some(object => object.solid && object.x === x && object.y === y);
}

export function nearbyInteractions(save: MesomonSaveV1): MapObject[] {
  const player = save.player, delta = DELTAS[player.facing];
  return getVisibleObjects(save).filter(object => Math.abs(object.x - player.x) + Math.abs(object.y - player.y) <= 1)
    .sort((a, b) => {
      const rank = (object: MapObject) => object.x === player.x + delta.x && object.y === player.y + delta.y ? -1 : Math.abs(object.x - player.x) + Math.abs(object.y - player.y);
      return rank(a) - rank(b);
    });
}

export function interactionLabel(save: MesomonSaveV1, object: MapObject): string {
  switch (object.id) {
    case 'rift': return flag(save, 'rift_sealed') ? 'Sealed basin' : flag(save, 'boss_introduced') ? object.label : 'Chamber basin';
    case 'gate-wheel': return flag(save, 'gate_opened') ? 'Braced tide wheel' : object.label;
    case 'sluice': return flag(save, 'sluice_open') ? 'Lowered sluice lever' : object.label;
    case 'kettle': return flag(save, 'page_found') ? 'Workshop kettle' : object.label;
    default: return object.label;
  }
}

export function getPhase(session: GameSession): 'explore' | 'dialogue' | 'battle' | 'seal' | 'ending' {
  if (session.dialogue) return 'dialogue';
  if (session.save.battle) return 'battle';
  if (session.save.seal.active) return 'seal';
  if (flag(session.save, 'chapter_complete') && !flag(session.save, 'ending_seen')) return 'ending';
  return 'explore';
}

const QUEST_STEPS = [
  ['captain_met', 'I spent four years charting the coast. Then Edda wrote about a sound in our harbor and asked me to bring my cuff.'],
  ['disembarked', 'I’m back on the pier I left at sixteen. I wish I’d said goodbye to Nia.'],
  ['nia_met', 'Nia came to meet me. Edda missed supper last night, and her workshop lamp was still burning.'],
  ['workshop_entered', 'My chair is still under Edda’s bench. No sign of her.'],
  ['clues_complete', 'Edda marked the second beat on her chart. It keeps time as the tide turns. Her map points to the old stairs.'],
  ['bram_met', 'Bram saw Edda take her lamp down the stairs. The water drops when we hear metal ring below the steps.'],
  ['rillik_bonded', 'Rillik came back for me. When it lifted its paw, I could still feel its heartbeat in my wrist.'],
  ['current_eddy', 'Rillik found a drain behind the passage wall.'],
  ['sluice_open', 'When the boards drained, I found a bootprint. Anyone on the pump crew could have left it.'],
  ['tutorial_complete', 'Tressel’s nest was soaked through. It was piling splinters on the dry boards.'],
  ['currents_followed', 'We followed the foam uphill to the chamber.'],
  ['boss_defeated', 'The shards hit the stone basin. That’s the ringing we heard up on the steps.'],
  ['rift_sealed', 'Rillik kept its paw on my cuff for all three pulses. The basin drains toward the sea again.'],
  ['page_found', 'Edda took a reading a mile inland after the tremor. It’s in her own handwriting. I want Nia to see it.'],
  ['chapter_complete', 'In the morning Nia and I will ask the carters if they saw Edda. Tonight there’s a place for me at the table.'],
] as const;
export function getQuestSteps(save: MesomonSaveV1) {
  const first = QUEST_STEPS.findIndex(([key]) => !flag(save, key));
  return QUEST_STEPS.map(([id, label], index) => ({ id, label, complete: flag(save, id), active: index === first }));
}
export function getHarborNotes(save: MesomonSaveV1): string[] {
  const notes: string[] = [];
  if (flag(save, 'whistle_imitation')) notes.push('Pell missed a note. Rillik copied the squeak. Now they play it that way on purpose.');
  else if (flag(save, 'whistle_returned')) notes.push('Pell has the whistle back. I can pick out those first two notes from across the quay.');
  else if (flag(save, 'whistle_found')) notes.push('Found the tin whistle. Bring it back to Pell.');
  else if (flag(save, 'whistle_accepted')) notes.push('Pell lost a tin whistle in the reeds below the market.');
  if (flag(save, 'wrong_catch')) notes.push('Rillik helped free the Muddren from the fisher’s net.');
  else if (flag(save, 'visited:fisher')) notes.push('A Muddren has its foot caught in the fisher’s net.');
  if (flag(save, 'heard:bram-lamp')) notes.push('Bram remembers Edda striking a match on the stairs.');
  else if (flag(save, 'heard:edda-lamp-oil')) notes.push('Seli sold Edda a whole bottle of lamp oil yesterday.');
  if (flag(save, 'heard:flour-carter')) notes.push('Ask the flour carter about Edda when the wagons load in the morning.');
  return notes;
}
export function needsGateBrace(save: MesomonSaveV1): boolean {
  return !flag(save, 'brace_found') && (flag(save, 'visited:gate-wheel') || flag(save, 'visited:nia-stairs'));
}
export function getObjective(save: MesomonSaveV1): string {
  if (!flag(save, 'captain_met')) return 'Ask the captain at the front of the ship if he can see Edda.';
  if (!flag(save, 'disembarked')) return 'Go ashore. The gangplank is at the back of the deck.';
  if (!flag(save, 'nia_met')) return 'Nia is waiting at the arrival pier.';
  if (!flag(save, 'workshop_entered')) return 'Look for Edda at her workshop, northwest of the market.';
  if (!flag(save, 'clues_complete')) {
    const clues = [['clue_chart', 'chart'], ['clue_map', 'field map'], ['clue_hook', 'empty hook']] as const;
    const missing = clues.filter(([key]) => !flag(save, key)).map(([, name]) => name);
    if (missing.length === 0) return 'Read the writing on the back of the field map · 3/3';
    if (missing.length === 1) return `Check the ${missing[0]} in Edda’s workshop · 2/3`;
    if (missing.length === 2) return `Check the ${missing[0]} and the ${missing[1]} · 1/3`;
    return 'Check the chart, field map and empty hook · 0/3';
  }
  if (!flag(save, 'bram_met')) return 'Ask Bram at the east quay if he saw Edda.';
  if (!flag(save, 'gate_opened')) {
    if (flag(save, 'brace_found')) return 'Take the timber to the tide wheel.';
    return needsGateBrace(save) ? 'Find a timber brace below the tide wheel.' : 'Help Rillik get free. Check the wheel at the old tide stairs.';
  }
  if (!flag(save, 'rillik_bonded')) return 'Cross the plank to Rillik on the lower landing.';
  if (!flag(save, 'current_eddy')) return 'Use Current Sense at the eddy under the wharf.';
  if (!flag(save, 'sluice_open')) return 'Lower the sluice lever to drain the crossing.';
  if (!flag(save, 'tutorial_complete')) return flag(save, 'visited:tressel') ? 'Go back to Tressel at the crossing.' : 'Cross the boards. Check the nest on the far side.';
  if (!flag(save, 'current_channel')) return 'Use Current Sense near the upper channel.';
  if (!flag(save, 'boss_defeated')) return save.player.mapId === 'chamber' ? 'Inspect the basin at the end of the walkway.' : 'Follow the current into the old tide chamber.';
  if (!flag(save, 'rift_sealed')) return 'The demon is gone. Align three pulses to seal the rift.';
  if (!flag(save, 'page_found')) return 'Inspect the stone beside the sealed rift.';
  if (!flag(save, 'chapter_complete')) return 'Show Edda’s page to Nia at the workshop.';
  return 'The inland road is closed. You can still explore Port Marche.';
}

function open(session: GameSession, id: string, lines: DialogueLine[], onFinish?: StoryEvent, choices?: DialogueState['choices']): GameSession {
  const dialogue: DialogueState = { id, lines: clone(lines), index: 0, ...(onFinish ? { onFinish } : {}), ...(choices ? { choices: clone(choices) } : {}) };
  session.save.dialogue = dialogue;
  return { ...session, dialogue, notice: '' };
}
function scene(session: GameSession, id: string, onFinish?: StoryEvent): GameSession {
  return open(session, id, beginNarrativeBeat(session.save, id), onFinish);
}
const opposite: Record<Direction, Direction> = { up: 'down', down: 'up', left: 'right', right: 'left' };
const directions = Object.keys(DELTAS) as Direction[];

function faceOneAnother(save: MesomonSaveV1, resident: NpcPosition) {
  const facing = directions.find(direction => resident.x + DELTAS[direction].x === save.player.x && resident.y + DELTAS[direction].y === save.player.y);
  if (facing) { resident.facing = facing; save.player.facing = opposite[facing]; }
}

type FieldPoint = { x: number; y: number };
const distance = (a: FieldPoint, b: FieldPoint) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** Choose the closest square on the accessible side of gates, with ties broken
 * by path order from the room entrance. An older save may be deep inside a prop. */
function nearestReachable(map: MapDefinition, origin: FieldPoint, canStand: (x: number, y: number) => boolean): FieldPoint {
  const queue = [map.spawn];
  const seen = new Set([map.spawn.y * map.width + map.spawn.x]);
  let closest = map.spawn, best = Infinity;
  for (const tile of queue) {
    const gap = distance(tile, origin);
    if (gap < best && canStand(tile.x, tile.y)) {
      closest = tile;
      best = gap;
      if (gap <= 1) break;
    }
    for (const { x: dx, y: dy } of Object.values(DELTAS)) {
      const x = tile.x + dx, y = tile.y + dy;
      const key = y * map.width + x;
      if (seen.has(key) || !canStand(x, y)) continue;
      seen.add(key);
      queue.push({ x, y });
    }
  }
  return closest;
}

function residentCanStand(save: MesomonSaveV1, others: MapObject[], x: number, y: number) {
  return canWalk(save, x, y, others) && !(x === 34 && y === 22)
    && !(save.player.x === x && save.player.y === y)
    && !others.some(object => object.x === x && object.y === y);
}

/** A short walk that ends beside Tavian, clear of doors, people and the return landing. */
function meetingPath(save: MesomonSaveV1, origin: FieldPoint, others: MapObject[]) {
  const queue: { x: number; y: number; steps: Direction[] }[] = [{ x: origin.x, y: origin.y, steps: [] }];
  const seen = new Set([origin.y * MAPS.harbor.width + origin.x]);
  for (const tile of queue) {
    if (distance(tile, save.player) === 1) return tile;
    if (tile.steps.length >= 4) continue;
    for (const direction of directions) {
      const x = tile.x + DELTAS[direction].x, y = tile.y + DELTAS[direction].y;
      const key = y * MAPS.harbor.width + x;
      if (seen.has(key) || !residentCanStand(save, others, x, y)) continue;
      seen.add(key);
      queue.push({ x, y, steps: [...tile.steps, direction] });
    }
  }
}

/** Old clients could reach a later room with its required encounter unfinished.
 * Resume on the near side without awarding the missing bond or replaying a
 * battle or scene from the inaccessible room. Valid in-flight scenes resume. */
function restoreTideAccess(session: GameSession) {
  const save = session.save;
  const map = save.player.mapId;
  if (flag(save, 'rillik_bonded') && save.party.length === 0) {
    // Calling the companion into its crystal never empties the battle party.
    // Reuse the saved individual if possible; a flag without any individual
    // returns to the encounter so a real first bond can be made.
    const starter = Object.values(save.collection).find(member => member.speciesId === 'rillik');
    if (starter) save.party.push(clone(starter));
    else {
      save.questFlags.rillik_bonded = false;
      save.questFlags.companion_released = false;
    }
  }
  if ((map !== 'passage' && map !== 'chamber') || !missingTideRequirement(save, map)) return;
  const destination = missingTideRequirement(save, 'passage') ? 'tide-stairs' : 'passage';
  const landing = MAPS[destination].spawn;
  teleport(session, destination, landing.x, landing.y, save.player.facing);
  save.dialogue = null;
  session.dialogue = null;
  save.battle = null;
  save.seal.active = false;
}

function restoreFieldPositions(save: MesomonSaveV1) {
  const { player, dialogue } = save;
  if (save.quayResidents) {
    // The residents remain on the quay while Tavian explores other rooms.
    const harbor = player.mapId === 'harbor' ? save : { ...save, player: { ...player, mapId: 'harbor' as const, ...MAPS.harbor.spawn } };
    for (const actor of ['nia', 'bram'] as const) {
      const resident = save.quayResidents[actor];
      if (!resident) continue;
      const others = getVisibleObjects(harbor).filter(object => object.id !== actor);
      const legal = (x: number, y: number) => residentCanStand(harbor, others, x, y);
      if (!legal(resident.x, resident.y)) Object.assign(resident, nearestReachable(MAPS.harbor, resident, legal));
    }
  }
  const occupants = getVisibleObjects(save);
  const legal = (x: number, y: number) => canWalk(save, x, y, occupants);
  const acrossRaisedGangway = player.mapId === 'tide-stairs' && !flag(save, 'gate_opened')
    && player.x === rillikLanding.x && player.y === rillikLanding.y;
  const acrossFlood = player.mapId === 'passage' && !flag(save, 'sluice_open') && player.x >= 12;
  if (!legal(player.x, player.y) || acrossRaisedGangway || acrossFlood) {
    Object.assign(player, nearestReachable(getMap(save), player, legal));
  }

  // A newer fixture may cross an older saved walk-in choreography. Keep the
  // conversation and its end event, replacing only steps that no longer fit.
  if (!dialogue?.approach) return;
  const { actor, steps } = dialogue.approach;
  const resident = save.quayResidents?.[actor];
  if (player.mapId === 'harbor' && resident) {
    const others = occupants.filter(object => object.id !== actor);
    let { x, y } = resident;
    const valid = steps.every(direction => {
      x += DELTAS[direction].x; y += DELTAS[direction].y;
      return residentCanStand(save, others, x, y);
    });
    if (valid && distance({ x, y }, player) === 1) return;
    const path = meetingPath(save, resident, others);
    if (path?.steps.length) {
      dialogue.approach.steps = path.steps;
      return;
    }
    // A saved meeting already started. If its short approach was cut off,
    // stage the resident beside Tavian before showing the saved first line.
    if (!path) Object.assign(resident, nearestReachable(MAPS.harbor, player, (x, y) => residentCanStand(save, others, x, y)));
    faceOneAnother(save, resident);
  }
  delete dialogue.approach;
}

function meetOnQuay(session: GameSession, actor: ApproachingNpc): GameSession {
  const save = session.save;
  if (save.player.mapId !== 'harbor' || flag(save, actor + '_met')) return session;
  const residents = getVisibleObjects(save), npc = residents.find(object => object.id === actor);
  if (!npc || distance(npc, save.player) > 3) return session;
  const path = meetingPath(save, npc, residents.filter(object => object.id !== actor));
  if (!path) return session;
  const result = scene(session, actor, actor === 'nia' ? 'nia-met' : 'bram-met');
  save.questFlags['visited:' + actor] = true;
  const position = { x: npc.x, y: npc.y, facing: npc.direction ?? 'down' };
  (save.quayResidents ??= {})[actor] = position;
  if (path.steps.length && !save.settings.reducedMotion) {
    result.dialogue!.approach = { actor, steps: path.steps };
  } else {
    position.x = path.x; position.y = path.y;
    faceOneAnother(save, position);
  }
  return result;
}
function short(session: GameSession, speaker: string, ...lines: string[]): GameSession { return open(session, `${speaker}-remark`, lines.map(text => ({ speaker, text }))); }
function teleport(session: GameSession, mapId: MapId, x: number, y: number, facing: Direction = 'up'): GameSession { session.save.player = { ...session.save.player, mapId, x, y, facing }; return session; }
function healParty(save: MesomonSaveV1) { save.party = save.party.map(member => ({ ...member, vitality: member.maxVitality })); for (const member of save.party) save.collection[member.id] = clone(member); }
function firstBond(save: MesomonSaveV1) { if (flag(save, 'rillik_bonded')) return; const member = makeCompanion('rillik', 'rillik-first', habitatSeed(save, 'tide-gate')); save.party.push(member); save.collection[member.id] = clone(member); save.questFlags.rillik_bonded = true; save.questFlags.companion_released = true; }

function event(session: GameSession, name?: StoryEvent): GameSession {
  const save = session.save;
  switch (name) {
    case 'captain-met': save.questFlags.captain_met = true; break;
    case 'nia-met': save.questFlags.nia_met = true; break;
    case 'workshop-entered': save.questFlags.workshop_entered = true; break;
    case 'clues-complete': save.questFlags.clues_complete = true; break;
    case 'bram-met': save.questFlags.bram_met = true; break;
    case 'gate-opened': save.questFlags.gate_opened = true; break;
    case 'first-bond': firstBond(save); session.notice = 'Rillik is bonded to you and walks beside you.'; break;
    case 'boss-introduced': save.questFlags.boss_introduced = true; save.rifts['port-marche'] = 'found'; save.battle = createBattle(save.party, 'rift-wretch', 'chamber-boss', habitatSeed(save, 'chamber-boss')); break;
    case 'sealed': save.questFlags.rift_sealed = true; save.rifts['port-marche'] = 'sealed'; save.seal.active = false; break;
    case 'page-found': save.questFlags.page_found = true; break;
    case 'chapter-complete': save.questFlags.chapter_complete = true; healParty(save); break;
    case 'whistle-accepted': save.questFlags.whistle_accepted = true; break;
    case 'whistle-returned': if (!flag(save, 'whistle_returned')) { save.questFlags.whistle_returned = true; save.inventory.tincture = (save.inventory.tincture ?? 0) + 1; save.inventory['tin-whistle'] = 0; session.notice = 'Tin Whistle complete · +1 tincture'; } break;
    case 'wrong-catch': save.questFlags.wrong_catch = true; break;
    case 'tutorial-complete': save.battle = createBattle(save.party, 'tressel', 'passage-encounter', habitatSeed(save, 'passage-encounter')); break;
    case 'wild-complete': save.battle = createBattle(save.party, 'gleamwing', 'gleamwing-encounter', habitatSeed(save, 'gleamwing-encounter')); break;
  }
  return session;
}

function finishBattle(session: GameSession): GameSession {
  const save = session.save, battle = save.battle;
  if (!battle || battle.playback || battle.phase === 'choosing') return session;
  for (const ally of battle.allies) {
    const member = save.party.find(value => value.id === ally.id);
    if (member) { member.vitality = ally.vitality; if (battle.phase === 'won' || battle.phase === 'resonated') member.experience += 20; save.collection[member.id] = clone(member); }
  }
  save.inventory.tincture = Math.max(0, (save.inventory.tincture ?? 0) - battle.usedTinctures);
  save.battle = null;
  if (battle.phase === 'lost') {
    healParty(save); teleport(session, 'tide-stairs', 12, 12, 'left');
    if (flag(save, 'page_found')) return short(session, 'Tavian', 'Dry boards. We can catch our breath here.');
    return short(session, 'Nia', 'Here, Tav. Sit on the dry step.', battle.id === 'chamber-boss' ? 'Your cuff’s left a mark. Give me your wrist a minute.' : 'I’ve got the gate. Take as long as you need.');
  }
  if (battle.phase === 'escaped') { session.notice = 'You stepped back. The creature has room.'; return session; }
  if (battle.phase === 'resonated') {
    const member = bondFighter(battle.enemy);
    if (member && !save.collection[member.id] && save.party.length < 3 && (save.inventory['crystal-bud'] ?? 0) > 0) { save.party.push(member); save.collection[member.id] = clone(member); save.inventory['crystal-bud']--; }
  }
  if (battle.id === 'passage-encounter') {
    save.questFlags.tutorial_complete = true;
    return short(session, 'Tavian', battle.phase === 'resonated' ? 'You can come with us. We’ll leave the nest alone.' : 'Easy. Keep your dry corner. We only need the passage.', flag(save, 'current_channel') ? 'We can get through to the chamber now.' : 'The next current is above the crossing.');
  }
  if (battle.id === 'gleamwing-encounter') { save.questFlags.gleamwing_complete = true; session.notice = battle.phase === 'resonated' ? 'Gleamwing answered · a new crystal rests beside Rillik’s' : 'The lantern is quiet again.'; return session; }
  save.questFlags.boss_defeated = true; save.questFlags.companion_released = true; save.seal = { active: true, pulses: 0, attempts: 0 };
  return scene(session, 'boss-defeated');
}

function advance(session: GameSession): GameSession {
  const dialogue = session.dialogue;
  if (dialogue) {
    if (dialogue.index >= dialogue.lines.length - 1 && dialogue.choices?.length) return session;
    const line = dialogue.lines[dialogue.index];
    session.save.dialogueHistory = [...session.save.dialogueHistory, line].slice(-100);
    if (dialogue.index < dialogue.lines.length - 1) { dialogue.index++; session.save.dialogue = dialogue; return session; }
    session.save.dialogue = null; session.dialogue = null;
    return event(session, dialogue.onFinish);
  }
  const battle = session.save.battle;
  if (battle?.playback) {
    session.save.battle = advanceBattleBeat(battle, battle.turn, battle.playback.index);
    return session;
  }
  if (battle) return finishBattle(session);
  if (getPhase(session) === 'ending') { session.save.questFlags.ending_seen = true; session.notice = 'Chapter I complete. You can visit the quay again.'; }
  return session;
}

function interact(session: GameSession, requestedId?: string): GameSession {
  const save = session.save;
  const object = nearbyInteractions(save).find(value => !requestedId || value.id === requestedId);
  if (!object) { session.notice = 'Walk beside someone or something, then press A.'; return session; }
  const result = interactWithObject(session, object.id);
  const visitId = object.id === 'muddren-catch' ? 'fisher' : object.id;
  save.questFlags[`visited:${visitId}`] = true;
  return result;
}

function interactWithObject(session: GameSession, id: string): GameSession {
  const save = session.save;
  if (id === 'captain') return flag(save, 'captain_met') ? short(session, 'Captain', 'Gangplank’s aft. Mind the third board.') : scene(session, 'captain', 'captain-met');
  if (id === 'gangplank') {
    if (!flag(save, 'captain_met')) return short(session, 'Captain', 'Tavian. A word before you go ashore.');
    save.questFlags.disembarked = true; teleport(session, 'harbor', 26, 30, 'up'); session.notice = ''; return meetOnQuay(session, 'nia');
  }
  if (id === 'nia') return flag(save, 'nia_met') ? scene(session, 'nia-repeat') : scene(session, 'nia', 'nia-met');
  if (id === 'workshop-door') {
    if (!flag(save, 'nia_met')) return short(session, 'Tavian', 'There’s Nia on the pier. Maybe she’s seen Edda.');
    teleport(session, 'workshop', 8, 11);
    return !flag(save, 'workshop_entered') ? scene(session, 'workshop', 'workshop-entered') : session;
  }
  if (id === 'workshop-exit') return teleport(session, 'harbor', 9, 16, 'down');
  if (['chart', 'field-map', 'satchel-hook'].includes(id)) {
    const key = id === 'chart' ? 'clue_chart' : id === 'field-map' ? 'clue_map' : 'clue_hook';
    const lines = beginNarrativeBeat(save, flag(save, key) ? id + '-repeat' : id);
    save.questFlags[key] = true;
    const complete = ['clue_chart', 'clue_map', 'clue_hook'].every(value => flag(save, value));
    return open(session, id, [...lines, ...(complete && !flag(save, 'clues_complete') ? beginNarrativeBeat(save, 'clues-complete') : [])], complete && !flag(save, 'clues_complete') ? 'clues-complete' : undefined);
  }
  if (id === 'bram') {
    if (!flag(save, 'clues_complete')) return scene(session, 'bram-early');
    return flag(save, 'bram_met') ? scene(session, 'bram-repeat') : scene(session, 'bram', 'bram-met');
  }
  if (id === 'tide-door') return flag(save, 'bram_met') ? teleport(session, 'tide-stairs', 5, 4) : short(session, 'Bram', 'Mind the chain there. Come round my side where I can hear you.');
  if (id === 'stairs-exit') return teleport(session, 'harbor', 34, 22, 'left');
  if (id === 'gate-brace') {
    save.questFlags.brace_found = true;
    return short(session, 'Tavian', flag(save, 'visited:gate-wheel')
      ? 'Long enough to slip under that wheel. Still sound, too.'
      : 'Good solid timber. I’ll take it up to the gate.');
  }
  if (id === 'gate-wheel') {
    if (flag(save, 'gate_opened')) return short(session, 'Tavian', 'It’s holding. Nia’s brace is better than the old bracket.');
    if (!flag(save, 'brace_found')) return scene(session, 'gate-blocked');
    return scene(session, 'gate-opened', 'gate-opened');
  }
  if (id === 'rillik-bond') return flag(save, 'gate_opened') ? scene(session, 'first-bond', 'first-bond') : short(session, 'Tavian', 'Its paw’s caught behind the bars. We need to raise the gate.');
  if (id === 'passage-door') return !missingTideRequirement(save, 'passage') ? teleport(session, 'passage', 4, 19) : short(session, 'Nia', flag(save, 'gate_opened') ? 'There, on the lower landing. I think it’s waiting for you.' : 'Tav, give me a hand at the wheel first. It’s still caught down there.');
  if (id === 'passage-exit') return teleport(session, 'tide-stairs', 15, 6, 'left');
  if (id === 'sense-eddy' || id === 'sense-channel') {
    if (!flag(save, 'rillik_bonded')) return session;
    save.questFlags.companion_released = true;
    const key = id === 'sense-eddy' ? 'current_eddy' : 'current_channel';
    const dialogueId = flag(save, key) ? id + '-repeat' : id;
    save.questFlags[key] = true;
    save.questFlags.sense_pulse = Number(save.questFlags.sense_pulse ?? 0) + 1;
    if (flag(save, 'current_eddy') && flag(save, 'current_channel')) save.questFlags.currents_followed = true;
    return scene(session, dialogueId);
  }
  if (id === 'sluice') {
    if (flag(save, 'sluice_open')) return short(session, 'Tavian', 'Handle’s down. The boards are dry.');
    if (!flag(save, 'current_eddy')) return short(session, 'Tavian', 'Which channel does this drain? Let Rillik check the current.');
    save.questFlags.sluice_open = true; return scene(session, 'sluice');
  }
  if (id === 'tressel') {
    save.questFlags.companion_released = true;
    return scene(session, flag(save, 'visited:tressel') ? 'tressel-retry' : 'tressel', 'tutorial-complete');
  }
  if (id === 'pickup-tincture') { save.questFlags.passage_tincture = true; save.inventory.tincture = (save.inventory.tincture ?? 0) + 1; session.notice = 'Found a sealed tincture · +1'; return session; }
  if (id === 'save-lamp' || id === 'rest-rope') {
    healParty(save);
    session.notice = save.party.length ? 'Your companions are rested.' : 'Tavian rests for a moment beside the window.';
    return session;
  }
  if (id === 'gleamwing') return scene(session, 'gleamwing', 'wild-complete');
  if (id === 'chamber-door') {
    switch (missingTideRequirement(save, 'chamber')) {
      case 'gate_opened': return short(session, 'Tavian', 'That little one is still caught at the tide stairs.');
      case 'rillik_bonded': return short(session, 'Tavian', 'I left Rillik on the lower landing.');
      case 'sluice_open': return short(session, 'Tavian', 'The crossing is flooded. I need the sluice lever.');
      case 'tutorial_complete': return short(session, 'Tavian', 'That Tressel’s still at the crossing. I’d better check on it.');
      case 'currents_followed': return short(session, 'Tavian', 'Rillik hasn’t found where the second current leads yet.');
    }
    return teleport(session, 'chamber', 8, 12);
  }
  if (id === 'chamber-exit') return teleport(session, 'passage', 18, 4, 'down');
  if (id === 'rift') {
    if (flag(save, 'rift_sealed')) return short(session, 'Tavian', 'Listen. I can hear the water under the boards again.');
    if (flag(save, 'boss_defeated')) { save.seal.active = true; return session; }
    save.questFlags.companion_released = true;
    return scene(session, flag(save, 'boss_introduced') ? 'boss-retry' : 'boss-intro', 'boss-introduced');
  }
  if (id === 'page') {
    if (flag(save, 'page_found')) return scene(session, 'page-repeat');
    save.questFlags.companion_released = true;
    return scene(session, 'page', 'page-found');
  }
  if (id === 'closing' && !flag(save, 'page_found')) return scene(session, 'workshop-nia');
  if (id === 'closing') {
    if (flag(save, 'chapter_complete')) return scene(session, 'closing-repeat');
    // Rillik rests in its crystal during supper and emerges beside the map.
    save.questFlags.companion_released = false;
    return open(session, 'closing', beginNarrativeBeat(save, 'closing'), undefined, CLOSING_CHOICES);
  }
  if (id === 'pell') {
    if (flag(save, 'whistle_found') && !flag(save, 'whistle_returned')) return scene(session, 'whistle-returned', 'whistle-returned');
    if (flag(save, 'whistle_returned')) {
      if (flag(save, 'companion_released') && !flag(save, 'whistle_imitation')) {
        save.questFlags.whistle_imitation = true;
        return scene(session, 'whistle-imitation');
      }
      return scene(session, 'pell-repeat');
    }
    return flag(save, 'whistle_accepted') ? scene(session, 'pell-pending') : scene(session, 'whistle-accepted', 'whistle-accepted');
  }
  if (id === 'whistle-reeds') { save.questFlags.whistle_found = true; save.inventory['tin-whistle'] = 1; session.notice = 'Found Pell’s dented tin whistle'; return session; }
  if (id === 'fisher' || id === 'muddren-catch') {
    if (flag(save, 'wrong_catch')) return scene(session, 'fisher-repeat');
    if (!flag(save, 'rillik_bonded')) return scene(session, 'fisher-early');
    save.questFlags.companion_released = true;
    return scene(session, 'wrong-catch', 'wrong-catch');
  }
  if (id === 'seli') {
    if (!flag(save, 'seli_gift')) {
      save.questFlags.seli_gift = true;
      save.inventory.tincture = (save.inventory.tincture ?? 0) + 1;
      return scene(session, 'seli-gift');
    }
    if (save.party.some(member => member.vitality < member.maxVitality)) { healParty(save); return scene(session, 'seli-rest'); }
    return scene(session, 'seli-repeat');
  }
  const lines = beginNarrativeBeat(save, id);
  return lines.length ? open(session, id, lines) : session;
}

export function reduceGame(previous: GameSession, action: GameAction): GameSession {
  const session = copySession(previous.save, previous.notice);
  const save = session.save;
  if (action.type === 'settings') { save.settings = { ...save.settings, ...action.settings }; return session; }
  if (action.type === 'tick') { if (Number.isFinite(action.seconds)) save.playtimeSeconds += Math.max(0, Math.min(60, Math.floor(action.seconds))); return session; }
  const approach = session.dialogue?.approach;
  if (action.type === 'approach-step') {
    if (!approach || approach.actor !== action.actor || approach.steps.length !== action.remaining) return previous;
    const position = save.quayResidents?.[approach.actor];
    if (position) {
      const steps = approach.steps.splice(0, save.settings.reducedMotion ? approach.steps.length : 1);
      for (const direction of steps) {
        position.x += DELTAS[direction].x; position.y += DELTAS[direction].y; position.facing = direction;
      }
    }
    if (!position || !approach.steps.length) {
      if (position) faceOneAnother(save, position);
      delete session.dialogue!.approach;
    }
    return session;
  }
  if (approach) return previous;
  if (action.type === 'input') {
    if (action.action === 'menu' || action.action === 'cancel') return session;
    if (action.action === 'confirm') return session.dialogue || save.battle || getPhase(session) === 'ending' ? advance(session) : getPhase(session) === 'explore' ? interact(session) : session;
    return reduceGame(session, { type: 'move', direction: action.action });
  }
  if (action.type === 'advance') return advance(session);
  if (action.type === 'choice') {
    const dialogue = session.dialogue;
    const choice = dialogue?.index === (dialogue?.lines.length ?? 0) - 1 ? dialogue?.choices?.find(value => value.id === action.id) : undefined;
    if (!choice) return previous;
    save.questFlags.response_tone = choice.id;
    save.questFlags.companion_released = true;
    save.dialogueHistory = [...save.dialogueHistory, dialogue!.lines[dialogue!.index]].slice(-100);
    return open(session, 'closing-after', [{ speaker: 'Tavian', text: choice.text }, ...beginNarrativeBeat(save, 'closing-after')], 'chapter-complete');
  }
  if (action.type === 'battle-beat') {
    if (!save.battle || session.dialogue) return previous;
    const next = advanceBattleBeat(save.battle, action.turn, action.index);
    if (next === save.battle) return previous;
    save.battle = next;
    return session;
  }
  if (action.type === 'battle') {
    if (!save.battle || session.dialogue || save.battle.playback || save.battle.phase !== 'choosing') return previous;
    save.battle = startBattleTurn(save.battle, action.action, { tinctures: Math.max(0, (save.inventory.tincture ?? 0) - save.battle.usedTinctures), emptyBuds: save.inventory['crystal-bud'] ?? 0 });
    return session;
  }
  if (action.type === 'seal') {
    if (!save.seal.active || session.dialogue || !flag(save, 'boss_defeated') || flag(save, 'rift_sealed') || !Number.isFinite(action.accuracy)) return previous;
    save.seal.attempts++;
    if (save.settings.sealAssist || save.settings.reducedMotion || action.accuracy >= 0.72) save.seal.pulses++;
    else { session.notice = 'Wait for the rings to meet, then press A.'; return session; }
    if (save.seal.pulses >= 3) { save.seal.active = false; return scene(session, 'sealed', 'sealed'); }
    session.notice = `${save.seal.pulses}/3 pulses aligned`; return session;
  }
  if (getPhase(session) !== 'explore') return previous;
  if (action.type === 'face') { save.player.facing = action.direction; return session; }
  if (action.type === 'move') {
    save.player.facing = action.direction; const delta = DELTAS[action.direction], x = save.player.x + delta.x, y = save.player.y + delta.y;
    if (canWalk(save, x, y)) {
      save.player.x = x; save.player.y = y; session.notice = '';
      if (save.player.mapId === 'harbor') {
        if (!flag(save, 'nia_met') && flag(save, 'disembarked')) return meetOnQuay(session, 'nia');
        if (flag(save, 'clues_complete') && !flag(save, 'bram_met')) return meetOnQuay(session, 'bram');
      }
    }
    return session;
  }
  if (action.type === 'interact') return interact(session, action.id);
  if (action.type === 'sense') {
    if (!flag(save, 'rillik_bonded')) { session.notice = 'Current Sense needs a companion.'; return session; }
    save.questFlags.companion_released = true;
    const sense = nearbyInteractions(save).find(object => object.kind === 'sense');
    if (sense) return interact(session, sense.id);
    save.questFlags.sense_pulse = Number(save.questFlags.sense_pulse ?? 0) + 1;
    session.notice = save.player.mapId === 'passage' && !flag(save, 'currents_followed') ? 'Rillik listens. Try the swirling water by the channel.' : 'Rillik’s tail ring glows, then settles. No nearby disturbance.';
    return session;
  }
  if (action.type === 'companion') { if (save.party.length) save.questFlags.companion_released = action.released; return session; }
  if (action.type === 'heal') {
    const injured = save.party.find(member => member.vitality < member.maxVitality);
    if (!injured) { session.notice = 'Your companions are already rested.'; return session; }
    if ((save.inventory.tincture ?? 0) < 1) { session.notice = 'No tinctures. Seli and the lantern alcove offer rest.'; return session; }
    save.inventory.tincture--; injured.vitality += tinctureRecovery(injured); save.collection[injured.id] = clone(injured); session.notice = `${SPECIES[injured.speciesId].name} recovered vitality`; return session;
  }
  return session;
}
