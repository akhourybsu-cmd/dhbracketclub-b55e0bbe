import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RuneMenuTabs } from "@/components/runedelve/RuneMenuTabs";

afterEach(cleanup);
function Menu() {
  const [view, setView] = useState<"loadout" | "relics" | "stats">("loadout");
  return (
    <>
      <RuneMenuTabs
        id="test-armory"
        label="Armory view"
        panelId="test-panel"
        value={view}
        onChange={setView}
        options={
          [
            { value: "loadout", label: "Loadout" },
            { value: "relics", label: "Collection" },
            { value: "stats", label: "Combat stats" },
          ] as const
        }
      />
      <div
        role="tabpanel"
        id="test-panel"
        aria-labelledby={`test-armory-${view}`}
      >
        {view}
      </div>
    </>
  );
}

describe("Rune game menu tabs", () => {
  it("uses one tab stop and wraps keyboard selection without scrolling the screen", () => {
    render(<Menu />);
    const first = screen.getByRole("tab", { name: "Loadout" });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowLeft" });
    const last = screen.getByRole("tab", { name: "Combat stats" });
    expect(last).toHaveFocus();
    expect(last).toHaveAttribute("aria-selected", "true");
    expect(first).toHaveAttribute("tabindex", "-1");
    expect(
      screen.getByRole("tabpanel", { name: "Combat stats" }),
    ).toHaveTextContent("stats");
    fireEvent.keyDown(last, { key: "ArrowRight" });
    expect(first).toHaveFocus();
    expect(first).toHaveAttribute("tabindex", "0");
  });

  it("supports direct choices and Home/End while preserving a linked active panel", () => {
    render(<Menu />);
    const collection = screen.getByRole("tab", { name: "Collection" });
    fireEvent.click(collection);
    expect(
      screen.getByRole("tabpanel", { name: "Collection" }),
    ).toHaveTextContent("relics");
    fireEvent.keyDown(collection, { key: "End" });
    expect(screen.getByRole("tab", { name: "Combat stats" })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: "Home" });
    expect(screen.getByRole("tab", { name: "Loadout" })).toHaveFocus();
    expect(
      screen.getAllByRole("tab").filter((tab) => tab.tabIndex === 0),
    ).toHaveLength(1);
    expect(screen.getByRole("tabpanel", { name: "Loadout" })).toHaveAttribute(
      "id",
      "test-panel",
    );
  });
});
