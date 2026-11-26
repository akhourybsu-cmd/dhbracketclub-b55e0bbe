import { describe, expect, it } from 'vitest';
import { createBattle, makeCompanion, resonanceEligibility, resolveBattleTurn } from '@/lib/mesomon/battle';
import { canWalk, createNewSave, createSession, DELTAS, getMap, getObjective, getPhase, getQuestSteps, getVisibleObjects, nearbyInteractions, reduceGame } from '@/lib/mesomon/engine';
import { keyboardAction, pointerAction } from '@/lib/mesomon/input';
import { MAPS } from '@/lib/mesomon/data/maps';
import { migrateSave } from '@/lib/mesomon/save';
import type { BattleAction, Direction, GameSession, MapObject } from '@/lib/mesomon/types';

function playTurn(previous: GameSession, action: BattleAction): GameSession {
  let session = reduceGame(previous, { type: 'battle', action });
  while (session.save.battle?.playback) session = reduceGame(session, { type: 'advance' });
  return session;
}
function finishDialogue(value: GameSession): GameSession {
  let session = value;
  for (let guard = 0; session.dialogue && guard < 300; guard++) {
    const dialogue = session.dialogue;
    if (dialogue.approach) {
      session = reduceGame(session, { type: 'approach-step', actor: dialogue.approach.actor, remaining: dialogue.approach.steps.length });
      continue;
    }
    session = reduceGame(session, dialogue.choices && dialogue.index === dialogue.lines.length - 1 ? { type: 'choice', id: 'warm' } : { type: 'advance' });
  }
  expect(session.dialogue).toBeNull();
  return session;
}
function walkTo(session: GameSession, object: MapObject): GameSession {
  const player = session.save.player, key = (x: number, y: number) => `${x},${y}`;
  const queue: { x: number; y: number; path: Direction[] }[] = [{ x: player.x, y: player.y, path: [] }], seen = new Set([key(player.x, player.y)]);
  while (queue.length) {
    const current = queue.shift()!;
    if (Math.abs(current.x - object.x) + Math.abs(current.y - object.y) <= 1) return current.path.reduce((value, direction) => reduceGame(value, { type: 'move', direction }), session);
    for (const direction of Object.keys(DELTAS) as Direction[]) {
      const delta = DELTAS[direction], x = current.x + delta.x, y = current.y + delta.y;
      if (seen.has(key(x, y)) || !canWalk(session.save, x, y)) continue;
      seen.add(key(x, y)); queue.push({ x, y, path: [...current.path, direction] });
    }
  }
  throw new Error(`Unreachable ${session.save.player.mapId}:${object.id}`);
}
function beginInteraction(session: GameSession, id: string): GameSession {
  const object = getVisibleObjects(session.save).find(value => value.id === id);
  if (!object) throw new Error(`Missing ${session.save.player.mapId}:${id}`);
  return reduceGame(walkTo(session, object), { type: 'interact', id });
}
function interactWith(session: GameSession, id: string): GameSession {
  const result = finishDialogue(beginInteraction(session, id));
  expect(migrateSave(result.save), `Save remains valid after ${id}`).not.toBeNull();
  return result;
}
function reachFirstBond(): GameSession {
  let session = createSession(createNewSave());
  for (const id of ['captain', 'gangplank', 'nia', 'workshop-door', 'chart', 'field-map', 'satchel-hook', 'workshop-exit', 'bram', 'tide-door', 'gate-brace', 'gate-wheel', 'rillik-bond']) session = interactWith(session, id);
  return session;
}

