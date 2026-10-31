import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppDrawer } from "@/components/AppDrawer";
import { NavDrawerProvider, useNavDrawer } from "@/contexts/NavDrawerContext";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ signOut: vi.fn() }),
}));
vi.mock("@/contexts/ClubContext", () => ({
  useClub: () => ({ club: { id: "club", name: "DH Club" } }),
}));
vi.mock("@/hooks/useSoundEffect", () => ({
  useSoundEffect: () => ({ play: vi.fn() }),
}));
vi.mock("@/hooks/useClubAssets", () => ({
  useClubAssets: () => ({
    filterNavPaths: (paths: string[]) => paths,
    installedAssets: [],
    isVisible: () => false,
  }),
}));
vi.mock("@/components/ThemeToggle", () => ({
  ThemeToggle: () => <button>Toggle theme</button>,
}));

function Harness() {
  const { open, setOpen } = useNavDrawer();
  const location = useLocation();
  return (
    <>
      <button onClick={(event) => setOpen(true, event.currentTarget)}>
        Header opener
      </button>
      <button onClick={(event) => setOpen(true, event.currentTarget)}>
        More opener
      </button>
      <output data-testid="route">{location.pathname}</output>
      <AppDrawer open={open} onOpenChange={setOpen} />
    </>
  );
}

function mount() {
  render(
    <MemoryRouter initialEntries={["/compete"]}>
      <NavDrawerProvider>
        <Harness />
      </NavDrawerProvider>
    </MemoryRouter>,
  );
}
afterEach(cleanup);

describe("navigation drawer focus", () => {
  it.each(["More opener", "Header opener"])(
    "restores the actual %s on Escape without scrolling",
    async (label) => {
      mount();
      const opener = screen.getByRole("button", { name: label });
      const other = screen.getByRole("button", {
        name: label === "More opener" ? "Header opener" : "More opener",
      });
      other.focus();
      // Touch activation need not focus its button before opening the sheet.
      fireEvent.click(opener);
      await screen.findByRole("dialog", { name: "Navigation Menu" });
      const focus = vi.spyOn(opener, "focus");
      fireEvent.keyDown(document, { key: "Escape" });
      await waitFor(() => expect(opener).toHaveFocus());
      expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    },
  );

  it("clears the old opener without stealing focus after drawer navigation", async () => {
    mount();
    const opener = screen.getByRole("button", { name: "More opener" });
    fireEvent.click(opener);
    await screen.findByRole("dialog", { name: "Navigation Menu" });
    const focus = vi.spyOn(opener, "focus");
    fireEvent.click(screen.getByRole("link", { name: "Home" }));
    await waitFor(() =>
      expect(screen.getByTestId("route")).toHaveTextContent("/dashboard"),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(focus).not.toHaveBeenCalled();
  });
});
