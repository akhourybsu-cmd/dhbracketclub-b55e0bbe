import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HowToPlaySheet } from "@/components/runedelve/HowToPlaySheet";
import { CodexSheet } from "@/components/runedelve/CodexSheet";
import { RunModifierPicker } from "@/components/runedelve/RunModifierPicker";
import { PathVariantPicker } from "@/components/runedelve/PathVariantPicker";
import { RelicUpgradeSheet } from "@/components/runedelve/RelicUpgradeSheet";
import { RUN_MODIFIERS } from "@/lib/runedelve/runModifiers";
import { PATH_VARIANTS } from "@/lib/runedelve/pathVariants";
import { RELIC_BY_ID, RELIC_CATALOG } from "@/lib/runedelve/relics";

vi.mock("@/hooks/useSheetSfx", () => ({ useSheetSfx: () => undefined }));
vi.mock("@/hooks/useRuneDelveHero", () => ({
  useRuneDelveHero: () => ({ data: { class: "mage" } }),
}));
vi.mock("@/hooks/useRuneDelveClassProgress", () => ({
  useAllClassProgress: () => ({ data: [{ class: "mage", level: 15 }] }),
}));
vi.mock("@/hooks/useRuneDelveCampaign", () => ({
  useMyProgress: () => ({ data: { highest_unlocked_level: 150 } }),
}));
vi.mock("@/hooks/useDailyChallenge", () => ({
  useTodayDaily: () => ({ dateStr: "2026-10-30", timeLimitSec: 120 }),
  useMyDailyStreak: () => ({
    data: { current_streak: 2, best_streak: 3, lifetime_clears: 5 },
  }),
}));
afterEach(cleanup);

function HelpHarness() {
  const [open, setOpen] = useState(false);
  return (
    <MemoryRouter>
      <button onClick={() => setOpen(true)}>Open lesson</button>
      <HowToPlaySheet open={open} onOpenChange={setOpen} heroClass="mage" />
    </MemoryRouter>
  );
}

describe("Rune Delve explicit dialog pages", () => {
  it("makes every lesson reachable and restores keyboard focus to its opener", async () => {
    render(<HelpHarness />);
    const opener = screen.getByRole("button", { name: "Open lesson" });
    opener.focus();
    fireEvent.click(opener);
    expect(
      screen.getByRole("heading", { name: "Connect 3 or more" }),
    ).toBeVisible();
    const next = () =>
      fireEvent.click(
        screen.getByRole("button", { name: "Next how to play page" }),
      );
    next();
    expect(screen.getByRole("heading", { name: /Guard/ })).toBeVisible();
    next();
    expect(
      screen.getByRole("heading", { name: "Watch the enemy" }),
    ).toBeVisible();
    next();
    expect(
      screen.getByRole("heading", { name: "Charge all four sigils" }),
    ).toBeVisible();
    next();
    expect(screen.getByRole("link", { name: /Explore class/ })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Next how to play page" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Ready to delve" }));
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it("browses bargains without choosing until the explicit action is pressed", () => {
    const pick = vi.fn();
    const skip = vi.fn();
    render(
      <RunModifierPicker
        offer={RUN_MODIFIERS.slice(0, 3)}
        onPick={pick}
        onSkip={skip}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Next chamber bargains page" }),
    );
    expect(pick).not.toHaveBeenCalled();
    expect(skip).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: `Choose ${RUN_MODIFIERS[1].name}` }),
    );
    expect(pick).toHaveBeenCalledExactlyOnceWith(RUN_MODIFIERS[1]);
  });

  it("keeps all path choices reachable without triggering navigation in preview", () => {
    const pick = vi.fn();
    render(
      <PathVariantPicker levelNumber={150} onPick={pick} onClose={vi.fn()} />,
    );
    for (let index = 0; index < PATH_VARIANTS.length - 1; index++)
      fireEvent.click(
        screen.getByRole("button", { name: "Next milestone paths page" }),
      );
    expect(pick).not.toHaveBeenCalled();
    expect(screen.getByText("Enemy HP +25%")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Choose Elite Path" }));
    expect(pick).toHaveBeenCalledExactlyOnceWith(PATH_VARIANTS[2]);
  });

  it("compares owned and next relic ranks before an explicit paid upgrade", () => {
    const confirm = vi.fn();
    render(
      <RelicUpgradeSheet
        open
        onOpenChange={vi.fn()}
        relic={RELIC_BY_ID.ember_edge}
        currentRank={2}
        shards={1000}
        onConfirm={confirm}
      />,
    );
    expect(
      screen.getByText(/First red chain each run deals \+55%/),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Next relic comparison page" }),
    );
    expect(
      screen.getByText(/First red chain each run deals \+60%/),
    ).toBeVisible();
    expect(confirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Upgrade to R3/ }));
    expect(confirm).toHaveBeenCalledOnce();
  });

  it("paginates the entire Codex relic collection and resets the page on tab changes", () => {
    render(
      <MemoryRouter>
        <CodexSheet open onOpenChange={vi.fn()} />
      </MemoryRouter>,
    );
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Relics" }));
    for (let index = 0; index < RELIC_CATALOG.length; index++) {
      expect(
        screen.getByRole("heading", {
          name: new RegExp(
            RELIC_CATALOG[index].name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          ),
        }),
      ).toBeVisible();
      if (index < RELIC_CATALOG.length - 1)
        fireEvent.click(
          screen.getByRole("button", { name: "Next codex relics page" }),
        );
    }
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Daily" }));
    expect(
      screen.getByRole("heading", { name: "Endless Survival" }),
    ).toBeVisible();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Masteries" }));
    expect(
      screen.getByRole("heading", { name: /Mage · Level 15/ }),
    ).toBeVisible();
  });
});
