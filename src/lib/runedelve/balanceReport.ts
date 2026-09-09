// Comprehensive Rune Delve balance report generator.
//
// Pure analysis module. Consumes the headless simulator output + (optional)
// live player run aggregates and produces a structured `BalanceReport` that
// the admin page renders. Zero React, zero DB.
//
// The report intentionally errs on the side of "too much information" —
// it's an admin tool, not a player surface. Every section is generated from
// real numbers (sim or DB), not hand-written prose.

import { simulateBand, type SimAggregate } from './simulator';
import { generateLevel } from './levelGenerator';
import { CLASS_LIST, getClass, type HeroClass } from './classConfig';
import { MASTERY_TIERS } from './classMastery';
import { bossKindForLevel, bossRuleForLevel, BOSS_RULES, type BossKind } from './bossRules';
import type { MechanicId } from './mechanics';
import { getLayoutForLevel } from './chamberAssignment';
import { RELIC_CATALOG } from './relics';
import { xpForRun } from './scoring';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface LiveLevelAgg {
  level: number;
  hero_class: HeroClass | null;
  attempts: number;
  clears: number;
  avg_turns: number;
  avg_dmg: number;
  avg_hp: number;
  unique_players: number;
  ability_rate: number;
}

export interface Recommendation {
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  area: string;
  file?: string;
  finding: string;
  suggestion: string;
}

export interface ClassMatrixCell {
  level: number;
  cls: HeroClass;
  clearRate: number;
  avgDmg: number;
  avgTurns: number;
}

export interface BalanceReport {
  generatedAt: string;
  totalLevels: number;
  runsPerLevel: number;
  health: { score: number; label: string };
  exec: {
    criticalIssues: string[];
    quickWins: string[];
  };
  scaling: Array<{
    level: number;
    chapter: number;
    enemyHpTotal: number;
    enemyDpsTotal: number;
    turnLimit: number;
    requiredDps: number;
    classDps: Record<HeroClass, number>;
    classClear: Record<HeroClass, number>;
    bestClass: HeroClass;
    worstClass: HeroClass;
    bossKind: BossKind;
    mechanics: MechanicId[];
  }>;
  classMatrix: ClassMatrixCell[];
  classSummary: Array<{
    cls: HeroClass;
    name: string;
    passive: string;
    overallClear: number;
    bestChapter: number;
    worstChapter: number;
    deadZones: Array<{ from: number; to: number; clearRate: number }>;
    lockoutLevels: number[];
  }>;
  masteries: Array<{
    cls: HeroClass;
    tier: 1 | 2 | 3 | 4 | 5;
    name: string;
    summary: string;
    unlockLevel: number;
    /** Reserved until the simulator can run with/without this exact mastery. */
    deltaWinPct: number;
    verdict: 'underpowered' | 'balanced' | 'overpowered' | 'situational';
  }>;
  bosses: Array<{
    level: number;
    kind: BossKind;
    rule: string | null;
    avgClearAcrossClasses: number;
    avgKillTurns: number;
    nearDeathRate: number;
    verdict: 'wall' | 'tense' | 'fair' | 'pushover';
  }>;
  enemies: Array<{
    name: string;
    appearances: number;
    avgHp: number;
    avgDmg: number;
    chapters: number[];
  }>;
  mechanics: Array<{
    mechanic: MechanicId;
    levels: number[];
    introLevel: number;
    avgClearImpact: number;
    stackingHotspots: number[];
  }>;
  economy: {
    xpCurve: Array<{ level: number; avgScore: number; avgXp: number }>;
    relicCount: number;
    relicTiers: Record<string, number>;
  };
  liveCrossCheck: Array<{
    level: number;
    cls: HeroClass | null;
    liveAttempts: number;
    liveClearRate: number;
    simClearRate: number;
    delta: number; // live - sim (negative = humans struggle more than AI)
    flag: 'humans-struggle' | 'humans-overperform' | 'ok' | 'no-data';
  }>;
  recommendations: Recommendation[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function chapterFor(level: number): number {
  return Math.max(1, Math.ceil(level / 50));
}

function avg(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((s, n) => s + n, 0) / arr.length;
}

function findRanges(levels: number[]): Array<{ from: number; to: number }> {
  if (!levels.length) return [];
  const sorted = [...levels].sort((a, b) => a - b);
  const out: Array<{ from: number; to: number }> = [];
  let from = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === prev + 1) { prev = sorted[i]; continue; }
    out.push({ from, to: prev });
    from = sorted[i];
    prev = sorted[i];
  }
  out.push({ from, to: prev });
  return out;
}

