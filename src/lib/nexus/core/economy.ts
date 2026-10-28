import type { CoreProfile, CoreRun, CoreScenario } from "./types";

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
  run: Pick<CoreRun, "phase" | "cleared">,
  scenario: CoreScenario,
  profile?: Pick<CoreProfile, "campaign" | "challenges">,
) {
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
