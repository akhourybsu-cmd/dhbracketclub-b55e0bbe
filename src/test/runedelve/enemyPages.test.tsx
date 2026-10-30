import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EnemyDisplay } from "@/components/runedelve/EnemyDisplay";

vi.mock("@/components/runedelve/RuneArtwork", () => ({
  RuneEnemyArt: () => <span />,
}));
afterEach(cleanup);

describe("bounded enemy stage", () => {
  it("keeps reinforcements reachable and follows the next real target without growing the stage", () => {
    const enemies = Array.from({ length: 8 }, (_, id) => ({
      id: `foe-${id}`,
      name: `Foe ${id}`,
      emoji: "",
      hp: 100,
      maxHp: 100,
      damage: 5,
    }));
    const view = render(
      <EnemyDisplay enemies={enemies} primaryTargetId="foe-0" />,
    );
    expect(view.container.querySelectorAll("[data-enemy-id]")).toHaveLength(3);
    expect(screen.getByRole("button", { name: /Inspect Foe 0/ })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Next enemies/ }));
    expect(screen.getByRole("button", { name: /Inspect Foe 3/ })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Next enemies/ }));
    expect(screen.getByRole("button", { name: /Inspect Foe 7/ })).toBeVisible();
    view.rerender(<EnemyDisplay enemies={enemies} primaryTargetId="foe-1" />);
    expect(screen.getByRole("button", { name: /Inspect Foe 1/ })).toBeVisible();
    expect(view.container.querySelectorAll("[data-enemy-id]")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: /Inspect Foe 1/ }));
    expect(screen.getByRole("dialog", { name: "Foe 1" })).toBeVisible();
  });
});
