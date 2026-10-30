import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CombatFeedback,
  BattleStageFeedback,
  TargetFeedback,
} from "@/components/runedelve/CombatFeedback";
import {
  initialCombat,
  useAbility,
  type CombatState,
} from "@/lib/runedelve/combatEngine";
import { advanceResonance } from "@/lib/runedelve/resonance";

const preferences = vi.hoisted(() => ({ reduced: false }));
vi.mock("framer-motion", () => ({
  useReducedMotion: () => preferences.reduced,
}));

const enemy = {
  id: "foe",
  name: "Sentinel",
  emoji: "",
  hp: 100,
  maxHp: 100,
  damage: 4,
};
const marks = (container: HTMLElement) =>
  container.querySelectorAll("[data-rd-feedback]");
function Scene({
  state,
  scope = "encounter",
  abilityRevision,
}: {
  state: CombatState;
  scope?: string;
  abilityRevision?: number;
}) {
  return (
    <CombatFeedback
      state={state}
      cls="warrior"
      scope={scope}
      className="stage"
      abilityRevision={abilityRevision}
    >
      {state.enemies.map((foe) => (
        <TargetFeedback key={foe.id} target={foe.id} />
      ))}
      <TargetFeedback target="hero-health" />
      <TargetFeedback target="hero-mana" />
      <TargetFeedback target="hero-guard" />
      <BattleStageFeedback />
    </CombatFeedback>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  preferences.reduced = false;
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: false,
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: false,
  });
});

