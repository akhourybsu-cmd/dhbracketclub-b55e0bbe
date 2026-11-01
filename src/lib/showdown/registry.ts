import { lazy } from 'react';
import { initialOrientations, replayActions, scoreRound, compareMatch } from './prism/engine';
import { PRISM_RULES_VERSION, type PrismAction, type PrismPuzzle } from './prism/types';
import { validatePlacements, scoreScene, compareMatch as compareMemoryMatch } from './afterimage/engine';
import { AFTERIMAGE_RULES_VERSION, type AfterimagePlacement, type AfterimageSceneView } from './afterimage/types';

/** Versioned adapters share the challenge lifecycle; published versions remain playable. */
const prismBreak = {
  key: 'prism_break', name: 'Prism Break', description: 'Bend the light. Three puzzles. One rivalry.',
  category: 'Spatial logic', icon: 'Gem', cover: 'prism-crystal', rulesVersion: PRISM_RULES_VERSION, enabled: true,
  matchMaxScore: 1500, roundNoun: 'boards', rulesSummary: 'Three boards. Every rotation counts. Solve efficiently for up to 1,500 points.',
  Gameplay: lazy(() => import('@/components/showdown/PrismBreakGame').then(module => ({ default: module.PrismBreakGame }))),
  Board: lazy(() => import('@/components/showdown/PrismBoard').then(module => ({ default: module.PrismBoard }))),
  Results: lazy(() => import('@/components/showdown/ShowdownResults').then(module => ({ default: module.ShowdownResults }))),
  initializePuzzle: (puzzle: PrismPuzzle) => ({ actions: [] as PrismAction[], orientations: initialOrientations(puzzle) }),
  validateSubmission: (puzzle: PrismPuzzle, actions: PrismAction[], skipped = false) => {
    const replay = replayActions(puzzle, actions);
    return { valid: skipped || replay.solved, replay };
  },
  // Client helpers explain results; the database independently replays and scores every ranked action.
  scoreRound, compareResults: compareMatch,
} as const;

const afterimage = {
  key: 'afterimage', name: 'Afterimage', description: 'A fleeting scene. A lasting impression. Restore what you remember.',
  category: 'Visual memory', icon: 'Eye', cover: 'afterimage-miniature', rulesVersion: AFTERIMAGE_RULES_VERSION, enabled: true,
  matchMaxScore: 375, roundNoun: 'scenes', rulesSummary: 'Study each scene for seven seconds, then restore its missing objects. Three scenes, up to 375 points.',
  Gameplay: lazy(() => import('@/components/showdown/afterimage/AfterimageGame').then(module => ({ default: module.AfterimageGame }))),
  Board: lazy(() => import('@/components/showdown/afterimage/AfterimageScene').then(module => ({ default: module.AfterimageScene }))),
  Results: lazy(() => import('@/components/showdown/afterimage/AfterimageResults').then(module => ({ default: module.AfterimageResults }))),
  initializePuzzle: (scene: AfterimageSceneView) => ({ sceneId: scene.id, placements: [] as AfterimagePlacement[] }),
  validateSubmission: (scene: AfterimageSceneView, placements: AfterimagePlacement[]) => { validatePlacements(placements, scene); return { valid: true }; },
  scoreRound: scoreScene, compareResults: compareMemoryMatch,
} as const;

export const showdownGames = [prismBreak, afterimage] as const;
export type ShowdownGameRegistration = typeof showdownGames[number];
export function getShowdownGame(key: 'prism_break', rulesVersion?: number): typeof prismBreak | undefined;
export function getShowdownGame(key: 'afterimage', rulesVersion?: number): typeof afterimage | undefined;
export function getShowdownGame(key: string, rulesVersion?: number): ShowdownGameRegistration | undefined;
export function getShowdownGame(key: string, rulesVersion?: number): ShowdownGameRegistration | undefined {
  return showdownGames.find(game => game.key === key && (rulesVersion === undefined || game.rulesVersion === rulesVersion));
}
