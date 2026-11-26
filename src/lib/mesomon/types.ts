export type Direction = 'up' | 'down' | 'left' | 'right';
export type InputAction = Direction | 'confirm' | 'cancel' | 'menu';
export type MapId = 'ship' | 'harbor' | 'workshop' | 'tide-stairs' | 'passage' | 'chamber';
export type SpeciesId = 'rillik' | 'muddren' | 'gleamwing' | 'tressel' | 'rift-wretch';
export type Affinity = 'Tide' | 'Stone' | 'Gale' | 'Lumen' | 'Rift';
export type MoveId = 'brine-snap' | 'reedstep' | 'resonant-cry' | 'tidal-veil' | 'bank-break' | 'mud-wrap' | 'lantern-dust' | 'quick-tackle' | 'splinter-swipe' | 'rift-lash';
export interface IndividualStats {
  maxVitality: number; power: number; guard: number; agility: number; resonance: number;
}
export interface BondedMesomon extends IndividualStats {
  id: string; speciesId: Exclude<SpeciesId, 'rift-wretch'>; level: number;
  vitality: number; experience: number; moves: MoveId[];
}
export interface Fighter extends IndividualStats {
  id: string; speciesId: SpeciesId; vitality: number; moves: MoveId[];
}
/** Read-only presentation of the combatants just after one beat in a committed turn. */
export interface BattleBeat {
  side: 'ally' | 'enemy' | 'field';
  kind: 'action' | 'impact' | 'notice';
  text: string;
  activeIndex: number;
  allyVitality: number[];
  enemyVitality: number;
  agitation: number;
  stability: number;
}
export interface BattleState {
  id: 'passage-encounter' | 'gleamwing-encounter' | 'chamber-boss';
  allies: Fighter[]; activeIndex: number; enemy: Fighter;
  agitation: number; stability: number; maxStability: number; frenzy: boolean;
  seed: number; turn: number; guarded: boolean; evasion: boolean; mudbound: number;
  phase: 'choosing' | 'won' | 'lost' | 'resonated' | 'escaped';
  log: string[]; usedTinctures: number;
  playback?: { index: number; beats: BattleBeat[] };
}
export type BattleAction = { type: 'move'; moveId: MoveId } | { type: 'guard' }
  | { type: 'switch'; index: number } | { type: 'item'; itemId: 'tincture' }
  | { type: 'resonate' } | { type: 'flee' };
export interface DialogueLine { speaker: string; text: string; }
export interface DialogueChoice { id: 'warm' | 'wry' | 'direct'; label: string; text: string; }
export interface NarrativeVariant {
  when?: { all?: string[]; none?: string[]; tone?: DialogueChoice['id'] };
  once?: string;
  lines: DialogueLine[];
}
export type ApproachingNpc = 'nia' | 'bram';
export interface NpcPosition { x: number; y: number; facing: Direction }
export interface NpcApproach { actor: ApproachingNpc; steps: Direction[] }
export interface DialogueState { approach?: NpcApproach; id: string; lines: DialogueLine[]; index: number; onFinish?: StoryEvent; choices?: DialogueChoice[]; }
export type StoryEvent = 'captain-met' | 'nia-met' | 'workshop-entered' | 'clues-complete' | 'bram-met' | 'gate-opened' | 'first-bond' | 'boss-introduced' | 'sealed' | 'page-found' | 'chapter-complete' | 'whistle-accepted' | 'whistle-returned' | 'wrong-catch' | 'tutorial-complete' | 'wild-complete';
export interface MesomonSettings {
  textSpeed: 'slow' | 'normal' | 'fast'; battleSpeed: 'normal' | 'fast';
  reducedMotion: boolean; haptics: boolean; mute: boolean; sealAssist: boolean;
  musicVolume: number; ambientVolume: number;
}
export interface MesomonSaveV1 {
  schemaVersion: 1; slot: 1 | 2 | 3; journeySeed?: number;
  player: { name: 'Tavian'; mapId: MapId; x: number; y: number; facing: Direction };
  party: BondedMesomon[]; collection: Record<string, BondedMesomon>;
  inventory: Record<string, number>; questFlags: Record<string, boolean | number | string>;
  activeQuestId: string; rifts: Record<string, 'unseen' | 'found' | 'sealed'>;
  settings: MesomonSettings; playtimeSeconds: number; savedAt: string;
  battle: BattleState | null; seal: { active: boolean; pulses: number; attempts: number };
  quayResidents?: Partial<Record<ApproachingNpc, NpcPosition>>;
  dialogue: DialogueState | null; dialogueHistory: DialogueLine[];
}
export interface GameSession { save: MesomonSaveV1; dialogue: DialogueState | null; notice: string; }
export type GameAction = { type: 'input'; action: InputAction }
  | { type: 'move' | 'face'; direction: Direction } | { type: 'interact'; id?: string }
  | { type: 'advance' } | { type: 'choice'; id: 'warm' | 'wry' | 'direct' }
  | { type: 'battle-beat'; turn: number; index: number }
  | { type: 'battle'; action: BattleAction } | { type: 'seal'; accuracy: number }
  | { type: 'approach-step'; actor: ApproachingNpc; remaining: number }
  | { type: 'sense' } | { type: 'companion'; released: boolean }
  | { type: 'heal' } | { type: 'settings'; settings: Partial<MesomonSettings> }
  | { type: 'tick'; seconds: number };
export type TileKind = 'water' | 'stone' | 'wood' | 'wall' | 'roof' | 'reeds' | 'sand' | 'floor' | 'dark-water' | 'stairs' | 'grass';
export type ObjectKind = 'npc' | 'door' | 'clue' | 'gate' | 'sense' | 'encounter' | 'pickup' | 'rift' | 'sign' | 'crystal' | 'search';
export interface MapObject {
  id: string; x: number; y: number; label: string; kind: ObjectKind; sprite: string;
  solid?: boolean; direction?: Direction; hidden?: boolean;
}
export interface MapDefinition { id: MapId; name: string; width: number; height: number; tiles: TileKind[][]; objects: MapObject[]; spawn: { x: number; y: number }; ambience: 'harbor' | 'workshop' | 'underwharf'; }
export interface SpeciesDefinition { id: SpeciesId; name: string; category: 'mesomon' | 'demon'; affinities: Affinity[]; description: string; variation: IndividualStats; vitality: number; power: number; guard: number; agility: number; resonance: number; moves: MoveId[]; }
export interface MoveDefinition { id: MoveId; name: string; affinity: Affinity; kind: 'attack' | 'calm' | 'evade' | 'guard'; power: number; priority: number; description: string; }