describe("committed combat feedback", () => {
  it("keeps restored baselines quiet and emits one defeat for a real HP transition", () => {
    const restored = {
      ...initialCombat([{ ...enemy, hp: 12 }], 10),
      hp: 65,
      mana: 3,
      abilityUsed: true,
    };
    const view = render(<Scene state={restored} />);
    expect(marks(view.container)).toHaveLength(0);
    const after = {
      ...restored,
      enemies: [{ ...enemy, hp: 0 }],
      totalDamage: 12,
      enemiesDefeated: 1,
    };
    view.rerender(<Scene state={after} />);
    expect(
      view.container.querySelectorAll('[data-rd-feedback="defeat"]'),
    ).toHaveLength(1);
    expect(view.container).toHaveTextContent("−12");
    const id = marks(view.container)[0].getAttribute("data-rd-feedback-id");
    view.rerender(<Scene state={{ ...after, enemies: [...after.enemies] }} />);
    expect(marks(view.container)).toHaveLength(1);
    expect(marks(view.container)[0]).toHaveAttribute("data-rd-feedback-id", id);
    act(() => vi.advanceTimersByTime(1101));
    expect(marks(view.container)).toHaveLength(0);
  });

  it("shows a class burst only after a successful committed ability", () => {
    const before = { ...initialCombat([enemy], 10), mana: 3 };
    const view = render(<Scene state={before} />);
    view.rerender(<Scene state={useAbility(before, "warrior").next} />);
    expect(
      view.container.querySelector('[data-rd-feedback="ability"]'),
    ).toHaveTextContent("Cleave");
    expect(
      view.container.querySelector('[data-rd-feedback="damage"]'),
    ).toHaveTextContent("−40");
    act(() => vi.advanceTimersByTime(1101));
    const spent = useAbility(before, "warrior").next;
    view.rerender(<Scene state={useAbility(spent, "warrior").next} />);
    expect(marks(view.container)).toHaveLength(0);
  });

  it("uses the successful-cast counter for repeated free casts and ignores unchanged counters", () => {
    const before = initialCombat([{ ...enemy, hp: 200, maxHp: 200 }], 10);
    const view = render(<Scene state={before} abilityRevision={0} />);
    expect(marks(view.container)).toHaveLength(0);
    const firstFree = useAbility(before, "warrior", null, [], 1, 0).next;
    view.rerender(<Scene state={firstFree} abilityRevision={1} />);
    const firstId = view.container
      .querySelector('[data-rd-feedback="ability"]')
      ?.getAttribute("data-rd-feedback-id");
    expect(firstId).toBeDefined();
    act(() => vi.advanceTimersByTime(1101));
    const secondFree = useAbility(firstFree, "warrior", null, [], 1, 0).next;
    expect(secondFree.mana).toBe(firstFree.mana);
    expect(secondFree.abilityUsed).toBe(firstFree.abilityUsed);
    view.rerender(<Scene state={secondFree} abilityRevision={2} />);
    const secondId = view.container
      .querySelector('[data-rd-feedback="ability"]')
      ?.getAttribute("data-rd-feedback-id");
    expect(secondId).toBeDefined();
    expect(secondId).not.toBe(firstId);
    view.rerender(<Scene state={{ ...secondFree }} abilityRevision={2} />);
    expect(
      view.container.querySelector('[data-rd-feedback="ability"]'),
    ).toHaveAttribute("data-rd-feedback-id", secondId);
    act(() => vi.advanceTimersByTime(1101));
    view.rerender(
      <Scene state={{ ...secondFree, mana: 3 }} abilityRevision={2} />,
    );
    view.rerender(<Scene state={secondFree} abilityRevision={2} />);
    expect(
      view.container.querySelector('[data-rd-feedback="ability"]'),
    ).toBeNull();
  });

  it("reads hero resources and Convergence from the actual engine result", () => {
    const before: CombatState = {
      ...initialCombat([enemy], 10),
      hp: 50,
      resonance: { colors: ["red", "blue", "green"], bursts: 2 },
    };
    const view = render(<Scene state={before} />);
    const converged = advanceResonance(before, "gold").next;
    view.rerender(<Scene state={{ ...converged, hp: 60 }} />);
    for (const kind of ["damage", "heal", "mana", "guard", "convergence"])
      expect(
        view.container.querySelector(`[data-rd-feedback="${kind}"]`),
      ).not.toBeNull();
    expect(
      view.container.querySelector('[data-rd-feedback="ability"]'),
    ).toBeNull();
    expect(
      view.container.querySelector('[data-rd-feedback="heal"]'),
    ).toHaveTextContent("+10");
  });

  it("clears on hide, establishes hidden updates as the baseline, and never replays them", () => {
    const before = initialCombat([enemy], 10);
    const view = render(<Scene state={before} />);
    view.rerender(<Scene state={{ ...before, hp: 90 }} />);
    expect(marks(view.container)).toHaveLength(1);
    act(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(marks(view.container)).toHaveLength(0);
    view.rerender(<Scene state={{ ...before, hp: 80 }} />);
    act(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: false,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(marks(view.container)).toHaveLength(0);
    view.rerender(<Scene state={{ ...before, hp: 75 }} />);
    expect(
      view.container.querySelector('[data-rd-feedback="hurt"]'),
    ).toHaveTextContent("−5");
  });

  it("suppresses reduced-motion effects and resets quietly when encounter identity changes", () => {
    const before = initialCombat([enemy], 10);
    const view = render(<Scene state={before} />);
    preferences.reduced = true;
    view.rerender(<Scene state={{ ...before, hp: 90 }} />);
    expect(marks(view.container)).toHaveLength(0);
    preferences.reduced = false;
    view.rerender(
      <Scene state={{ ...before, hp: 80 }} scope="next-encounter" />,
    );
    expect(marks(view.container)).toHaveLength(0);
    view.rerender(
      <Scene state={{ ...before, hp: 75 }} scope="next-encounter" />,
    );
    expect(marks(view.container)).toHaveLength(1);
  });

  it("caps simultaneous effects and cancels its fallback cleanup on unmount", () => {
    const before = initialCombat(
      Array.from({ length: 24 }, (_, id) => ({ ...enemy, id: `foe-${id}` })),
      10,
    );
    const view = render(<Scene state={before} />);
    view.rerender(
      <Scene
        state={{
          ...before,
          totalDamage: 240,
          enemies: before.enemies.map((foe) => ({ ...foe, hp: 90 })),
        }}
      />,
    );
    expect(marks(view.container)).toHaveLength(12);
    expect(vi.getTimerCount()).toBe(1);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
