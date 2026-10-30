// One exact portrait per creature identity. Atlas cells are row-major in a 4×4 square.
export interface MonsterPortrait {
  id: string;
  name: string;
  atlas: string;
  cell: number;
}
export const MONSTER_PORTRAITS: readonly MonsterPortrait[] = [
  {
    id: "cave_bat",
    name: "Cave Bat",
    atlas: "/images/rune-delve/monsters-ember.webp",
    cell: 0,
  },
  {
    id: "goblin_scout",
    name: "Goblin Scout",
    atlas: "/images/rune-delve/monsters-ember.webp",
    cell: 1,
  },
  {
    id: "ember_slime",
    name: "Ember Slime",
    atlas: "/images/rune-delve/monsters-ember.webp",
    cell: 2,
  },
  {
    id: "shadow_imp",
    name: "Shadow Imp",
    atlas: "/images/rune-delve/monsters-ember.webp",
    cell: 3,
  },
  {
    id: "crystal_spider",
    name: "Crystal Spider",
    atlas: "/images/rune-delve/monsters-ember.webp",
    cell: 4,
  },
  {
    id: "ember_rat",
    name: "Ember Rat",
    atlas: "/images/rune-delve/monsters-ember.webp",
    cell: 5,
  },
  {
    id: "tunnel_kobold",
    name: "Tunnel Kobold",
    atlas: "/images/rune-delve/monsters-ember.webp",
    cell: 6,
  },
  {
    id: "cave_lizard",
    name: "Cave Lizard",
    atlas: "/images/rune-delve/monsters-ember.webp",
    cell: 7,
  },
  {
    id: "mossback_toad",
    name: "Mossback Toad",
    atlas: "/images/rune-delve/monsters-ember.webp",
    cell: 8,
  },
  {
    id: "lantern_moth",
    name: "Lantern Moth",
    atlas: "/images/rune-delve/monsters-ember.webp",
    cell: 9,
  },
  {
    id: "goblin_brute",
    name: "Goblin Brute",
    atlas: "/images/rune-delve/monsters-ember.webp",
    cell: 10,
  },
  {
    id: "cave_crab",
    name: "Cave Crab",
    atlas: "/images/rune-delve/monsters-ember.webp",
    cell: 11,
  },
  {
    id: "ember_pup",
    name: "Ember Pup",
    atlas: "/images/rune-delve/monsters-ember.webp",
    cell: 12,
  },
  {
    id: "dust_wisp",
    name: "Dust Wisp",
    atlas: "/images/rune-delve/monsters-ember.webp",
    cell: 13,
  },
  {
    id: "feral_imp",
    name: "Feral Imp",
    atlas: "/images/rune-delve/monsters-ember.webp",
    cell: 14,
  },
  {
    id: "bone_husk",
    name: "Bone Husk",
    atlas: "/images/rune-delve/monsters-ember.webp",
    cell: 15,
  },
  {
    id: "skeleton_warrior",
    name: "Skeleton Warrior",
    atlas: "/images/rune-delve/monsters-crystal.webp",
    cell: 0,
  },
  {
    id: "rune_wraith",
    name: "Rune Wraith",
    atlas: "/images/rune-delve/monsters-crystal.webp",
    cell: 1,
  },
  {
    id: "frost_revenant",
    name: "Frost Revenant",
    atlas: "/images/rune-delve/monsters-crystal.webp",
    cell: 2,
  },
  {
    id: "cult_warden",
    name: "Cult Warden",
    atlas: "/images/rune-delve/monsters-crystal.webp",
    cell: 3,
  },
  {
    id: "cult_chanter",
    name: "Cult Chanter",
    atlas: "/images/rune-delve/monsters-crystal.webp",
    cell: 4,
  },
  {
    id: "stone_golem",
    name: "Stone Golem",
    atlas: "/images/rune-delve/monsters-crystal.webp",
    cell: 5,
  },
  {
    id: "frost_acolyte",
    name: "Frost Acolyte",
    atlas: "/images/rune-delve/monsters-crystal.webp",
    cell: 6,
  },
  {
    id: "bone_archer",
    name: "Bone Archer",
    atlas: "/images/rune-delve/monsters-crystal.webp",
    cell: 7,
  },
  {
    id: "crystal_construct",
    name: "Crystal Construct",
    atlas: "/images/rune-delve/monsters-crystal.webp",
    cell: 8,
  },
  {
    id: "glacial_imp",
    name: "Glacial Imp",
    atlas: "/images/rune-delve/monsters-crystal.webp",
    cell: 9,
  },
  {
    id: "cult_seer",
    name: "Cult Seer",
    atlas: "/images/rune-delve/monsters-crystal.webp",
    cell: 10,
  },
  {
    id: "revenant_thrall",
    name: "Revenant Thrall",
    atlas: "/images/rune-delve/monsters-crystal.webp",
    cell: 11,
  },
  {
    id: "hollow_shrieker",
    name: "Hollow Shrieker",
    atlas: "/images/rune-delve/monsters-crystal.webp",
    cell: 12,
  },
  {
    id: "quartz_serpent",
    name: "Quartz Serpent",
    atlas: "/images/rune-delve/monsters-crystal.webp",
    cell: 13,
  },
  {
    id: "frost_warden",
    name: "Frost Warden",
    atlas: "/images/rune-delve/monsters-crystal.webp",
    cell: 14,
  },
  {
    id: "whisper_witch",
    name: "Whisper Witch",
    atlas: "/images/rune-delve/monsters-crystal.webp",
    cell: 15,
  },
  {
    id: "cursed_knight",
    name: "Cursed Knight",
    atlas: "/images/rune-delve/monsters-vault.webp",
    cell: 0,
  },
  {
    id: "voidspawn",
    name: "Voidspawn",
    atlas: "/images/rune-delve/monsters-vault.webp",
    cell: 1,
  },
  {
    id: "bone_summoner",
    name: "Bone Summoner",
    atlas: "/images/rune-delve/monsters-vault.webp",
    cell: 2,
  },
  {
    id: "shadow_assassin",
    name: "Shadow Assassin",
    atlas: "/images/rune-delve/monsters-vault.webp",
    cell: 3,
  },
  {
    id: "arcane_caster",
    name: "Arcane Caster",
    atlas: "/images/rune-delve/monsters-vault.webp",
    cell: 4,
  },
  {
    id: "ancient_drake",
    name: "Ancient Drake",
    atlas: "/images/rune-delve/monsters-vault.webp",
    cell: 5,
  },
  {
    id: "void_acolyte",
    name: "Void Acolyte",
    atlas: "/images/rune-delve/monsters-vault.webp",
    cell: 6,
  },
  {
    id: "wraith_lord",
    name: "Wraith Lord",
    atlas: "/images/rune-delve/monsters-vault.webp",
    cell: 7,
  },
  {
    id: "sundered_titan",
    name: "Sundered Titan",
    atlas: "/images/rune-delve/monsters-vault.webp",
    cell: 8,
  },
  {
    id: "void_stalker",
    name: "Void Stalker",
    atlas: "/images/rune-delve/monsters-vault.webp",
    cell: 9,
  },
  {
    id: "dread_summoner",
    name: "Dread Summoner",
    atlas: "/images/rune-delve/monsters-vault.webp",
    cell: 10,
  },
  {
    id: "arcane_warden",
    name: "Arcane Warden",
    atlas: "/images/rune-delve/monsters-vault.webp",
    cell: 11,
  },
  {
    id: "bone_juggernaut",
    name: "Bone Juggernaut",
    atlas: "/images/rune-delve/monsters-vault.webp",
    cell: 12,
  },
  {
    id: "void_seer",
    name: "Void Seer",
    atlas: "/images/rune-delve/monsters-vault.webp",
    cell: 13,
  },
  {
    id: "gloom_wisp",
    name: "Gloom Wisp",
    atlas: "/images/rune-delve/monsters-vault.webp",
    cell: 14,
  },
  {
    id: "vault_revenant",
    name: "Vault Revenant",
    atlas: "/images/rune-delve/monsters-vault.webp",
    cell: 15,
  },
  {
    id: "crypt_sentinel",
    name: "Crypt Sentinel",
    atlas: "/images/rune-delve/monsters-legends.webp",
    cell: 0,
  },
  {
    id: "cave_stalker",
    name: "Cave Stalker",
    atlas: "/images/rune-delve/monsters-legends.webp",
    cell: 1,
  },
  {
    id: "ashborn_raider",
    name: "Ashborn Raider",
    atlas: "/images/rune-delve/monsters-legends.webp",
    cell: 2,
  },
  {
    id: "stone_guardian",
    name: "Stone Guardian",
    atlas: "/images/rune-delve/monsters-legends.webp",
    cell: 3,
  },
  {
    id: "void_sovereign",
    name: "The Hollow Sovereign",
    atlas: "/images/rune-delve/monsters-legends.webp",
    cell: 4,
  },
  {
    id: "legacy_skeleton",
    name: "Skeleton",
    atlas: "/images/rune-delve/monsters-legends.webp",
    cell: 5,
  },
  {
    id: "legacy_slime",
    name: "Slime",
    atlas: "/images/rune-delve/monsters-legends.webp",
    cell: 6,
  },
  {
    id: "cave_bat__boss",
    name: "Boss Cave Bat",
    atlas: "/images/rune-delve/monsters-legends.webp",
    cell: 7,
  },
  {
    id: "goblin_scout__boss",
    name: "Boss Goblin Scout",
    atlas: "/images/rune-delve/monsters-legends.webp",
    cell: 8,
  },
  {
    id: "ember_slime__boss",
    name: "Boss Ember Slime",
    atlas: "/images/rune-delve/monsters-legends.webp",
    cell: 9,
  },
  {
    id: "skeleton_warrior__boss",
    name: "Boss Skeleton Warrior",
    atlas: "/images/rune-delve/monsters-legends.webp",
    cell: 10,
  },
  {
    id: "stone_golem__boss",
    name: "Boss Stone Golem",
    atlas: "/images/rune-delve/monsters-legends.webp",
    cell: 11,
  },
  {
    id: "cursed_knight__boss",
    name: "Boss Cursed Knight",
    atlas: "/images/rune-delve/monsters-legends.webp",
    cell: 12,
  },
  {
    id: "ancient_drake__boss",
    name: "Boss Ancient Drake",
    atlas: "/images/rune-delve/monsters-legends.webp",
    cell: 13,
  },
  {
    id: "voidspawn__boss",
    name: "Boss Voidspawn",
    atlas: "/images/rune-delve/monsters-legends.webp",
    cell: 14,
  },
  {
    id: "rune_wraith__boss",
    name: "Boss Rune Wraith",
    atlas: "/images/rune-delve/monsters-legends.webp",
    cell: 15,
  },
];

