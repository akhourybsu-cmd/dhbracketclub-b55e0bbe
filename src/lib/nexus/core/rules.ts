// A deployed run keeps its rules, including checkpoints from earlier releases.
export const BALANCE_VERSION = 6;
const archived = {
  spawnRadius: 455,
  enemySpeed: 1,
  intermission: 7,
  bossIntermission: 7,
  hpStep: 0.24,
  hpCurve: 1.4,
  hpCurveWeight: 0.1,
  exponentialStart: 8,
  exponentialGrowth: 1.14,
  orbitDamage: 12.8,
  orbitHitRadius: 28,
  arcDamage: 36,
  arcJump: 110,
  arcInterval: 2.8,
  arcFalloff: 0.82,
  railDamage: 140,
  railInterval: 4.8,
  mortarDamage: 75,
  mortarRadius: 85,
  mortarRadiusStep: 6,
  mortarInterval: 3.8,
  stasis: 0.12,
  repairRegen: 0.5,
  repairHull: 1,
  slowStep: 0.08,
};
const current = {
  ...archived,
  spawnRadius: 410,
  enemySpeed: 1.3,
  intermission: 3.5,
  bossIntermission: 6.5,
  hpStep: 0.2,
  hpCurve: 1.3,
  hpCurveWeight: 0.09,
  exponentialStart: 10,
  exponentialGrowth: 1.12,
  orbitDamage: 18,
  orbitHitRadius: 36,
  arcDamage: 40,
  arcJump: 135,
  arcInterval: 2.5,
  arcFalloff: 0.86,
  railDamage: 170,
  railInterval: 4.4,
  mortarDamage: 56,
  mortarRadius: 74,
  mortarRadiusStep: 5,
  mortarInterval: 4.2,
  stasis: 0.1,
  repairRegen: 2.5,
  repairHull: 1.2,
  slowStep: 0.06,
};
const expanded = { ...current, exponentialStart: 15, exponentialGrowth: 1.07 };
export function combatRules(balanceVersion = 3) {
  return balanceVersion >= 6
    ? expanded
    : balanceVersion >= 5
      ? current
      : archived;
}
