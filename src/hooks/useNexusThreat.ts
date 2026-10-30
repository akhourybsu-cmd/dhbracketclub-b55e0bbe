import { useState } from "react";
import { DIFFICULTIES, getDifficulty } from "@/lib/nexus/core/difficulty";

// A menu preference, never an authority for the deployed ticket or its rewards.
export function useNexusThreat(
  userId: string | undefined,
  clubId: string | undefined,
  totalWaves: number,
) {
  const key = `nexus_threat_v1:${userId}:${clubId}`;
  const [preferred, setPreferred] = useState(() => {
    try {
      return Number(localStorage.getItem(key)) || 1;
    } catch {
      return 1;
    }
  });
  const unlocked = DIFFICULTIES.filter((d) => totalWaves >= d.waves);
  const selected = getDifficulty(preferred);
  const threat =
    totalWaves >= selected.waves ? selected : unlocked[unlocked.length - 1];
  const choose = (id: number) => {
    const next = getDifficulty(id);
    if (totalWaves < next.waves) return;
    setPreferred(next.id);
    try {
      localStorage.setItem(key, String(next.id));
    } catch {
      /* Play remains available without storage. */
    }
  };
  return { threat, choose };
}
