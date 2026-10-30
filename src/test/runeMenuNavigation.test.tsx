import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import RuneDelveLevelMapPage from "@/pages/RuneDelveLevelMapPage";

const state = vi.hoisted(() => ({
  progress: undefined as
    | undefined
    | { highest_unlocked_level: number; highest_completed_level: number },
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "member-a" } }),
}));
vi.mock("@/hooks/useRuneDelveHero", () => ({
  useRuneDelveHero: () => ({ data: { class: "mage" }, refetch: vi.fn() }),
}));
vi.mock("@/hooks/useRuneDelveCampaign", () => ({
  useMyProgress: () => ({ data: state.progress, refetch: vi.fn() }),
  useLevelWindow: (start: number, count: number) => ({
    data: Array.from({ length: count }, (_, i) => ({
      level_number: start + i,
      modifiers: {},
    })),
    refetch: vi.fn(),
  }),
}));
function Location() {
  return <p data-testid="path">{useLocation().pathname}</p>;
}
const shell = (
  <MemoryRouter initialEntries={["/rune-delve/levels"]}>
    <Routes>
      <Route path="/rune-delve/levels" element={<RuneDelveLevelMapPage />} />
      <Route path="*" element={<Location />} />
    </Routes>
  </MemoryRouter>
);
afterEach(() => {
  cleanup();
  state.progress = undefined;
});

describe("Dungeon route selection", () => {
  it("follows the loaded class frontier rather than staying on Chapter1", async () => {
    const { rerender } = render(shell);
    state.progress = {
      highest_unlocked_level: 63,
      highest_completed_level: 62,
    };
    rerender(
      <MemoryRouter initialEntries={["/rune-delve/levels"]}>
        <Routes>
          <Route
            path="/rune-delve/levels"
            element={<RuneDelveLevelMapPage />}
          />
          <Route path="*" element={<Location />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(
        (screen.getByRole("combobox", { name: "Chapter" }) as HTMLSelectElement)
          .value,
      ).toBe("2"),
    );
    expect(screen.getByRole("button", { name: /^Level 63 ·/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Level 1 ·/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Level 63 ·/ }));
    expect(screen.getByTestId("path").textContent).toBe("/rune-delve/play/63");
  });
  it("allows previewing a locked stage without allowing play", async () => {
    state.progress = { highest_unlocked_level: 1, highest_completed_level: 0 };
    render(shell);
    fireEvent.click(screen.getByRole("button", { name: "11–20 LOCKED" }));
    expect(
      screen
        .getByRole("button", { name: /^Level 11 ·/ })
        .hasAttribute("disabled"),
    ).toBe(true);
  });
});
