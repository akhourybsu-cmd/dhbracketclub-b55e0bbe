import { useRuneRewardReveal } from "@/hooks/useRuneRewardReveal";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RuneRewardProvider,
  type RuneRewardReveal,
} from "@/components/runedelve/RuneRewardReveal";

const state = vi.hoisted(() => ({ userId: "alice" }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: state.userId } }),
}));
const reward: RuneRewardReveal = {
  id: "purchase:ember:1",
  title: "Ember acquired",
  items: [
    {
      kind: "relic",
      relicId: "ember_edge",
      rank: 1,
      label: "Ember Edge",
      detail: "A new flame in your loadout.",
    },
  ],
};
let enqueue: ReturnType<typeof useRuneRewardReveal>["reveal"];
function Actions() {
  const { reveal } = useRuneRewardReveal();
  enqueue = reveal;
  return <button onClick={() => reveal(reward)}>Acquire relic</button>;
}
function view() {
  return (
    <RuneRewardProvider>
      <Actions />
    </RuneRewardProvider>
  );
}
beforeEach(() => {
  sessionStorage.clear();
  state.userId = "alice";
});
afterEach(cleanup);

describe("Centered Rune acquisitions", () => {
  it("centers a confirmed acquisition, focuses Continue and suppresses duplicate receipt events", async () => {
    render(view());
    const opener = screen.getByRole("button", { name: "Acquire relic" });
    opener.focus();
    fireEvent.click(opener);
    expect(
      screen.getByRole("dialog", { name: "Ember acquired" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Ember Edge")).toBeVisible();
    expect(screen.getByRole("button", { name: /Continue/ })).toHaveFocus();
    act(() => enqueue(reward));
    fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(
      JSON.parse(sessionStorage.getItem("rd-reward-seen:v1:alice")!),
    ).toEqual([reward.id]);
    fireEvent.click(opener);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("queues independent receipts and pages all parts of a multi-reward acquisition without scrolling", () => {
    render(view());
    act(() => {
      enqueue(reward);
      enqueue({
        id: "quest:q1",
        title: "Quest complete",
        items: [
          { kind: "shards", label: "Rune Shards", amount: 50 },
          { kind: "xp", label: "Class XP", amount: 25 },
        ],
      });
    });
    expect(screen.getByText("1 more reward")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
    expect(
      screen.getByRole("dialog", { name: "Quest complete" }),
    ).toBeVisible();
    expect(screen.getByText("+50 Rune Shards")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Next acquired rewards page" }),
    );
    expect(screen.getByText("+25 Class XP")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Next acquired rewards page" }),
    ).toBeDisabled();
  });

  it("does not re-celebrate acknowledged rewards when restoring the game shell", () => {
    sessionStorage.setItem(
      "rd-reward-seen:v1:alice",
      JSON.stringify([reward.id]),
    );
    render(view());
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Acquire relic" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("clears a previous account's queue and rejects its late async confirmations", () => {
    const page = render(view());
    const staleEnqueue = enqueue;
    fireEvent.click(screen.getByRole("button", { name: "Acquire relic" }));
    state.userId = "bob";
    page.rerender(view());
    expect(screen.queryByRole("dialog")).toBeNull();
    act(() => staleEnqueue({ ...reward, id: "late:alice" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Acquire relic" }));
    expect(
      screen.getByRole("dialog", { name: "Ember acquired" }),
    ).toBeVisible();
  });

  it("keeps its in-memory receipt protection when optional storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(view());
    fireEvent.click(screen.getByRole("button", { name: "Acquire relic" }));
    fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
    act(() => enqueue(reward));
    expect(screen.queryByRole("dialog")).toBeNull();
    vi.restoreAllMocks();
  });
});
