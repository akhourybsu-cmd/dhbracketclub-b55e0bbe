import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import RuneDelveBestiaryPage from "@/pages/RuneDelveBestiaryPage";
import RuneDelveLeaderboardPage from "@/pages/RuneDelveLeaderboardPage";
import RuneDelveQuestsPage from "@/pages/RuneDelveQuestsPage";
import RuneDelveHistoryPage from "@/pages/RuneDelveHistoryPage";
import { BESTIARY_ROSTER } from "@/lib/runedelve/enemyRoster";
import type { BestiaryEntry } from "@/hooks/useBestiary";
import type { ActiveQuest, QuestDefinition } from "@/lib/runedelve/quests";

type StoredRow = Record<string, unknown>;
const state = vi.hoisted(() => ({
  userId: "member",
  viewport: { width: 320, height: 568, short: true, landscape: false },
  bestiary: [] as BestiaryEntry[],
  leaders: [] as Array<{
    id: string;
    user_id: string;
    rank: number;
    highest_completed_level: number;
    total_levels_cleared: number;
    profile: { display_name: string };
    hero: {
      hero_name: string;
      class: string;
      level: number;
      cosmetic_title: string;
      current_streak: number;
    };
  }>,
  definitions: [] as QuestDefinition[],
  quests: [] as ActiveQuest[],
  tables: {} as Record<string, StoredRow[]>,
  failTables: [] as string[],
  claim: vi.fn(),
}));
vi.mock("@/hooks/useRuneViewport", () => ({
  useRuneViewport: () => state.viewport,
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: state.userId } }),
}));
vi.mock("@/hooks/useBestiary", () => ({
  useBestiary: () => ({
    data: state.bestiary,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));
vi.mock("@/hooks/useRuneDelveCampaign", () => ({
  useCampaignLeaderboard: () => ({
    data: state.leaders,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));
vi.mock("@/hooks/useRuneDelveHero", () => ({
  useRuneDelveHero: () => ({
    data: { user_id: state.userId, class: "warrior" },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));
vi.mock("@/hooks/useQuests", () => ({
  useQuestDefinitions: () => ({
    data: state.definitions,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useActiveQuests: () => ({
    data: state.quests,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useClaimQuest: () => ({ mutateAsync: state.claim, isPending: false }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (name: string) => {
      const filters: Array<(row: StoredRow) => boolean> = [];
      let sortKey = "",
        ascending = true,
        limit = Infinity;
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => {
          filters.push((row) => row[key] === value);
          return query;
        },
        order: (key: string, options: { ascending: boolean }) => {
          sortKey = key;
          ascending = options.ascending;
          return query;
        },
        limit: (value: number) => {
          limit = value;
          return query;
        },
        then: (
          resolve: (value: {
            data: StoredRow[] | null;
            error: { message: string } | null;
          }) => unknown,
        ) => {
          const rows = (state.tables[name] ?? []).filter((row) =>
            filters.every((filter) => filter(row)),
          );
          rows.sort(
            (a, b) =>
              String(a[sortKey] ?? "").localeCompare(String(b[sortKey] ?? "")) *
              (ascending ? 1 : -1),
          );
          return Promise.resolve(
            state.failTables.includes(name)
              ? { data: null, error: { message: "Read failed" } }
              : { data: rows.slice(0, limit), error: null },
          ).then(resolve);
        },
      };
      return query;
    },
  },
}));

const clients: QueryClient[] = [];
function mount(content: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        {content}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
function tab(name: string) {
  const trigger = screen.getByRole("tab", { name });
  act(() => {
    trigger.focus();
  });
  fireEvent.keyDown(trigger, { key: "Enter" });
}
function discovery(id: string): BestiaryEntry {
  return {
    id,
    user_id: state.userId,
    archetype_id: id,
    defeat_count: 9,
    highest_level_defeated: 17,
    first_defeated_at: "2026-10-30T00:00:00Z",
    last_defeated_at: "2026-10-30T00:00:00Z",
    created_at: "2026-10-30T00:00:00Z",
    updated_at: "2026-10-30T00:00:00Z",
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  state.userId = "member";
  state.viewport = { width: 320, height: 568, short: true, landscape: false };
  state.bestiary = [];
  state.leaders = [];
  state.definitions = [];
  state.quests = [];
  state.tables = {};
  state.failTables = [];
  state.claim.mockResolvedValue({ shards: 25 });
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
});

describe("paged Rune secondary collections", () => {
  it("pages the Bestiary, resets the page for search, and keeps undiscovered names private", () => {
    const known = BESTIARY_ROSTER[0],
      hidden = BESTIARY_ROSTER[1];
    state.bestiary = [discovery(known.id)];
    mount(<RuneDelveBestiaryPage />);
    const entries = screen.getByLabelText("Bestiary entries");
    expect(within(entries).getAllByRole("button")).toHaveLength(6);
    fireEvent.click(screen.getByRole("button", { name: "Next bestiary page" }));
    expect(screen.queryByRole("button", { name: known.name })).toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: "Search bestiary" }), {
      target: { value: known.name },
    });
    expect(screen.getByRole("button", { name: known.name })).toBeVisible();
    expect(
      screen.queryByRole("navigation", { name: "Bestiary pages" }),
    ).toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: "Search bestiary" }), {
      target: { value: hidden.name },
    });
    expect(screen.getByText("No matches")).toBeVisible();
    fireEvent.change(screen.getByRole("textbox", { name: "Search bestiary" }), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Chapter 2" }));
    expect(
      screen.getByRole("button", { name: "Previous bestiary page" }),
    ).toBeDisabled();
    fireEvent.click(
      within(screen.getByLabelText("Bestiary entries")).getAllByRole(
        "button",
      )[0],
    );
    expect(screen.getByRole("dialog")).toHaveTextContent("Defeat this");
    expect(screen.queryByRole("tab", { name: "Record" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "Ability" })).toBeNull();
  });

  it("makes discovered Bestiary lore, records and abilities separate reachable sections", () => {
    const known = BESTIARY_ROSTER.find((enemy) => enemy.ability)!;
    state.bestiary = [discovery(known.id)];
    mount(<RuneDelveBestiaryPage />);
    fireEvent.change(screen.getByRole("textbox", { name: "Search bestiary" }), {
      target: { value: known.name },
    });
    fireEvent.click(screen.getByRole("button", { name: known.name }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Description");
    expect(screen.queryByText("Defeats")).toBeNull();
    tab("Record");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Defeats");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("L17");
    tab("Ability");
    expect(screen.getByRole("tabpanel")).toHaveTextContent(
      known.telegraphLabel ?? "Special move",
    );
  });

  it("retains absolute campaign ranks and can jump to the current player’s page", () => {
    state.leaders = Array.from({ length: 8 }, (_, index) => ({
      id: `rank-${index}`,
      user_id: index === 7 ? "member" : `member-${index}`,
      rank: index + 1,
      highest_completed_level: 150 - index,
      total_levels_cleared: 150 - index,
      profile: { display_name: `Player ${index + 1}` },
      hero: {
        hero_name: `Hero ${index + 1}`,
        class: "warrior",
        level: 8,
        cosmetic_title: "Squire of Steel",
        current_streak: 3,
      },
    }));
    mount(<RuneDelveLeaderboardPage />);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("Hero 1")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Show your rank, 8" }));
    expect(screen.queryByText("Hero 1")).toBeNull();
    expect(screen.getByText("#8", { exact: true })).toBeVisible();
    expect(screen.getByText(/Hero 8/)).toHaveTextContent("(you)");
    expect(
      screen.getByRole("button", { name: "Next standings page" }),
    ).toBeDisabled();
  });

  it("keeps each quest and its claim reachable without allowing a duplicate claim", async () => {
    for (const scope of ["daily", "weekly"] as const)
      for (let index = 0; index < 3; index++) {
        const definition: QuestDefinition = {
          id: `${scope}-${index}`,
          scope,
          title: `${scope} objective ${index + 1}`,
          description: "Clear one campaign encounter.",
          objective_type: "levels_cleared",
          target_value: 1,
          shard_reward: 25,
          xp_reward: 10,
          is_personal: index === 2,
          hero_class: null,
          weight: 1,
        };
        state.definitions.push(definition);
        state.quests.push({
          id: `active-${definition.id}`,
          user_id: "member",
          quest_id: definition.id,
          definition,
          scope,
          period_key: scope === "daily" ? "2026-10-30" : "2026-W44",
          progress: 1,
          target_value: 1,
          status: "completed",
          claimed_at: null,
        });
      }
    mount(<RuneDelveQuestsPage />);
    expect(screen.getAllByRole("article")).toHaveLength(1);
    fireEvent.click(
      screen.getByRole("button", { name: "Next daily quest page" }),
    );
    expect(
      screen.getByRole("heading", { name: "daily objective 2" }),
    ).toBeVisible();
    const claim = screen.getByRole("button", { name: "Claim +25 💎" });
    act(() => {
      fireEvent.click(claim);
      fireEvent.click(claim);
    });
    await waitFor(() => expect(state.claim).toHaveBeenCalledTimes(1));
    expect(state.claim).toHaveBeenCalledWith(
      expect.objectContaining({ id: "active-daily-1" }),
    );
    tab("Weekly");
    expect(
      screen.getByRole("heading", { name: "weekly objective 1" }),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Next weekly quest page" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Next weekly quest page" }),
    );
    expect(
      screen.getByRole("heading", { name: "weekly objective 3" }),
    ).toBeVisible();
    tab("Guide");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("midnight UTC");
  });

  it("pages campaign history while keeping account filters and daily/quest tabs", async () => {
    state.tables.rune_delve_runs = Array.from({ length: 8 }, (_, index) => ({
      id: `run-${index}`,
      user_id: "member",
      level_number: index + 1,
      hero_class: "warrior",
      score: 1000 + index,
      enemies_defeated: 2,
      longest_chain: 6,
      dungeon_cleared: true,
      xp_earned: 50,
      last_played_at: `2026-10-${String(index + 10).padStart(2, "0")}`,
      attempts: 2,
      clears: 1,
    }));
    state.tables.rune_delve_runs.push({
      ...state.tables.rune_delve_runs[0],
      id: "private-run",
      user_id: "another-member",
      level_number: 99,
    });
    state.tables.rune_delve_daily_runs = [
      {
        id: "daily",
        user_id: "member",
        daily_date: "2026-10-30",
        score: 3456,
        hero_class: "mage",
        stars: 2,
        kills_count: 17,
      },
    ];
    state.tables.rune_delve_active_quests = [];
    mount(<RuneDelveHistoryPage />);
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(3));
    expect(screen.getByRole("heading", { name: /Level 8/ })).toBeVisible();
    expect(screen.queryByText(/Level 99/)).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Next campaign history page" }),
    );
    expect(screen.getByRole("heading", { name: /Level 5/ })).toBeVisible();
    tab("Daily");
    await waitFor(() => expect(screen.getByText("3,456")).toBeVisible());
    expect(screen.getByRole("tabpanel")).toHaveTextContent("17 kills");
    tab("Quests");
    await waitFor(() =>
      expect(screen.getByText("No quest history yet.")).toBeVisible(),
    );
  });

  it("keeps a failed history read retryable instead of presenting an empty record", async () => {
    state.tables.rune_delve_runs = [
      {
        id: "retry-run",
        user_id: "member",
        level_number: 17,
        hero_class: "warrior",
        score: 1000,
        enemies_defeated: 2,
        longest_chain: 6,
        dungeon_cleared: true,
        xp_earned: 50,
        last_played_at: "2026-10-30",
      },
    ];
    state.failTables = ["rune_delve_runs"];
    mount(<RuneDelveHistoryPage />);
    await waitFor(() =>
      expect(screen.getByText("The dungeon lost your signal")).toBeVisible(),
    );
    expect(
      screen.queryByText("No campaign records yet — start your campaign!"),
    ).toBeNull();
    state.failTables = [];
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /Level 17/ })).toBeVisible(),
    );
    expect(screen.queryByText("The dungeon lost your signal")).toBeNull();
  });
});
