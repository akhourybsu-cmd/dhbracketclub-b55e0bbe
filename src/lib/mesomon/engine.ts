import { createBattle, makeCompanion, resolveBattleTurn } from './battle';
import { CLOSING_CHOICES } from './data/dialogue';
import { narrativeLines } from './narrative';
import { MAPS, WALKABLE_TILES } from './data/maps';
import { SPECIES } from './data/species';
import type { DialogueLine, DialogueState, Direction, GameAction, GameSession, MapDefinition, MapId, MapObject, MesomonSaveV1, StoryEvent } from './types';

export { SPECIES, MOVES } from './data/species';
export const CHAPTER_TITLE = 'The Harbor in Two Voices';
export const DELTAS: Record<Direction, { x: number; y: number }> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const flag = (save: MesomonSaveV1, key: string) => save.questFlags[key] === true;
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export function createNewSave(slot: 1 | 2 | 3 = 1): MesomonSaveV1 {
  return { schemaVersion: 1, slot, player: { name: 'Tavian', mapId: 'ship', x: 8, y: 9, facing: 'up' }, party: [], collection: {}, inventory: { tincture: 2, 'crystal-bud': 2 }, questFlags: {}, activeQuestId: 'harbor-two-voices', rifts: { 'port-marche': 'unseen' }, settings: { textSpeed: 'normal', battleSpeed: 'normal', reducedMotion: false, haptics: false, mute: true, sealAssist: false, musicVolume: 0.35, ambientVolume: 0.3 }, playtimeSeconds: 0, savedAt: new Date().toISOString(), battle: null, seal: { active: false, pulses: 0, attempts: 0 }, dialogue: null, dialogueHistory: [] };
}

export function createSession(save: MesomonSaveV1): GameSession { const restored = clone(save); return { save: restored, dialogue: restored.dialogue, notice: '' }; }
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
  });
}

export function canWalk(save: MesomonSaveV1, x: number, y: number): boolean {
  const map = getMap(save);
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= map.width || y >= map.height || !WALKABLE_TILES.has(map.tiles[y][x])) return false;
  if (map.id === 'passage' && !flag(save, 'sluice_open') && x >= 10 && x <= 11 && y >= 11 && y <= 14) return false;
  return !getVisibleObjects(save).some(object => object.solid && object.x === x && object.y === y);
}

export function nearbyInteractions(save: MesomonSaveV1): MapObject[] {
  const player = save.player, delta = DELTAS[player.facing];
  return getVisibleObjects(save).filter(object => Math.abs(object.x - player.x) + Math.abs(object.y - player.y) <= 1)
    .sort((a, b) => {
      const rank = (object: MapObject) => object.x === player.x + delta.x && object.y === player.y + delta.y ? -1 : Math.abs(object.x - player.x) + Math.abs(object.y - player.y);
      return rank(a) - rank(b);
    });
}

export function getPhase(session: GameSession): 'explore' | 'dialogue' | 'battle' | 'seal' | 'ending' {
  if (session.dialogue) return 'dialogue';
  if (session.save.battle) return 'battle';
  if (session.save.seal.active) return 'seal';
  if (flag(session.save, 'chapter_complete') && !flag(session.save, 'ending_seen')) return 'ending';
  return 'explore';
}

