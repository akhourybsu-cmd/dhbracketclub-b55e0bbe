import type { CoreProfile, CoreRun, CoreScenario } from "./types";
import { getDifficulty } from "./difficulty";
import { milestoneCredits } from "./progression";

export function endlessCredits(waves: number) {
  const w = Math.max(0, Math.min(100000, Math.floor(waves)));
  return Math.min(1800, 3 * w + Math.floor((w * w) / 8));
}

export function waveCredits(scenario: CoreScenario, waves: number) {
  const w = Math.max(0, Math.min(100000, Math.floor(waves)));
  if (scenario.mode === "endless")
    return Math.min(1500, 4 * w + Math.floor((w * w) / 4));
  return (
    w *
    (scenario.mode === "challenge"
      ? 6
      : 4 + Math.floor(Number(scenario.id) / 2))
  );
}
export function rewardBreakdown(
  run: Pick<CoreRun, "phase" | "cleared" | "balanceVersion" | "difficulty">,
  scenario: CoreScenario,
  profile?: Pick<CoreProfile, "campaign" | "challenges"> &
    Partial<Pick<CoreProfile, "bestWave">>,
) {
  if ((run.balanceVersion || 0) >= 4 && scenario.mode === "endless") {
    const waves = Math.floor(
      endlessCredits(run.cleared) *
        ((run.balanceVersion || 0) >= 6
          ? getDifficulty(run.difficulty).reward
          : 1),
    );
    const bonus = milestoneCredits(run.cleared, profile?.bestWave || 0);
    return { waves, bonus, total: waves + bonus, firstClear: !!bonus };
  }
  const cleared =
    run.phase === "victory" &&
    (scenario.mode === "campaign"
      ? profile?.campaign[scenario.id]
      : profile?.challenges[scenario.id]);
  const firstClear = run.phase === "victory" && !cleared;
  const waves = waveCredits(scenario, run.cleared),
    bonus = firstClear ? scenario.reward : 0;
  return { waves, bonus, total: waves + bonus, firstClear: !!bonus };
}
