import { ENEMIES, UPGRADES } from "./catalog";
import {
  BALANCE_VERSION,
  SYSTEMS,
  emptyMetrics,
  stats,
  upgradeCost,
} from "./systems";
import { rewardBreakdown } from "./economy";
import type {
  CoreEnemy,
  CoreRun,
  CoreScenario,
  EnemyType,
  Research,
  UpgradeId,
  WeaponId,
} from "./types";
export { stats, upgradeCost } from "./systems";

export const STEP = 0.05,
  CORE_RADIUS = 30,
  SPAWN_RADIUS = 455;
export const isFinished = (s: CoreRun) =>
  s.phase === "victory" || s.phase === "defeat";
export const distance = (e: { x: number; y: number }) => Math.hypot(e.x, e.y);
function random(s: CoreRun) {
  s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0;
  return s.seed / 4294967296;
}
function copy(s: CoreRun): CoreRun {
  const m = s.metrics || emptyMetrics(s.energy);
  return {
    ...s,
    enemies: s.enemies.map((e) => ({ ...e })),
    projectiles: s.projectiles.map((p) => ({ ...p })),
    effects: [...s.effects],
    toSpawn: [...s.toSpawn],
    metrics: {
      ...m,
      damage: { ...m.damage },
      kills: { ...m.kills },
      shots: { ...m.shots },
    },
  };
}
export function createRun(
  scenario: CoreScenario,
  research: Research = {},
  id: string = crypto.randomUUID(),
  seed = Date.now() >>> 0,
): CoreRun {
  const energy = 80 + (research.salvage || 0) * 12;
  const s: CoreRun = {
    version: 2,
    balanceVersion: BALANCE_VERSION,
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
    energy,
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
    arcCd: 0,
    railCd: 0,
    shieldDelay: 0,
    energyRemainder: 0,
    metrics: emptyMetrics(energy),
    targeting: "nearest",
  };
  const v = stats(s, scenario);
  s.hp = v.maxHp;
  s.shield = v.maxShield;
  return s;
}
export function waveDifficulty(wave: number, scenario: CoreScenario) {
  return scenario.mode === "campaign"
    ? 1 + (scenario.difficulty - 1) * (0.3 + 0.7 * Math.min(1, (wave - 1) / 7))
    : scenario.difficulty;
}
export function waveEnemies(wave: number, scenario: CoreScenario): EnemyType[] {
  const count = Math.min(
    100,
    Math.round((6 + wave * 2.6) * waveDifficulty(wave, scenario)),
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
  fromX?: number,
  fromY?: number,
) {
  s.effects.push({
    id: ++s.nextId,
    kind,
    x,
    y,
    life,
    maxLife: life,
    value,
    fromX,
    fromY,
  });
}
export function enemyScale(wave: number, scenario: CoreScenario) {
  return (
    scenario.hp *
    waveDifficulty(wave, scenario) ** 0.85 *
    (1 + (wave - 1) * 0.24 + Math.max(0, wave - 7) ** 1.4 * 0.1) *
    (scenario.mode === "campaign"
      ? 1 + (scenario.difficulty - 1) * Math.max(0, wave - 4) * 0.085
      : 1) *
    (scenario.mode === "endless" ? 1.14 ** Math.max(0, wave - 8) : 1)
  );
}
function spawn(
  s: CoreRun,
  scenario: CoreScenario,
  kind: EnemyType,
  position?: { x: number; y: number },
) {
  const d = ENEMIES[kind],
    angle = random(s) * Math.PI * 2,
    hp = d.hp * enemyScale(s.wave, scenario);
  s.enemies.push({
    id: ++s.nextId,
    kind,
    x: position?.x ?? Math.cos(angle) * SPAWN_RADIUS,
    y: position?.y ?? Math.sin(angle) * SPAWN_RADIUS,
    hp,
    maxHp: hp,
    speed: d.speed * scenario.speed * (1 + Math.min(1, s.wave * 0.014)),
    damage: d.damage * (1 + (s.wave - 1) * 0.09),
    radius: d.radius,
    bounty: d.bounty,
    attackCd: 0.5,
    slowed: 0,
  });
}
const armorMultiplier = (e: CoreEnemy, source: WeaponId) =>
  source === "rail" || source === "nova"
    ? 1
    : e.kind === "tank" || e.kind === "boss"
      ? 0.75
      : 1;
function hit(s: CoreRun, e: CoreEnemy, amount: number, source: WeaponId) {
  if (e.hp <= 0) return;
  const actual = Math.min(e.hp, amount * armorMultiplier(e, source));
  e.hp -= actual;
  e.lastHit = source;
  s.metrics!.damage[source] += actual;
  effect(s, "hit", e.x, e.y, 0.18, actual);
}
function creditEnergy(s: CoreRun, amount: number) {
  const total = (s.energyRemainder || 0) + amount,
    whole = Math.floor(total + 1e-8);
  s.energyRemainder = total - whole;
  s.energy += whole;
  s.metrics!.energyEarned += whole;
}
function harvest(s: CoreRun, scenario: CoreScenario) {
  const dead = s.enemies.filter((e) => e.hp <= 0),
    income = stats(s, scenario).income;
  for (const e of dead) {
    s.kills++;
    s.metrics!.kills[e.lastHit || "pulse"]++;
    creditEnergy(s, e.bounty * income);
    s.score += e.bounty * 10;
    effect(s, "kill", e.x, e.y, 0.5, e.bounty);
    if (e.kind === "splitter")
      for (let i = 0; i < 3; i++)
        spawn(s, scenario, "swarm", { x: e.x + (i - 1) * 12, y: e.y + 12 });
  }
  s.enemies = s.enemies.filter((e) => e.hp > 0);
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
  const lv = s.upgrades[id] || 0,
    cost = upgradeCost(id, lv);
  if (lv >= def.max || s.energy < cost) return s;
  const before = stats(s, scenario),
    n = copy(s);
  n.energy -= cost;
  n.metrics!.energySpent += cost;
  n.upgrades = { ...s.upgrades, [id]: lv + 1 };
  const after = stats(n, scenario);
  n.hp += after.maxHp - before.maxHp;
  n.shield += after.maxShield - before.maxShield;
  n.fireCd = (Math.max(0, n.fireCd) * before.fireRate) / after.fireRate;
  n.arcCd =
    (Math.max(0, n.arcCd || 0) * after.arcInterval) / before.arcInterval;
  n.railCd =
    (Math.max(0, n.railCd || 0) * after.railInterval) / before.railInterval;
  return n;
}
export function activateAbility(
  s: CoreRun,
  scenario: CoreScenario,
  ability: "nova" | "overdrive",
): CoreRun {
  if (s.phase !== "wave" || (ability === "nova" ? s.novaCd : s.overdriveCd) > 0)
    return s;
  const n = copy(s);
  if (ability === "overdrive")
    return {
      ...n,
      overdriveTime: SYSTEMS.overdriveDuration,
      overdriveCd: SYSTEMS.overdriveCooldown,
      fireCd: n.fireCd / SYSTEMS.overdriveMultiplier,
      arcCd: (n.arcCd || 0) / SYSTEMS.overdriveMultiplier,
      railCd: (n.railCd || 0) / SYSTEMS.overdriveMultiplier,
    };
  n.novaCd = SYSTEMS.novaCooldown;
  n.metrics!.shots.nova++;
  effect(n, "nova", 0, 0, 0.85);
  for (const e of n.enemies)
    if (distance(e) <= SYSTEMS.novaRange) {
      hit(n, e, stats(n, scenario).novaDamage, "nova");
      const d = Math.max(1, distance(e));
      e.x += (e.x / d) * 65;
      e.y += (e.y / d) * 65;
      e.slowed = 2;
    }
  harvest(n, scenario);
  return n;
}
function priority(s: CoreRun, a: CoreEnemy, b: CoreEnemy) {
  return s.targeting === "strongest"
    ? b.hp - a.hp
    : s.targeting === "fastest"
      ? b.speed - a.speed
      : distance(a) - distance(b);
}
function reserved(s: CoreRun, e: CoreEnemy) {
  return s.projectiles
    .filter((p) => p.target === e.id)
    .reduce((sum, p) => sum + p.damage * armorMultiplier(e, "pulse"), 0);
}
function fireSystems(s: CoreRun, scenario: CoreScenario) {
  const v = stats(s, scenario);
  s.orbitalCd -= STEP;
  if (v.orbit && s.orbitalCd <= 0) {
    s.orbitalCd += SYSTEMS.orbitalInterval;
    for (let i = 0; i < v.orbit; i++) {
      const a = s.time * 1.8 + (i * Math.PI * 2) / v.orbit,
        x = Math.cos(a) * SYSTEMS.orbitalRadius,
        y = Math.sin(a) * SYSTEMS.orbitalRadius;
      for (const e of s.enemies)
        if (
          e.hp > 0 &&
          Math.hypot(e.x - x, e.y - y) <= SYSTEMS.orbitalHitRadius + e.radius
        ) {
          hit(s, e, v.orbitDamage, "orbit");
          s.metrics!.shots.orbit++;
        }
    }
  } else if (!v.orbit) s.orbitalCd = 0;
  s.arcCd = (s.arcCd || 0) - STEP;
  if (v.arcDamage && s.arcCd <= 0) {
    let next = s.enemies
      .filter((e) => e.hp > 0 && distance(e) <= v.range)
      .sort((a, b) => priority(s, a, b))[0];
    if (next) {
      s.arcCd += v.arcInterval;
      s.metrics!.shots.arc++;
      const visited = new Set<number>();
      let x = 0,
        y = 0;
      for (let i = 0; i < v.arcTargets && next; i++) {
        visited.add(next.id);
        effect(s, "arc", next.x, next.y, 0.28, undefined, x, y);
        hit(s, next, v.arcDamage * 0.82 ** i, "arc");
        x = next.x;
        y = next.y;
        next = s.enemies
          .filter(
            (e) =>
              e.hp > 0 &&
              !visited.has(e.id) &&
              Math.hypot(e.x - x, e.y - y) <= v.arcJump,
          )
          .sort(
            (a, b) =>
              Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y),
          )[0];
      }
    } else s.arcCd = 0;
  } else if (!v.arcDamage) s.arcCd = 0;
  s.railCd = (s.railCd || 0) - STEP;
  if (v.railDamage && s.railCd <= 0) {
    const target = s.enemies
      .filter((e) => e.hp > 0 && distance(e) <= v.range)
      .sort((a, b) => b.hp - a.hp)[0];
    if (target) {
      s.railCd += v.railInterval;
      s.metrics!.shots.rail++;
      const d = Math.max(1, distance(target)),
        dx = target.x / d,
        dy = target.y / d,
        length = v.range + 40;
      for (const e of s.enemies) {
        const along = e.x * dx + e.y * dy,
          across = Math.abs(e.x * dy - e.y * dx);
        if (
          e.hp > 0 &&
          along >= 0 &&
          along <= length + e.radius &&
          across <= 10 + e.radius
        )
          hit(s, e, v.railDamage, "rail");
      }
      effect(s, "rail", dx * length, dy * length, 0.35);
    } else s.railCd = 0;
  } else if (!v.railDamage) s.railCd = 0;
  s.fireCd -= STEP;
  while (s.fireCd <= 1e-9) {
    const targets = s.enemies
      .filter(
        (e) =>
          e.hp > 0 && distance(e) <= v.range && reserved(s, e) < e.hp - 1e-6,
      )
      .sort((a, b) => priority(s, a, b));
    if (!targets.length) {
      s.fireCd = 0;
      break;
    }
    for (const e of targets.slice(0, v.targets)) {
      const critical = random(s) < v.critical;
      s.projectiles.push({
        id: ++s.nextId,
        x: 0,
        y: 0,
        target: e.id,
        damage: v.damage * (critical ? SYSTEMS.critMultiplier : 1),
        critical,
      });
      s.metrics!.shots.pulse++;
    }
    effect(s, "shot", 0, 0, 0.12);
    s.fireCd += 1 / v.fireRate;
  }
  const active: CoreRun["projectiles"] = [];
  for (const p of s.projectiles) {
    let target = s.enemies.find((e) => e.id === p.target && e.hp > 0);
    if (!target) {
      target = s.enemies
        .filter((e) => e.hp > 0 && distance(e) <= v.range)
        .sort(
          (a, b) =>
            Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y),
        )[0];
      if (target) p.target = target.id;
    }
    if (!target) continue;
    const d = Math.hypot(target.x - p.x, target.y - p.y);
    if (d <= SYSTEMS.projectileSpeed * STEP + target.radius)
      hit(s, target, p.damage, "pulse");
    else {
      p.x += ((target.x - p.x) / d) * SYSTEMS.projectileSpeed * STEP;
      p.y += ((target.y - p.y) / d) * SYSTEMS.projectileSpeed * STEP;
      active.push(p);
    }
  }
  s.projectiles = active;
}
// Pure 50ms simulation. Fractional cooldown overshoot carries to the next step.
export function stepRun(state: CoreRun, scenario: CoreScenario): CoreRun {
  if (state.phase === "ready" || isFinished(state)) return state;
  const s = copy(state);
  s.effects = s.effects
    .filter((e) => e.life > STEP)
    .map((e) => ({ ...e, life: e.life - STEP }));
  s.time += STEP;
  s.novaCd = Math.max(0, s.novaCd - STEP);
  s.overdriveCd = Math.max(0, s.overdriveCd - STEP);
  s.overdriveTime = Math.max(0, s.overdriveTime - STEP);
  if (state.overdriveTime > 0 && s.overdriveTime === 0) {
    s.fireCd *= SYSTEMS.overdriveMultiplier;
    s.arcCd = (s.arcCd || 0) * SYSTEMS.overdriveMultiplier;
    s.railCd = (s.railCd || 0) * SYSTEMS.overdriveMultiplier;
  }
  const v = stats(s, scenario);
  s.hp = Math.min(v.maxHp, s.hp + v.regen * STEP);
  s.shieldDelay = Math.max(0, (s.shieldDelay || 0) - STEP);
  if (s.shieldDelay <= 0)
    s.shield = Math.min(v.maxShield, s.shield + v.shieldRegen * STEP);
  if (s.phase === "intermission") {
    s.breakTime -= STEP;
    return s.breakTime <= 0 ? startWave(s, scenario) : s;
  }
  s.waveTime += STEP;
  s.spawnCd -= STEP;
  if (s.spawnCd <= 0 && s.toSpawn.length && s.enemies.length < 160) {
    spawn(s, scenario, s.toSpawn.shift()!);
    s.spawnCd +=
      Math.max(0.18, 0.8 - s.wave * 0.024) /
      Math.min(waveDifficulty(s.wave, scenario), 1.6);
  }
  for (const e of s.enemies) {
    const d = distance(e);
    e.slowed = Math.max(0, e.slowed - STEP);
    const field = d < SYSTEMS.slowRadius ? 1 - v.slow : 1,
      slow = e.slowed > 0 ? Math.min(field, 0.45) : field;
    const move = Math.min(
      Math.max(0, d - CORE_RADIUS - e.radius),
      e.speed * slow * STEP,
    );
    e.x -= (e.x / Math.max(d, 1)) * move;
    e.y -= (e.y / Math.max(d, 1)) * move;
  }
  fireSystems(s, scenario);
  harvest(s, scenario);
  for (const e of s.enemies)
    if (distance(e) <= CORE_RADIUS + e.radius + 1) {
      e.attackCd -= STEP;
      if (e.attackCd <= 0) {
        e.attackCd += 1;
        const damage = e.damage * (1 - v.armor),
          absorbed = Math.min(s.shield, damage);
        s.shield -= absorbed;
        s.metrics!.shieldAbsorbed += absorbed;
        s.shieldDelay = SYSTEMS.shieldDelay;
        s.hp = Math.max(0, s.hp - (damage - absorbed));
        s.damageTaken += damage - absorbed;
        effect(s, "breach", e.x, e.y, 0.3);
        if (s.hp <= 0) {
          s.phase = "defeat";
          return s;
        }
      }
    }
  if (!s.toSpawn.length && !s.enemies.length) {
    s.cleared = s.wave;
    creditEnergy(s, (25 + s.wave * 5) * v.income);
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
  return rewardBreakdown(s, scenario).total;
}