describe('Mesomon Port Marche chapter', () => {
  it('walks the full real chapter with collision, a willing wild bond, boss, seal and return', () => {
    let session = reachFirstBond();
    expect(session.save.party.map(member => member.speciesId)).toEqual(['rillik']);
    expect(session.save.inventory['crystal-bud']).toBe(2);
    for (const id of ['passage-door', 'pickup-tincture', 'sense-eddy', 'sluice', 'tressel']) session = interactWith(session, id);
    expect(session.save.battle?.enemy.speciesId).toBe('tressel');
    session = playTurn(session, { type: 'move', moveId: 'resonant-cry' });
    session = playTurn(session, { type: 'move', moveId: 'resonant-cry' });
    expect(resonanceEligibility(session.save.battle!, 2).eligible).toBe(true);
    session = playTurn(session, { type: 'resonate' });
    expect(session.save.party).toHaveLength(1);
    session = finishDialogue(reduceGame(session, { type: 'advance' }));
    expect(session.save.party.map(member => member.speciesId)).toEqual(['rillik', 'tressel']);
    expect(session.save.inventory['crystal-bud']).toBe(1);
    const once = JSON.stringify(session.save.party);
    session = reduceGame(session, { type: 'advance' });
    expect(JSON.stringify(session.save.party)).toBe(once);
    for (const id of ['save-lamp', 'sense-channel', 'chamber-door']) session = interactWith(session, id);
    const flooded = beginInteraction(session, 'chamber-markings');
    const floodedLines = flooded.dialogue!.lines;
    session = interactWith(finishDialogue(flooded), 'rift');
    expect(session.save.battle?.enemy.speciesId).toBe('rift-wretch');
    expect(session.save.rifts['port-marche']).toBe('found');
    for (let guard = 0; session.save.battle?.phase === 'choosing' && guard < 10; guard++) session = playTurn(session, { type: 'move', moveId: 'resonant-cry' });
    expect(session.save.battle?.phase).toBe('won');
    session = finishDialogue(reduceGame(session, { type: 'advance' }));
    expect(getPhase(session)).toBe('seal');
    session = reduceGame(session, { type: 'seal', accuracy: 0.1 });
    expect(session.save.seal.pulses).toBe(0);
    for (let pulse = 0; pulse < 3; pulse++) session = reduceGame(session, { type: 'seal', accuracy: 1 });
    session = finishDialogue(session);
    expect(session.save.rifts['port-marche']).toBe('sealed');
    const drained = beginInteraction(session, 'chamber-markings');
    expect(drained.dialogue!.lines).not.toEqual(floodedLines);
    session = finishDialogue(drained);
    for (const id of ['page', 'chamber-exit', 'passage-exit', 'stairs-exit', 'workshop-door', 'closing']) session = interactWith(session, id);
    expect(getPhase(session)).toBe('ending');
    expect(getQuestSteps(session.save).every(step => step.complete)).toBe(true);
    expect(session.save.questFlags.response_tone).toBe('warm');
    expect(session.save.party.every(member => member.vitality === member.maxVitality)).toBe(true);
    session = createSession(migrateSave(session.save)!);
    expect(getPhase(session)).toBe('ending');
    session = reduceGame(session, { type: 'advance' });
    session = createSession(migrateSave(session.save)!);
    expect(getPhase(session)).toBe('explore');
    expect(getObjective(session.save)).toContain('inland road');
    const returnVisit = beginInteraction(session, 'closing');
    expect(returnVisit.dialogue!.choices).toBeUndefined();
    expect(returnVisit.dialogue!.lines.some(line => line.speaker === 'Nia')).toBe(true);
    expect(getPhase(finishDialogue(returnVisit))).toBe('explore');
  });

  it.each([
    ['chart', 'satchel-hook', 'field-map'], ['chart', 'field-map', 'satchel-hook'],
    ['field-map', 'chart', 'satchel-hook'], ['field-map', 'satchel-hook', 'chart'],
    ['satchel-hook', 'chart', 'field-map'], ['satchel-hook', 'field-map', 'chart'],
  ])('solves the workshop once when visiting %s, %s, %s', (...order) => {
    let session = createSession(createNewSave());
    for (const id of ['captain', 'gangplank', 'nia', 'workshop-door']) session = interactWith(session, id);
    expect(getVisibleObjects(session.save).some(object => object.id === 'closing')).toBe(true);
    for (const [index, id] of order.entries()) {
      const first = beginInteraction(session, id);
      expect(first.dialogue?.onFinish).toBe(index === 2 ? 'clues-complete' : undefined);
      const revisit = beginInteraction(finishDialogue(first), id);
      expect(revisit.dialogue?.lines).not.toEqual(first.dialogue?.lines);
      expect(revisit.dialogue?.lines.length).toBeGreaterThan(0);
      expect(revisit.dialogue?.onFinish).toBeUndefined();
      session = finishDialogue(revisit);
      if (index === 1) {
        const remaining = order[2];
        const hint = beginInteraction(session, 'closing');
        const clueWords = { chart: /chart/i, 'field-map': /map/i, 'satchel-hook': /hook/i };
        expect(hint.dialogue!.lines.at(-1)?.text).toMatch(clueWords[remaining as keyof typeof clueWords]);
        session = finishDialogue(hint);
      }
    }
    expect(session.save.questFlags.clues_complete).toBe(true);
    session = interactWith(session, 'workshop-exit');
    expect(getVisibleObjects(session.save).some(object => object.id === 'nia')).toBe(false);
  });

  it('remembers optional introductions and observations through a reload', () => {
    let session = createSession(createNewSave());
    for (const id of ['captain', 'gangplank']) session = interactWith(session, id);
    const stranger = beginInteraction(session, 'pell');
    expect(stranger.dialogue?.onFinish).toBe('whistle-accepted');
    const pending = beginInteraction(finishDialogue(stranger), 'pell');
    expect(pending.dialogue?.id).toBe('pell-pending');
    expect(pending.dialogue?.onFinish).toBeUndefined();
    session = interactWith(finishDialogue(pending), 'bram');
    const first = beginInteraction(session, 'dockworker');
    session = createSession(migrateSave(finishDialogue(first).save)!);
    const repeat = beginInteraction(session, 'dockworker');
    expect(repeat.dialogue?.lines).not.toEqual(first.dialogue?.lines);
    expect(session.save.questFlags['visited:dockworker']).toBe(true);
    const unintroduced = createSession(createNewSave());
    expect(unintroduced.save.questFlags['visited:bram']).toBeUndefined();
    const progress = ['nia', 'workshop-door', 'field-map', 'chart', 'satchel-hook', 'workshop-exit'];
    for (const id of progress) session = interactWith(session, id);
    let other = unintroduced;
    for (const id of ['captain', 'gangplank', ...progress]) other = interactWith(other, id);
    expect(beginInteraction(other, 'bram').dialogue?.lines).not.toEqual(beginInteraction(session, 'bram').dialogue?.lines);
  });

  it.each([false, true])('lets Tavian discuss the crane tag once, including after a prior visit (%s)', (metRopeMaker) => {
    let session = createSession(createNewSave());
    for (const id of ['captain', 'gangplank']) session = interactWith(session, id);
    if (metRopeMaker) {
      const withoutTag = beginInteraction(session, 'rope-worker');
      expect(withoutTag.dialogue?.lines.some(line => line.speaker === 'Tavian')).toBe(false);
      session = finishDialogue(withoutTag);
    }
    session = interactWith(session, 'harbor-crane');
    const withTag = beginInteraction(createSession(migrateSave(session.save)!), 'rope-worker');
    expect(withTag.dialogue?.lines[0]).toMatchObject({ speaker: 'Tavian', text: expect.stringMatching(/pie weight/i) });
    const resumed = createSession(migrateSave(withTag.save)!);
    expect(resumed.dialogue?.lines).toEqual(withTag.dialogue?.lines);
    const revisit = beginInteraction(finishDialogue(resumed), 'rope-worker');
    expect(revisit.dialogue?.lines).not.toEqual(withTag.dialogue?.lines);
  });

  it('lets Pell hear Rillik after an earlier whistle return only when Rillik is outside', () => {
    let session = createSession(createNewSave());
    for (const id of ['captain', 'gangplank', 'pell', 'whistle-reeds', 'pell', 'nia', 'workshop-door', 'field-map', 'chart', 'satchel-hook', 'workshop-exit', 'bram', 'tide-door', 'gate-brace', 'gate-wheel', 'rillik-bond', 'stairs-exit']) session = interactWith(session, id);
    session = reduceGame(session, { type: 'companion', released: false });
    session = interactWith(session, 'pell');
    expect(session.save.questFlags.whistle_imitation).toBeUndefined();
    session = reduceGame(session, { type: 'companion', released: true });
    const imitation = beginInteraction(session, 'pell');
    expect(imitation.dialogue?.id).toBe('whistle-imitation');
    expect(beginInteraction(finishDialogue(imitation), 'pell').dialogue?.id).toBe('pell-repeat');
  });

  it('lets a healthy companion visit Seli, then heals the party on its return from a fight', () => {
    let session = interactWith(reachFirstBond(), 'stairs-exit');
    session = interactWith(session, 'bram');
    expect(session.save.questFlags['heard:bram-lamp']).toBeUndefined();
    const originalTinctures = session.save.inventory.tincture;
    session = interactWith(session, 'seli');
    expect(session.save.inventory.tincture).toBe(originalTinctures + 1);
    const healthy = beginInteraction(session, 'seli');
    expect(healthy.dialogue?.lines.some(line => line.speaker === 'Seli')).toBe(true);
    expect(healthy.dialogue?.id).toBe('seli-repeat');
    session = finishDialogue(healthy);
    expect(session.save.questFlags['heard:edda-lamp-oil']).toBe(true);
    const lamp = beginInteraction(session, 'bram');
    expect(lamp.save.questFlags['heard:bram-lamp']).toBe(true);
    expect(lamp.dialogue!.lines.map(line => line.speaker)).toEqual(['Tavian', 'Bram']);
    session = finishDialogue(lamp);

    for (const id of ['tide-door', 'passage-door', 'sense-eddy', 'sluice', 'tressel']) session = interactWith(session, id);
    for (let turn = 0; turn < 4; turn++) {
      const active = session.save.battle!.allies[0];
      if (active.vitality < active.maxVitality) break;
      session = playTurn(session, { type: 'guard' });
    }
    session = playTurn(session, { type: 'flee' });
    session = finishDialogue(reduceGame(session, { type: 'advance' }));
    expect(session.save.party[0].vitality).toBeLessThan(session.save.party[0].maxVitality);
    for (const id of ['passage-exit', 'stairs-exit', 'pell', 'whistle-reeds', 'pell']) session = interactWith(session, id);
    const beforeTreatment = session.save.inventory.tincture;
    expect(session.save.questFlags['heard:seli-whistle']).toBeUndefined();

    const treatment = beginInteraction(session, 'seli');
    expect(treatment.dialogue?.id).toBe('seli-rest');
    expect(treatment.save.questFlags['heard:seli-whistle']).toBe(true);
    session = createSession(migrateSave(finishDialogue(treatment).save)!);
    expect(session.save.party[0].vitality).toBe(session.save.party[0].maxVitality);
    expect(session.save.collection[session.save.party[0].id]).toEqual(session.save.party[0]);
    const later = beginInteraction(session, 'seli');
    expect(later.dialogue?.id).toBe('seli-repeat');
    expect(later.dialogue?.lines).not.toEqual(treatment.dialogue?.lines);
    expect(later.save.inventory.tincture).toBe(beforeTreatment);
  });

  it.each([['merchant', 'dockworker'], ['dockworker', 'merchant']] as const)(
    'remembers the freight conversation when meeting %s before %s',
    (first, second) => {
      let session = createSession(createNewSave());
      for (const id of ['captain', 'gangplank', first]) session = interactWith(session, id);
      expect(session.save.questFlags['heard:onion-lighter']).toBeUndefined();
      session = beginInteraction(session, second);
      if (second === 'merchant') {
        expect(session.save.questFlags['heard:onion-lighter']).toBeUndefined();
        session = beginInteraction(finishDialogue(session), 'dockworker');
      }
      expect(session.save.questFlags['heard:onion-lighter']).toBe(true);
      const lines = session.dialogue!.lines;
      expect(lines.some(line => /onion/i.test(line.text))).toBe(true);
      const resumed = createSession(migrateSave(session.save)!);
      expect(resumed.dialogue?.lines).toEqual(lines);
      expect(beginInteraction(finishDialogue(resumed), 'dockworker').dialogue?.lines).not.toEqual(lines);
    },
  );

  it.each([true, false])('lets the chart recall the rigger only after hearing the bell story (%s)', (heardBell) => {
    let session = createSession(createNewSave());
    for (const id of ['captain', 'gangplank', ...(heardBell ? ['bell-worker'] : []), 'nia', 'workshop-door'])
      session = interactWith(session, id);
    const chart = beginInteraction(createSession(migrateSave(session.save)!), 'chart');
    expect(chart.dialogue?.lines.some(line => /bell/i.test(line.text))).toBe(heardBell);
  });

  it.each(['before', 'after'] as const)('uses the flour-carter lead at supper only if learned %s finding the page', (visit) => {
    const save = createNewSave();
    save.questFlags.workshop_entered = true;
    save.questFlags.nia_met = true;
    save.questFlags.page_found = visit === 'after';
    save.player = { ...save.player, mapId: 'harbor', x: 18, y: 5 };
    let session = interactWith(createSession(save), 'inland-gate');
    expect(session.save.questFlags['visited:inland-gate']).toBe(true);
    expect(Boolean(session.save.questFlags['heard:flour-carter'])).toBe(visit === 'after');
    session.save.questFlags.page_found = true;
    session = interactWith(createSession(migrateSave(session.save)!), 'workshop-door');
    const supper = beginInteraction(session, 'closing');
    expect(supper.dialogue?.lines.some(line => /flour/i.test(line.text))).toBe(visit === 'after');
    expect(supper.dialogue?.choices?.map(choice => choice.id)).toEqual(['warm', 'wry', 'direct']);
  });

  it('keeps all three closing answers distinct, saved, and spoken once', () => {
    const replies = new Set<string>();
    for (const id of ['warm', 'wry', 'direct'] as const) {
      let session = createSession(createNewSave());
      Object.assign(session.save.questFlags, { workshop_entered: true, page_found: true });
      session.save.player = { ...session.save.player, mapId: 'workshop', x: 8, y: 7 };
      session = beginInteraction(session, 'closing');
      while (session.dialogue!.index < session.dialogue!.lines.length - 1) session = reduceGame(session, { type: 'advance' });
      const answer = session.dialogue!.choices!.find(choice => choice.id === id)!.text;
      session = reduceGame(session, { type: 'choice', id });
      session = createSession(migrateSave(session.save)!);
      replies.add(session.dialogue!.lines.find(line => line.speaker === 'Nia')!.text);
      session = finishDialogue(session);
      expect(session.save.dialogueHistory.filter(line => line.speaker === 'Tavian' && line.text === answer)).toHaveLength(1);
      expect(session.save.questFlags.response_tone).toBe(id);
      session = reduceGame(session, { type: 'advance' });
      expect(beginInteraction(session, 'closing').dialogue?.choices).toBeUndefined();
    }
    expect(replies.size).toBe(3);
  });

  it('keeps Nia in one place and lets the harbor recognize the sealed rift on a first visit', () => {
    const save = createNewSave();
    const niaLocations = () => Object.values(MAPS).flatMap(map =>
      getVisibleObjects({ ...save, player: { ...save.player, mapId: map.id } })
        .filter(object => ['nia', 'closing', 'nia-stairs'].includes(object.id))
        .map(() => map.id));
    expect(niaLocations()).toEqual(['harbor']);
    save.questFlags.workshop_entered = true;
    expect(niaLocations()).toEqual(['workshop']);
    save.questFlags.bram_met = true;
    expect(niaLocations()).toEqual(['tide-stairs']);
    save.questFlags.page_found = true;
    expect(niaLocations()).toEqual(['workshop']);

    save.player = { ...save.player, mapId: 'harbor', x: 11, y: 25 };
    const before = beginInteraction(createSession(save), 'dockworker');
    save.questFlags.rift_sealed = true;
    const after = beginInteraction(createSession(save), 'dockworker');
    const repeat = beginInteraction(finishDialogue(after), 'dockworker');
    expect(after.dialogue?.lines).not.toEqual(before.dialogue?.lines);
    expect(repeat.dialogue?.lines).toEqual(after.dialogue?.lines);
  });

  it('resumes the exact lines from a preexisting save without rewriting its conversation', () => {
    const save = createNewSave();
    save.dialogue = { id: 'captain', index: 1, lines: [
      { speaker: 'Captain', text: 'Port Marche.' }, { speaker: 'Tavian', text: 'I can see that.' },
    ], onFinish: 'captain-met' };
    const restored = createSession(migrateSave(save)!);
    expect(restored.dialogue?.lines[restored.dialogue.index].text).toBe('I can see that.');
    expect(finishDialogue(restored).save.questFlags.captain_met).toBe(true);
  });

  it('will not bypass story barriers or interact with a distant object', () => {
    let session = createSession(createNewSave());
    const before = session.save.player;
    session = reduceGame(session, { type: 'interact', id: 'gangplank' });
    expect(session.save.player).toEqual(before);
    session = interactWith(session, 'gangplank');
    expect(session.save.player.mapId).toBe('ship');
    session = interactWith(session, 'captain'); session = interactWith(session, 'gangplank');
    session = interactWith(session, 'tide-door');
    expect(session.save.player.mapId).toBe('harbor');
    expect(session.save.questFlags.bram_met).toBeUndefined();
  });

  it('records the three distinct clues once and restores a conversation mid-line', () => {
    let session = createSession(createNewSave());
    for (const id of ['captain', 'gangplank', 'nia', 'workshop-door', 'chart']) session = interactWith(session, id);
    session = interactWith(session, 'chart');
    expect(session.save.questFlags.clues_complete).toBeUndefined();
    const object = getVisibleObjects(session.save).find(value => value.id === 'field-map')!;
    session = reduceGame(walkTo(session, object), { type: 'interact', id: object.id });
    session = reduceGame(session, { type: 'advance' });
    expect(createSession(JSON.parse(JSON.stringify(session.save))).dialogue?.index).toBe(1);
    session = finishDialogue(session); session = interactWith(session, 'satchel-hook');
    expect(session.save.questFlags.clues_complete).toBe(true);
    expect(session.save.dialogueHistory.length).toBeLessThanOrEqual(100);
  });

  it('keeps optional whistle reward and noncombat Wrong Catch idempotent', () => {
    let session = reachFirstBond();
    session = interactWith(session, 'stairs-exit');
    session = interactWith(session, 'pell'); session = interactWith(session, 'whistle-reeds');
    const tinctures = session.save.inventory.tincture;
    session = interactWith(session, 'pell'); session = interactWith(session, 'pell');
    expect(session.save.questFlags.whistle_returned).toBe(true);
    expect(session.save.inventory.tincture).toBe(tinctures + 1);
    session = interactWith(session, 'fisher'); session = interactWith(session, 'fisher');
    expect(session.save.questFlags.wrong_catch).toBe(true);
    expect(session.save.battle).toBeNull();
    expect(session.save.party).toHaveLength(1);
  });

  it('restores battle and seal progress exactly across a reload', () => {
    let session = reachFirstBond();
    for (const id of ['passage-door', 'sense-eddy', 'sluice', 'tressel']) session = interactWith(session, id);
    session = playTurn(session, { type: 'guard' });
    const restored = createSession(JSON.parse(JSON.stringify(session.save)));
    expect(restored.save.battle).toEqual(session.save.battle);
    expect(playTurn(restored, { type: 'move', moveId: 'brine-snap' }).save.battle).toEqual(playTurn(session, { type: 'move', moveId: 'brine-snap' }).save.battle);
    session.save.battle = null; session.save.questFlags.boss_defeated = true; session.save.seal = { active: true, pulses: 1, attempts: 2 };
    expect(createSession(JSON.parse(JSON.stringify(session.save))).save.seal).toEqual({ active: true, pulses: 1, attempts: 2 });
    session.save.settings.sealAssist = true;
    session = reduceGame(session, { type: 'seal', accuracy: 0 });
    expect(session.save.seal.pulses).toBe(2);
  });

  it('never bonds the Rift Wretch and does not consume a turn for an invalid action', () => {
    const battle = createBattle([makeCompanion('rillik')], 'rift-wretch', 'chamber-boss', 77);
    expect(resonanceEligibility({ ...battle, agitation: 0 }, 9).eligible).toBe(false);
    const result = resolveBattleTurn(battle, { type: 'resonate' }, { emptyBuds: 9 });
    expect(result.phase).toBe('choosing'); expect(result.turn).toBe(0); expect(result.log[0]).toContain('Rift Wretch');
    expect(resolveBattleTurn(battle, { type: 'move', moveId: 'bank-break' })).toBe(battle);
  });

  it('requires zero Stability to expel a demon instead of treating its hidden vitality as the goal', () => {
    const battle = createBattle([makeCompanion('rillik')], 'rift-wretch', 'chamber-boss', 77);
    const inconsistentLegacySnapshot = { ...battle, enemy: { ...battle.enemy, vitality: 0 }, stability: 64 };
    const result = resolveBattleTurn(inconsistentLegacySnapshot, { type: 'move', moveId: 'brine-snap' });
    expect(result.phase).toBe('choosing');
    expect(result.stability).toBeGreaterThan(0);
    expect(result.enemy.vitality).toBeGreaterThan(0);
    const final = resolveBattleTurn({ ...result, stability: 1 }, { type: 'move', moveId: 'resonant-cry' });
    expect(final.phase).toBe('won');
    expect(final.stability).toBe(0);
  });

  it('uses deterministic seeded turns, priority, guard, healing and a safe loss retreat', () => {
    const battle = createBattle([makeCompanion('rillik')], 'tressel', 'passage-encounter', 123);
    const first = resolveBattleTurn(battle, { type: 'move', moveId: 'brine-snap' });
    expect(first).toEqual(resolveBattleTurn(battle, { type: 'move', moveId: 'brine-snap' }));
    expect(first.log[0]).toContain('Tressel'); // faster wild opponent acts first
    const guarded = resolveBattleTurn(battle, { type: 'guard' });
    expect(guarded.log[0]).toContain('braces');
    expect(guarded.allies[0].vitality).toBeGreaterThan(first.allies[0].vitality);
    const healed = resolveBattleTurn(first, { type: 'item', itemId: 'tincture' }, { tinctures: 1 });
    expect(healed.usedTinctures).toBe(1);
    expect(resolveBattleTurn(first, { type: 'item', itemId: 'tincture' }, { tinctures: 0 }).usedTinctures).toBe(0);
    let session = reachFirstBond();
    session.save.battle = { ...createBattle(session.save.party, 'rift-wretch', 'chamber-boss', 77), phase: 'lost' };
    session = finishDialogue(reduceGame(session, { type: 'advance' }));
    expect(session.save.player.mapId).toBe('tide-stairs');
    expect(session.save.party[0].vitality).toBe(session.save.party[0].maxVitality);
    expect(session.save.questFlags.boss_defeated).toBeUndefined();
  });

  it('validates resonance calm, frenzy, capacity and crystal conditions independently', () => {
    const battle = createBattle([makeCompanion('rillik')], 'gleamwing');
    expect(resonanceEligibility(battle).eligible).toBe(false);
    const calm = { ...battle, agitation: 0 };
    expect(resonanceEligibility(calm).eligible).toBe(true);
    expect(resonanceEligibility({ ...calm, frenzy: true }).eligible).toBe(false);
    expect(resonanceEligibility(calm, 0).eligible).toBe(false);
    expect(resonanceEligibility(calm, 1, false).eligible).toBe(false);
    expect(resonanceEligibility({ ...calm, allies: [calm.allies[0], calm.allies[0], calm.allies[0]] }).eligible).toBe(false);
  });

  it('does not treat low health as consent while a creature is still frightened', () => {
    const battle = createBattle([makeCompanion('rillik')], 'tressel');
    const tired = { ...battle, enemy: { ...battle.enemy, vitality: 1 } };
    expect(resonanceEligibility(tired).eligible).toBe(false);
    expect(resonanceEligibility(tired).reason).toContain('pulling away');
    expect(resonanceEligibility({ ...tired, agitation: 42 }).eligible).toBe(true);
    expect(resonanceEligibility({ ...battle, agitation: 27 }).eligible).toBe(true);
  });

  it('does not pass a fainted companion’s queued move to its replacement', () => {
    const rillik = { ...makeCompanion('rillik'), vitality: 1 };
    const battle = createBattle([rillik, makeCompanion('gleamwing')], 'tressel', 'passage-encounter', 57);
    const result = resolveBattleTurn(battle, { type: 'move', moveId: 'brine-snap' });
    expect(result.activeIndex).toBe(1);
    expect(result.allies[0].vitality).toBe(0);
    expect(result.enemy.vitality).toBe(battle.enemy.vitality);
    expect(result.log.some(line => line.includes('Brine Snap'))).toBe(false);
    const next = resolveBattleTurn(result, { type: 'move', moveId: 'quick-tackle' });
    expect(next.enemy.vitality).toBeLessThan(result.enemy.vitality);
  });

  it('keeps the optional lantern branch behind the same closed sluice crossing', () => {
    let session = reachFirstBond();
    session = interactWith(session, 'passage-door');
    const tressel = getVisibleObjects(session.save).find(object => object.id === 'tressel')!;
    expect(() => walkTo(session, tressel)).toThrow('Unreachable');
    // The optional creature remains reachable on the near side of the crossing.
    const gleamwing = getVisibleObjects(session.save).find(object => object.id === 'gleamwing')!;
    expect(nearbyInteractions(walkTo(session, gleamwing).save).some(object => object.id === 'gleamwing')).toBe(true);
    session = interactWith(session, 'sense-eddy'); session = interactWith(session, 'sluice');
    expect(nearbyInteractions(walkTo(session, tressel).save).some(object => object.id === 'tressel')).toBe(true);
  });

  it('can finish the whistle quest before the first bond without inventing a companion', () => {
    let session = createSession(createNewSave());
    for (const id of ['captain', 'gangplank', 'nia', 'pell', 'whistle-reeds', 'pell']) session = interactWith(session, id);
    expect(session.save.questFlags.whistle_returned).toBe(true);
    expect(session.save.party).toHaveLength(0);
    expect(session.save.dialogueHistory.some(line => line.text.includes('Rillik'))).toBe(false);
    const tinctures = session.save.inventory.tincture;
    session = interactWith(session, 'pell');
    expect(session.save.inventory.tincture).toBe(tinctures);
  });

  it('separates seeded Reedstep evasion from reliable Veil and the demon’s double pulse', () => {
    const battle = createBattle([makeCompanion('rillik')], 'rift-wretch', 'chamber-boss', 19);
    const third = { ...battle, turn: 2, mudbound: 2 };
    const veil = resolveBattleTurn(third, { type: 'move', moveId: 'tidal-veil' });
    expect(veil.log.some(line => line.includes('double pulse'))).toBe(true);
    expect(veil.mudbound).toBe(0);
    expect(veil.allies[0].vitality).toBeGreaterThanOrEqual(battle.allies[0].vitality - 6);
    const outcomes = new Set<number>();
    for (let seed = 1; seed <= 32; seed++) {
      const evasion = resolveBattleTurn({ ...battle, seed: seed * 1000003 }, { type: 'move', moveId: 'reedstep' });
      outcomes.add(evasion.allies[0].vitality);
      expect(evasion).toEqual(resolveBattleTurn({ ...battle, seed: seed * 1000003 }, { type: 'move', moveId: 'reedstep' }));
    }
    expect(outcomes.has(battle.allies[0].vitality)).toBe(true);
    expect([...outcomes].some(vitality => vitality < battle.allies[0].vitality)).toBe(true);
  });

  it('lets a solo Rillik beat the boss across 128 seeds with basic attacks, guard and two tinctures', () => {
    let worstTurns = 0, lowestSurvivingVitality = 48;
    for (let seed = 1; seed <= 128; seed++) {
      let battle = createBattle([makeCompanion('rillik')], 'rift-wretch', 'chamber-boss', seed * 65537);
      for (let turn = 0; battle.phase === 'choosing' && turn < 40; turn++) {
        const hp = battle.allies[battle.activeIndex].vitality;
        const remaining = 2 - battle.usedTinctures;
        const action: BattleAction = hp <= 18 && remaining > 0 ? { type: 'item', itemId: 'tincture' }
          : (battle.turn + 1) % 3 === 0 ? { type: 'guard' } : { type: 'move', moveId: 'brine-snap' };
        battle = resolveBattleTurn(battle, action, { tinctures: remaining });
      }
      expect(battle.phase, `Solo basic strategy seed ${seed}`).toBe('won');
      expect(battle.usedTinctures).toBeLessThanOrEqual(2);
      worstTurns = Math.max(worstTurns, battle.turn);
      lowestSurvivingVitality = Math.min(lowestSurvivingVitality, battle.allies[0].vitality);
    }
    expect(worstTurns).toBeLessThanOrEqual(12);
    expect(lowestSurvivingVitality).toBeGreaterThan(0);
  });

  it('finishes both required fights with one Rillik, starting supplies, and no optional rest or bond', () => {
    let session = reachFirstBond();
    for (const id of ['passage-door', 'sense-eddy', 'sluice', 'tressel']) session = interactWith(session, id);
    while (session.save.battle?.phase === 'choosing') session = playTurn(session, { type: 'move', moveId: 'brine-snap' });
    expect(session.save.battle?.phase).toBe('won');
    session = finishDialogue(reduceGame(session, { type: 'advance' }));
    expect(session.save.party).toHaveLength(1);
    expect(session.save.inventory.tincture).toBe(2);
    for (const id of ['sense-channel', 'chamber-door', 'rift']) session = interactWith(session, id);
    for (let turn = 0; session.save.battle?.phase === 'choosing' && turn < 40; turn++) {
      const battle = session.save.battle, hp = battle.allies[battle.activeIndex].vitality;
      const action: BattleAction = hp <= 18 && battle.usedTinctures < 2 ? { type: 'item', itemId: 'tincture' }
        : (battle.turn + 1) % 3 === 0 ? { type: 'guard' } : { type: 'move', moveId: 'brine-snap' };
      session = playTurn(session, action);
    }
    expect(session.save.battle?.phase).toBe('won');
    expect(session.save.party).toHaveLength(1);
    session = finishDialogue(reduceGame(session, { type: 'advance' }));
    expect(session.save.questFlags.boss_defeated).toBe(true);
    expect(session.save.inventory.tincture).toBeGreaterThanOrEqual(0);
    expect(session.save.seal.active).toBe(true);
  });

  it('persists healing exactly once across terminal battle reload and acknowledgement retries', () => {
    let session = reachFirstBond();
    session.save.party[0].vitality = 20;
    session.save.collection[session.save.party[0].id] = { ...session.save.party[0] };
    session.save.battle = createBattle(session.save.party, 'tressel');
    const before = session.save.inventory.tincture;
    session = playTurn(session, { type: 'item', itemId: 'tincture' });
    expect(session.save.battle?.usedTinctures).toBe(1);
    session = createSession(migrateSave(session.save)!);
    while (session.save.battle?.phase === 'choosing') session = playTurn(session, { type: 'move', moveId: 'brine-snap' });
    session = createSession(migrateSave(session.save)!);
    session = finishDialogue(reduceGame(session, { type: 'advance' }));
    expect(session.save.inventory.tincture).toBe(before - 1);
    session = createSession(migrateSave(session.save)!);
    session = reduceGame(session, { type: 'advance' });
    expect(session.save.inventory.tincture).toBe(before - 1);
  });

  it('uses the same action interface for touch and keyboard and rejects page shortcuts', () => {
    for (const [key, action] of [['ArrowUp', 'up'], ['w', 'up'], ['Enter', 'confirm'], ['z', 'confirm'], ['Escape', 'cancel'], ['m', 'menu']] as const) expect(keyboardAction(key)).toBe(pointerAction(action));
    expect(keyboardAction('Tab')).toBeNull(); expect(keyboardAction('Control')).toBeNull();
    const session = createSession(createNewSave());
    expect(reduceGame(session, { type: 'input', action: 'left' }).save.player).toEqual(reduceGame(session, { type: 'move', direction: 'left' }).save.player);
  });

  it('ships six bounded maps with matching tile dimensions and reachable default spawns', () => {
    expect(Object.keys(MAPS)).toHaveLength(6);
    for (const map of Object.values(MAPS)) {
      expect(map.tiles).toHaveLength(map.height); expect(map.tiles.every(row => row.length === map.width)).toBe(true);
      expect(new Set(map.objects.map(object => object.id)).size).toBe(map.objects.length);
      const save = createNewSave(); save.player = { ...save.player, mapId: map.id, ...map.spawn };
      expect(getMap(save)).toBe(map); expect(canWalk(save, map.spawn.x, map.spawn.y)).toBe(true);
      expect(canWalk(save, -1, 0)).toBe(false); expect(canWalk(save, map.width, 0)).toBe(false);
    }
    expect(nearbyInteractions(createNewSave()).every(object => object.id !== 'captain')).toBe(true);
  });
});
