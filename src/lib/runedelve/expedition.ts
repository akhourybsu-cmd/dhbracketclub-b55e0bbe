import {
  applyChain,
  damageEnemies,
  enemiesAttack,
  endTurn,
  initialCombat,
  useAbility as castAbility,
  MAX_MANA,
  type CombatState,
} from "./combatEngine";
import {
  ensurePlayableBoard,
  isValidChain,
  resolveBoard,
  type Cell,
} from "./boardEngine";
import { generateBoard, type Enemy, type RuneType } from "./dungeonGenerator";
import { mulberry32 } from "./prng";
import type { HeroClass } from "./classConfig";
import { advanceResonance } from "./resonance";

export const EXPEDITION_VERSION = 1;
export const EXPEDITION_ROOMS = 6;
export const EXPEDITION_ASCENSIONS = 8;
export type ExpeditionRouteId = "crypt" | "hunt" | "vault" | "shrine";
export type ExpeditionBoonId =
  | "ember"
  | "echo"
  | "verdant"
  | "bastion"
  | "siphon"
  | "firstlight"
  | "tempest"
  | "battery"
  | "thorns"
  | "fury"
  | "phoenix"
  | "hourglass";
export interface ExpeditionBoon {
  id: ExpeditionBoonId;
  name: string;
  description: string;
  icon: string;
  color: string;
}
export const EXPEDITION_BOONS: ExpeditionBoon[] = [
  {
    id: "ember",
    name: "Ember edge",
    description: "Attack chains deal 18% more damage.",
    icon: "sword",
    color: "destructive",
  },
  {
    id: "echo",
    name: "Arc echo",
    description: "Abilities strike every foe for 14 extra damage.",
    icon: "zap",
    color: "accent",
  },
  {
    id: "verdant",
    name: "Living heart",
    description: "+15 max HP. Healing chains restore 8 extra HP.",
    icon: "heart",
    color: "success",
  },
  {
    id: "bastion",
    name: "Golden bastion",
    description: "Guard chains grant 1 extra turn of protection.",
    icon: "shield",
    color: "gold",
  },
  {
    id: "siphon",
    name: "Soul drinker",
    description: "Each defeated foe restores 8 HP.",
    icon: "droplet",
    color: "destructive",
  },
  {
    id: "firstlight",
    name: "First light",
    description: "Enter every room with 1 extra mana.",
    icon: "sun",
    color: "gold",
  },
  {
    id: "tempest",
    name: "Storm thread",
    description: "Chains of 5+ strike every foe for 10 damage.",
    icon: "wind",
    color: "accent",
  },
  {
    id: "battery",
    name: "Bloom spark",
    description: "Healing chains of 4+ also grant 1 mana.",
    icon: "sparkles",
    color: "success",
  },
  {
    id: "thorns",
    name: "Thorn crown",
    description: "Guard reflects 50% more damage.",
    icon: "crown",
    color: "success",
  },
  {
    id: "fury",
    name: "Last flame",
    description: "Attack chains deal 35% more damage below 40% HP.",
    icon: "flame",
    color: "destructive",
  },
  {
    id: "phoenix",
    name: "Phoenix feather",
    description: "Once per run, survive a fatal hit at 40% HP.",
    icon: "feather",
    color: "gold",
  },
  {
    id: "hourglass",
    name: "Borrowed time",
    description: "Every room begins with 2 extra moves.",
    icon: "hourglass",
    color: "accent",
  },
];
/** Numeric totals displayed for the next drafted rank and the current build. */
export function expeditionBoonDescription(
  id: ExpeditionBoonId,
  level = 1,
): string {
  const n = Math.max(1, Math.min(10, Math.floor(level)));
  switch (id) {
    case "ember":
      return `Attack chains deal ${18 * n}% more damage.`;
    case "echo":
      return `Abilities strike every foe for ${14 * n} extra damage.`;
    case "verdant":
      return `+${15 * n} max HP. Healing chains restore ${8 * n} extra HP.`;
    case "bastion":
      return `Guard chains grant ${n} extra guarded ${n === 1 ? "turn" : "turns"}.`;
    case "siphon":
      return `Each defeated foe restores ${8 * n} HP.`;
    case "firstlight":
      return `Enter every room with ${n} extra mana (cap 3).`;
    case "tempest":
      return `Chains of 5+ strike every foe for ${10 * n} damage.`;
    case "battery":
      return `Healing chains of 4+ grant ${n} mana (cap 3).`;
    case "thorns":
      return `Guard reflects ${50 * n}% more damage.`;
    case "fury":
      return `Attack chains deal ${35 * n}% more damage below 40% HP.`;
    case "phoenix":
      return "Once per run, survive a fatal hit at 40% HP.";
    case "hourglass":
      return `Every room begins with ${2 * n} extra moves.`;
  }
}
export const EXPEDITION_ROUTES = {
  crypt: {
    name: "The crypt",
    description: "Balanced foes",
    detail: "A steady path through the dark.",
    icon: "skull",
    biome: "crypt",
  },
  hunt: {
    name: "Blood hunt",
    description: "Stronger foes · empowered boon",
    detail: "Stackable blessings gain two ranks.",
    icon: "swords",
    biome: "forge",
  },
  vault: {
    name: "Sunken vault",
    description: "Extra foe · bonus score",
    detail: "Clear the room for 250 extra score.",
    icon: "gem",
    biome: "vault",
  },
  shrine: {
    name: "Lost shrine",
    description: "Recover 18 HP · armored foes",
    detail: "Heal on entry. Foes begin with armor.",
    icon: "heart",
    biome: "sanctum",
  },
} as const;
export interface ExpeditionTicket {
  id: string;
  seed: number;
  hero_class: HeroClass;
  ascension: number;
  started_at: string;
}
export interface ExpeditionRun {
  version: number;
  id: string;
  seed: number;
  heroClass: HeroClass;
  ascension: number;
  room: number;
  roomsCleared: number;
  phase: "combat" | "boon" | "route" | "won" | "lost";
  route: ExpeditionRouteId;
  boons: Partial<Record<ExpeditionBoonId, number>>;
  grid: RuneType[][];
  combat: CombatState;
  rngTick: number;
  totalTurns: number;
  score: number;
  totalKills: number;
  phoenixUsed: boolean;
  startedAt: string;
  savedAt: number;
  notice: string;
  lastAction: string;
}
const ENEMIES = [
  {
    name: "Crypt sentinel",
    emoji: "💀",
    family: "undead",
    archetypeId: "skeleton_guard",
  },
  {
    name: "Rune wraith",
    emoji: "👻",
    family: "magical",
    archetypeId: "rune_wraith",
  },
  {
    name: "Cave stalker",
    emoji: "🕷️",
    family: "beast",
    archetypeId: "crystal_spider",
  },
  {
    name: "Ashborn raider",
    emoji: "👹",
    family: "cultist",
    archetypeId: "goblin_raider",
  },
  {
    name: "Stone guardian",
    emoji: "🗿",
    family: "cave",
    archetypeId: "stone_golem",
  },
];
const rank = (run: ExpeditionRun, id: ExpeditionBoonId) => run.boons[id] ?? 0;
export function expeditionReward(
  rooms: number,
  ascension: number,
  cleared: boolean,
): number {
  const count = Number.isFinite(rooms)
    ? Math.max(0, Math.min(6, Math.floor(rooms)))
    : 0;
  const tier = Number.isFinite(ascension)
    ? Math.max(0, Math.min(7, Math.floor(ascension)))
    : 0;
  return count * (12 + tier * 2) + (cleared && count === 6 ? 40 + tier * 6 : 0);
}
export function expeditionEnemies(
  seed: number,
  room: number,
  ascension: number,
  route: ExpeditionRouteId,
): Enemy[] {
  const rng = mulberry32((seed ^ Math.imul(room, 12741)) >>> 0);
  const count =
    room === 1
      ? 1
      : room === 6
        ? 2
        : (room >= 4 ? 2 : 2) + (route === "vault" ? 1 : 0);
  const hpMul = 1 + ascension * 0.16;
  return Array.from({ length: count }, (_, i) => {
    const template = ENEMIES[Math.floor(rng() * ENEMIES.length)];
    const boss = room === 6 && i === 0;
    const baseHp = boss ? 250 : room === 1 ? 74 : 46 + room * 15;
    const hp = Math.round(
      baseHp * hpMul * (route === "hunt" ? 1.16 : 1) * (0.94 + rng() * 0.12),
    );
    return {
      ...template,
      id: `exp-${room}-${i}`,
      name: boss ? "The Hollow Sovereign" : template.name,
      archetypeId: boss ? "void_sovereign" : template.archetypeId,
      hp,
      maxHp: hp,
      damage:
        Math.round(
          (boss ? 7 : 2 + Math.floor(room / 2)) * (1 + ascension * 0.08),
        ) + (route === "hunt" ? 1 : 0),
      intent: boss ? 3 : 3 + i,
      intentMax: boss ? 3 : 3 + i,
      tier: boss ? "boss" : route === "hunt" && i === 0 ? "mini" : undefined,
      armor: route === "shrine" ? 4 : 0,
    };
  });
}