// ─── Main builder ───────────────────────────────────────────────────────────

export interface BuildOpts {
  startLevel: number;
  endLevel: number;
  runsPerLevel: number;
  liveData?: LiveLevelAgg[];
  onProgress?: (done: number, total: number, cls: HeroClass) => void;
  cancelRef?: { cancelled: boolean };
}

export async function buildBalanceReport(opts: BuildOpts): Promise<BalanceReport> {
  const { startLevel, endLevel, runsPerLevel, liveData = [], onProgress, cancelRef } = opts;
  const classes: HeroClass[] = CLASS_LIST.map(c => c.id);
  const totalUnits = classes.length * (endLevel - startLevel + 1);
  let done = 0;

  // Sim per-class, per-level. Yield to event loop so the UI stays responsive.
  const simByClass: Record<HeroClass, Map<number, SimAggregate>> = {
    warrior: new Map(), mage: new Map(), rogue: new Map(), cleric: new Map(),
  };

  for (const cls of classes) {
    for (let lvl = startLevel; lvl <= endLevel; lvl++) {
      if (cancelRef?.cancelled) throw new Error('cancelled');
      const band = simulateBand(lvl, lvl, cls, runsPerLevel);
      simByClass[cls].set(lvl, band[0]);
      done += 1;
      onProgress?.(done, totalUnits, cls);
      // Yield every 4 levels — keeps the browser painting.
      if (lvl % 4 === 0) await new Promise(r => setTimeout(r, 0));
    }
  }

  // ─── Section: Macro scaling ──────────────────────────────────────────────
  const scaling: BalanceReport['scaling'] = [];
  for (let lvl = startLevel; lvl <= endLevel; lvl++) {
    const def = generateLevel(lvl);
    const enemyHpTotal = def.enemy_config.reduce((s, e) => s + e.maxHp, 0);
    const enemyDpsTotal = def.enemy_config.reduce((s, e) => s + e.damage, 0);
    const requiredDps = enemyHpTotal / Math.max(1, def.turn_limit);
    const classDps: Record<HeroClass, number> = { warrior: 0, mage: 0, rogue: 0, cleric: 0 };
    const classClear: Record<HeroClass, number> = { warrior: 0, mage: 0, rogue: 0, cleric: 0 };
    for (const cls of classes) {
      const a = simByClass[cls].get(lvl);
      if (!a) continue;
      classDps[cls] = a.avgTurnsUsed > 0 ? a.avgDamageDealt / a.avgTurnsUsed : 0;
      classClear[cls] = a.clearRate;
    }
    let bestClass: HeroClass = 'warrior';
    let worstClass: HeroClass = 'warrior';
    let bestRate = -1; let worstRate = 2;
    for (const cls of classes) {
      if (classClear[cls] > bestRate) { bestRate = classClear[cls]; bestClass = cls; }
      if (classClear[cls] < worstRate) { worstRate = classClear[cls]; worstClass = cls; }
    }
    scaling.push({
      level: lvl,
      chapter: chapterFor(lvl),
      enemyHpTotal,
      enemyDpsTotal,
      turnLimit: def.turn_limit,
      requiredDps,
      classDps,
      classClear,
      bestClass,
      worstClass,
      bossKind: bossKindForLevel(lvl),
      mechanics: def.modifiers.mechanics ?? [],
    });
  }

  // ─── Section: Class matrix ───────────────────────────────────────────────
  const classMatrix: ClassMatrixCell[] = [];
  for (const cls of classes) {
    for (let lvl = startLevel; lvl <= endLevel; lvl++) {
      const a = simByClass[cls].get(lvl)!;
      classMatrix.push({
        level: lvl, cls,
        clearRate: a.clearRate,
        avgDmg: a.avgDamageDealt,
        avgTurns: a.avgTurnsUsed,
      });
    }
  }

  // ─── Class summary ───────────────────────────────────────────────────────
  const classSummary: BalanceReport['classSummary'] = classes.map(cls => {
    const def = getClass(cls);
    const cells = classMatrix.filter(c => c.cls === cls);
    const overallClear = avg(cells.map(c => c.clearRate));
    // Per-chapter averages
    const byChapter = new Map<number, number[]>();
    for (const c of cells) {
      const ch = chapterFor(c.level);
      if (!byChapter.has(ch)) byChapter.set(ch, []);
      byChapter.get(ch)!.push(c.clearRate);
    }
    let bestChapter = 1, worstChapter = 1, bestVal = -1, worstVal = 2;
    for (const [ch, rates] of byChapter) {
      const v = avg(rates);
      if (v > bestVal) { bestVal = v; bestChapter = ch; }
      if (v < worstVal) { worstVal = v; worstChapter = ch; }
    }
    const lockoutLevels = cells.filter(c => c.clearRate === 0).map(c => c.level);
    const deadZoneRanges = findRanges(cells.filter(c => c.clearRate < 0.15).map(c => c.level));
    const deadZones = deadZoneRanges.map(r => ({
      from: r.from, to: r.to,
      clearRate: avg(cells.filter(c => c.level >= r.from && c.level <= r.to).map(c => c.clearRate)),
    }));
    return {
      cls, name: def.name, passive: def.passive,
      overallClear, bestChapter, worstChapter, deadZones, lockoutLevels,
    };
  });

  // ─── Mastery catalog ─────────────────────────────────────────────────────
  // The headless simulator currently runs base classes and does not activate
  // hero mastery loadouts. Comparing adjacent generated levels is NOT a valid
  // measurement of a mastery, so keep this section explicitly neutral rather
  // than producing false buff/nerf recommendations.
  const masteries: BalanceReport['masteries'] = [];
  for (const cls of classes) {
    for (const tier of MASTERY_TIERS[cls]) {
      masteries.push({
        cls, tier: tier.tier, name: tier.name, summary: tier.summary,
        unlockLevel: tier.unlockLevel, deltaWinPct: 0, verdict: 'situational',
      });
    }
  }

  // ─── Boss audit ──────────────────────────────────────────────────────────
  const bosses: BalanceReport['bosses'] = [];
  for (let lvl = startLevel; lvl <= endLevel; lvl++) {
    const kind = bossKindForLevel(lvl);
    if (kind === null) continue;
    const ruleId = bossRuleForLevel(lvl);
    const ruleName = ruleId ? (BOSS_RULES[ruleId]?.label ?? ruleId) : null;
    const clears = classes.map(c => simByClass[c].get(lvl)?.clearRate ?? 0);
    const turns = classes.map(c => simByClass[c].get(lvl)?.avgTurnsUsed ?? 0);
    const nd = classes.map(c => simByClass[c].get(lvl)?.nearDeathRate ?? 0);
    const avgClear = avg(clears);
    let verdict: 'wall' | 'tense' | 'fair' | 'pushover';
    if (avgClear < 0.15) verdict = 'wall';
    else if (avgClear < 0.45) verdict = 'tense';
    else if (avgClear < 0.85) verdict = 'fair';
    else verdict = 'pushover';
    bosses.push({
      level: lvl, kind, rule: ruleName,
      avgClearAcrossClasses: avgClear,
      avgKillTurns: avg(turns),
      nearDeathRate: avg(nd),
      verdict,
    });
  }

  // ─── Enemy roster usage ──────────────────────────────────────────────────
  const enemyMap = new Map<string, { appearances: number; hpSum: number; dmgSum: number; chapters: Set<number> }>();
  for (let lvl = startLevel; lvl <= endLevel; lvl++) {
    const def = generateLevel(lvl);
    for (const e of def.enemy_config) {
      const key = e.name;
      if (!enemyMap.has(key)) enemyMap.set(key, { appearances: 0, hpSum: 0, dmgSum: 0, chapters: new Set() });
      const r = enemyMap.get(key)!;
      r.appearances += 1;
      r.hpSum += e.maxHp;
      r.dmgSum += e.damage;
      r.chapters.add(chapterFor(lvl));
    }
  }
  const enemies: BalanceReport['enemies'] = Array.from(enemyMap.entries())
    .map(([name, r]) => ({
      name,
      appearances: r.appearances,
      avgHp: r.hpSum / r.appearances,
      avgDmg: r.dmgSum / r.appearances,
      chapters: Array.from(r.chapters).sort(),
    }))
    .sort((a, b) => b.appearances - a.appearances);

  // ─── Mechanics layer ─────────────────────────────────────────────────────
  const mechMap = new Map<MechanicId, { levels: number[] }>();
  const stacking: number[] = [];
  for (let lvl = startLevel; lvl <= endLevel; lvl++) {
    const def = generateLevel(lvl);
    const ms = def.modifiers.mechanics ?? [];
    const layout = getLayoutForLevel(lvl);
    // Count what the player must actually read: campaign rules (Layered Goals
    // counts through its generated bonus), a boss rule, and one chamber-zone
    // rule. Optional run modifiers are player-chosen and excluded here.
    const campaignRules = ms.filter(m => m !== 'multi_objective').length;
    const bonusRule = def.modifiers.secondary_objective ? 1 : 0;
    const bossRule = def.modifiers.boss_rule ? 1 : 0;
    const zoneRule = layout.preview.hazardZones > 0 || layout.preview.treasureZones > 0 ? 1 : 0;
    if (campaignRules + bonusRule + bossRule + zoneRule > 3) stacking.push(lvl);
    for (const m of ms) {
      if (!mechMap.has(m)) mechMap.set(m, { levels: [] });
      mechMap.get(m)!.levels.push(lvl);
    }
  }
  const baselineClear = avg(scaling.map(s => avg(classes.map(c => s.classClear[c]))));
  const mechanics: BalanceReport['mechanics'] = Array.from(mechMap.entries()).map(([m, r]) => {
    const withMech = r.levels.map(lvl => avg(classes.map(c => simByClass[c].get(lvl)?.clearRate ?? 0)));
    return {
      mechanic: m,
      levels: r.levels,
      introLevel: r.levels[0],
      avgClearImpact: avg(withMech) - baselineClear,
      stackingHotspots: stacking.filter(l => r.levels.includes(l)),
    };
  });

  // ─── Economy ─────────────────────────────────────────────────────────────
  const xpCurve = scaling.map(s => {
    const avgScore = avg(classes.map(c => simByClass[c].get(s.level)?.avgDamageDealt ?? 0)) +
      avg(classes.map(c => (simByClass[c].get(s.level)?.clearRate ?? 0) * 500));
    return { level: s.level, avgScore, avgXp: xpForRun(avgScore, true) };
  });
  const relicTiers: Record<string, number> = {};
  for (const r of RELIC_CATALOG) {
    const tier = String(r.tier);
    relicTiers[tier] = (relicTiers[tier] || 0) + 1;
  }
  const economy = { xpCurve, relicCount: RELIC_CATALOG.length, relicTiers };

  // ─── Live cross-check ────────────────────────────────────────────────────
  const liveCrossCheck: BalanceReport['liveCrossCheck'] = [];
  for (let lvl = startLevel; lvl <= endLevel; lvl++) {
    for (const cls of classes) {
      const live = liveData.find(d => d.level === lvl && d.hero_class === cls);
      const sim = simByClass[cls].get(lvl)!;
      const liveRate = live && live.attempts > 0 ? live.clears / live.attempts : 0;
      const delta = (live ? liveRate : 0) - sim.clearRate;
      let flag: 'humans-struggle' | 'humans-overperform' | 'ok' | 'no-data';
      if (!live || live.attempts < 5) flag = 'no-data';
      else if (delta < -0.20) flag = 'humans-struggle';
      else if (delta > 0.20) flag = 'humans-overperform';
      else flag = 'ok';
      liveCrossCheck.push({
        level: lvl, cls,
        liveAttempts: live?.attempts ?? 0,
        liveClearRate: liveRate,
        simClearRate: sim.clearRate,
        delta, flag,
      });
    }
  }

  // ─── Health score & exec summary ─────────────────────────────────────────
  const overallClearRate = avg(classMatrix.map(c => c.clearRate));
  const variance = avg(classMatrix.map(c => Math.pow(c.clearRate - overallClearRate, 2)));
  const variancePenalty = Math.min(40, Math.round(variance * 200));
  const brutalCount = scaling.filter(s => avg(classes.map(c => s.classClear[c])) < 0.15).length;
  const score = Math.max(0, Math.min(100, Math.round(60 + overallClearRate * 40 - variancePenalty - brutalCount * 0.5)));
  const label = score >= 85 ? 'Excellent' : score >= 70 ? 'Healthy' : score >= 55 ? 'Workable' : score >= 40 ? 'Needs Work' : 'Critical';

  const criticalIssues: string[] = [];
  for (const cs of classSummary) {
    if (cs.deadZones.length) {
      const z = cs.deadZones[0];
      criticalIssues.push(`${cs.name} has a dead zone at L${z.from}-${z.to} (${(z.clearRate * 100).toFixed(0)}% clears).`);
    }
  }
  for (const b of bosses.filter(x => x.verdict === 'wall').slice(0, 3)) {
    criticalIssues.push(`Boss L${b.level} (${b.rule ?? b.kind}) is a wall — only ${(b.avgClearAcrossClasses * 100).toFixed(0)}% across all classes.`);
  }

  const quickWins: string[] = [];
  for (const b of bosses.filter(x => x.verdict === 'pushover').slice(0, 3)) {
    quickWins.push(`Tighten boss L${b.level} — ${(b.avgClearAcrossClasses * 100).toFixed(0)}% clear is too high for a boss beat.`);
  }

  // ─── Recommendations ─────────────────────────────────────────────────────
  const recommendations: Recommendation[] = [];

  for (const cs of classSummary) {
    for (const z of cs.deadZones) {
      recommendations.push({
        priority: z.clearRate === 0 ? 'P0' : 'P1',
        area: `Class balance — ${cs.name}`,
        file: 'src/lib/runedelve/levelGenerator.ts',
        finding: `${cs.name} clears ${(z.clearRate * 100).toFixed(0)}% across L${z.from}-${z.to}.`,
        suggestion: z.clearRate === 0
          ? `Mathematically unwinnable for ${cs.name}. Review HP scaling (scaleEnemy) and turn limit (turnLimitFor) for this band, or buff the class signature.`
          : `Consider a +1 turn or -10% enemy HP nudge in this band, or introduce a relic that synergises with ${cs.passive.toLowerCase()}.`,
      });
    }
  }

  for (const b of bosses.filter(x => x.verdict === 'wall')) {
    recommendations.push({
      priority: 'P0',
      area: `Boss tuning — L${b.level}`,
      file: 'src/lib/runedelve/bossRules.ts',
      finding: `${b.kind} boss with rule "${b.rule ?? 'none'}" only clears ${(b.avgClearAcrossClasses * 100).toFixed(0)}% averaged across classes.`,
      suggestion: 'Lower stat boost (bossStatBoost), shave HP, or relax the boss rule (e.g., reduce phase-lock duration).',
    });
  }

  for (const b of bosses.filter(x => x.verdict === 'pushover')) {
    recommendations.push({
      priority: 'P2',
      area: `Boss tuning — L${b.level}`,
      file: 'src/lib/runedelve/bossRules.ts',
      finding: `${b.kind} boss clears ${(b.avgClearAcrossClasses * 100).toFixed(0)}% — feels less than a boss beat.`,
      suggestion: 'Add +5% HP, tighten the turn budget by 1, or layer a secondary objective.',
    });
  }

  const mechMechanics = mechanics.filter(m => m.stackingHotspots.length);
  if (mechMechanics.length) {
    recommendations.push({
      priority: 'P1',
      area: 'Mechanic stacking',
      file: 'src/lib/runedelve/mechanics.ts',
      finding: `${stacking.length} levels exceed the three-rule readability budget (e.g., L${stacking.slice(0, 3).join(', L')}).`,
      suggestion: 'Remove a remix rule or optional goal so each encounter has at most three visible decision layers.',
    });
  }

  const impossible = scaling.filter(s => {
    const bestDps = Math.max(...classes.map(c => s.classDps[c]));
    return s.requiredDps > bestDps * 1.1;
  });
  if (impossible.length) {
    recommendations.push({
      priority: 'P0',
      area: 'DPS budget',
      file: 'src/lib/runedelve/levelGenerator.ts',
      finding: `${impossible.length} levels (e.g., L${impossible.slice(0, 5).map(s => s.level).join(', L')}) require more DPS than even the best class can deliver.`,
      suggestion: 'Cut enemy HP totals, extend turn limit, or remove a wave/enemy from the spawn.',
    });
  }

  const struggling = liveCrossCheck.filter(c => c.flag === 'humans-struggle');
  if (struggling.length) {
    const sample = struggling.slice(0, 3).map(c => `L${c.level} ${c.cls}`).join(', ');
    recommendations.push({
      priority: 'P1',
      area: 'Live data — UX gap',
      finding: `Humans clear ${struggling.length} (level, class) combos ≥20% worse than the AI sim (${sample}).`,
      suggestion: 'Likely UX issue (telegraph clarity, ability timing prompts, or board readability) — investigate the play page for these levels.',
    });
  }

  const prioOrder: Record<Recommendation['priority'], number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
  recommendations.sort((a, b) => prioOrder[a.priority] - prioOrder[b.priority] || a.area.localeCompare(b.area));

  return {
    generatedAt: new Date().toISOString(),
    totalLevels: endLevel - startLevel + 1,
    runsPerLevel,
    health: { score, label },
    exec: { criticalIssues: criticalIssues.slice(0, 5), quickWins: quickWins.slice(0, 5) },
    scaling,
    classMatrix,
    classSummary,
    masteries,
    bosses,
    enemies,
    mechanics,
    economy,
    liveCrossCheck,
    recommendations,
  };
}

