import { describe, expect, it } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { RelicCard } from "@/components/runedelve/RelicCard";
import { RELIC_BY_ID } from "@/lib/runedelve/relics";
import {
  parseRuneResult,
  runeResultKey,
  type RuneResultSnapshot,
} from "@/lib/runedelve/resultSnapshot";

const now = 1_800_000_000_000;
const failedRun: RuneResultSnapshot = {
  version: 2,
  userId: "member-a",
  heroClass: "mage",
  levelNumber: 10,
  ts: now,
  score: 350,
  totalDamage: 94,
  enemiesDefeated: 1,
  hpRemaining: 0,
  turnsUsed: 8,
  longestChain: 6,
  xpEarned: 0,
  dungeonCleared: false,
  shardsAwarded: 5,
  wasNewBest: false,
  improvedChain: true,
  improvedTurns: false,
  improvedHp: false,
  firstClear: false,
};
afterEach(cleanup);

describe("Rune Delve result handoff", () => {
  it("retains the actual failed attempt independently from a prior cleared best", () => {
    const parsed = parseRuneResult(
      JSON.stringify(failedRun),
      "member-a",
      "mage",
      10,
      now,
    );
    expect(parsed).toMatchObject({
      dungeonCleared: false,
      score: 350,
      hpRemaining: 0,
      improvedChain: true,
    });
  });
  it("rejects another member, class, level, expired or malformed results", () => {
    const raw = JSON.stringify(failedRun);
    expect(runeResultKey("member-a", "mage", 10)).not.toBe(
      runeResultKey("member-b", "mage", 10),
    );
    expect(parseRuneResult(raw, "member-b", "mage", 10, now)).toBeNull();
    expect(parseRuneResult(raw, "member-a", "warrior", 10, now)).toBeNull();
    expect(parseRuneResult(raw, "member-a", "mage", 11, now)).toBeNull();
    expect(
      parseRuneResult(raw, "member-a", "mage", 10, now + 86_400_001),
    ).toBeNull();
    expect(parseRuneResult("{broken", "member-a", "mage", 10, now)).toBeNull();
    expect(
      parseRuneResult(
        JSON.stringify({ ...failedRun, score: -1 }),
        "member-a",
        "mage",
        10,
        now,
      ),
    ).toBeNull();
    expect(
      parseRuneResult(
        JSON.stringify({ ...failedRun, dungeonCleared: "false" }),
        "member-a",
        "mage",
        10,
        now,
      ),
    ).toBeNull();
  });
});

describe("Relic actions", () => {
  it("labels equipment actions as equipment rather than a purchase", () => {
    render(
      <RelicCard
        relic={RELIC_BY_ID.ember_edge}
        state="owned"
        rank={2}
        intent="equip"
      />,
    );
    expect(screen.getByRole("button").textContent).toContain("Equip relic");
    expect(screen.queryByText(/Upgrade/)).toBeNull();
    cleanup();
    render(
      <RelicCard
        relic={RELIC_BY_ID.ember_edge}
        state="equipped"
        rank={2}
        intent="equip"
      />,
    );
    expect(screen.getByRole("button").textContent).toContain("Unequip");
  });
  it("displays the owned rank effect and correct next-rank cost in the forge", () => {
    render(
      <RelicCard
        relic={RELIC_BY_ID.ember_edge}
        state="owned"
        shards={1000}
        rank={2}
      />,
    );
    expect(screen.getByRole("button").textContent).toContain("+55% damage");
    expect(screen.getByRole("button").textContent).toContain("Upgrade · 120");
  });
});
