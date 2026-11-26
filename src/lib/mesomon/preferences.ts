import type { MesomonSettings } from "./types";

// Device preferences are separate from chapter progress: muting the title
// must not create a blank save or overwrite a chapter still loading from cloud.
export const preferencesKey = (userId?: string | null) =>
  `dh:mesomon:preferences:v1:${encodeURIComponent(userId ?? "guest")}`;
export function readPreferences(
  userId?: string | null,
): Partial<MesomonSettings> {
  try {
    const value = JSON.parse(
      localStorage.getItem(preferencesKey(userId)) ?? "null",
    );
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const result: Partial<MesomonSettings> = {};
    for (const key of [
      "manualBattle",
      "reducedMotion",
      "haptics",
      "mute",
      "sealAssist",
    ] as const)
      if (typeof value[key] === "boolean") result[key] = value[key];
    if (["slow", "normal", "fast"].includes(value.textSpeed))
      result.textSpeed = value.textSpeed;
    if (["normal", "fast"].includes(value.battleSpeed))
      result.battleSpeed = value.battleSpeed;
    for (const key of ["musicVolume", "ambientVolume"] as const)
      if (typeof value[key] === "number" && Number.isFinite(value[key]))
        result[key] = Math.max(0, Math.min(1, value[key]));
    return result;
  } catch {
    return {};
  }
}
export function writePreferences(
  userId: string | null | undefined,
  settings: MesomonSettings,
): void {
  try {
    localStorage.setItem(preferencesKey(userId), JSON.stringify(settings));
  } catch {
    /* Chapter saves report storage errors separately. */
  }
}
