/** Shared public identity/geometry only. Authored scene definitions stay in backend seed data. */
export const AFTERIMAGE_RULES_VERSION = 1;
export const AFTERIMAGE_STUDY_MS = 7000;
export const AFTERIMAGE_ROUND_MAX_SCORE = 125;
export const AFTERIMAGE_MATCH_MAX_SCORE = 375;
export const AFTERIMAGE_LOGICAL_WIDTH = 1000;
export const AFTERIMAGE_LOGICAL_HEIGHT = 700;
export const AFTERIMAGE_ASSET_IDS = [
  'book', 'lantern', 'key', 'orb', 'flask', 'compass', 'cup', 'clock', 'flower', 'shell',
  'anchor', 'fish', 'bell', 'telescope', 'candle', 'teapot', 'crown', 'crystal', 'quill', 'globe',
  'scroll', 'acorn', 'pear', 'watering_can', 'gear', 'bottle', 'star', 'map', 'satchel', 'feather',
] as const;
export const AFTERIMAGE_THEME_IDS = ['workshop', 'greenhouse', 'harbor', 'clockmaker', 'kitchen', 'observatory'] as const;
export const AFTERIMAGE_DIFFICULTY_COUNTS = {
  easy: { objects: 9, missing: 3, distractors: 0 },
  medium: { objects: 12, missing: 4, distractors: 1 },
  hard: { objects: 15, missing: 5, distractors: 2 },
} as const;
export type AfterimageAssetId = typeof AFTERIMAGE_ASSET_IDS[number];
export type AfterimageThemeId = typeof AFTERIMAGE_THEME_IDS[number];
export type AfterimageDifficulty = keyof typeof AFTERIMAGE_DIFFICULTY_COUNTS;
export type AfterimagePhase = 'ready' | 'study' | 'reconstruct' | 'submitted' | 'review';
export interface AfterimagePiece {
  id: string;
  assetId: AfterimageAssetId;
  label: string;
  orientation?: number;
  variant?: string;
}
export interface AfterimageObject extends AfterimagePiece { x: number; y: number; layer: number }
export interface AfterimageSlot {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  layer: number;
}
export interface AfterimagePrivateSlot extends AfterimageSlot { objectId: string }
export interface AfterimagePlacement { object_id: string; slot_id: string }
export interface AfterimageAccessibility { label: string; instructions: string }

/** Backend/offline canonical content, never a playable client payload or browser catalog. */
export interface AfterimageSceneDefinition {
  id: string;
  version: number;
  difficulty: AfterimageDifficulty;
  title: string;
  theme: AfterimageThemeId;
  background: AfterimageThemeId;
  width: number;
  height: number;
  objects: AfterimageObject[];
  missingIds: string[];
  distractors: AfterimagePiece[];
  slots: AfterimagePrivateSlot[];
  trayOrder: string[];
  a11y: AfterimageAccessibility;
}
export interface AfterimageSceneView {
  id: string;
  version: number;
  difficulty: AfterimageDifficulty;
  title: string;
  theme: AfterimageThemeId;
  background: AfterimageThemeId;
  width: number;
  height: number;
  phase: AfterimagePhase;
  objects: AfterimageObject[];
  slots: AfterimageSlot[];
  tray: AfterimagePiece[];
  a11y: AfterimageAccessibility;
  /** The answer map is returned only after both players finish the match. */
  answers?: AfterimagePlacement[];
  study_started_at?: string | null;
  study_expires_at?: string | null;
  server_now?: string;
  /** Client-only monotonic observation metadata; never scoring inputs. */
  observation_remaining_ms?: number;
  observation_received_at?: number;
}
export interface AfterimageRoundScore { score: number; correct_count: number; required_count: number; perfect: boolean }
export interface AfterimageStanding { totalScore: number; perfectRounds: number }
export type AfterimageMatchComparison = 'first' | 'second' | 'draw';
