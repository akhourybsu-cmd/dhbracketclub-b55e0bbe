import { beforeEach, describe, expect, it } from "vitest";
import {
  createExpedition,
  previewExpeditionChain,
  expeditionAbility,
  expeditionBoonChoices,
  expeditionChain,
  expeditionEnemies,
  expeditionReward,
  expeditionRouteChoices,
  chooseExpeditionBoon,
  chooseExpeditionRoute,
  loadExpedition,
  saveExpedition,
  clearExpedition,
  type ExpeditionRun,
} from "@/lib/runedelve/expedition";
import { findAvailableChain } from "@/lib/runedelve/boardEngine";
import type { HeroClass } from "@/lib/runedelve/classConfig";
const ticket = {
  id: "11111111-1111-4111-8111-111111111111",
  seed: 728391,
  hero_class: "warrior" as HeroClass,
  ascension: 0,
  started_at: "2026-10-30T12:00:00Z",
};
const three = [
  { r: 0, c: 0 },
  { r: 0, c: 1 },
  { r: 0, c: 2 },
];
function controlled(
  color: "red" | "blue" | "green" | "gold" = "red",
): ExpeditionRun {
  const run = createExpedition(ticket);
  run.grid = Array.from({ length: 5 }, () => Array(5).fill(color));
  run.combat.enemies = [
    {
      id: "target",
      name: "Training sentinel",
      emoji: "",
      hp: 999,
      maxHp: 999,
      damage: 0,
      intent: 99,
      intentMax: 99,
    },
  ];
  return run;
}
describe("Rune Delve Expedition", () => {
  beforeEach(() => localStorage.clear());
  it("creates a reproducible six-room opening and guarantees a playable board across seeds", () => {
    for (let seed = 0; seed < 120; seed++) {
      const a = createExpedition({ ...ticket, seed });
      const b = createExpedition({ ...ticket, seed });
      expect(a.grid).toEqual(b.grid);
      expect(a.combat.enemies).toEqual(b.combat.enemies);
      expect(findAvailableChain(a.grid)).not.toBeNull();
      expect(a.combat.turnsRemaining).toBe(16);
    }
  });
  it("rejects invalid and repeated-cell chains without spending a turn", () => {
    const run = controlled();
    expect(expeditionChain(run, [])).toBe(run);
    expect(expeditionChain(run, [three[0], three[1], three[0]])).toBe(run);
    expect(run.totalTurns).toBe(0);
  });
  it("applies boon attack power before armor and never damages or heals a different target on overkill", () => {
    const run = controlled();
    run.boons.ember = 1;
    run.combat.enemies[0].armor = 20;
    const next = expeditionChain(run, three);
    expect(next.combat.enemies[0].hp).toBe(982);
    const overkill = controlled();
    overkill.boons.ember = 2;
    overkill.combat.enemies[0].hp = 1;
    overkill.combat.enemies.push({
      id: "other",
      name: "Other",
      emoji: "",
      hp: 50,
      maxHp: 50,
      damage: 0,
      intent: 99,
      intentMax: 99,
    });
    const after = expeditionChain(overkill, three);
    expect(after.combat.enemies[0].hp).toBe(0);
    expect(after.combat.enemies[1].hp).toBe(50);
    expect(after.totalKills).toBe(1);
  });
  it("clears a room, drafts one offered boon, and carries health/build into a revealed route", () => {
    const run = controlled();
    run.combat.hp = 47;
    run.combat.enemies[0].hp = 1;
    const cleared = expeditionChain(run, three);
    expect(cleared.phase).toBe("boon");
    expect(cleared.roomsCleared).toBe(1);
    const choices = expeditionBoonChoices(cleared);
    expect(choices).toHaveLength(3);
    expect(new Set(choices.map((b) => b.id)).size).toBe(3);
    expect(chooseExpeditionBoon(cleared, "phoenix") === cleared).toBe(
      !choices.some((b) => b.id === "phoenix"),
    );
    const drafted = chooseExpeditionBoon(cleared, choices[0].id);
    expect(drafted.phase).toBe("route");
    expect(Object.values(drafted.boons)).toEqual([1]);
    const paths = expeditionRouteChoices(drafted);
    expect(new Set(paths).size).toBe(2);
    const entered = chooseExpeditionRoute(drafted, paths[0]);
    expect(entered.room).toBe(2);
    expect(entered.phase).toBe("combat");
    expect(entered.boons).toEqual(drafted.boons);
    expect(entered.combat.hp).toBe(
      Math.min(
        drafted.combat.maxHp,
        drafted.combat.hp + (paths[0] === "shrine" ? 18 : 0),
      ),
    );
    expect(findAvailableChain(entered.grid)).not.toBeNull();
  });
  it("offers varied but repeatable blessings and route choices across dungeon seeds", () => {
    const boons = new Set();
    const routes = new Set();
    for (let seed = 1; seed < 60; seed++) {
      const run = createExpedition({ ...ticket, seed });
      run.phase = "boon";
      expect(expeditionBoonChoices(run)).toEqual(expeditionBoonChoices(run));
      expeditionBoonChoices(run).forEach((b) => boons.add(b.id));
      expeditionRouteChoices(run).forEach((r) => routes.add(r));
    }
    expect(boons.size).toBe(12);
    expect(routes.size).toBe(4);
  });
  it("keeps abilities mana-gated and counts each committed action once", () => {
    const run = controlled();
    expect(expeditionAbility(run)).toBe(run);
    run.combat.mana = 3;
    const after = expeditionAbility(run);
    expect(after.totalTurns).toBe(1);
    expect(after.combat.mana).toBe(0);
    expect(after.combat.enemies[0].hp).toBe(959);
  });
  it("makes healing, mana synergy, lifesteal and one-use phoenix mechanically distinct", () => {
    const green = controlled("green");
    green.combat.hp = 10;
    green.boons.verdant = 1;
    green.boons.battery = 1;
    const heal = expeditionChain(green, [...three, { r: 0, c: 3 }]);
    expect(heal.combat.hp).toBe(42);
    expect(heal.combat.mana).toBe(1);
    const steal = controlled();
    steal.boons.siphon = 1;
    steal.combat.hp = 10;
    steal.combat.enemies[0].hp = 1;
    expect(expeditionChain(steal, three).combat.hp).toBe(18);
    const phoenix = controlled("blue");
    phoenix.boons.phoenix = 1;
    phoenix.combat.hp = 1;
    phoenix.combat.enemies[0].damage = 50;
    const revived = expeditionChain(phoenix, three);
    expect(revived.combat.hp).toBe(40);
    expect(revived.phoenixUsed).toBe(true);
    expect(revived.phase).toBe("combat");
    revived.grid = Array.from({ length: 5 }, () => Array(5).fill("blue"));
    const fallen = expeditionChain(revived, three);
    expect(fallen.combat.hp).toBe(0);
    expect(fallen.phase).toBe("lost");
  });
  it("cannot use lifesteal as an unlisted resurrection after lethal retaliation", () => {
    const run = controlled();
    run.combat.hp = 1;
    run.boons.siphon = 1;
    run.combat.enemies[0].hp = 1;
    run.combat.enemies.push({
      id: "survivor",
      name: "Retaliator",
      emoji: "",
      hp: 100,
      maxHp: 100,
      damage: 30,
      intent: 99,
      intentMax: 99,
    });
    const lost = expeditionChain(run, three);
    expect(lost.combat.hp).toBe(0);
    expect(lost.phase).toBe("lost");
    const reflected = controlled("blue");
    reflected.combat.hp = 1;
    reflected.combat.shieldTurns = 1;
    reflected.boons.siphon = 1;
    reflected.combat.enemies[0].damage = 100;
    reflected.combat.enemies.push({
      id: "fragile",
      name: "Fragile foe",
      emoji: "",
      hp: 1,
      maxHp: 1,
      damage: 1,
      intent: 99,
      intentMax: 99,
    });
    const fatal = expeditionChain(reflected, three);
    expect(fatal.totalKills).toBeGreaterThan(0);
    expect(fatal.combat.hp).toBe(0);
    expect(fatal.phase).toBe("lost");
  });
  it("lets Rogue spend mana on Shadowstep without spending a move or triggering retaliation", () => {
    const run = controlled();
    run.heroClass = "rogue";
    run.combat.mana = 3;
    run.combat.enemies[0].damage = 40;
    const after = expeditionAbility(run);
    expect(after.combat.mana).toBe(0);
    expect(after.combat.hp).toBe(100);
    expect(after.combat.turnsRemaining).toBe(run.combat.turnsRemaining);
    expect(after.totalTurns).toBe(0);
    expect(after.combat.shadowstepActive).toBe(true);after.combat.mana=3;expect(expeditionAbility(after)).toBe(after);
  });
  it("previews exact class and boon effects before retaliation without changing the run", () => {
    const run = controlled();
    run.boons.ember = 2;
    run.boons.tempest = 1;
    run.boons.siphon = 1;
    run.combat.hp = 30;
    run.combat.enemies[0].hp = 1;
    run.combat.enemies.push({
      id: "second",
      name: "Second sentinel",
      emoji: "",
      hp: 100,
      maxHp: 100,
      damage: 0,
      intent: 99,
      intentMax: 99,
    });
    const original = JSON.stringify(run);
    const preview = previewExpeditionChain(run, "red", 5);
    expect(JSON.stringify(run)).toBe(original);
    expect(preview.damage).toBe(11);
    expect(preview.healing).toBe(8);
    expect(preview.text).toContain("11 dmg");
    expect(preview.text).toContain("+8 HP");
    const mana = controlled("blue");
    mana.heroClass = "mage";
    expect(previewExpeditionChain(mana, "blue", 3).mana).toBe(2);
    mana.combat.mana = 3;
    expect(previewExpeditionChain(mana, "blue", 5).text).toContain("Mana full");
    const healing = controlled("green");
    healing.heroClass = "cleric";
    healing.combat.hp = 10;
    healing.boons.verdant = 2;
    healing.boons.battery = 1;
    const bloom = previewExpeditionChain(healing, "green", 4);
    expect(bloom.healing).toBe(52);
    expect(bloom.mana).toBe(1);
    const ward = controlled("gold");
    ward.boons.bastion = 2;
    ward.combat.resonance = { colors: ["red", "blue", "green"], bursts: 0 };
    const burst = previewExpeditionChain(ward, "gold", 3);
    expect(burst.guard).toBe(5);
    expect(burst.damage).toBe(20);
    expect(burst.mana).toBe(1);
    expect(burst.burst).toBe(true);
  });
  it("scales all enemies with ascension while fixing the final room to a boss encounter", () => {
    const low = expeditionEnemies(7, 6, 0, "crypt"),
      high = expeditionEnemies(7, 6, 7, "crypt");
    expect(low[0].tier).toBe("boss");
    expect(high[0].hp).toBeGreaterThan(low[0].hp);
    expect(high[0].damage).toBeGreaterThan(low[0].damage);
    expect(expeditionEnemies(7, 3, 0, "vault")).toHaveLength(
      expeditionEnemies(7, 3, 0, "crypt").length + 1,
    );
  });
  it("never awards unplayed rooms and bounds the clear reward by ascension", () => {
    expect(expeditionReward(0, 0, false)).toBe(0);
    expect(expeditionReward(5, 0, false)).toBe(60);
    expect(expeditionReward(6, 0, true)).toBe(112);
    expect(expeditionReward(6, 7, true)).toBe(238);
  });
  it("checkpoints survive reload, reject stale/invalid data, and remain scoped by key", () => {
    const run = createExpedition(ticket);
    expect(saveExpedition("account-a", run)).toBe(true);
    expect(loadExpedition("account-a")?.grid).toEqual(run.grid);
    expect(loadExpedition("account-b")).toBeNull();
    localStorage.setItem("corrupt", '{"version":1}');
    expect(loadExpedition("corrupt")).toBeNull();
    localStorage.setItem(
      "old",
      JSON.stringify({ ...run, savedAt: Date.now() - 8 * 86400000 }),
    );
    expect(loadExpedition("old")).toBeNull();
    clearExpedition("account-a");
    expect(loadExpedition("account-a")).toBeNull();
  });
});
