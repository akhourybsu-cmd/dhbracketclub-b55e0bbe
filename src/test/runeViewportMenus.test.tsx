import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import RuneDelveHeroPage from "@/pages/RuneDelveHeroPage";
import RuneDelveArmoryPage from "@/pages/RuneDelveArmoryPage";
import RuneDelveShopPage from "@/pages/RuneDelveShopPage";
import { RuneBuildPages } from "@/components/runedelve/RuneBuildPages";
import { buildCharacterSheet } from "@/lib/runedelve/characterStats";

const state = vi.hoisted(() => ({
  viewport: { width: 320, height: 568, short: true, landscape: false },
  updateHero: vi.fn().mockResolvedValue({}),
  updateLoadout: vi.fn().mockResolvedValue({}),
  purchase: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/hooks/useRuneViewport", () => ({
  useRuneViewport: () => state.viewport,
}));
vi.mock("@/hooks/useRuneDelveHero", () => ({
  useRuneDelveHero: () => ({
    data: {
      class: "warrior",
      hero_name: "Aster",
      level: 5,
      xp: 0,
      current_streak: 1,
      lifetime_runs: 12,
      lifetime_score: 5000,
    },
  }),
  useUpdateHero: () => ({ mutateAsync: state.updateHero }),
}));
vi.mock("@/hooks/useRuneDelveClassProgress", () => ({
  useAllClassProgress: () => ({
    data: ["warrior", "mage", "rogue", "cleric"].map((cls) => ({
      class: cls,
      level: 5,
      xp: 0,
      highest_unlocked_level: 1,
    })),
  }),
  useEnsureClassProgress: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ level: 1, xp: 0 }),
  }),
}));
vi.mock("@/hooks/useRuneDelveCampaign", () => ({
  useMyProgress: () => ({ data: { highest_unlocked_level: 1 } }),
}));
vi.mock("@/hooks/useRuneShards", () => ({
  useRuneWallet: () => ({ data: { shards: 2000, slots_unlocked: 2 } }),
  useUnlockSlot: () => ({ mutate: vi.fn() }),
}));
vi.mock("@/hooks/useRelicCollection", () => ({
  useRelicCollection: () => ({
    data: [
      "ember_edge",
      "aether_spark",
      "iron_resolve",
      "verdant_heart",
      "keysight",
    ].map((relic_id) => ({ relic_id, rank: 1 })),
  }),
  usePurchaseRelic: () => ({ mutateAsync: state.purchase }),
  usePurchaseRelicUpgrade: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/hooks/useLoadout", () => ({
  useLoadout: () => ({ data: { slot_1: null, slot_2: null, slot_3: null } }),
  useUpdateLoadout: () => ({ mutateAsync: state.updateLoadout }),
}));
vi.mock("@/hooks/useRuneDelveSfx", () => ({
  useRuneDelveSfx: () => ({ play: vi.fn() }),
}));
vi.mock("@/hooks/useSoundEffect", () => ({
  useSoundEffect: () => ({ play: vi.fn() }),
}));
vi.mock("@/components/runedelve/RelicUpgradeSheet", () => ({
  RelicUpgradeSheet: () => null,
}));

beforeEach(() => {
  state.viewport = { width: 320, height: 568, short: true, landscape: false };
  vi.clearAllMocks();
});
afterEach(cleanup);

