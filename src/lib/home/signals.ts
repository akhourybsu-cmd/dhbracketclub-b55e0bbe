import type { FeatDefinition } from "@/lib/feats/types";
import type { CoreRun } from "@/lib/nexus/core/types";
import { notificationTime } from "@/lib/notifications";
export function homeRelativeTime(iso: string, now = Date.now()) {
  const time = Date.parse(iso),
    age = now - time;
  return Number.isFinite(time) && age >= 0 && age < 60_000
    ? "Just now"
    : notificationTime(iso);
}
export interface HomeGoal {
  key: string;
  title: string;
  category: string;
  unit: FeatDefinition["unit"];
  value: number;
  target: number;
  tier: number;
  points: number;
  progress: number;
  tracked: boolean;
}
export interface HomeProgress {
  score: number;
  unlocked: number;
  club_rank: number | null;
  goals: HomeGoal[];
}
export interface HomeDrop {
  id: string;
  title: string;
  kind: "learned" | "article" | "photo";
  created_at: string;
  profiles?: { display_name: string } | null;
}
export interface HomePortfolio {
  total_value: number;
  valued_at: string | null;
  season: { starting_cash: number; status: string };
  history: { value: number; trading_date: string }[];
}
export interface HomeSignal<T> {
  data?: T;
  loading: boolean;
  error: boolean;
}
export interface HomeSignals {
  progress: HomeSignal<HomeProgress>;
  drop: HomeSignal<HomeDrop[]>;
  portfolio: HomeSignal<HomePortfolio | null>;
  nexus: HomeSignal<{ endless_best: number } | null>;
  forge: HomeSignal<{ id: string; title: string | null } | null>;
  checkpoint: { missionName: string; waveLabel: string } | null;
}
export function nexusHomeCheckpoint(run: CoreRun | null) {
  if (
    !run ||
    !run.registered ||
    (run.balanceVersion || 0) < 4 ||
    run.scenarioId !== "endless" ||
    run.phase === "defeat" ||
    run.phase === "victory"
  )
    return null;
  return { missionName: "Endless Defense", waveLabel: `Wave ${run.wave}` };
}
export function portfolioHistory(values: { value: number }[]) {
  const points = values
    .map((p) => Number(p.value))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (points.length < 2) return null;
  const min = Math.min(...points),
    max = Math.max(...points),
    range = max - min || 1;
  return points
    .map(
      (v, i) =>
        `${((i / (points.length - 1)) * 128).toFixed(1)},${(28 - ((v - min) / range) * 24).toFixed(1)}`,
    )
    .join(" ");
}
export function portfolioReturn(portfolio: HomePortfolio | null | undefined) {
  const seed = Number(portfolio?.season.starting_cash),
    value = Number(portfolio?.total_value);
  if (
    !portfolio?.valued_at ||
    !Number.isFinite(seed) ||
    seed <= 0 ||
    !Number.isFinite(value) ||
    value < 0
  )
    return null;
  return ((value - seed) / seed) * 100;
}
