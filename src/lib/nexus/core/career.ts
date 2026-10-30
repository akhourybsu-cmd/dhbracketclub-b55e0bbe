import { RESEARCH } from "./catalog";
import { ARMORY, AUXILIARIES, MILESTONES, MODULES } from "./progression";
import type { CoreProfile } from "./types";

// Career is derived from cloud-saved progression. It grants no separate currency.
export const DEFENDER_RANKS = [
  { name: "Recruit", waves: 0 },
  { name: "Sentinel", waves: 25 },
  { name: "Warden", waves: 75 },
  { name: "Vanguard", waves: 150 },
  { name: "Guardian", waves: 300 },
  { name: "Commander", waves: 600 },
  { name: "Paragon", waves: 1000 },
  { name: "Nexus Prime", waves: 2000 },
  { name: "Starforged", waves: 4200 },
  { name: "Eternal", waves: 9000 },
  { name: "Infinite", waves: 15000 },
] as const;
const whole = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
export function defenderRank(totalWaves: number) {
  const waves = whole(totalWaves);
  let index = 0;
  for (let i = 1; i < DEFENDER_RANKS.length; i++)
    if (waves >= DEFENDER_RANKS[i].waves) index = i;
  const current = DEFENDER_RANKS[index],
    next = DEFENDER_RANKS[index + 1] || null;
  return {
    ...current,
    index,
    level: index + 1,
    next,
    totalWaves: waves,
    progress: next ? (waves - current.waves) / (next.waves - current.waves) : 1,
    remaining: next ? next.waves - waves : 0,
  };
}

export function careerMedals(profile: CoreProfile) {
  const weapons = AUXILIARIES.filter((a) =>
    profile.unlocks.includes(a.id),
  ).length;
  const support = MODULES.filter((a) => profile.unlocks.includes(a.id)).length;
  const research = RESEARCH.reduce(
    (sum, r) => sum + Math.min(r.max, whole(profile.research[r.id] || 0)),
    0,
  );
  return [
    {
      id: "first-light",
      name: "First Light",
      icon: "Zap",
      description: "Bank your first cleared wave.",
      current: whole(profile.totalWaves),
      target: 1,
    },
    {
      id: "siegebreaker",
      name: "Siegebreaker",
      icon: "Shield",
      description: "Clear the first siege at wave 5.",
      current: whole(profile.bestWave),
      target: 5,
    },
    {
      id: "armed",
      name: "Armed & Ready",
      icon: "Crosshair",
      description: "Unlock your first auxiliary weapon.",
      current: weapons,
      target: 1,
    },
    {
      id: "arsenal",
      name: "Full Arsenal",
      icon: "Radar",
      description: "Own four auxiliary weapons.",
      current: weapons,
      target: 4,
    },
    {
      id: "tactician",
      name: "Tactician",
      icon: "Snowflake",
      description: "Own three support modules.",
      current: support,
      target: 3,
    },
    {
      id: "engineer",
      name: "Core Engineer",
      icon: "HeartPulse",
      description: "Complete 15 permanent research levels.",
      current: research,
      target: 15,
    },
    {
      id: "veteran",
      name: "Veteran",
      icon: "Orbit",
      description: "Bank 100 lifetime waves.",
      current: whole(profile.totalWaves),
      target: 100,
    },
    {
      id: "apex",
      name: "Apex Defender",
      icon: "Sparkles",
      description: "Clear wave 25 in one defense.",
      current: whole(profile.bestWave),
      target: 25,
    },
    {
      id: "arsenal-master",
      name: "Arsenal Master",
      icon: "Crosshair",
      description: "Own all seven auxiliary weapons.",
      current: weapons,
      target: 7,
    },
    {
      id: "support-master",
      name: "Systems Architect",
      icon: "Shield",
      description: "Own all five support modules.",
      current: support,
      target: 5,
    },
    {
      id: "scientist",
      name: "Beyond the Blueprint",
      icon: "Sparkles",
      description: "Complete 90 permanent research levels.",
      current: research,
      target: 90,
    },
    {
      id: "eternal",
      name: "Eternal Watch",
      icon: "Orbit",
      description: "Bank 9,000 lifetime waves.",
      current: whole(profile.totalWaves),
      target: 9000,
    },
  ].map((m) => ({
    ...m,
    current: Math.min(m.target, m.current),
    unlocked: m.current >= m.target,
    progress: Math.min(1, m.current / m.target),
  }));
}
export type CareerMedal = ReturnType<typeof careerMedals>[number];
export function careerSnapshot(profile: CoreProfile) {
  return {
    totalWaves: whole(profile.totalWaves),
    rank: defenderRank(profile.totalWaves),
    medals: careerMedals(profile)
      .filter((m) => m.unlocked)
      .map((m) => m.id),
  };
}
export function careerOutcome(
  before: ReturnType<typeof careerSnapshot>,
  after: CoreProfile,
) {
  const rank = defenderRank(after.totalWaves);
  return {
    rank,
    promoted: rank.index > before.rank.index,
    bankedWaves: Math.max(0, whole(after.totalWaves) - before.totalWaves),
    medals: careerMedals(after).filter(
      (m) => m.unlocked && !before.medals.includes(m.id),
    ),
  };
}

export function nextWaveTarget(bestWave: number, cleared = 0) {
  const reached = Math.max(whole(bestWave), whole(cleared));
  const milestone = MILESTONES.find((m) => m.wave > reached);
  return {
    wave: milestone?.wave || (Math.floor(reached / 5) + 1) * 5,
    credits: milestone?.credits || 0,
  };
}

export interface CareerObjective {
  kind: "equip" | "unlock" | "wave";
  title: string;
  description: string;
  action: string;
  href?: string;
  progress: number;
  wave?: number;
  credits?: number;
}
export function nextCareerObjective(profile: CoreProfile): CareerObjective {
  const owned = AUXILIARIES.find((a) => profile.unlocks.includes(a.id));
  if (owned && !profile.loadout.weapons.length)
    return {
      kind: "equip",
      title: "Arm your core",
      description: `Deploy ${owned.name}.`,
      action: "Equip now",
      href: `/nexus/loadout/endless?item=${owned.id}`,
      progress: 1,
    };
  const ready = ARMORY.find(
    (a) =>
      !profile.unlocks.includes(a.id) &&
      profile.totalWaves >= a.waves &&
      profile.credits >= a.cost,
  );
  if (ready)
    return {
      kind: "unlock",
      title: `Unlock ${ready.name}`,
      description: `${ready.cost} credits · Ready in the armory`,
      action: "Unlock",
      href: `/nexus/research?tab=${ready.kind === "weapon" ? "armory" : "support"}&item=${ready.id}`,
      progress: 1,
    };
  const target = nextWaveTarget(profile.bestWave);
  return {
    kind: "wave",
    title: `Clear wave ${String(target.wave).padStart(2, "0")}`,
    description: target.credits
      ? `Earn a +${target.credits} milestone bonus.`
      : "Set your next personal record.",
    action: "Play",
    progress: Math.min(1, whole(profile.bestWave) / target.wave),
    wave: target.wave,
    credits: target.credits,
  };
}
