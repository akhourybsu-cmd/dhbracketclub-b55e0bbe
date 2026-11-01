import { sanitizeScene } from '@/lib/showdown/afterimage/engine';
import { AFTERIMAGE_ASSET_IDS, AFTERIMAGE_DIFFICULTY_COUNTS, type AfterimagePhase, type AfterimagePlacement, type AfterimageSceneDefinition } from '@/lib/showdown/afterimage/types';
import type { ShowdownMatchDetail } from '@/lib/showdown/types';

/** Test-only authored geometry. Never imported into the production application. */
export function afterimageFixtureScene(round = 1): AfterimageSceneDefinition {
  const difficulty = round === 1 ? 'easy' : round === 2 ? 'medium' : 'hard';
  const counts = AFTERIMAGE_DIFFICULTY_COUNTS[difficulty];
  const columns = round === 1 ? 3 : round === 2 ? 4 : 5;
  const objects = AFTERIMAGE_ASSET_IDS.slice(0, counts.objects).map((assetId, index) => ({
    id: `object-${assetId}`, assetId, label: assetId.replace(/_/g, ' '), x: 100 + index % columns * 800 / (columns - 1),
    y: 130 + Math.floor(index / columns) * 220, layer: index,
  }));
  const missing = objects.slice(0, counts.missing);
  const distractors = AFTERIMAGE_ASSET_IDS.slice(counts.objects, counts.objects + counts.distractors).map(assetId => ({ id: `object-${assetId}`, assetId, label: assetId.replace(/_/g, ' ') }));
  return { id: `test-scene-${round}`, version: 1, difficulty, title: `Test memory ${round}`, theme: 'workshop', background: 'workshop', width: 1000, height: 700,
    objects, missingIds: missing.map(piece => piece.id), distractors,
    slots: missing.map((piece, index) => ({ id: `place-${index + 1}`, objectId: piece.id, label: `Place ${index + 1}`, x: piece.x, y: piece.y, layer: piece.layer, width: 180, height: 160 })),
    trayOrder: [...missing.map(piece => piece.id), ...distractors.map(piece => piece.id)].reverse(),
    a11y: { label: 'A miniature workshop', instructions: 'Study the scene, then restore its missing objects.' } };
}
const record = { wins: 0, losses: 0, draws: 0, played: 0 };
export function afterimageFixtureDetail({ phase = 'reconstruct' as AfterimagePhase, placements = [] as AfterimagePlacement[], revision = 1, completed = 0, final = false, id = 'memory-match', userId = 'member-a', clubId = 'club-1' } = {}): ShowdownMatchDetail {
  const current = completed < 3 ? completed + 1 : null;
  const opponentId = userId === 'member-a' ? 'member-b' : 'member-a';
  return { challenge: { id, club_id: clubId, game_key: 'afterimage', rules_version: 1, status: final ? 'completed' : 'active', challenger_id: userId, recipient_id: opponentId,
    created_at: '2026-11-01T00:00:00Z', expires_at: '2026-11-04T00:00:00Z', completed_at: final ? '2026-11-01T00:03:00Z' : null, winner_id: null, outcome: final ? 'draw' : null, rematch_of: null,
    players: [
      { user_id: userId, display_name: 'Alex', avatar_url: null, started_at: '2026-11-01T00:00:00Z', finished_at: completed === 3 ? '2026-11-01T00:02:00Z' : null, rounds_completed: completed, total_score: completed * 125, solved_count: completed, perfect_count: completed, rotations: 0 },
      { user_id: opponentId, display_name: 'Blair', avatar_url: null, started_at: final ? '2026-11-01T00:00:00Z' : null, finished_at: final ? '2026-11-01T00:03:00Z' : null, rounds_completed: final ? 3 : 0, total_score: final ? 375 : null, solved_count: final ? 3 : null, perfect_count: final ? 3 : null, rotations: final ? 0 : null },
    ] }, rounds: [1,2,3].map(number => {
      const definition = afterimageFixtureScene(number);
      const submitted = number <= completed;
      const answers = definition.slots.map(slot => ({ object_id: slot.objectId, slot_id: slot.id }));
      const roundPhase = final ? 'review' : submitted ? 'submitted' : phase;
      const timing = roundPhase === 'study' ? { study_started_at: '2026-11-01T00:00:00.000Z', study_expires_at: '2026-11-01T00:00:07.000Z', server_now: '2026-11-01T00:00:01.000Z' } : {};
      return { round_number: number, difficulty: definition.difficulty, puzzle_id: definition.id, puzzle_version: 1, title: definition.title, puzzle: null, minimum_rotations: null,
        scene: final || submitted || number === current ? sanitizeScene(definition, roundPhase, timing) : null,
        me: { actions: [], placements: submitted ? answers : number === current ? placements : [], revision: submitted ? 2 : number === current ? revision : 0, submitted, skipped: false, solved: submitted, score: submitted ? 125 : null, rotations: 0, correct_count: submitted ? answers.length : null, perfect: submitted ? true : null },
        opponent: final ? { actions: [], placements: answers, revision: 2, submitted: true, skipped: false, solved: true, score: 125, rotations: 0, correct_count: answers.length, perfect: true } : null };
    }), current_round: current, can_play: completed < 3, can_decline: false, can_cancel: false, readonly_reason: null,
    record, rivalry: { ...record, opponent_id: opponentId, display_name: 'Blair', avatar_url: null } };
}