const QUEST_STEPS = [
  ['disembarked', 'Disembark in Port Marche'], ['workshop_entered', 'Find Edda’s workshop'], ['clues_complete', 'Inspect the three workshop clues'],
  ['bram_met', 'Speak to Bram at the tide barrier'], ['rillik_bonded', 'Free the trapped Rillik'], ['current_eddy', 'Trace the current beneath the boards'],
  ['sluice_open', 'Drain the crossing'], ['tutorial_complete', 'Make the under-wharf passage safe'], ['currents_followed', 'Follow the upper channel'], ['boss_defeated', 'Push back the Rift Wretch'], ['rift_sealed', 'Seal the first rift'], ['page_found', 'Inspect the stone beside the sealed rift'], ['chapter_complete', 'Bring Edda’s page home'],
] as const;
export function getQuestSteps(save: MesomonSaveV1) {
  const first = QUEST_STEPS.findIndex(([key]) => !flag(save, key));
  return QUEST_STEPS.map(([id, label], index) => ({ id, label, complete: flag(save, id), active: index === first }));
}
export function getObjective(save: MesomonSaveV1): string {
  if (!flag(save, 'captain_met')) return 'Speak to the captain, near the ship’s bow.';
  if (!flag(save, 'disembarked')) return 'Take the gangplank at the back of the deck.';
  if (!flag(save, 'nia_met')) return 'Nia is waiting at the arrival pier.';
  if (!flag(save, 'workshop_entered')) return 'Edda’s workshop is northwest, past the market.';
  if (!flag(save, 'clues_complete')) return `Search Edda’s chart, field map and empty hook · ${['clue_chart', 'clue_map', 'clue_hook'].filter(key => flag(save, key)).length}/3`;
  if (!flag(save, 'bram_met')) return 'Speak to Bram on the far eastern quay.';
  if (!flag(save, 'gate_opened')) return flag(save, 'brace_found') ? 'Brace the jammed wheel. Nia will hold the gate.' : 'Find a loose brace below the tide wheel.';
  if (!flag(save, 'rillik_bonded')) return 'Rillik came back. Kneel beside the broken walkway.';
  if (!flag(save, 'current_eddy')) return 'Enter the under-wharf passage. Let Rillik sense the current.';
  if (!flag(save, 'sluice_open')) return 'Follow the pale ripple to the maintenance sluice.';
  if (!flag(save, 'tutorial_complete')) return 'A frightened Tressel guards the crossing. Approach carefully.';
  if (!flag(save, 'current_channel')) return 'Use Current Sense near the upper channel.';
  if (!flag(save, 'boss_defeated')) return 'Follow the second current into the old tide chamber.';
  if (!flag(save, 'rift_sealed')) return 'The demon is gone. Align three pulses to seal the rift.';
  if (!flag(save, 'page_found')) return 'Inspect the stone beside the sealed rift.';
  if (!flag(save, 'chapter_complete')) return 'Return to Nia at Edda’s workshop.';
  return 'Port Marche is quiet again. The inland road will have to wait.';
}

function open(session: GameSession, id: string, lines: DialogueLine[], onFinish?: StoryEvent, choices?: DialogueState['choices']): GameSession {
  const dialogue: DialogueState = { id, lines: clone(lines), index: 0, ...(onFinish ? { onFinish } : {}), ...(choices ? { choices: clone(choices) } : {}) };
  session.save.dialogue = dialogue;
  return { ...session, dialogue, notice: '' };
}
function scene(session: GameSession, id: string, onFinish?: StoryEvent): GameSession {
  return open(session, id, narrativeLines(session.save, id), onFinish);
}
function short(session: GameSession, speaker: string, ...lines: string[]): GameSession { return open(session, `${speaker}-remark`, lines.map(text => ({ speaker, text }))); }
function teleport(session: GameSession, mapId: MapId, x: number, y: number, facing: Direction = 'up'): GameSession { session.save.player = { ...session.save.player, mapId, x, y, facing }; return session; }
function healParty(save: MesomonSaveV1) { save.party = save.party.map(member => ({ ...member, vitality: member.maxVitality })); for (const member of save.party) save.collection[member.id] = clone(member); }
function firstBond(save: MesomonSaveV1) { if (flag(save, 'rillik_bonded')) return; const member = makeCompanion('rillik', 'rillik-first'); save.party.push(member); save.collection[member.id] = clone(member); save.questFlags.rillik_bonded = true; save.questFlags.companion_released = true; }

function event(session: GameSession, name?: StoryEvent): GameSession {
  const save = session.save;
  switch (name) {
    case 'captain-met': save.questFlags.captain_met = true; break;
    case 'nia-met': save.questFlags.nia_met = true; break;
    case 'workshop-entered': save.questFlags.workshop_entered = true; break;
    case 'clues-complete': save.questFlags.clues_complete = true; break;
    case 'bram-met': save.questFlags.bram_met = true; break;
    case 'gate-opened': save.questFlags.gate_opened = true; break;
    case 'first-bond': firstBond(save); session.notice = 'Rillik chose to stay · first crystal formed'; break;
    case 'boss-introduced': save.questFlags.boss_introduced = true; save.rifts['port-marche'] = 'found'; save.battle = createBattle(save.party, 'rift-wretch', 'chamber-boss', 19200617); break;
    case 'sealed': save.questFlags.rift_sealed = true; save.rifts['port-marche'] = 'sealed'; save.seal.active = false; break;
    case 'page-found': save.questFlags.page_found = true; break;
    case 'chapter-complete': save.questFlags.chapter_complete = true; healParty(save); break;
    case 'whistle-accepted': save.questFlags.whistle_accepted = true; break;
    case 'whistle-returned': if (!flag(save, 'whistle_returned')) { save.questFlags.whistle_returned = true; save.inventory.tincture = (save.inventory.tincture ?? 0) + 1; save.inventory['tin-whistle'] = 0; session.notice = 'Tin Whistle complete · +1 tincture'; } break;
    case 'wrong-catch': save.questFlags.wrong_catch = true; break;
    case 'tutorial-complete': save.battle = createBattle(save.party, 'tressel', 'passage-encounter', 420197); break;
    case 'wild-complete': save.battle = createBattle(save.party, 'gleamwing', 'gleamwing-encounter', 501932); break;
  }
  return session;
}

