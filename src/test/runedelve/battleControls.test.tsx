import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HeroStatusBar } from "@/components/runedelve/HeroStatusBar";
import { initialCombat } from "@/lib/runedelve/combatEngine";

afterEach(cleanup);

describe("battle ability controls", () => {
  it("allows a First Light free cast with an empty mana pool", () => {
    const cast = vi.fn();
    render(
      <HeroStatusBar
        state={initialCombat([], 15)}
        cls="mage"
        onAbility={cast}
        manaCost={0}
      />,
    );
    const button = screen.getByRole("button", { name: /Ready to cast/ });
    expect(button).toBeEnabled();
    expect(button).toHaveTextContent("Free cast");
    fireEvent.click(button);
    expect(cast).toHaveBeenCalledTimes(1);
  });

  it("shows primed Shadowstep and prevents spending mana to prime it again", () => {
    const cast = vi.fn();
    render(
      <HeroStatusBar
        state={{ ...initialCombat([], 15), mana: 3, shadowstepActive: true }}
        cls="rogue"
        onAbility={cast}
      />,
    );
    const button = screen.getByRole("button", { name: /Primed/ });
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Next attack ×2");
    fireEvent.click(button);
    expect(cast).not.toHaveBeenCalled();
  });
});
