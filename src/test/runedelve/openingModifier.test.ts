import { describe, expect, it } from "vitest";
import { initialCombat } from "@/lib/runedelve/combatEngine";
import { applyOpeningModifier } from "@/lib/runedelve/openingModifier";
import { getModifierById, STEADY_PATH } from "@/lib/runedelve/runModifiers";
import { snapshotKey } from "@/lib/runedelve/runSnapshot";

describe("chamber opening bargains", () => {
  it("applies the advertised health risk when Glass Cannon is chosen", () => {
    const before = initialCombat([], 15);
    const after = applyOpeningModifier(before, getModifierById("glass_cannon"));
    expect(after.maxHp).toBe(Math.round(before.maxHp * 0.65));
    expect(after.hp).toBe(after.maxHp);
    expect(before.hp).toBe(before.maxHp);
  });

  it("applies turn costs and mana grants before the first chain", () => {
    const before = initialCombat([], 15);
    expect(
      applyOpeningModifier(before, getModifierById("speedrun")).turnsRemaining,
    ).toBe(13);
    const wellspring = applyOpeningModifier(
      before,
      getModifierById("wellspring"),
    );
    expect(wellspring.mana).toBe(2);
    expect(wellspring.maxHp).toBe(Math.round(before.maxHp * 0.9));
    expect(applyOpeningModifier(before, STEADY_PATH)).toEqual(before);
  });

  it("keeps alternate chamber checkpoints separate without changing standard keys", () => {
    expect(snapshotKey("u", "l", "mage")).toBe("rd-run:u:mage:l");
    expect(snapshotKey("u", "l", "mage", "elite:")).not.toBe(
      snapshotKey("u", "l", "mage", "treasure:"),
    );
  });
});