function finishBattle(session: GameSession): GameSession {
  const save = session.save, battle = save.battle;
  if (!battle || battle.phase === 'choosing') return session;
  for (const ally of battle.allies) {
    const member = save.party.find(value => value.id === ally.id);
    if (member) { member.vitality = ally.vitality; if (battle.phase === 'won' || battle.phase === 'resonated') member.experience += 20; save.collection[member.id] = clone(member); }
  }
  save.inventory.tincture = Math.max(0, (save.inventory.tincture ?? 0) - battle.usedTinctures);
  save.battle = null;
  if (battle.phase === 'lost') {
    healParty(save); teleport(session, 'tide-stairs', 12, 12, 'left');
    if (flag(save, 'page_found')) return short(session, 'Tavian', 'Dry boards. We can catch our breath here.');
    return short(session, 'Nia', 'Steady. Sit here on the steps a minute.', battle.id === 'chamber-boss' ? 'That thing can wait. Let me see your wrist.' : 'There’s room to rest here. I’ve got the gate.');
  }
  if (battle.phase === 'escaped') { session.notice = 'You stepped back. The creature has room.'; return session; }
  if (battle.phase === 'resonated' && battle.enemy.speciesId !== 'rift-wretch') {
    const member = makeCompanion(battle.enemy.speciesId, `${battle.enemy.speciesId}-${battle.id}`);
    if (!save.collection[member.id] && save.party.length < 3 && (save.inventory['crystal-bud'] ?? 0) > 0) { save.party.push(member); save.collection[member.id] = clone(member); save.inventory['crystal-bud']--; }
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
  if (session.save.battle) return finishBattle(session);
  if (getPhase(session) === 'ending') { session.save.questFlags.ending_seen = true; session.notice = 'Chapter I complete · the harbor remains yours to explore'; }
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
    save.questFlags.disembarked = true; teleport(session, 'harbor', 26, 30, 'up'); session.notice = 'Port Marche · the harbor remembers you'; return session;
  }
  if (id === 'nia') return flag(save, 'nia_met') ? scene(session, 'nia-repeat') : scene(session, 'nia', 'nia-met');
  if (id === 'workshop-door') {
    if (!flag(save, 'nia_met')) return short(session, 'Tavian', 'Nia’s waiting at the pier. I should say hello.');
    teleport(session, 'workshop', 8, 11);
    return !flag(save, 'workshop_entered') ? scene(session, 'workshop', 'workshop-entered') : session;
  }
  if (id === 'workshop-exit') return teleport(session, 'harbor', 9, 16, 'down');
  if (['chart', 'field-map', 'satchel-hook'].includes(id)) {
    const key = id === 'chart' ? 'clue_chart' : id === 'field-map' ? 'clue_map' : 'clue_hook';
    const lines = narrativeLines(save, flag(save, key) ? id + '-repeat' : id);
    save.questFlags[key] = true;
    const complete = ['clue_chart', 'clue_map', 'clue_hook'].every(value => flag(save, value));
    return open(session, id, [...lines, ...(complete && !flag(save, 'clues_complete') ? narrativeLines(save, 'clues-complete') : [])], complete && !flag(save, 'clues_complete') ? 'clues-complete' : undefined);
  }
  if (id === 'bram') {
    if (!flag(save, 'clues_complete')) return scene(session, 'bram-early');
    return flag(save, 'bram_met') ? scene(session, 'bram-repeat') : scene(session, 'bram', 'bram-met');
  }
  if (id === 'tide-door') return flag(save, 'bram_met') ? teleport(session, 'tide-stairs', 5, 4) : short(session, 'Bram', 'Talk to me before you pass that barrier.');
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
  if (id === 'rillik-bond') return flag(save, 'gate_opened') ? scene(session, 'first-bond', 'first-bond') : short(session, 'Tavian', 'It can’t get clear of the lattice. Open the gate first.');
  if (id === 'passage-door') return flag(save, 'rillik_bonded') ? teleport(session, 'passage', 4, 19) : short(session, 'Nia', 'Check the lower walkway before going under.');
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
    if (flag(save, 'sluice_open')) return short(session, 'Tavian', 'The crossing’s drained. No need to turn it again.');
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
    if (!flag(save, 'tutorial_complete')) return short(session, 'Tavian', 'That frightened Tressel is still guarding the way back.');
    if (!flag(save, 'currents_followed')) return short(session, 'Tavian', 'Rillik hasn’t found where the second current leads yet.');
    return teleport(session, 'chamber', 8, 12);
  }
  if (id === 'chamber-exit') return teleport(session, 'passage', 18, 4, 'down');
  if (id === 'rift') {
    if (flag(save, 'rift_sealed')) return short(session, 'Tavian', 'One voice. At last.');
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
    save.questFlags.companion_released = true;
    return open(session, 'closing', narrativeLines(save, 'closing'), undefined, CLOSING_CHOICES);
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
    if (save.party.length) { healParty(save); return scene(session, 'seli-rest'); }
    return scene(session, 'seli-repeat');
  }
  const lines = narrativeLines(save, id);
  return lines.length ? open(session, id, lines) : session;
}

