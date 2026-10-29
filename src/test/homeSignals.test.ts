import { describe, it, expect } from "vitest";
import {
  nexusHomeCheckpoint,
  portfolioHistory,
  portfolioReturn,
  type HomePortfolio,
} from "@/lib/home/signals";
import { rankNextActions } from "@/lib/home/nextAction";
import { createRun } from "@/lib/nexus/core/engine";
import { ENDLESS } from "@/lib/nexus/core/catalog";
import { buildHomeUpdates } from "@/lib/home/mobileHome";
describe("Home feature signals", () => {
  it("surfaces only registered current endless checkpoints with the canonical resume route", () => {
    const run = createRun(ENDLESS);
    run.registered = true;
    run.wave = 12;
    const saved = nexusHomeCheckpoint(run);
    expect(saved?.waveLabel).toBe("Wave 12");
    expect(
      rankNextActions({
        userId: "me",
        installedSlugs: new Set(["nexus-defense"]),
        endlessSavedRun: saved,
      })[0].to,
    ).toBe("/nexus/battle/endless");
    expect(nexusHomeCheckpoint({ ...run, registered: false })).toBeNull();
    expect(nexusHomeCheckpoint({ ...run, balanceVersion: 3 })).toBeNull();
    expect(nexusHomeCheckpoint({ ...run, phase: "defeat" })).toBeNull();
    expect(nexusHomeCheckpoint({ ...run, phase: "victory" })).toBeNull();
    expect(nexusHomeCheckpoint(null)).toBeNull();
  });
  it("draws only finite observed portfolio data, including flat and falling histories", () => {
    expect(portfolioHistory([{ value: NaN }, { value: 50000 }])).toBeNull();
    expect(portfolioHistory([{ value: 50000 }, { value: 50000 }])).toBe(
      "0.0,28.0 128.0,28.0",
    );
    expect(portfolioHistory([{ value: 60000 }, { value: 50000 }])).toBe(
      "0.0,4.0 128.0,28.0",
    );
    expect(portfolioHistory([{ value: 0 }, { value: Infinity }])).toBeNull();
  });
  it("uses the actual season capital and requires a recorded valuation", () => {
    const portfolio = {
      total_value: 58250,
      valued_at: "2026-10-29T15:00:00Z",
      season: { starting_cash: 50000, status: "active" },
      history: [],
    } as HomePortfolio;
    expect(portfolioReturn(portfolio)).toBeCloseTo(16.5);
    expect(portfolioReturn({ ...portfolio, total_value: 40000 })).toBe(-20);
    expect(portfolioReturn({ ...portfolio, valued_at: null })).toBeNull();
    expect(
      portfolioReturn({
        ...portfolio,
        season: { starting_cash: 0, status: "active" },
      }),
    ).toBeNull();
    expect(portfolioReturn(null)).toBeNull();
  });
  it("brings direct Drop activity into Home without requiring the feed plugin", () => {
    const input = {
      installed: new Set(["daily-find"]),
      activity: [],
      events: [],
      campaigns: [],
      drafts: [],
      today: [],
      upcoming: [],
      showCelebrations: false,
      drops: [
        {
          id: "drop",
          title: "A real discovery",
          kind: "learned" as const,
          created_at: "2026-10-29T15:00:00Z",
          profiles: { display_name: "Alex" },
        },
      ],
    };
    const rows = buildHomeUpdates(input);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      title: "Alex shared a Drop",
      detail: "A real discovery",
      to: "/finds/drop",
    });
    expect(buildHomeUpdates({ ...input, installed: new Set() })).toEqual([]);
  });
});
