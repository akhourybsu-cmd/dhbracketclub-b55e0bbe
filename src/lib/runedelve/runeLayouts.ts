// Rune Delve — Chamber Layout Catalog
//
// Visual / metadata layer for the dungeon, hub, and level-map screens.
// Every chamber layout supplies:
//   • a stylised mini-map shape (rendered by <RuneLayoutPreview/> as inline SVG)
//   • a short briefing line and a longer flavor description
//   • a category (path / vault / sanctum / boss) so screens can filter/style
//   • preview metadata plus hazard / treasure counts. Hazard and treasure
//     zones are read by the play engine; entry/exit/rune-slot counts shape the
//     decorative mini-map only. Locked-zone counts remain reserved metadata.
//
// Adding a new layout: append an entry here and (optionally) reference it
// from chamberAssignment.ts so a band of levels deploys on it.

export type ChamberCategory = 'path' | 'vault' | 'sanctum' | 'boss';

export type RuneLayoutId =
  | 'ancient_gate'
  | 'split_passage'
  | 'spiral_sanctum'
  | 'rune_crossroads'
  | 'cursed_vault'
  | 'ember_hollow'
  | 'crystal_archive'
  | 'forgotten_catacomb'
  | 'shadow_reliquary'
  | 'final_seal_chamber';

/**
 * Canonical shape of a chamber layout's preview metadata. The play engine
 * uses hazardZones and treasureZones on its 5×5 board. The remaining fields
 * describe the mini-map silhouette and are not additional gameplay rules.
 */
export interface ChamberPreview {
  /** Path / shape identifier — picked up by RuneLayoutPreview to render the mini-map. */
  shape:
    | 'gate'         // simple bend through an archway
    | 'split'        // diverging passages
    | 'spiral'       // inward winding sanctum
    | 'crossroads'   // 4-way intersection
    | 'vault'        // central locked chamber
    | 'hollow'       // open arena with side alcoves
    | 'archive'      // shelf-grid lined corridors
    | 'catacomb'     // multi-corridor chambered network
    | 'reliquary'    // ritual circle with relics around the rim
    | 'seal';        // boss room funnel into a sealed core
  /** Primary accent color (HSL parts) used for glow + theming. */
  accent: string;
  /** Secondary accent (HSL parts) — used for subtle highlights. */
  accent2?: string;
  /** Atmosphere keyword — drives mood text + subtle treatment. */
  atmosphere: 'torchlit' | 'mossy' | 'crystalline' | 'embered' | 'cursed' | 'sealed' | 'abyssal';
  /** Number of enemy/wave entry points. */
  entryPoints: number;
  /** Number of available exits (may equal 1 for boss rooms). */
  exitPoints: number;
  /** Approximate rune-slot count this chamber supports. */
  runeSlots: number;
  /** Number of hazard zones (corrupted/eclipse/sealed tiles, magma, etc). */
  hazardZones: number;
  /** Number of treasure / relic alcoves. */
  treasureZones: number;
  /** Number of locked doors / sealed sub-chambers. */
  lockedZones: number;
}

export interface RuneLayout {
  id: RuneLayoutId;
  name: string;
  /** Short one-liner for briefing cards & lists. */
  tagline: string;
  /** Longer narrative used on dedicated briefing surfaces. */
  briefing: string;
  category: ChamberCategory;
  /** 1–5 visual danger rating for layout comparison; not a stat multiplier. */
  difficultyModifier: 1 | 2 | 3 | 4 | 5;
  preview: ChamberPreview;
  /** Tags shown as small chips on briefing cards. */
  tags: string[];
  /** Suggested loadout / play-style hint shown on briefing screens. */
  recommendedStrategy: string;
}

