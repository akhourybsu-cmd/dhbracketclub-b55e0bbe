import { ENEMIES, UPGRADES } from "./catalog";
import type {
  CoreEnemy,
  CoreRun,
  CoreScenario,
  EnemyType,
  Research,
  UpgradeId,
} from "./types";

export const STEP = 0.05;
export const CORE_RADIUS = 30;
export const SPAWN_RADIUS = 455;
export const isFinished = (s: CoreRun) =>
  s.phase === "victory" || s.phase === "defeat";
export const distance = (e: { x: number; y: number }) => Math.hypot(e.x, e.y);

// Seeded RNG is stored with the run. Resume and 2× speed preserve the same simulation.
function random(s: CoreRun) {
  s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0;
  return s.seed / 4294967296;
}

export function stats(
  s: Pick<CoreRun, "upgrades" | "research" | "overdriveTime">,
  scenario: CoreScenario,
) {
  const u = (id: UpgradeId) => s.upgrades[id] || 0;
  const r = s.research;
  const glass = scenario.rule === "glass";
  return {
    damage:
      16 *
      (1 + u("damage") * 0.35) *
      (1 + (r.weapons || 0) * 0.08) *
      (glass ? 2 : 1),
    fireRate:
      1.8 *
      (1 + u("haste") * 0.22) *
      (1 + (r.reactor || 0) * 0.05) *
      (s.overdriveTime > 0 ? 2.2 : 1),
    range: 240 + u("range") * 22,
    targets: 1 + u("multishot"),
    critical: u("critical") * 0.08,
    maxHp: glass ? 1 : 180 + (r.plating || 0) * 20 + u("hull") * 55,
    maxShield: glass ? 0 : 50 + (r.barrier || 0) * 15 + u("shield") * 35,
    regen: glass || scenario.rule === "blackout" ? 0 : u("regen") * 1.6,
    shieldRegen:
      glass || scenario.rule === "blackout" ? 0 : 2.5 + u("shield") * 0.5,
    armor: glass ? 0 : u("armor") * 0.08,
    income: 1 + u("income") * 0.18,
    orbit: u("orbit"),
    slow: u("frost") * 0.1,
    novaDamage: 65 * (1 + (r.nova || 0) * 0.15) * (1 + u("damage") * 0.15),
  };
}

export function createRun(
  scenario: CoreScenario,
  research: Research = {},
  id: string = crypto.randomUUID(),
  seed = Date.now() >>> 0,
): CoreRun {
  const s: CoreRun = {
    version: 2,
    id,
    scenarioId: scenario.id,
    seed,
    nextId: 0,
    phase: "ready",
    time: 0,
    wave: 0,
    cleared: 0,
    waveTime: 0,
    toSpawn: [],
    spawnCd: 0,
    breakTime: 0,
    hp: 180,
    shield: 50,
    energy: 80 + (research.salvage || 0) * 12,
    kills: 0,
    score: 0,
    damageTaken: 0,
    upgrades: {},
    research: { ...research },
    enemies: [],
    projectiles: [],
    effects: [],
    fireCd: 0,
    novaCd: 0,
    overdriveCd: 0,
    overdriveTime: 0,
    orbitalCd: 0,
    targeting: "nearest",
  };
  const v = stats(s, scenario);
  s.hp = v.maxHp;
  s.shield = v.maxShield;
  return s;
}

export function waveEnemies(wave: number, scenario: CoreScenario): EnemyType[] {
  const count = Math.min(
    100,
    Math.round((6 + wave * 2.6) * scenario.difficulty),
  );
  const kinds: EnemyType[] = [];
  const sector = scenario.mode === "campaign" ? Number(scenario.id) : 8;
  for (let i = 0; i < count; i++) {
    let kind: EnemyType = "drone";
    if ((wave >= 2 || sector >= 2) && i % 4 === 1) kind = "runner";
    if ((wave >= 3 || sector >= 3) && i % 5 === 2) kind = "swarm";
    if ((wave >= 4 || sector >= 4 || scenario.rule === "siege") && i % 7 === 3)
      kind = "tank";
    if ((wave >= 6 || sector >= 5) && i % 9 === 4) kind = "splitter";
    kinds.push(kind);
  }
  const bossWave = wave % (scenario.rule === "siege" ? 3 : 5) === 0;
  if (bossWave || wave === scenario.waves)
    kinds.splice(Math.floor(count / 2), 0, "boss");
  if (scenario.id === "8" && wave === 12) kinds.push("boss");
  return kinds;
}

export function startWave(s: CoreRun, scenario: CoreScenario): CoreRun {
  if (s.phase !== "ready" && s.phase !== "intermission") return s;
  return {
    ...s,
    phase: "wave",
    wave: s.wave + 1,
    waveTime: 0,
    breakTime: 0,
    toSpawn: waveEnemies(s.wave + 1, scenario),
    spawnCd: 0.4,
  };
}

function effect(
  s: CoreRun,
  kind: CoreRun["effects"][number]["kind"],
  x: number,
  y: number,
  life: number,
  value?: number,
) {
  s.effects.push({ id: ++s.nextId, kind, x, y, life, maxLife: life, value });
}

