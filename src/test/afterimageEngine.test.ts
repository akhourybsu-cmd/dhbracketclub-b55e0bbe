import { describe, expect, it } from 'vitest';
import library from '../../supabase/seed/afterimage-library.json';
import {
  AfterimageValidationError, compareMatch, normalizePlacements, sanitizeScene, scoreScene,
  updatePlacement, validatePlacements, validatePublishedScene, validateSceneDefinition, validateSceneView,
} from '@/lib/showdown/afterimage/engine';
import type { AfterimagePlacement, AfterimageSceneDefinition } from '@/lib/showdown/afterimage/types';

function scene(difficulty: 'easy' | 'medium' | 'hard' = 'easy'): AfterimageSceneDefinition {
  const { validation: _certificate, ...raw } = library.find(entry => entry.difficulty === difficulty)!;
  const definition: unknown = JSON.parse(JSON.stringify(raw));
  validateSceneDefinition(definition); return definition;
}
const answers = (definition: AfterimageSceneDefinition): AfterimagePlacement[] => definition.slots.map(slot => ({ object_id: slot.objectId, slot_id: slot.id }));
const timing = { study_started_at: '2026-11-01T12:00:00.000Z', study_expires_at: '2026-11-01T12:00:07.000Z', server_now: '2026-11-01T12:00:02.500Z' };

describe('Afterimage scoring and comparison', () => {
  it.each(['easy', 'medium', 'hard'] as const)('awards exactly 125 for a perfect %s reconstruction and zero for empty/skip', difficulty => {
    const definition = scene(difficulty), required = definition.slots.length;
    expect(scoreScene(definition, answers(definition))).toEqual({ score: 125, correct_count: required, required_count: required, perfect: true });
    expect(scoreScene(definition, [])).toEqual({ score: 0, correct_count: 0, required_count: required, perfect: false });
    expect(scoreScene(definition, answers(definition), true)).toEqual({ score: 0, correct_count: 0, required_count: required, perfect: false });
  });
  it('implements the required partial-score examples without a partial perfect bonus', () => {
    expect(scoreScene(scene('medium'), answers(scene('medium')).slice(0, 3))).toMatchObject({ score: 75, correct_count: 3, required_count: 4, perfect: false });
    expect(scoreScene(scene('hard'), answers(scene('hard')).slice(0, 2))).toMatchObject({ score: 40, correct_count: 2, required_count: 5, perfect: false });
    expect(scoreScene(scene('easy'), answers(scene('easy')).slice(0, 2))).toMatchObject({ score: 67, perfect: false });
  });
  it('counts only exact object-to-place identities and does not reward a distractor', () => {
    const definition = scene('medium'), correct = answers(definition);
    const distracted = [...correct.slice(0, 3), { object_id: definition.distractors[0].id, slot_id: correct[3].slot_id }];
    expect(scoreScene(definition, distracted)).toMatchObject({ score: 75, correct_count: 3, perfect: false });
    const swapped = [{ object_id: correct[0].object_id, slot_id: correct[1].slot_id }, { object_id: correct[1].object_id, slot_id: correct[0].slot_id }, ...correct.slice(2)];
    expect(scoreScene(definition, swapped)).toMatchObject({ score: 50, correct_count: 2, perfect: false });
  });
  it('compares score and then perfect rounds; it never introduces a timing or move tiebreak', () => {
    expect(compareMatch({ totalScore: 300, perfectRounds: 0 }, { totalScore: 299, perfectRounds: 2 })).toBe('first');
    // The perfect-count comparison remains explicit for future rules versions,
    // even if a particular v1 score sum has no second attainable perfect count.
    expect(compareMatch({ totalScore: 250, perfectRounds: 1 }, { totalScore: 250, perfectRounds: 2 })).toBe('second');
    const first = { totalScore: 200, perfectRounds: 1, moves: 2, elapsed: 5000 };
    const second = { totalScore: 200, perfectRounds: 1, moves: 200, elapsed: 500000 };
    expect(compareMatch(first, second)).toBe('draw');
    expect(compareMatch({ totalScore: 0, perfectRounds: 0 }, { totalScore: 0, perfectRounds: 0 })).toBe('draw');
    expect(() => compareMatch({ totalScore: 376, perfectRounds: 3 }, second)).toThrow('match totals');
  });
});