describe("viewport menu navigation", () => {
  it("keeps rename and all four classes reachable on separate hero screens", async () => {
    render(
      <MemoryRouter>
        <RuneDelveHeroPage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Rename hero" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Hero name" }), {
      target: { value: "  Aster II  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save name" }));
    await waitFor(() =>
      expect(state.updateHero).toHaveBeenCalledWith({ hero_name: "Aster II" }),
    );
    fireEvent.click(screen.getByRole("tab", { name: "Classes" }));
    expect(
      screen.getByRole("button", { name: /^Active Warrior/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Switch to Rogue/ }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Next classes page" }));
    expect(
      screen.getByRole("button", { name: /^Switch to Rogue/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Switch to Cleric/ }),
    ).toBeInTheDocument();
  });

  it("pages the armory collection and equips the visible relic without scrolling", async () => {
    render(
      <MemoryRouter>
        <RuneDelveArmoryPage />
      </MemoryRouter>,
    );
    expect(
      screen.getAllByRole("button", {
        name: "Choose a relic for this empty slot",
      }),
    ).toHaveLength(2);
    fireEvent.click(screen.getByRole("tab", { name: /^Collection/ }));
    expect(
      screen.getByRole("button", { name: /^Ember Edge\./ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Aether Spark\./ }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Next relics page" }));
    fireEvent.click(screen.getByRole("button", { name: /^Aether Spark\./ }));
    await waitFor(() =>
      expect(state.updateLoadout).toHaveBeenCalledWith({
        cls: "warrior",
        slot_1: "aether_spark",
        slot_2: null,
        slot_3: null,
      }),
    );
  });

  it("resets catalog paging when filters change and retains locked tiers", () => {
    render(
      <MemoryRouter>
        <RuneDelveShopPage />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("button", { name: /^Ember Edge\./ }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next relics page" }));
    expect(
      screen.getByRole("button", { name: /^Aether Spark\./ }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Relic category" }), {
      target: { value: "offense" },
    });
    expect(
      screen.getByRole("button", { name: /^Ember Edge\./ }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Relic tier" }), {
      target: { value: "3" },
    });
    expect(
      screen.getByRole("button", { name: /^Executioner's Mark\./ }),
    ).toBeDisabled();
  });

  it("retains the actual stats, ability kit and every mastery behind build pages", () => {
    const sheet = buildCharacterSheet({
      cls: "warrior",
      classLevel: 5,
      campaignLevel: 1,
      slots: [],
    });
    render(
      <RuneBuildPages
        sheet={sheet}
        masteries={[
          {
            id: "test",
            name: "Iron oath",
            summary: "Retained mastery detail.",
            unlockLevel: 10,
          },
        ]}
        level={5}
      />,
    );
    expect(screen.getByText(/Combat stats/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next build page" }));
    expect(screen.getByText(sheet.abilityDetail)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next build page" }));
    expect(screen.getByText("Retained mastery detail.")).toBeInTheDocument();
    expect(screen.getByText("Unlocks at level 10")).toBeInTheDocument();
  });

  it("keeps every stat note and conditional effect reachable with its source and rank", () => {
    const sheet = buildCharacterSheet({
      cls: "warrior",
      classLevel: 80,
      campaignLevel: 70,
      slots: ["ember_edge", "void_pact", "first_light"],
      rankById: new Map([
        ["ember_edge", 4],
        ["void_pact", 3],
        ["first_light", 2],
      ]),
    });
    const masteries = [
      {
        id: "oath",
        name: "Iron oath",
        summary: "Mastery first.",
        unlockLevel: 10,
      },
    ];
    render(<RuneBuildPages sheet={sheet} masteries={masteries} level={80} />);
    const next = () =>
      fireEvent.click(screen.getByRole("button", { name: "Next build page" }));
    expect(
      screen.getByRole("heading", { name: /Combat stats/ }),
    ).toBeInTheDocument();
    next();
    expect(screen.getByText(sheet.abilityDetail)).toBeInTheDocument();
    next();
    expect(screen.getByText("Mastery first.")).toBeInTheDocument();
    for (const stat of sheet.stats) {
      next();
      expect(
        screen.getByRole("heading", { name: stat.label }),
      ).toBeInTheDocument();
      expect(
        within(screen.getByText("Base", { exact: true })).getByText(
          `${stat.base}${stat.suffix}`,
          { exact: true },
        ),
      ).toBeInTheDocument();
      expect(
        within(screen.getByText("Effective", { exact: true })).getByText(
          `${stat.effective}${stat.suffix}`,
          { exact: true },
        ),
      ).toBeInTheDocument();
      expect(screen.getByText(stat.note, { exact: true })).toBeInTheDocument();
    }
    expect(
      sheet.bonuses.some(
        (bonus) => bonus.source === "Relic" && bonus.rank === 4,
      ),
    ).toBe(true);
    for (const bonus of sheet.bonuses) {
      next();
      expect(
        screen.getByRole("heading", { name: bonus.name }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(bonus.detail, { exact: true }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          `Source: ${bonus.source}${bonus.rank != null ? ` · Rank ${bonus.rank}` : ""}`,
          { exact: true },
        ),
      ).toBeInTheDocument();
    }
    expect(
      screen.getByRole("button", { name: "Next build page" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("navigation", { name: "Build pages" }),
    ).toHaveAttribute(
      "data-page-count",
      String(2 + masteries.length + sheet.stats.length + sheet.bonuses.length),
    );
  });
});