function spawn(
  s: CoreRun,
  scenario: CoreScenario,
  kind: EnemyType,
  position?: { x: number; y: number },
) {
  const def = ENEMIES[kind];
  const angle = random(s) * Math.PI * 2;
  const scale =
    scenario.hp *
    scenario.difficulty ** 0.7 *
    (1 + (s.wave - 1) * 0.2 + Math.max(0, s.wave - 8) ** 1.5 * 0.07) *
    (scenario.mode === "endless" ? 1.13 ** Math.max(0, s.wave - 10) : 1);
  const hp = def.hp * scale;
  s.enemies.push({
    id: ++s.nextId,
    kind,
    x: position?.x ?? Math.cos(angle) * SPAWN_RADIUS,
    y: position?.y ?? Math.sin(angle) * SPAWN_RADIUS,
    hp,
    maxHp: hp,
    speed: def.speed * scenario.speed * (1 + Math.min(1.5, s.wave * 0.012)),
    damage: def.damage * (1 + (s.wave - 1) * 0.07),
    radius: def.radius,
    bounty: def.bounty,
    attackCd: 0.5,
    slowed: 0,
  });
}

function hit(
  s: CoreRun,
  enemy: CoreEnemy,
  damage: number,
  bypassArmor = false,
) {
  if (enemy.hp <= 0) return;
  enemy.hp -=
    damage *
    (!bypassArmor && (enemy.kind === "tank" || enemy.kind === "boss")
      ? 0.75
      : 1);
  effect(s, "hit", enemy.x, enemy.y, 0.22, damage);
}

function harvest(s: CoreRun, scenario: CoreScenario) {
  const dead = s.enemies.filter((e) => e.hp <= 0);
  const income = stats(s, scenario).income;
  for (const e of dead) {
    s.kills++;
    s.energy += Math.round(e.bounty * income);
    s.score += e.bounty * 10;
    effect(s, "kill", e.x, e.y, 0.6, e.bounty);
    if (e.kind === "splitter") {
      for (let i = 0; i < 3; i++)
        spawn(s, scenario, "swarm", { x: e.x + (i - 1) * 12, y: e.y + 12 });
    }
  }
  s.enemies = s.enemies.filter((e) => e.hp > 0);
}

export function upgradeCost(id: UpgradeId, level: number) {
  const def = UPGRADES.find((u) => u.id === id)!;
  return Math.round(def.cost * 1.55 ** level);
}

export function upgradeBlocked(id: UpgradeId, scenario: CoreScenario) {
  return (
    (scenario.rule === "glass" &&
      ["hull", "shield", "regen", "armor"].includes(id)) ||
    (scenario.rule === "blackout" && id === "regen")
  );
}

export function buyUpgrade(
  s: CoreRun,
  scenario: CoreScenario,
  id: UpgradeId,
): CoreRun {
  const def = UPGRADES.find((u) => u.id === id);
  if (!def || isFinished(s) || upgradeBlocked(id, scenario)) return s;
  const level = s.upgrades[id] || 0;
  const cost = upgradeCost(id, level);
  if (level >= def.max || s.energy < cost) return s;
  return {
    ...s,
    energy: s.energy - cost,
    upgrades: { ...s.upgrades, [id]: level + 1 },
    hp: s.hp + (id === "hull" ? 55 : 0),
    shield: s.shield + (id === "shield" ? 35 : 0),
  };
}

export function activateAbility(
  s: CoreRun,
  scenario: CoreScenario,
  ability: "nova" | "overdrive",
): CoreRun {
  if (s.phase !== "wave" || (ability === "nova" ? s.novaCd : s.overdriveCd) > 0)
    return s;
  const n = {
    ...s,
    enemies: s.enemies.map((e) => ({ ...e })),
    effects: [...s.effects],
  };
  if (ability === "overdrive")
    return { ...n, overdriveTime: 6, overdriveCd: 30 };
  const damage = stats(n, scenario).novaDamage;
  n.novaCd = 20;
  effect(n, "nova", 0, 0, 0.85);
  for (const e of n.enemies) {
    if (distance(e) <= 350) {
      hit(n, e, damage, true);
      const d = Math.max(1, distance(e));
      e.x += (e.x / d) * 65;
      e.y += (e.y / d) * 65;
      e.slowed = 2;
    }
  }
  harvest(n, scenario);
  return n;
}

