import type { CoreRun, CoreScenario } from "./types";

export const DIFFICULTIES = [
  {
    id: 1,
    name: "Frontier",
    waves: 0,
    hp: 1,
    damage: 1,
    speed: 1,
    reward: 1,
    description: "Learn your build. The original endless threat.",
  },
  {
    id: 2,
    name: "Incursion",
    waves: 150,
    hp: 1.4,
    damage: 1.15,
    speed: 1.02,
    reward: 1.25,
    description: "Heavier enemies. Twin siege engines every tenth wave.",
  },
  {
    id: 3,
    name: "Onslaught",
    waves: 600,
    hp: 2,
    damage: 1.35,
    speed: 1.04,
    reward: 1.6,
    description: "Twin sieges and runners with 15% extra approach speed.",
  },
  {
    id: 4,
    name: "Cataclysm",
    waves: 1800,
    hp: 3,
    damage: 1.6,
    speed: 1.07,
    reward: 2.1,
    description:
      "Armored enemies regenerate 0.4% hull each second. Sustain your fire.",
  },
  {
    id: 5,
    name: "Oblivion",
    waves: 4200,
    hp: 4.5,
    damage: 1.9,
    speed: 1.1,
    reward: 2.8,
    description:
      "Siege engines attack 25% more often. Armor and interception matter.",
  },
  {
    id: 6,
    name: "Singularity",
    waves: 9000,
    hp: 6.5,
    damage: 2.3,
    speed: 1.14,
    reward: 3.6,
    description: "All threats combined. Splitters release an additional swarm.",
  },
] as const;

export function getDifficulty(id = 1) {
  return DIFFICULTIES.find((d) => d.id === id) || DIFFICULTIES[0];
}

// A ticket's difficulty is immutable. Menus may change while a saved run is active.
export function scenarioForRun(
  scenario: CoreScenario,
  run: Pick<CoreRun, "balanceVersion" | "difficulty">,
): CoreScenario {
  if (scenario.mode !== "endless" || (run.balanceVersion || 0) < 6)
    return scenario;
  const d = getDifficulty(run.difficulty);
  if (scenario.threat === d.id) return scenario;
  return {
    ...scenario,
    threat: d.id,
    hp: scenario.hp * d.hp,
    speed: scenario.speed * d.speed,
  };
}