describe('Afterimage phase privacy', () => {
  it('shows no memory content before Ready, then shows the original scene only during the study window', () => {
    const definition = scene();
    const ready = sanitizeScene(definition, 'ready');
    expect(ready.objects).toEqual([]); expect(ready.slots).toEqual([]); expect(ready.tray).toEqual([]);
    expect(() => validatePlacements([], ready)).not.toThrow();
    const study = sanitizeScene(definition, 'study', timing);
    expect(study.objects).toHaveLength(9); expect(study.slots).toEqual([]); expect(study.tray).toEqual([]);
    expect(() => validatePlacements([], study)).not.toThrow();
    expect(study.answers).toBeUndefined();
  });
  it('strips the removed positions, private map and private tray-order metadata throughout reconstruction and own submission', () => {
    const definition = scene('hard');
    for (const phase of ['reconstruct', 'submitted'] as const) {
      const view = sanitizeScene(definition, phase);
      expect(view.objects).toHaveLength(10); expect(view.slots).toHaveLength(5); expect(view.tray).toHaveLength(7);
      expect(view.objects.every(object => !definition.missingIds.includes(object.id))).toBe(true);
      expect(view.tray.every(piece => !('x' in piece) && !('y' in piece) && !('layer' in piece))).toBe(true);
      expect(view.slots.every(slot => !('objectId' in slot))).toBe(true);
      const serialized = JSON.stringify(view);
      for (const privateField of ['objectId', 'missingIds', 'trayOrder', 'answers']) expect(serialized).not.toContain(privateField);
      expect(() => validateSceneView(view)).not.toThrow();
    }
  });
  it('opens a verified answer map in completed review without changing the private definition', () => {
    const definition = scene('medium'), original = JSON.stringify(definition);
    const review = sanitizeScene(definition, 'review');
    expect(review.objects).toHaveLength(12);
    expect(review.answers).toEqual(answers(definition));
    expect(JSON.stringify(definition)).toBe(original);
    expect(() => validateSceneView({ ...review, answers: [...answers(definition).slice(1), { ...answers(definition)[0], slot_id: answers(definition)[1].slot_id }] })).toThrow(AfterimageValidationError);
  });
  it('rejects a private answer hidden in a public target, tray piece or top-level reconstruction field', () => {
    const definition = scene(), view = sanitizeScene(definition, 'reconstruct');
    expect(() => validateSceneView({ ...view, slots: [{ ...view.slots[0], objectId: definition.missingIds[0] }, ...view.slots.slice(1)] })).toThrow(AfterimageValidationError);
    expect(() => validateSceneView({ ...view, tray: [{ ...view.tray[0], x: 200, y: 300 }, ...view.tray.slice(1)] })).toThrow(AfterimageValidationError);
    expect(() => validateSceneView({ ...view, missingIds: definition.missingIds })).toThrow(AfterimageValidationError);
    expect(() => validateSceneView({ ...view, answers: answers(definition) })).toThrow('sealed');
    expect(() => validateSceneView({ ...view, objects: definition.objects })).toThrow('removed-object positions');
    const removed = definition.objects.find(object => definition.missingIds.includes(object.id))!;
    expect(() => validateSceneView({ ...view, objects: [removed, ...view.objects.slice(1)] })).toThrow('original coordinates');
    expect(() => validateSceneView({ ...view, objects: [{ ...removed, id: 'different-memory-id' }, ...view.objects.slice(1)] })).toThrow('distinct identities');
    expect(() => validateSceneView({ ...view, slots: [{ ...view.slots[0], id: `place-${view.tray[0].id}` }, ...view.slots.slice(1)] })).toThrow('target identity');
    expect(() => validateSceneView({ ...view, slots: [{ ...view.slots[0], label: `Place for ${view.tray[0].label}` }, ...view.slots.slice(1)] })).toThrow('never the answer');
  });
  it('rejects content that reveals future missing selections during study or objects while ready', () => {
    const definition = scene(), study = sanitizeScene(definition, 'study', timing), reconstructed = sanitizeScene(definition, 'reconstruct');
    expect(() => validateSceneView({ ...study, slots: reconstructed.slots })).toThrow('missing selections');
    expect(() => validateSceneView({ ...sanitizeScene(definition, 'ready'), objects: definition.objects })).toThrow('must not reveal');
  });
  it('validates an original seven-second server observation and rejects expired or malformed study windows', () => {
    const definition = scene();
    expect(() => sanitizeScene(definition, 'study', { ...timing, observation_remaining_ms: 4500, observation_received_at: 25.3 })).not.toThrow();
    expect(() => sanitizeScene(definition, 'study', { ...timing, study_expires_at: '2026-11-01T12:00:14.000Z' })).toThrow('seven-second');
    expect(() => sanitizeScene(definition, 'study', { ...timing, server_now: timing.study_expires_at })).toThrow('seven-second');
    expect(() => sanitizeScene(definition, 'study', { ...timing, study_started_at: 'yesterday' })).toThrow('timestamps');
    expect(() => sanitizeScene(definition, 'study', { ...timing, observation_remaining_ms: 7001 })).toThrow('observation');
    expect(() => sanitizeScene(definition, 'study', { ...timing, observation_received_at: NaN })).toThrow('observation');
  });
});

