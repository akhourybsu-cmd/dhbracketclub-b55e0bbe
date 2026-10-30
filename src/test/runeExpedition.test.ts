import { beforeEach, describe, expect, it } from "vitest";
import {
  createExpedition,
  previewExpeditionChain,
  expeditionAbility,
  expeditionBoonChoices,
  expeditionBoonGain,
  expeditionBoonDescription,
  expeditionMoveBudget,
  expeditionPressureStep,
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
import { initialCombat } from "@/lib/runedelve/combatEngine";
import {
  expeditionCandidates,
  simulateExpedition,
} from "../../scripts/balance-rune-expedition";
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
      expect(a.combat.turnsRemaining).toBe(10);
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
    expect(next.combat.enemies[0].hp).toBe(977);
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
    run.combat.mana = 2;
    run.combat.enemies[0].damage = 40;
    const after = expeditionAbility(run);
    expect(after.combat.mana).toBe(0);
    expect(after.combat.hp).toBe(100);
    expect(after.combat.turnsRemaining).toBe(run.combat.turnsRemaining);
    expect(after.totalTurns).toBe(0);
    expect(after.combat.shadowstepActive).toBe(true);
    after.combat.mana = 3;
    expect(expeditionAbility(after)).toBe(after);
  });
  it("always offers encounter progress, excludes capped mana boons and clamps Hunt gains", () => {
    const tempo = new Set(["ember", "echo", "tempest", "fury", "hourglass"]);
    let sawFirstlight = false;
    for (let seed = 1; seed <= 100; seed++) {
      const run = createExpedition({ ...ticket, seed });
      run.phase = "boon";
      run.route = "hunt";
      run.boons = { firstlight: 2, battery: 3, phoenix: 1 };
      const choices = expeditionBoonChoices(run);
      expect(choices.some((boon) => tempo.has(boon.id))).toBe(true);
      expect(
        choices.some((boon) => boon.id === "battery" || boon.id === "phoenix"),
      ).toBe(false);
      expect(choices).toEqual(expeditionBoonChoices(run));
      if (choices.some((boon) => boon.id === "firstlight")) {
        sawFirstlight = true;
        expect(expeditionBoonGain(run, "firstlight")).toBe(1);
        const after = chooseExpeditionBoon(run, "firstlight");
        expect(after.boons.firstlight).toBe(3);
        expect(
          expeditionBoonChoices(after).some((boon) => boon.id === "firstlight"),
        ).toBe(false);
      }
    }
    expect(sawFirstlight).toBe(true);
  });
  it("gives Vault its extra moves, four legal choices and the existing score bonus", () => {
    let seed = 1;
    while (
      seed < 100 &&
      !expeditionRouteChoices(createExpedition({ ...ticket, seed })).includes(
        "vault",
      )
    )
      seed++;
    const run = createExpedition({ ...ticket, seed });
    run.phase = "route";
    const entered = chooseExpeditionRoute(run, "vault");
    expect(entered.combat.turnsRemaining).toBe(
      expeditionMoveBudget(2, 0, "crypt") + 3,
    );
    expect(entered.roomStartTurns).toBe(entered.combat.turnsRemaining);
    entered.combat.mana = 3;
    entered.combat.enemies = entered.combat.enemies.map((enemy) => ({
      ...enemy,
      hp: 1,
    }));
    const cleared = expeditionAbility(entered);
    expect(cleared.phase).toBe("boon");
    expect(expeditionBoonChoices(cleared)).toHaveLength(4);
    expect(
      new Set(expeditionBoonChoices(cleared).map((boon) => boon.id)).size,
    ).toBe(4);
    expect(
      cleared.score -
        cleared.combat.totalDamage -
        cleared.totalKills * 100 -
        100,
    ).toBe(250);
    expect(
      chooseExpeditionBoon(cleared, expeditionBoonChoices(cleared)[3].id).phase,
    ).toBe("route");
  });
  it("gives Fury a useful healthy bonus and a stronger bonus strictly below half health", () => {
    const run = controlled();
    run.boons.fury = 1;
    expect(previewExpeditionChain(run, "red", 3).damage).toBe(39);
    run.combat.hp = 50;
    expect(previewExpeditionChain(run, "red", 3).damage).toBe(39);
    run.combat.hp = 49;
    expect(previewExpeditionChain(run, "red", 3).damage).toBe(49);
    expect(expeditionBoonDescription("fury", 2)).toContain("16%");
    expect(expeditionBoonDescription("fury", 2)).toContain("70% below 50%");
  });
  it("smooths tier budgets while retaining every Borrowed Time rank on entry", () => {
    for (const room of [1, 2, 6]) {
      expect(expeditionMoveBudget(room, 3)).toBeGreaterThan(
        expeditionMoveBudget(room, 0),
      );
      expect(expeditionMoveBudget(room, 7)).toBeGreaterThan(
        expeditionMoveBudget(room, 3),
      );
    }
    const run = createExpedition(ticket);
    run.phase = "route";
    run.boons.hourglass = 4;
    const route = expeditionRouteChoices(run)[0];
    expect(chooseExpeditionRoute(run, route).combat.turnsRemaining).toBe(
      expeditionMoveBudget(2, 0, route) + 8,
    );
  });
  it("applies shared long-chain damage tiers without spending bonus moves", () => {
    const chain = [
      ...Array.from({ length: 5 }, (_, c) => ({ r: 0, c })),
      ...Array.from({ length: 5 }, (_, c) => ({ r: 1, c: 4 - c })),
    ];
    for (const [length, damage] of [
      [4, 48],
      [5, 60],
      [6, 86],
      [7, 109],
      [8, 134],
      [10, 168],
    ]) {
      const run = controlled();
      const preview = previewExpeditionChain(run, "red", length);
      const next = expeditionChain(run, chain.slice(0, length));
      expect(preview.damage).toBe(damage);
      expect(next.combat.totalDamage - run.combat.totalDamage).toBe(damage);
      expect(next.combat.turnsRemaining).toBe(run.combat.turnsRemaining - 1);
      expect(next.totalTurns).toBe(1);
    }
  });
  it("raises pressure steadily by tier and describes the actual opening rules", () => {
    expect(
      Array.from({ length: 8 }, (_, tier) => expeditionPressureStep(tier)),
    ).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
    expect(expeditionPressureStep(0, true)).toBe(2);
    const opening = expeditionEnemies(ticket.seed, 1, 7, "crypt")[0];
    expect(opening.telegraphLabel).toBe("Heavy strike every 3 moves.");
    const boss = expeditionEnemies(ticket.seed, 6, 7, "crypt")[0];
    expect(boss.telegraphLabel).toContain("+4 attack every 2 moves");
  });
  it("raises visible attack pressure in prolonged rooms without stacking it twice", () => {
    const run = createExpedition({ ...ticket, ascension: 3 });
    run.phase = "route";
    const entered = chooseExpeditionRoute(run, expeditionRouteChoices(run)[0]);
    entered.combat.turnsRemaining = entered.roomStartTurns! - 8;
    entered.grid = Array.from({ length: 5 }, () => Array(5).fill("blue"));
    const base = entered.combat.enemies[0].damage;
    const after = expeditionChain(entered, three);
    expect(after.combat.enemies[0].damage).toBe(base + 2);
    after.grid = entered.grid;
    const again = expeditionChain(after, three);
    expect(again.combat.enemies[0].damage).toBe(base + 2);
    again.grid = entered.grid;
    const later = expeditionChain(again, three);
    expect(later.combat.enemies[0].damage).toBe(base + 4);
    expect(entered.combat.enemies[0].damage).toBe(base);
  });
  it("accelerates the Sovereign's visible heavy countdown at half health and preserves it on reload", () => {
    const run = createExpedition(ticket);
    run.room = 6;
    run.roomsCleared = 5;
    run.combat = initialCombat(
      expeditionEnemies(ticket.seed, 6, 0, "crypt"),
      expeditionMoveBudget(6, 0),
    );
    run.roomStartTurns = run.combat.turnsRemaining;
    run.combat.enemies[0].hp = Math.floor(run.combat.enemies[0].maxHp / 2);
    run.grid = Array.from({ length: 5 }, () => Array(5).fill("blue"));
    const after = expeditionChain(run, three);
    expect(after.combat.enemies[0].intentMax).toBe(2);
    expect(after.lastAction).toContain("Sovereign enraged");
    expect(run.combat.enemies[0].intentMax).toBe(3);
    expect(saveExpedition("enraged", after)).toBe(true);
    expect(loadExpedition("enraged")?.combat.enemies[0].intentMax).toBe(2);
  });
  it("loads old v1 high-rank checkpoints without trimming boons or resetting moves", () => {
    const run = createExpedition(ticket);
    delete run.roomStartTurns;
    run.combat.turnsRemaining = 16;
    run.boons = { firstlight: 5, battery: 6, hourglass: 4 };
    expect(saveExpedition("old-v1", run)).toBe(true);
    const loaded = loadExpedition("old-v1")!;
    expect(loaded.boons).toEqual(run.boons);
    expect(loaded.combat.turnsRemaining).toBe(16);
    expect(loaded.grid).toEqual(run.grid);
    expect(
      expeditionBoonChoices(loaded).some(
        (boon) => boon.id === "firstlight" || boon.id === "battery",
      ),
    ).toBe(false);
  });
  it("searches later colors even when the first cluster consumes its search budget", () => {
    const run = controlled();
    run.grid[4] = ["blue", "blue", "blue", "green", "green"];
    const paths = expeditionCandidates(run);
    expect(paths.some((path) => run.grid[path[0].r][path[0].c] === "red")).toBe(
      true,
    );
    expect(
      paths.some((path) => run.grid[path[0].r][path[0].c] === "blue"),
    ).toBe(true);
    expect(
      paths.every(
        (path) =>
          new Set(path.map((cell) => `${cell.r}-${cell.c}`)).size ===
          path.length,
      ),
    ).toBe(true);
  });
  it.each(["smart", "ordinary"] as const)(
    "records complete legal drafts and terminal outcomes for the %s policy",
    (policy) => {
      const run = simulateExpedition(728391, "rogue", 0, policy);
      expect(
        run.drafts.every((draft) => draft.offered.includes(draft.picked)),
      ).toBe(true);
      expect(
        run.routes.every((route) => route.offered.includes(route.picked)),
      ).toBe(true);
      expect(run.rooms.length).toBeGreaterThan(0);
      expect(run.turns).toBeGreaterThan(0);
      expect(run.cleared ? run.roomsCleared === 6 : run.loss !== null).toBe(
        true,
      );
    },
  );
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
  it("rejects incomplete combat state that would turn a resumed score into NaN", () => {
    const run = createExpedition(ticket);
    for (const field of [
      "totalDamage",
      "enemiesDefeated",
      "longestChain",
      "shadowstepActive",
      "abilityUsed",
      "rogueBonusTriggered",
    ]) {
      const combat = { ...run.combat } as Record<string, unknown>;
      delete combat[field];
      localStorage.setItem("broken", JSON.stringify({ ...run, combat }));
      expect(loadExpedition("broken"), field).toBeNull();
    }
  });
  it("rejects malformed telegraphs, display text, resonance and impossible phase checkpoints", () => {
    const run = createExpedition(ticket);
    const broken = [
      { ...run, lastAction: { unexpected: "object" } },
      { ...run, startedAt: "not a date" },
      { ...run, totalKills: undefined },
      { ...run, phoenixUsed: "false" },
      { ...run, boons: [] },
      {
        ...run,
        combat: {
          ...run.combat,
          enemies: run.combat.enemies.map((enemy) => ({
            ...enemy,
            armor: "broken",
          })),
        },
      },
      {
        ...run,
        combat: {
          ...run.combat,
          enemies: run.combat.enemies.map((enemy) => ({
            ...enemy,
            intent: "broken",
          })),
        },
      },
      {
        ...run,
        combat: {
          ...run.combat,
          resonance: { colors: ["red", "red"], bursts: 0 },
        },
      },
      { ...run, combat: { ...run.combat, hp: 0 } },
      { ...run, combat: { ...run.combat, turnsRemaining: 0 } },
      { ...run, phase: "won" },
      { ...run, phase: "boon" },
    ];
    for (const checkpoint of broken) {
      localStorage.setItem("broken", JSON.stringify(checkpoint));
      expect(loadExpedition("broken"), JSON.stringify(checkpoint)).toBeNull();
    }
  });
});
