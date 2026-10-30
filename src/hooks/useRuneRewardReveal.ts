import { createContext, useContext } from "react";
import type { RuneRewardReveal } from "@/lib/runedelve/rewardPresentation";

/** Safe outside the game shell; only its account-scoped provider presents rewards. */
export const RuneRewardContext = createContext({
  reveal: (_reward: RuneRewardReveal) => {},
});
export function useRuneRewardReveal() {
  return useContext(RuneRewardContext);
}
