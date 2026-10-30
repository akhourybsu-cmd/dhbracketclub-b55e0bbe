import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RuneEnemyArt } from "@/components/runedelve/RuneArtwork";
import { EnemyDisplay } from "@/components/runedelve/EnemyDisplay";
import {
  BESTIARY_ROSTER,
  ENEMY_ROSTER,
  MINION_BONE_HUSK,
} from "@/lib/runedelve/enemyRoster";
import { generateLevel } from "@/lib/runedelve/levelGenerator";
import {
  MONSTER_PORTRAITS,
  monsterPortraitPosition,
  resolveMonsterPortrait,
} from "@/lib/runedelve/monsterPortraits";

afterEach(cleanup);

describe("Rune Delve · individual monster portraits", () => {
  it("gives all 64 named identities their own exact atlas cell", () => {
    expect(MONSTER_PORTRAITS).toHaveLength(64);
    expect(new Set(MONSTER_PORTRAITS.map((p) => p.id)).size).toBe(64);
    expect(
      new Set(MONSTER_PORTRAITS.map((p) => `${p.atlas}:${p.cell}`)).size,
    ).toBe(64);
    for (const atlas of new Set(MONSTER_PORTRAITS.map((p) => p.atlas))) {
      expect(
        MONSTER_PORTRAITS.filter((p) => p.atlas === atlas)
          .map((p) => p.cell)
          .sort((a, b) => a - b),
      ).toEqual(Array.from({ length: 16 }, (_, i) => i));
    }
  });

  it("resolves the complete canonical roster and every promoted bestiary entry", () => {
    for (const creature of [...ENEMY_ROSTER, MINION_BONE_HUSK]) {
      expect(
        resolveMonsterPortrait({
          archetypeId: creature.id,
          name: creature.name,
        }).portrait?.id,
      ).toBe(creature.id);
    }
    for (const creature of BESTIARY_ROSTER) {
      const resolved = resolveMonsterPortrait({
        archetypeId: creature.id,
        name: creature.name,
      });
      expect(resolved.portrait, creature.id).toBeDefined();
      expect(resolved.portrait?.id.split("__")[0]).toBe(
        creature.id.split("__")[0],
      );
      expect(resolved.promotion).toBe(
        creature.id.endsWith("__boss")
          ? "boss"
          : creature.id.endsWith("__mini")
            ? "mini"
            : null,
      );
    }
  });

  it.each([
    ["skeleton_guard", "Crypt sentinel", "crypt_sentinel"],
    ["crystal_spider", "Cave stalker", "cave_stalker"],
    ["goblin_raider", "Ashborn raider", "ashborn_raider"],
    ["stone_golem", "Stone guardian", "stone_guardian"],
    ["void_sovereign", "The Hollow Sovereign", "void_sovereign"],
    ["rune_wraith", "Rune wraith", "rune_wraith"],
  ])(
    "keeps %s / %s on its named Expedition portrait",
    (archetypeId, name, id) => {
      expect(resolveMonsterPortrait({ archetypeId, name }).portrait?.id).toBe(
        id,
      );
    },
  );

  it("preserves old generic names without confusing them with the armored/fire versions", () => {
    expect(resolveMonsterPortrait({ name: "Skeleton" }).portrait?.id).toBe(
      "legacy_skeleton",
    );
    expect(resolveMonsterPortrait({ name: "Slime" }).portrait?.id).toBe(
      "legacy_slime",
    );
    expect(resolveMonsterPortrait({ name: "Cave Bat" }).portrait?.id).toBe(
      "cave_bat",
    );
    expect(
      resolveMonsterPortrait({ name: "Crystal Spider" }).portrait?.id,
    ).toBe("crystal_spider");
  });

  it("uses dedicated legendary portraits and distinct promotion/echo treatment", () => {
    expect(
      resolveMonsterPortrait({
        archetypeId: "goblin_scout",
        name: "Dread Goblin Scout",
        tier: "boss",
      }).portrait?.id,
    ).toBe("goblin_scout__boss");
    const echoed = resolveMonsterPortrait({
      archetypeId: "goblin_scout",
      name: "Echo of Goblin Scout",
      tier: "boss",
    });
    expect(echoed).toMatchObject({
      promotion: "boss",
      echo: true,
      portrait: { id: "goblin_scout__boss" },
    });
    expect(
      resolveMonsterPortrait({
        archetypeId: "cult_warden",
        name: "Greater Cult Warden",
      }),
    ).toMatchObject({ promotion: "mini", portrait: { id: "cult_warden" } });
    expect(
      resolveMonsterPortrait({
        archetypeId: "dread_summoner",
        name: "Dread Summoner",
      }),
    ).toMatchObject({ promotion: null, portrait: { id: "dread_summoner" } });
    expect(
      resolveMonsterPortrait({
        archetypeId: "dread_summoner__boss",
        name: "Boss Dread Summoner",
      }),
    ).toMatchObject({ promotion: "boss", portrait: { id: "dread_summoner" } });
  });

  it("keeps every generated campaign enemy on a known species portrait", () => {
    for (let level = 1; level <= 150; level++) {
      const encounter = generateLevel(level);
      const waves = encounter.modifiers?.waves ?? [];
      for (const enemy of [
        ...encounter.enemy_config,
        ...waves.flatMap((wave) => wave.enemies),
      ]) {
        expect(
          resolveMonsterPortrait({
            archetypeId: enemy.archetypeId,
            name: enemy.name,
            tier: enemy.tier,
          }).portrait,
          `${level}:${enemy.name}`,
        ).toBeDefined();
      }
    }
  });

  it("addresses the actual sixteen cells and never selects a neighboring family picture", () => {
    expect(monsterPortraitPosition(0)).toBe("0% 0%");
    expect(monsterPortraitPosition(3)).toBe("100% 0%");
    expect(monsterPortraitPosition(12)).toBe("0% 100%");
    expect(monsterPortraitPosition(15)).toBe("100% 100%");
    const view = render(
      <RuneEnemyArt archetypeId="mossback_toad" name="Mossback Toad" />,
    );
    expect(
      view.container.querySelector('[data-monster-portrait="mossback_toad"]'),
    ).toBeInTheDocument();
    const image = view.container.querySelector<HTMLElement>(
      ".rd-creature-illustration",
    )!;
    expect(image.style.backgroundImage).toContain("monsters-ember.webp");
    expect(image.style.backgroundSize).toBe("400% 400%");
  });

  it("uses a neutral unknown emblem instead of presenting an unrelated monster", () => {
    const view = render(
      <RuneEnemyArt
        archetypeId="future_unlisted_creature"
        name="An unknown foe"
      />,
    );
    expect(
      view.container.querySelector('[data-monster-portrait="unknown"]'),
    ).toBeInTheDocument();
    expect(
      view.container.querySelector(".rd-creature-illustration"),
    ).toBeNull();
  });

  it("uses the same correctly named portrait in battle and accessible inspection", () => {
    const view = render(
      <EnemyDisplay
        enemies={[
          {
            id: "exp-cave",
            archetypeId: "crystal_spider",
            name: "Cave stalker",
            emoji: "",
            hp: 80,
            maxHp: 80,
            damage: 5,
          },
        ]}
      />,
    );
    expect(
      view.container.querySelector('[data-monster-portrait="cave_stalker"]'),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /Inspect Cave stalker/ }),
    );
    const portrait = screen.getByRole("img", { name: "Cave stalker portrait" });
    expect(portrait).toHaveAttribute("data-monster-portrait", "cave_stalker");
    expect(
      portrait.querySelector<HTMLElement>(".rd-creature-illustration")?.style
        .backgroundImage,
    ).toContain("monsters-legends.webp");
  });
});