export function reduceGame(previous: GameSession, action: GameAction): GameSession {
  const session = createSession(previous.save); session.notice = previous.notice;
  const save = session.save;
  if (action.type === 'settings') { save.settings = { ...save.settings, ...action.settings }; return session; }
  if (action.type === 'tick') { if (Number.isFinite(action.seconds)) save.playtimeSeconds += Math.max(0, Math.min(60, Math.floor(action.seconds))); return session; }
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
    save.dialogueHistory = [...save.dialogueHistory, dialogue!.lines[dialogue!.index]].slice(-100);
    return open(session, 'closing-after', [{ speaker: 'Tavian', text: choice.text }, ...narrativeLines(save, 'closing-after')], 'chapter-complete');
  }
  if (action.type === 'battle') {
    if (!save.battle || session.dialogue || save.battle.phase !== 'choosing') return previous;
    save.battle = resolveBattleTurn(save.battle, action.action, { tinctures: Math.max(0, (save.inventory.tincture ?? 0) - save.battle.usedTinctures), emptyBuds: save.inventory['crystal-bud'] ?? 0 });
    return session;
  }
  if (action.type === 'seal') {
    if (!save.seal.active || session.dialogue || !flag(save, 'boss_defeated') || flag(save, 'rift_sealed') || !Number.isFinite(action.accuracy)) return previous;
    save.seal.attempts++;
    if (save.settings.sealAssist || save.settings.reducedMotion || action.accuracy >= 0.72) save.seal.pulses++;
    else { session.notice = 'A little early. Breathe, then try the same pulse again.'; return session; }
    if (save.seal.pulses >= 3) { save.seal.active = false; return scene(session, 'sealed', 'sealed'); }
    session.notice = `${save.seal.pulses}/3 pulses aligned`; return session;
  }
  if (getPhase(session) !== 'explore') return previous;
  if (action.type === 'move') {
    save.player.facing = action.direction; const delta = DELTAS[action.direction], x = save.player.x + delta.x, y = save.player.y + delta.y;
    if (canWalk(save, x, y)) { save.player.x = x; save.player.y = y; session.notice = ''; }
    return session;
  }
  if (action.type === 'interact') return interact(session, action.id);
  if (action.type === 'sense') {
    if (!flag(save, 'rillik_bonded')) { session.notice = 'There is no bonded current to follow yet.'; return session; }
    save.questFlags.companion_released = true;
    const sense = nearbyInteractions(save).find(object => object.kind === 'sense');
    if (sense) return interact(session, sense.id);
    save.questFlags.sense_pulse = Number(save.questFlags.sense_pulse ?? 0) + 1;
    session.notice = save.player.mapId === 'passage' && !flag(save, 'currents_followed') ? 'Rillik listens. Find the wet eddies beside the channel.' : 'Rillik’s tail ring glows, then settles. No nearby disturbance.';
    return session;
  }
  if (action.type === 'companion') { if (save.party.length) save.questFlags.companion_released = action.released; return session; }
  if (action.type === 'heal') {
    const injured = save.party.find(member => member.vitality < member.maxVitality);
    if (!injured) { session.notice = 'Your companions are already rested.'; return session; }
    if ((save.inventory.tincture ?? 0) < 1) { session.notice = 'No tinctures. Seli and the lantern alcove offer rest.'; return session; }
    save.inventory.tincture--; injured.vitality = Math.min(injured.maxVitality, injured.vitality + 26); save.collection[injured.id] = clone(injured); session.notice = `${SPECIES[injured.speciesId].name} recovered vitality`; return session;
  }
  return session;
}