export const RUNE_LAYOUTS: Record<RuneLayoutId, RuneLayout> = {
  ancient_gate: {
    id: 'ancient_gate',
    name: 'Ancient Gate',
    tagline: 'A torchlit entrance hall — your descent begins here.',
    briefing:
      'Stone columns bear the marks of forgotten kings. The floor is stable, with no hazard cells and one treasure cell to reward an early detour.',
    category: 'path',
    difficultyModifier: 1,
    preview: {
      shape: 'gate',
      accent: '38 95% 60%',
      accent2: '45 100% 70%',
      atmosphere: 'torchlit',
      entryPoints: 1,
      exitPoints: 1,
      runeSlots: 4,
      hazardZones: 0,
      treasureZones: 1,
      lockedZones: 0,
    },
    tags: ['Onboarding', 'Treasure', 'No Hazards'],
    recommendedStrategy: 'Learn the chain controls, then include the ✨ treasure cell when it fits.',
  },
  split_passage: {
    id: 'split_passage',
    name: 'Split Passage',
    tagline: 'Two corridors fork around a buried shrine.',
    briefing:
      'A cave-in split the old path around a buried shrine. On the board, one treasure cell offers a reward while one red hazard cell costs HP when chained.',
    category: 'path',
    difficultyModifier: 2,
    preview: {
      shape: 'split',
      accent: '195 80% 65%',
      accent2: '38 95% 60%',
      atmosphere: 'mossy',
      entryPoints: 2,
      exitPoints: 1,
      runeSlots: 6,
      hazardZones: 1,
      treasureZones: 1,
      lockedZones: 0,
    },
    tags: ['1 Hazard', '1 Treasure', 'Mossy'],
    recommendedStrategy: 'Take the treasure when your route can avoid the hazard; neither cell is required.',
  },
  spiral_sanctum: {
    id: 'spiral_sanctum',
    name: 'Spiral Sanctum',
    tagline: 'A coiling shrine — long path, slow approach, no shortcuts.',
    briefing:
      'The original wardens built this sanctum as a meditation spiral. Two treasure cells reward deliberate routing; one hazard cell punishes a careless shortcut.',
    category: 'sanctum',
    difficultyModifier: 3,
    preview: {
      shape: 'spiral',
      accent: '270 70% 65%',
      accent2: '195 80% 65%',
      atmosphere: 'mossy',
      entryPoints: 1,
      exitPoints: 1,
      runeSlots: 8,
      hazardZones: 1,
      treasureZones: 2,
      lockedZones: 1,
    },
    tags: ['1 Hazard', '2 Treasure', 'Sanctum'],
    recommendedStrategy: 'Favor a clean long chain; detour through treasure only when the color path stays safe.',
  },
  rune_crossroads: {
    id: 'rune_crossroads',
    name: 'Rune Crossroads',
    tagline: 'Four-way intersection where converging lines empower runes.',
    briefing:
      'Four old roads meet around a cracked rune dais. Two hazard cells and one treasure cell turn the board into a simple risk-versus-reward route.',
    category: 'sanctum',
    difficultyModifier: 3,
    preview: {
      shape: 'crossroads',
      accent: '210 80% 60%',
      accent2: '270 70% 65%',
      atmosphere: 'crystalline',
      entryPoints: 4,
      exitPoints: 1,
      runeSlots: 7,
      hazardZones: 2,
      treasureZones: 1,
      lockedZones: 0,
    },
    tags: ['2 Hazards', '1 Treasure', 'Crossroads'],
    recommendedStrategy: 'Route around red hazard cells unless the chain payoff is worth up to 10 HP.',
  },
  cursed_vault: {
    id: 'cursed_vault',
    name: 'Cursed Vault',
    tagline: 'A buried treasury sealed by malformed wards.',
    briefing:
      'Greedy hands stripped this vault long ago. Three treasure cells remain among three red hazard cells, making every detour a visible trade-off.',
    category: 'vault',
    difficultyModifier: 4,
    preview: {
      shape: 'vault',
      accent: '350 75% 60%',
      accent2: '38 95% 60%',
      atmosphere: 'cursed',
      entryPoints: 2,
      exitPoints: 1,
      runeSlots: 6,
      hazardZones: 3,
      treasureZones: 3,
      lockedZones: 2,
    },
    tags: ['3 Hazards', '3 Treasure', 'Cursed'],
    recommendedStrategy: 'Treasure pays per matched cell; hazards persist, so do not route through them by habit.',
  },
  ember_hollow: {
    id: 'ember_hollow',
    name: 'Ember Hollow',
    tagline: 'A magma-warmed cavern lit by drifting embers.',
    briefing:
      'Heat pulses through this chamber, but its marked zones stay fixed for the fight. Two red hazard cells cost HP; one treasure cell pays extra rewards.',
    category: 'path',
    difficultyModifier: 3,
    preview: {
      shape: 'hollow',
      accent: '15 95% 60%',
      accent2: '38 100% 65%',
      atmosphere: 'embered',
      entryPoints: 2,
      exitPoints: 1,
      runeSlots: 6,
      hazardZones: 2,
      treasureZones: 1,
      lockedZones: 0,
    },
    tags: ['2 Hazards', '1 Treasure', 'Warmlit'],
    recommendedStrategy: 'The zones do not cycle—plan around the two fixed hazard cells.',
  },
  crystal_archive: {
    id: 'crystal_archive',
    name: 'Crystal Archive',
    tagline: 'Shelved corridors of resonant glass — every match echoes.',
    briefing:
      'A cathedral of crystal pillars and lore-shelves. Two treasure cells glint between the stacks, guarded by one clearly marked hazard cell.',
    category: 'sanctum',
    difficultyModifier: 3,
    preview: {
      shape: 'archive',
      accent: '195 90% 65%',
      accent2: '270 70% 70%',
      atmosphere: 'crystalline',
      entryPoints: 2,
      exitPoints: 1,
      runeSlots: 9,
      hazardZones: 1,
      treasureZones: 2,
      lockedZones: 1,
    },
    tags: ['1 Hazard', '2 Treasure', 'Lore'],
    recommendedStrategy: 'Use the safer treasure route when possible; a longer clean chain is still the priority.',
  },
  forgotten_catacomb: {
    id: 'forgotten_catacomb',
    name: 'Forgotten Catacomb',
    tagline: 'Burial corridors with secret sub-chambers behind sealed doors.',
    briefing:
      'A network of crypt corridors hides two treasure cells among two red hazard cells. The doors shape the chamber art; no secret key is required.',
    category: 'path',
    difficultyModifier: 3,
    preview: {
      shape: 'catacomb',
      accent: '152 35% 50%',
      accent2: '195 70% 60%',
      atmosphere: 'mossy',
      entryPoints: 2,
      exitPoints: 2,
      runeSlots: 7,
      hazardZones: 2,
      treasureZones: 2,
      lockedZones: 2,
    },
    tags: ['2 Hazards', '2 Treasure', 'Crypt'],
    recommendedStrategy: 'Read the board marks directly: treasure rewards you, hazards cost HP, and neither blocks chaining.',
  },
  shadow_reliquary: {
    id: 'shadow_reliquary',
    name: 'Shadow Reliquary',
    tagline: 'A ritual circle where the relics watch back.',
    briefing:
      'Relic alcoves rim a shadowed stone circle. Four treasure cells make this the richest board, while two red hazard cells keep greed costly.',
    category: 'vault',
    difficultyModifier: 4,
    preview: {
      shape: 'reliquary',
      accent: '270 80% 70%',
      accent2: '350 75% 65%',
      atmosphere: 'abyssal',
      entryPoints: 3,
      exitPoints: 1,
      runeSlots: 12,
      hazardZones: 2,
      treasureZones: 4,
      lockedZones: 1,
    },
    tags: ['2 Hazards', '4 Treasure', 'Shadowed'],
    recommendedStrategy: 'Collect treasure through natural chains; forcing every pickup can spend more HP than it earns.',
  },
  final_seal_chamber: {
    id: 'final_seal_chamber',
    name: 'Final Seal Chamber',
    tagline: 'The boss vault — a single funnel into a sealed core.',
    briefing:
      'The end of the chapter. A boss waits beyond three hazard cells and one treasure cell. The boss banner states the chamber’s only special combat rule.',
    category: 'boss',
    difficultyModifier: 5,
    preview: {
      shape: 'seal',
      accent: '0 85% 60%',
      accent2: '45 100% 65%',
      atmosphere: 'sealed',
      entryPoints: 3,
      exitPoints: 1,
      runeSlots: 6,
      hazardZones: 3,
      treasureZones: 1,
      lockedZones: 1,
    },
    tags: ['Boss', '3 Hazards', '1 Treasure'],
    recommendedStrategy: 'Read the Boss Rule first, then value survival over a risky treasure detour.',
  },
};

/* ─── Selectors ─────────────────────────────────────────────────────── */

export function getLayout(id: RuneLayoutId | undefined | null): RuneLayout | undefined {
  if (!id) return undefined;
  return RUNE_LAYOUTS[id];
}

export function getLayoutsByCategory(category: ChamberCategory): RuneLayout[] {
  return Object.values(RUNE_LAYOUTS).filter(l => l.category === category);
}

export const ALL_LAYOUTS: RuneLayout[] = Object.values(RUNE_LAYOUTS);

/** Default fallback used when no layout has been assigned to a level. */
export const DEFAULT_LAYOUT: RuneLayoutId = 'ancient_gate';