export type MonsterPromotion = "mini" | "boss" | null;
export interface ResolvedMonsterPortrait {
  portrait: MonsterPortrait | undefined;
  promotion: MonsterPromotion;
  echo: boolean;
}

const BY_ID = new Map(
  MONSTER_PORTRAITS.map((portrait) => [portrait.id, portrait]),
);
const normalizedName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const BY_NAME = new Map(
  MONSTER_PORTRAITS.map((portrait) => [
    normalizedName(portrait.name),
    portrait.id,
  ]),
);
const EXPEDITION_NAMES = new Map([
  ["crypt sentinel", "crypt_sentinel"],
  ["cave stalker", "cave_stalker"],
  ["ashborn raider", "ashborn_raider"],
  ["stone guardian", "stone_guardian"],
  ["the hollow sovereign", "void_sovereign"],
]);
const LEGACY_IDS: Record<string, string> = {
  skeleton_guard: "crypt_sentinel",
  goblin_raider: "ashborn_raider",
  skeleton: "legacy_skeleton",
  slime: "legacy_slime",
  hollow_sovereign: "void_sovereign",
};

/** Stable species identity, not a family guess. Legacy Expedition labels win
 * over the older reused archetype IDs (Cave Stalker was crystal_spider). */
export function resolveMonsterPortrait({
  archetypeId,
  name,
  tier,
  enemyId,
}: {
  archetypeId?: string;
  name?: string;
  tier?: "mini" | "boss";
  enemyId?: string;
}): ResolvedMonsterPortrait {
  const originalName = name ?? "";
  let displayName = originalName.trim();
  let promotion: MonsterPromotion = tier ?? null;
  let echo = /(?:^|-)echo(?:-|$)/i.test(enemyId ?? "");
  let previous = "";
  while (previous !== displayName) {
    previous = displayName;
    const existing = BY_NAME.get(normalizedName(displayName));
    if (existing && !existing.endsWith("__boss")) break;
    if (/^echo of\s+/i.test(displayName)) {
      echo = true;
      displayName = displayName.replace(/^echo of\s+/i, "");
    } else if (/^(?:mini[- ]boss|greater|champion)\s+/i.test(displayName)) {
      promotion ??= "mini";
      displayName = displayName.replace(
        /^(?:mini[- ]boss|greater|champion)\s+/i,
        "",
      );
    } else if (/^(?:boss|dread)\s+/i.test(displayName)) {
      promotion ??= "boss";
      displayName = displayName.replace(/^(?:boss|dread)\s+/i, "");
    }
  }
  let baseId = archetypeId?.toLowerCase();
  if (baseId?.endsWith("__boss")) {
    promotion ??= "boss";
    baseId = baseId.slice(0, -6);
  } else if (baseId?.endsWith("__mini")) {
    promotion ??= "mini";
    baseId = baseId.slice(0, -6);
  }
  if (baseId) baseId = LEGACY_IDS[baseId] ?? baseId;
  const exactName = normalizedName(displayName);
  const namedId = EXPEDITION_NAMES.get(exactName);
  // Exact canonical IDs remain authoritative, except known legacy name aliases.
  baseId =
    namedId ?? (baseId && BY_ID.has(baseId) ? baseId : BY_NAME.get(exactName));
  const promoted =
    promotion === "boss" && baseId ? BY_ID.get(`${baseId}__boss`) : undefined;
  return {
    portrait: promoted ?? (baseId ? BY_ID.get(baseId) : undefined),
    promotion,
    echo,
  };
}

/** CSS percentages address cell centers without bleeding into a neighboring portrait. */
export function monsterPortraitPosition(cell: number): string {
  const bounded = Math.max(0, Math.min(15, Math.floor(cell)));
  return `${((bounded % 4) * 100) / 3}% ${(Math.floor(bounded / 4) * 100) / 3}%`;
}