export function createExpedition(ticket: ExpeditionTicket): ExpeditionRun {
  const initialRng = mulberry32(ticket.seed);
  const grid = ensurePlayableBoard(generateBoard(initialRng), initialRng).grid;
  return {
    version: EXPEDITION_VERSION,
    id: ticket.id,
    seed: ticket.seed,
    heroClass: ticket.hero_class,
    ascension: ticket.ascension,
    room: 1,
    roomsCleared: 0,
    phase: "combat",
    route: "crypt",
    boons: {},
    grid,
    combat: initialCombat(
      expeditionEnemies(ticket.seed, 1, ticket.ascension, "crypt"),
      16,
    ),
    rngTick: 0,
    totalTurns: 0,
    score: 0,
    totalKills: 0,
    phoenixUsed: false,
    startedAt: ticket.started_at,
    savedAt: Date.now(),
    notice: "",
    lastAction: "Chain 3 matching runes. Defeat every foe.",
  };
}
export function expeditionBoonChoices(run: ExpeditionRun): ExpeditionBoon[] {
  const rng = mulberry32(
    (run.seed ^ Math.imul(run.room, 81721) ^ 0x991a) >>> 0,
  );
  const eligible = EXPEDITION_BOONS.filter(
    (boon) => boon.id !== "phoenix" || !rank(run, "phoenix"),
  );
  const shuffled = [...eligible];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, 3);
}
export function expeditionRouteChoices(
  run: ExpeditionRun,
): ExpeditionRouteId[] {
  if (run.room >= 5) return ["crypt", "shrine"];
  const ids: ExpeditionRouteId[] = ["crypt", "hunt", "vault", "shrine"];
  const rng = mulberry32(
    (run.seed ^ Math.imul(run.room, 69119) ^ 0xab11) >>> 0,
  );
  const first = Math.floor(rng() * ids.length);
  const second = (first + 1 + Math.floor(rng() * 3)) % ids.length;
  return [ids[first], ids[second]];
}
export function chooseExpeditionBoon(
  run: ExpeditionRun,
  id: ExpeditionBoonId,
): ExpeditionRun {
  if (
    run.phase !== "boon" ||
    !expeditionBoonChoices(run).some((b) => b.id === id)
  )
    return run;
  const gain = run.route === "hunt" && id !== "phoenix" ? 2 : 1;
  const combat = { ...run.combat };
  if (id === "verdant") {
    combat.maxHp += 15 * gain;
    combat.hp += 15 * gain;
  }
  combat.hp = Math.min(combat.maxHp, combat.hp + 8);
  return {
    ...run,
    combat,
    boons: { ...run.boons, [id]: rank(run, id) + gain },
    phase: "route",
    notice: "",
    lastAction: "Choose the next chamber.",
  };
}
export function chooseExpeditionRoute(
  run: ExpeditionRun,
  route: ExpeditionRouteId,
): ExpeditionRun {
  if (run.phase !== "route" || !expeditionRouteChoices(run).includes(route))
    return run;
  const room = run.room + 1;
  const rng = mulberry32((run.seed ^ Math.imul(room, 17771)) >>> 0);
  const combat = initialCombat(
    expeditionEnemies(run.seed, room, run.ascension, route),
    (room === 6 ? 22 : 17) + rank(run, "hourglass") * 2,
    { bonusMaxHp: run.combat.maxHp - 100 },
  );
  combat.hp = Math.min(
    combat.maxHp,
    run.combat.hp + (route === "shrine" ? 18 : 0),
  );
  combat.mana = Math.min(MAX_MANA, run.combat.mana + rank(run, "firstlight"));
  combat.shieldTurns = Math.min(2, run.combat.shieldTurns);
  return {
    ...run,
    room,
    route,
    combat,
    grid: ensurePlayableBoard(generateBoard(rng), rng).grid,
    phase: "combat",
    notice: "",
    lastAction:
      room === 6
        ? "The Sovereign awaits."
        : EXPEDITION_ROUTES[route].description,
  };
}
function damageAll(combat: CombatState, amount: number): CombatState {
  return amount > 0 ? damageEnemies(combat, Math.round(amount)).next : combat;
}
function finishAction(
  run: ExpeditionRun,
  combat: CombatState,
  grid: RuneType[][],
  label: string,
  freeAction = false,
): ExpeditionRun {
  const playerKills = Math.max(
    0,
    combat.enemiesDefeated - run.combat.enemiesDefeated,
  );
  let next = beforeEnemyPhase(run, combat);
  const killed = next.enemies.every((e) => e.hp <= 0);
  if (killed) next = endTurn(next);
  else if (!freeAction)
    next = enemiesAttack(next, true, null, 0, {
      cls: run.heroClass,
      relicMultiplier: 1 + rank(run, "thorns") * 0.5,
    });
  const actionKills = next.enemiesDefeated - run.combat.enemiesDefeated;
  const retaliationKills = Math.max(0, actionKills - playerKills);
  if (next.hp > 0 && retaliationKills > 0)
    next = {
      ...next,
      hp: Math.min(
        next.maxHp,
        next.hp + retaliationKills * rank(run, "siphon") * 8,
      ),
    };
  let phoenixUsed = run.phoenixUsed;
  if (next.hp <= 0 && rank(run, "phoenix") && !phoenixUsed) {
    next = { ...next, hp: Math.max(1, Math.ceil(next.maxHp * 0.4)) };
    phoenixUsed = true;
    label = "Phoenix reborn · 40% HP";
  }
  const cleared = next.enemies.every((e) => e.hp <= 0) && next.hp > 0;
  const lost = !cleared && (next.hp <= 0 || next.turnsRemaining <= 0);
  const damage = Math.max(0, next.totalDamage - run.combat.totalDamage);
  const score =
    run.score +
    damage +
    Math.max(0, actionKills) * 100 +
    (cleared ? 100 + (run.route === "vault" ? 250 : 0) : 0);
  return {
    ...run,
    combat: next,
    grid,
    rngTick: run.rngTick + 1,
    totalTurns: run.totalTurns + (freeAction ? 0 : 1),
    score,
    totalKills: run.totalKills + Math.max(0, actionKills),
    phoenixUsed,
    roomsCleared: cleared ? run.room : run.roomsCleared,
    phase: cleared
      ? run.room === 6
        ? "won"
        : "boon"
      : lost
        ? "lost"
        : "combat",
    lastAction: cleared ? "Chamber cleared" : label,
    notice: "",
    savedAt: Date.now(),
  };
}
function beforeEnemyPhase(
  run: ExpeditionRun,
  combat: CombatState,
): CombatState {
  const playerKills = Math.max(
    0,
    combat.enemiesDefeated - run.combat.enemiesDefeated,
  );
  return {
    ...combat,
    hp: Math.min(
      combat.maxHp,
      combat.hp + playerKills * rank(run, "siphon") * 8,
    ),
    shieldTurns: Math.min(12, combat.shieldTurns),
  };
}
function chainPower(run: ExpeditionRun, type: RuneType, length: number) {
  const multiplier =
    1 +
    rank(run, "ember") * 0.18 +
    (run.combat.hp / run.combat.maxHp < 0.4 ? rank(run, "fury") * 0.35 : 0);
  let { next: combat } = applyChain(
    run.combat,
    type,
    length,
    run.heroClass,
    null,
    5,
    1,
    { combatMultiplier: multiplier },
  );
  if (type === "green")
    combat = {
      ...combat,
      hp: Math.min(combat.maxHp, combat.hp + rank(run, "verdant") * 8),
      mana: Math.min(
        MAX_MANA,
        combat.mana + (length >= 4 ? rank(run, "battery") : 0),
      ),
    };
  if (type === "gold")
    combat = {
      ...combat,
      shieldTurns: Math.min(12, combat.shieldTurns + rank(run, "bastion")),
    };
  if (length >= 5) combat = damageAll(combat, rank(run, "tempest") * 10);
  return advanceResonance(combat, type);
}
/** Exact player-phase effects, including armor, class, boons, overkill and resource caps. No board/refill, enemy phase, storage or RNG work. */
export function previewExpeditionChain(
  run: ExpeditionRun,
  type: RuneType,
  length: number,
) {
  const power = chainPower(run, type, length);
  const combat = beforeEnemyPhase(run, power.next);
  const damage = combat.totalDamage - run.combat.totalDamage;
  const healing = combat.hp - run.combat.hp;
  const mana = combat.mana - run.combat.mana;
  const guard = combat.shieldTurns - run.combat.shieldTurns;
  const pieces: string[] = [];
  if (damage > 0 || type === "red") pieces.push(`${damage} dmg`);
  if (healing > 0 || type === "green")
    pieces.push(healing > 0 ? `+${healing} HP` : "HP full");
  if (mana > 0 || type === "blue")
    pieces.push(mana > 0 ? `+${mana} mana` : "Mana full");
  if (guard > 0 || type === "gold")
    pieces.push(guard > 0 ? `+${guard} guard` : "Guard full");
  return {
    damage,
    healing,
    mana,
    guard,
    burst: !!power.burst,
    text: pieces.join(" · "),
  };
}
export function expeditionChain(
  run: ExpeditionRun,
  chain: Cell[],
): ExpeditionRun {
  if (run.phase !== "combat" || !isValidChain(run.grid, chain)) return run;
  const type = run.grid[chain[0].r][chain[0].c];
  const resonance = chainPower(run, type, chain.length);
  const combat = resonance.next;
  const rng = mulberry32(
    (run.seed ^
      Math.imul(run.rngTick + 1, 196613) ^
      Math.imul(run.room, 173)) >>>
      0,
  );
  const grid = ensurePlayableBoard(
    resolveBoard(run.grid, chain, rng),
    rng,
  ).grid;
  return finishAction(
    run,
    combat,
    grid,
    resonance.burst
      ? "Resonance burst!"
      : `${chain.length} ${type === "red" ? "attack" : type === "blue" ? "mana" : type === "green" ? "healing" : "guard"} runes`,
  );
}
export function expeditionAbility(run: ExpeditionRun): ExpeditionRun {
  if (run.phase !== "combat") return run;
  const { next, ok } = castAbility(run.combat, run.heroClass);
  if (!ok) return run;
  return finishAction(
    run,
    damageAll(next, rank(run, "echo") * 14),
    run.grid,
    run.heroClass === "rogue"
      ? "Shadowstep · free action"
      : "Ability unleashed",
    run.heroClass === "rogue",
  );
}
export function expeditionStorageKey(userId: string, clubId: string): string {
  return `rd-expedition:v1:${userId}:${clubId}`;
}
export function saveExpedition(key: string, run: ExpeditionRun): boolean {
  try {
    localStorage.setItem(key, JSON.stringify({ ...run, savedAt: Date.now() }));
    return true;
  } catch {
    return false;
  }
}
export function loadExpedition(key: string): ExpeditionRun | null {
  try {
    const run = JSON.parse(
      localStorage.getItem(key) ?? "null",
    ) as ExpeditionRun | null;
    if (
      !run ||
      run.version !== EXPEDITION_VERSION ||
      typeof run.id !== "string" ||
      !Number.isFinite(run.seed) ||
      !Number.isInteger(run.room) ||
      run.room < 1 ||
      run.room > 6 ||
      !Number.isInteger(run.ascension) ||
      run.ascension < 0 ||
      run.ascension > 7 ||
      !["warrior", "mage", "rogue", "cleric"].includes(run.heroClass) ||
      !["combat", "boon", "route", "won", "lost"].includes(run.phase)
    )
      return null;
    if (
      !Array.isArray(run.grid) ||
      run.grid.length !== 5 ||
      !run.grid.every(
        (row) =>
          row.length === 5 &&
          row.every((cell) => ["red", "blue", "green", "gold"].includes(cell)),
      )
    )
      return null;
    if (
      !Object.prototype.hasOwnProperty.call(EXPEDITION_ROUTES, run.route) ||
      !Number.isInteger(run.roomsCleared) ||
      run.roomsCleared < 0 ||
      run.roomsCleared > run.room
    )
      return null;
    if (
      !run.combat ||
      !Number.isFinite(run.combat.hp) ||
      !Number.isFinite(run.combat.maxHp) ||
      !Array.isArray(run.combat.enemies) ||
      !run.boons ||
      typeof run.boons !== "object" ||
      !Number.isInteger(run.rngTick) ||
      !Number.isInteger(run.totalTurns) ||
      !Number.isFinite(run.score)
    )
      return null;
    if (
      !Object.entries(run.boons).every(
        ([id, count]) =>
          EXPEDITION_BOONS.some((boon) => boon.id === id) &&
          Number.isInteger(count) &&
          count >= 1 &&
          count <= 10,
      )
    )
      return null;
    const combat = run.combat;
    if (
      combat.maxHp < 100 ||
      combat.maxHp > 250 ||
      combat.hp < 0 ||
      combat.hp > combat.maxHp ||
      !Number.isInteger(combat.mana) ||
      combat.mana < 0 ||
      combat.mana > 3 ||
      !Number.isInteger(combat.shieldTurns) ||
      combat.shieldTurns < 0 ||
      combat.shieldTurns > 12 ||
      !Number.isInteger(combat.turnsRemaining) ||
      combat.turnsRemaining < 0 ||
      combat.turnsRemaining > 50
    )
      return null;
    if (
      combat.enemies.length < 1 ||
      combat.enemies.length > 3 ||
      !combat.enemies.every(
        (enemy) =>
          typeof enemy.id === "string" &&
          typeof enemy.name === "string" &&
          Number.isFinite(enemy.hp) &&
          Number.isFinite(enemy.maxHp) &&
          enemy.hp >= 0 &&
          enemy.maxHp > 0 &&
          enemy.hp <= enemy.maxHp &&
          Number.isFinite(enemy.damage) &&
          enemy.damage >= 0,
      )
    )
      return null;
    if (
      run.totalTurns < 0 ||
      run.totalTurns > 180 ||
      run.rngTick < 0 ||
      run.rngTick > 300 ||
      run.score < 0 ||
      run.score > 250000 ||
      !Number.isFinite(run.savedAt)
    )
      return null;
    if (
      combat.resonance &&
      (!Array.isArray(combat.resonance.colors) ||
        combat.resonance.colors.some(
          (color) => !["red", "blue", "green", "gold"].includes(color),
        ) ||
        !Number.isInteger(combat.resonance.bursts) ||
        combat.resonance.bursts < 0)
    )
      return null;
    if (
      Date.now() - run.savedAt > 7 * 86400000 ||
      run.savedAt > Date.now() + 60000
    )
      return null;
    return run;
  } catch {
    return null;
  }
}
export function clearExpedition(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
}