// Fixed step, pure transitions. No timers or DOM dependencies inside combat.
export function stepRun(state: CoreRun, scenario: CoreScenario): CoreRun {
  if (state.phase === "ready" || isFinished(state)) return state;
  const s: CoreRun = {
    ...state,
    enemies: state.enemies.map((e) => ({ ...e })),
    projectiles: state.projectiles.map((p) => ({ ...p })),
    effects: state.effects
      .filter((e) => e.life > STEP)
      .map((e) => ({ ...e, life: e.life - STEP })),
    toSpawn: [...state.toSpawn],
  };
  s.time += STEP;
  s.novaCd = Math.max(0, s.novaCd - STEP);
  s.overdriveCd = Math.max(0, s.overdriveCd - STEP);
  s.overdriveTime = Math.max(0, s.overdriveTime - STEP);
  const v = stats(s, scenario);
  s.hp = Math.min(v.maxHp, s.hp + v.regen * STEP);
  // Shield can recharge between attacks but cannot out-heal a sustained breach.
  s.shield = Math.min(v.maxShield, s.shield + v.shieldRegen * STEP);
  if (s.phase === "intermission") {
    s.breakTime -= STEP;
    return s.breakTime <= 0 ? startWave(s, scenario) : s;
  }
  s.waveTime += STEP;
  s.spawnCd -= STEP;
  if (s.spawnCd <= 0 && s.toSpawn.length && s.enemies.length < 160) {
    spawn(s, scenario, s.toSpawn.shift()!);
    s.spawnCd =
      Math.max(0.15, 0.95 - s.wave * 0.025) /
      Math.min(scenario.difficulty, 1.6);
  }
  for (const e of s.enemies) {
    const d = distance(e);
    e.slowed = Math.max(0, e.slowed - STEP);
    const slow = e.slowed > 0 ? 0.45 : d < 165 ? 1 - v.slow : 1;
    const move = Math.min(
      Math.max(0, d - CORE_RADIUS - e.radius),
      e.speed * slow * STEP,
    );
    e.x -= (e.x / Math.max(d, 1)) * move;
    e.y -= (e.y / Math.max(d, 1)) * move;
    if (d <= CORE_RADIUS + e.radius + 1) {
      e.attackCd -= STEP;
      if (e.attackCd <= 0) {
        e.attackCd = 1;
        const damage = e.damage * (1 - v.armor);
        const absorbed = Math.min(s.shield, damage);
        s.shield -= absorbed;
        s.hp = Math.max(0, s.hp - (damage - absorbed));
        s.damageTaken += damage - absorbed;
        effect(s, "breach", e.x, e.y, 0.4);
        if (s.hp <= 0) {
          s.phase = "defeat";
          return s;
        }
      }
    }
  }
  // Orbitals are real moving weapons; each blade damages enemies near its current position.
  s.orbitalCd -= STEP;
  if (v.orbit && s.orbitalCd <= 0) {
    s.orbitalCd = 0.2;
    for (let i = 0; i < v.orbit; i++) {
      const a = s.time * 1.8 + (i * Math.PI * 2) / v.orbit;
      const x = Math.cos(a) * 95,
        y = Math.sin(a) * 95;
      for (const e of s.enemies)
        if (Math.hypot(e.x - x, e.y - y) < 28 + e.radius)
          hit(s, e, v.damage * 0.6);
    }
  }
  s.fireCd -= STEP;
  if (s.fireCd <= 0) {
    const targets = s.enemies.filter((e) => e.hp > 0 && distance(e) <= v.range);
    targets.sort((a, b) =>
      s.targeting === "strongest"
        ? b.hp - a.hp
        : s.targeting === "fastest"
          ? b.speed - a.speed
          : distance(a) - distance(b),
    );
    if (targets.length) {
      for (const e of targets.slice(0, v.targets)) {
        const critical = random(s) < v.critical;
        s.projectiles.push({
          id: ++s.nextId,
          x: 0,
          y: 0,
          target: e.id,
          damage: v.damage * (critical ? 3 : 1),
          critical,
        });
      }
      effect(s, "shot", 0, 0, 0.16);
      s.fireCd = 1 / v.fireRate;
    }
  }
  const aliveProjectiles: CoreRun["projectiles"] = [];
  for (const p of s.projectiles) {
    const target = s.enemies.find((e) => e.id === p.target && e.hp > 0);
    if (!target) continue;
    const d = Math.hypot(target.x - p.x, target.y - p.y);
    if (d < 520 * STEP + target.radius) hit(s, target, p.damage);
    else {
      p.x += ((target.x - p.x) / d) * 520 * STEP;
      p.y += ((target.y - p.y) / d) * 520 * STEP;
      aliveProjectiles.push(p);
    }
  }
  s.projectiles = aliveProjectiles;
  harvest(s, scenario);
  if (s.toSpawn.length === 0 && s.enemies.length === 0) {
    s.cleared = s.wave;
    s.energy += Math.round((25 + s.wave * 5) * v.income);
    s.score += s.wave * 100;
    s.projectiles = [];
    s.phase =
      scenario.waves !== null && s.wave >= scenario.waves
        ? "victory"
        : "intermission";
    s.breakTime = 7;
  }
  return s;
}

export function runStars(s: CoreRun, scenario: CoreScenario) {
  if (s.phase !== "victory") return 0;
  const ratio = s.hp / stats(s, scenario).maxHp;
  return ratio >= 0.8 ? 3 : ratio >= 0.4 ? 2 : 1;
}

export function runReward(s: CoreRun, scenario: CoreScenario) {
  return (
    5 +
    Math.min(500, s.cleared * 6) +
    (s.phase === "victory" ? scenario.reward : 0)
  );
}
