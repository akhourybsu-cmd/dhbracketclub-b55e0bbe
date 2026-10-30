import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HeroStatusBar } from "@/components/runedelve/HeroStatusBar";
import { initialCombat } from "@/lib/runedelve/combatEngine";

const base = initialCombat(
  [{ id: "foe", name: "Target", emoji: "", hp: 100, maxHp: 100, damage: 1 }],
  10,
);
afterEach(cleanup);

describe("class ability HUD costs", () => {
  it("shows Shadowstep ready at its shared two-mana cost without an override", () => {
    const view = render(
      <HeroStatusBar
        state={{ ...base, mana: 1 }}
        cls="rogue"
        onAbility={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Shadowstep. 1 more mana needed" }),
    ).toBeDisabled();
    view.rerender(
      <HeroStatusBar
        state={{ ...base, mana: 2 }}
        cls="rogue"
        onAbility={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Shadowstep. Ready to cast" }),
    ).toBeEnabled();
    view.rerender(
      <HeroStatusBar
        state={{ ...base, mana: 3, shadowstepActive: true }}
        cls="rogue"
        onAbility={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /Shadowstep\. Primed/ }),
    ).toBeDisabled();
  });

  it("preserves free First Light and Mage Reserve cost overrides", () => {
    const view = render(
      <HeroStatusBar
        state={base}
        cls="rogue"
        manaCost={0}
        onAbility={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Shadowstep. Ready to cast" }),
    ).toBeEnabled();
    expect(screen.getByText("Free cast")).toBeInTheDocument();
    view.rerender(
      <HeroStatusBar
        state={{ ...base, mana: 2 }}
        cls="mage"
        manaCost={2}
        onAbility={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Arc Burst. Ready to cast" }),
    ).toBeEnabled();
  });
});
