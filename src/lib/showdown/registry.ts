import { lazy } from 'react';
import { initialOrientations, replayActions, scoreRound, compareMatch } from './prism/engine';
import { PRISM_RULES_VERSION, type PrismAction, type PrismPuzzle } from './prism/types';

/** Versioned adapters share the challenge lifecycle; published versions remain playable. */
const prismBreak = {
  key: 'prism_break', name: 'Prism Break', description: 'Bend the light. Three puzzles. One rivalry.',
  category: 'Spatial logic', icon: 'Gem', cover: 'prism-crystal', rulesVersion: PRISM_RULES_VERSION, enabled: true,
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

export const showdownGames = [prismBreak] as const;
export type ShowdownGameRegistration = typeof showdownGames[number];
export function getShowdownGame(key: string, rulesVersion?: number): ShowdownGameRegistration | undefined {
  return showdownGames.find(game => game.key === key && (rulesVersion === undefined || game.rulesVersion === rulesVersion));
}