describe('Legal tactile reconstruction', () => {
  it('permits incomplete or wrong legal choices without reporting correctness', () => {
    const definition = scene(), view = sanitizeScene(definition, 'reconstruct');
    expect(validatePlacements([], view)).toBeUndefined();
    expect(validatePlacements([{ object_id: view.tray[0].id, slot_id: view.slots[0].id }], view)).toBeUndefined();
    expect(validatePlacements([{ object_id: view.tray[0].id, slot_id: view.slots[1].id }], view)).toBeUndefined();
  });
  it('supports replacing a target, swapping two placed objects, returning one to the tray and resetting freely', () => {
    const definition = scene(), [a,b,c] = definition.trayOrder, [first,second] = definition.slots;
    const initial = [{ object_id: a, slot_id: first.id }, { object_id: b, slot_id: second.id }];
    const swapped = updatePlacement(initial, a, second.id);
    expect(swapped).toEqual(normalizePlacements([{ object_id: b, slot_id: first.id }, { object_id: a, slot_id: second.id }]));
    const replaced = updatePlacement(swapped, c, second.id);
    expect(replaced).toEqual(normalizePlacements([{ object_id: b, slot_id: first.id }, { object_id: c, slot_id: second.id }]));
    expect(updatePlacement(updatePlacement(replaced, c, null), b, null)).toEqual([]);
    expect(initial).toEqual([{ object_id: a, slot_id: first.id }, { object_id: b, slot_id: second.id }]);
  });
  it('rejects duplicate object/slot use, unknown pieces and client-supplied scoring fields', () => {
    const definition = scene('medium'), view = sanitizeScene(definition, 'reconstruct'), valid = answers(definition);
    expect(() => validatePlacements([{ ...valid[0] }, { object_id: valid[0].object_id, slot_id: valid[1].slot_id }], view)).toThrow(AfterimageValidationError);
    expect(() => validatePlacements([{ ...valid[0] }, { object_id: valid[1].object_id, slot_id: valid[0].slot_id }], view)).toThrow(AfterimageValidationError);
    expect(() => validatePlacements([{ object_id: definition.objects.find(object => !definition.missingIds.includes(object.id))!.id, slot_id: valid[0].slot_id }], view)).toThrow(AfterimageValidationError);
    expect(() => validatePlacements([{ ...valid[0], score: 125 }], view)).toThrow(AfterimageValidationError);
    expect(() => validatePlacements([{ ...valid[0], slot_id: 'unknown-place' }], view)).toThrow(AfterimageValidationError);
    expect(() => scoreScene(definition, [...valid, { object_id: definition.distractors[0].id, slot_id: valid[0].slot_id }])).toThrow(AfterimageValidationError);
  });
});

describe('Published scene correctness and geometry', () => {
  it('rejects indistinguishable artwork, malformed identities, invalid canonical maps and distractors from the original scene', () => {
    const duplicate = scene(); duplicate.objects[1].assetId = duplicate.objects[0].assetId;
    expect(() => validateSceneDefinition(duplicate)).toThrow('distinct identities');
    const repeatedId = scene(); repeatedId.objects[1].id = repeatedId.objects[0].id;
    expect(() => validateSceneDefinition(repeatedId)).toThrow('distinct identities');
    const distractor = scene('medium'); distractor.distractors[0].assetId = distractor.objects[0].assetId;
    expect(() => validateSceneDefinition(distractor)).toThrow('distinct identities');
    const map = scene(); map.slots[0].objectId = map.objects.find(object => !map.missingIds.includes(object.id))!.id;
    expect(() => validateSceneDefinition(map)).toThrow('one-to-one');
    const revealing = scene(); revealing.slots[0].id = revealing.slots[0].objectId;
    expect(() => validateSceneDefinition(revealing)).toThrow('one-to-one');
    const encoded = scene(); encoded.slots[0].id = `place-${encoded.slots[0].objectId}`;
    expect(() => validateSceneDefinition(encoded)).toThrow('one-to-one');
    const answerLabel = scene(); answerLabel.slots[0].label = `Place for ${answerLabel.objects[0].label}`;
    expect(() => validateSceneDefinition(answerLabel)).toThrow('never the answer');
    const tray = scene(); tray.trayOrder[0] = tray.trayOrder[1];
    expect(() => validateSceneDefinition(tray)).toThrow('frozen tray');
  });
  it('rejects overlapping, inaccessible, nonfinite and too-small mobile targets before publishing', () => {
    const small = scene(); small.slots[0].width = 120;
    expect(validatePublishedScene(small).valid).toBe(false);
    const invalid = scene(); invalid.objects[0].x = Infinity;
    expect(validatePublishedScene(invalid).valid).toBe(false);
    const overlapping = scene(); overlapping.objects[1].x = overlapping.objects[0].x; overlapping.objects[1].y = overlapping.objects[0].y;
    expect(validatePublishedScene(overlapping).valid).toBe(false);
    const wrongPosition = scene(); wrongPosition.slots[0].x++;
    expect(() => validateSceneDefinition(wrongPosition)).toThrow('canonical object position');
  });
});
