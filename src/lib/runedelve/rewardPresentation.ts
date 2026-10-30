import { getClass, newTitleUnlocked, type HeroClass } from "./classConfig";
import { MASTERY_TIERS } from "./classMastery";

export interface RuneRewardItem {
  kind:
    | "relic"
    | "shards"
    | "xp"
    | "mastery"
    | "title"
    | "slot"
    | "blessing"
    | "discovery"
    | "level";
  label: string;
  detail?: string;
  relicId?: string;
  rank?: number;
  amount?: number;
  glyph?: string;
}
export interface RuneRewardReveal {
  id: string;
  title: string;
  eyebrow?: string;
  detail?: string;
  items: RuneRewardItem[];
}
export interface RuneProgressionReceipt {
  previousClassLevel?: number;
  classLevel?: number;
  slotsUnlocked?: number;
}

/** Presentation comes from an acknowledged delta, never a restored hero read. */
export function progressionRewardItems(
  cls: HeroClass,
  receipt: RuneProgressionReceipt,
  previousSlots?: number,
): RuneRewardItem[] {
  const before = receipt.previousClassLevel;
  const after = receipt.classLevel;
  const items: RuneRewardItem[] = [];
  if (
    before !== undefined &&
    after !== undefined &&
    Number.isInteger(before) &&
    Number.isInteger(after) &&
    before >= 1 &&
    after > before &&
    after <= 150
  ) {
    for (const mastery of MASTERY_TIERS[cls]) {
      if (mastery.unlockLevel > before && mastery.unlockLevel <= after)
        items.push({
          kind: "mastery",
          label: mastery.name,
          detail: mastery.summary,
        });
    }
    items.push({
      kind: "level",
      label: `Level ${after}`,
      detail: `${getClass(cls).name} · Your earned power grows.`,
    });
    const title = newTitleUnlocked(cls, before, after);
    if (title)
      items.push({
        kind: "title",
        label: title.next,
        detail: "A new title for your legend.",
      });
  }
  if (
    previousSlots !== undefined &&
    receipt.slotsUnlocked !== undefined &&
    receipt.slotsUnlocked > previousSlots
  )
    items.push({
      kind: "slot",
      label: "Third relic slot",
      detail: "Equip a third relic in the Armory.",
    });
  return items;
}