// ─── Markdown export ────────────────────────────────────────────────────────

export function reportToMarkdown(r: BalanceReport): string {
  const lines: string[] = [];
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  const num = (n: number, d = 1) => Number.isFinite(n) ? n.toFixed(d) : '—';

  lines.push(`# Rune Delve — Balance Report`);
  lines.push(`_Generated ${r.generatedAt} · ${r.totalLevels} levels × 4 classes × ${r.runsPerLevel} runs_`);
  lines.push('');
  lines.push(`## 1. Health Score: ${r.health.score}/100 — ${r.health.label}`);
  lines.push('');
  lines.push(`### Critical Issues`);
  if (r.exec.criticalIssues.length) r.exec.criticalIssues.forEach(i => lines.push(`- ${i}`));
  else lines.push(`- None detected.`);
  lines.push('');
  lines.push(`### Quick Wins`);
  if (r.exec.quickWins.length) r.exec.quickWins.forEach(i => lines.push(`- ${i}`));
  else lines.push(`- None detected.`);
  lines.push('');

  lines.push(`## 2. Macro Scaling Audit`);
  lines.push(`| Lvl | Ch | HP Total | DPS Total | Turns | Req DPS | Best Class | Worst Class | Boss |`);
  lines.push(`|---:|---:|---:|---:|---:|---:|:---|:---|:---|`);
  for (const s of r.scaling) {
    lines.push(`| ${s.level} | ${s.chapter} | ${s.enemyHpTotal} | ${s.enemyDpsTotal} | ${s.turnLimit} | ${num(s.requiredDps)} | ${s.bestClass} (${pct(s.classClear[s.bestClass])}) | ${s.worstClass} (${pct(s.classClear[s.worstClass])}) | ${s.bossKind} |`);
  }
  lines.push('');

  lines.push(`## 3. Class Balance`);
  for (const cs of r.classSummary) {
    lines.push(`### ${cs.name} — ${pct(cs.overallClear)} avg clear`);
    lines.push(`- **Passive**: ${cs.passive}`);
    lines.push(`- **Best chapter**: ${cs.bestChapter} · **Worst chapter**: ${cs.worstChapter}`);
    if (cs.lockoutLevels.length) lines.push(`- **Lockout levels** (0% clears): ${cs.lockoutLevels.join(', ')}`);
    if (cs.deadZones.length) {
      lines.push(`- **Dead zones**:`);
      cs.deadZones.forEach(z => lines.push(`  - L${z.from}-${z.to}: ${pct(z.clearRate)}`));
    }
    lines.push('');
  }

  lines.push(`## 4. Mastery Catalog`);
  lines.push(`_Base-class simulation does not activate mastery loadouts, so no causal effectiveness score is claimed._`);
  lines.push(`| Class | Tier | Name | Unlock |`);
  lines.push(`|:---|:---:|:---|---:|`);
  for (const m of r.masteries) {
    lines.push(`| ${m.cls} | T${m.tier} | ${m.name} | L${m.unlockLevel} |`);
  }
  lines.push('');

  lines.push(`## 5. Boss Audit`);
  lines.push(`| Lvl | Kind | Rule | Avg Clear | Avg Turns | Near-Death % | Verdict |`);
  lines.push(`|---:|:---|:---|---:|---:|---:|:---|`);
  for (const b of r.bosses) {
    lines.push(`| ${b.level} | ${b.kind} | ${b.rule ?? '—'} | ${pct(b.avgClearAcrossClasses)} | ${num(b.avgKillTurns)} | ${pct(b.nearDeathRate)} | ${b.verdict} |`);
  }
  lines.push('');

  lines.push(`## 6. Enemy Roster Usage`);
  lines.push(`| Name | Appearances | Avg HP | Avg Dmg | Chapters |`);
  lines.push(`|:---|---:|---:|---:|:---|`);
  for (const e of r.enemies) {
    lines.push(`| ${e.name} | ${e.appearances} | ${num(e.avgHp)} | ${num(e.avgDmg)} | ${e.chapters.join(', ')} |`);
  }
  lines.push('');

  lines.push(`## 7. Mechanics Layer`);
  lines.push(`| Mechanic | First Used | Levels | Contextual clear delta | Rule-overload hotspots |`);
  lines.push(`|:---|---:|---:|---:|:---|`);
  for (const m of r.mechanics) {
    lines.push(`| ${m.mechanic} | L${m.introLevel} | ${m.levels.length} | ${(m.avgClearImpact * 100).toFixed(1)}% | ${m.stackingHotspots.length ? m.stackingHotspots.join(', ') : '—'} |`);
  }
  lines.push('');

  lines.push(`## 8. Economy & Progression`);
  lines.push(`- **Relic catalog size**: ${r.economy.relicCount}`);
  lines.push(`- **Relic tiers**: ${Object.entries(r.economy.relicTiers).map(([t, n]) => `${t}=${n}`).join(', ')}`);
  lines.push(`- **XP per run trend** (sampled levels):`);
  const xpSample = r.economy.xpCurve.filter((_, i) => i % 10 === 0).concat(r.economy.xpCurve.slice(-1));
  for (const x of xpSample) {
    lines.push(`  - L${x.level}: avg score ≈ ${num(x.avgScore, 0)}, XP ≈ ${x.avgXp}`);
  }
  lines.push('');

  lines.push(`## 9. Live Data Cross-Check`);
  const liveWithData = r.liveCrossCheck.filter(c => c.flag !== 'no-data');
  if (!liveWithData.length) {
    lines.push(`_No statistically meaningful live data yet (need ≥5 attempts per level/class)._`);
  } else {
    lines.push(`| Lvl | Class | Live Attempts | Live % | Sim % | Δ | Flag |`);
    lines.push(`|---:|:---|---:|---:|---:|---:|:---|`);
    for (const c of liveWithData) {
      lines.push(`| ${c.level} | ${c.cls ?? '—'} | ${c.liveAttempts} | ${pct(c.liveClearRate)} | ${pct(c.simClearRate)} | ${(c.delta * 100).toFixed(1)}% | ${c.flag} |`);
    }
  }
  lines.push('');

  lines.push(`## 10. Prioritized Recommendations`);
  if (!r.recommendations.length) {
    lines.push(`_No actionable recommendations — campaign is healthy._`);
  } else {
    for (const rec of r.recommendations) {
      lines.push(`### ${rec.priority} · ${rec.area}`);
      lines.push(`**Finding**: ${rec.finding}`);
      lines.push(`**Suggestion**: ${rec.suggestion}`);
      if (rec.file) lines.push(`**File**: \`${rec.file}\``);
      lines.push('');
    }
  }

  return lines.join('\n');
}
