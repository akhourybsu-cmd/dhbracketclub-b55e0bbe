import { StrictMode, useState } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RuneBoard } from "@/components/runedelve/RuneBoard";
import { RuneCell } from "@/components/runedelve/RuneCell";
import type { Cell } from "@/lib/runedelve/boardEngine";
import type { RuneType } from "@/lib/runedelve/dungeonGenerator";

const sound = vi.hoisted(() => ({ play: vi.fn() }));
vi.mock("@/hooks/useSoundEffect", () => ({ useSoundEffect: () => sound }));
vi.mock("sonner", () => ({ toast: vi.fn() }));

const GRID: RuneType[][] = [
  ["red", "red", "red", "blue", "green"],
  ["blue", "blue", "blue", "green", "green"],
  ["green", "green", "green", "gold", "gold"],
  ["gold", "gold", "gold", "red", "red"],
  ["red", "blue", "green", "gold", "red"],
];
const PATH: Cell[] = [
  { r: 0, c: 0 },
  { r: 0, c: 1 },
  { r: 0, c: 2 },
];
const originalAnimate = Object.getOwnPropertyDescriptor(
  Element.prototype,
  "animate",
);
const originalElementFromPoint = Object.getOwnPropertyDescriptor(
  document,
  "elementFromPoint",
);
let hidden = false;
let reduced = false;
let point: Element | null = null;
let mediaListeners: Set<() => void>;
let animations: Array<{ element: Element; cancel: ReturnType<typeof vi.fn> }>;
let animate: ReturnType<typeof vi.fn>;

function RefillBoard({ onCommit }: { onCommit: (chain: Cell[]) => void }) {
  const [grid, setGrid] = useState(GRID);
  return (
    <RuneBoard
      grid={grid}
      onChainComplete={(chain) => {
        onCommit(chain);
        setGrid((previous) =>
          previous.map((row, r) =>
            row.map((type, c) =>
              chain.some((cell) => cell.r === r && cell.c === c)
                ? type === "blue"
                  ? "green"
                  : "blue"
                : type,
            ),
          ),
        );
      }}
    />
  );
}

function cell(container: HTMLElement, r: number, c: number) {
  const button = container.querySelector<HTMLButtonElement>(
    `button[data-r="${r}"][data-c="${c}"]`,
  );
  if (!button) throw new Error(`Missing rune at ${r},${c}`);
  return button;
}
function choosePath(container: HTMLElement) {
  for (const { r, c } of PATH) fireEvent.click(cell(container, r, c));
}
function dragPath(container: HTMLElement) {
  fireEvent.pointerDown(cell(container, 0, 0));
  for (const c of [1, 2]) {
    // Pointer hits on decorative SVGs still belong to their rune button.
    point = cell(container, 0, c).querySelector("svg");
    fireEvent.pointerMove(window, { clientX: c * 20, clientY: 10 });
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  hidden = false;
  reduced = false;
  point = null;
  mediaListeners = new Set();
  animations = [];
  localStorage.setItem("rd-control-mode-v1", "tap");
  vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query) =>
      ({
        media: query,
        get matches() {
          return query.includes("prefers-reduced-motion") && reduced;
        },
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: (_event: string, listener: () => void) =>
          mediaListeners.add(listener),
        removeEventListener: (_event: string, listener: () => void) =>
          mediaListeners.delete(listener),
        dispatchEvent: () => true,
      }) as unknown as MediaQueryList,
  );
  animate = vi.fn(function (this: Element) {
    const cancel = vi.fn();
    animations.push({ element: this, cancel });
    return { cancel } as unknown as Animation;
  });
  Object.defineProperty(Element.prototype, "animate", {
    configurable: true,
    value: animate,
  });
  Object.defineProperty(document, "elementFromPoint", {
    configurable: true,
    value: () => point,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.removeItem("rd-control-mode-v1");
  if (originalAnimate)
    Object.defineProperty(Element.prototype, "animate", originalAnimate);
  else Reflect.deleteProperty(Element.prototype, "animate");
  if (originalElementFromPoint)
    Object.defineProperty(
      document,
      "elementFromPoint",
      originalElementFromPoint,
    );
  else Reflect.deleteProperty(document, "elementFromPoint");
});

describe("Rune board visual effects preserve input", () => {
  it("commits once in StrictMode and retains all 25 rune buttons through refill", () => {
    const commit = vi.fn();
    const { container } = render(
      <StrictMode>
        <RefillBoard onCommit={commit} />
      </StrictMode>,
    );
    const buttons = [
      ...container.querySelectorAll<HTMLButtonElement>(
        "button[data-r][data-c]",
      ),
    ];
    expect(buttons).toHaveLength(25);
    expect(animate).not.toHaveBeenCalled();
    choosePath(container);
    expect(
      container.querySelectorAll('[data-rune-cell][aria-pressed="true"]'),
    ).toHaveLength(3);
    const cast = screen.getByRole("button", { name: "Cast" });
    fireEvent.click(cast);
    fireEvent.click(cast);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(PATH);
    expect(cast).toBeDisabled();
    expect(
      container.querySelectorAll('[data-rune-cell][aria-pressed="true"]'),
    ).toHaveLength(0);
    const after = [
      ...container.querySelectorAll<HTMLButtonElement>(
        "button[data-r][data-c]",
      ),
    ];
    expect(after).toHaveLength(25);
    after.forEach((button, index) => expect(button).toBe(buttons[index]));
    expect(cell(container, 0, 0)).toHaveAccessibleName("Mana rune");
    expect(animations.length).toBeGreaterThan(0);
    expect(
      animations.every(({ element }) => element.closest("button") !== element),
    ).toBe(true);
    expect(container.querySelector('[data-cast-fx="true"]')).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    act(() => {
      vi.advanceTimersByTime(621);
    });
    expect(container.querySelector('[data-cast-fx="true"]')).toBeNull();
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it.each(["pointercancel", "blur"] as const)(
    "%s discards a drag before a later pointerup",
    (event) => {
      const commit = vi.fn();
      const { container } = render(
        <RuneBoard grid={GRID} onChainComplete={commit} />,
      );
      fireEvent.click(screen.getByRole("button", { name: "Drag" }));
      dragPath(container);
      expect(
        container.querySelectorAll('[data-rune-cell][aria-pressed="true"]'),
      ).toHaveLength(3);
      fireEvent(window, new Event(event));
      fireEvent.pointerUp(window);
      expect(commit).not.toHaveBeenCalled();
      expect(
        container.querySelectorAll('[data-rune-cell][aria-pressed="true"]'),
      ).toHaveLength(0);
      expect(container.querySelector('[data-cast-fx="true"]')).toBeNull();
      dragPath(container);
      fireEvent.pointerUp(window);
      fireEvent.pointerUp(window);
      expect(commit).toHaveBeenCalledTimes(1);
      expect(commit).toHaveBeenCalledWith(PATH);
    },
  );

  it.each(["hidden", "reduced"] as const)(
    "cancels active effects when %s and does not replay them on return",
    (reason) => {
      const commit = vi.fn();
      const { container, unmount } = render(<RefillBoard onCommit={commit} />);
      const baselineTimers = vi.getTimerCount();
      expect(container.querySelector(".rd-rune-board")).toHaveAttribute(
        "data-motion",
        "full",
      );
      choosePath(container);
      fireEvent.click(screen.getByRole("button", { name: "Cast" }));
      expect(animations.length).toBeGreaterThan(0);
      expect(container.querySelector('[data-cast-fx="true"]')).not.toBeNull();
      const animationCount = animate.mock.calls.length;
      act(() => {
        if (reason === "hidden") {
          hidden = true;
          document.dispatchEvent(new Event("visibilitychange"));
        } else {
          reduced = true;
          mediaListeners.forEach((listener) => listener());
        }
      });
      expect(container.querySelector(".rd-rune-board")).toHaveAttribute(
        "data-motion",
        "reduced",
      );
      expect(container.querySelector('[data-cast-fx="true"]')).toBeNull();
      expect(
        animations.every(({ cancel }) => cancel.mock.calls.length > 0),
      ).toBe(true);
      expect(vi.getTimerCount()).toBeLessThanOrEqual(baselineTimers);
      expect(commit).toHaveBeenCalledTimes(1);
      act(() => {
        if (reason === "hidden") {
          hidden = false;
          document.dispatchEvent(new Event("visibilitychange"));
        } else {
          reduced = false;
          mediaListeners.forEach((listener) => listener());
        }
        vi.advanceTimersByTime(1000);
      });
      expect(container.querySelector(".rd-rune-board")).toHaveAttribute(
        "data-motion",
        "full",
      );
      expect(animate).toHaveBeenCalledTimes(animationCount);
      expect(commit).toHaveBeenCalledTimes(1);
      unmount();
      expect(mediaListeners.size).toBe(0);
      expect(vi.getTimerCount()).toBeLessThanOrEqual(baselineTimers);
    },
  );

  it("keeps a reduced-motion cast functional without starting cosmetic effects", () => {
    reduced = true;
    const commit = vi.fn();
    const { container } = render(
      <StrictMode>
        <RefillBoard onCommit={commit} />
      </StrictMode>,
    );
    const baselineTimers = vi.getTimerCount();
    expect(container.querySelector(".rd-rune-board")).toHaveAttribute(
      "data-motion",
      "reduced",
    );
    choosePath(container);
    fireEvent.click(screen.getByRole("button", { name: "Cast" }));
    expect(commit).toHaveBeenCalledTimes(1);
    expect(cell(container, 0, 0)).toHaveAccessibleName("Mana rune");
    expect(animate).not.toHaveBeenCalled();
    expect(container.querySelector('[data-cast-fx="true"]')).toBeNull();
    expect(vi.getTimerCount()).toBeLessThanOrEqual(baselineTimers);
  });

  it("cancels arrival animations and cast cleanup timers on unmount", () => {
    const { container, unmount } = render(<RefillBoard onCommit={vi.fn()} />);
    const baselineTimers = vi.getTimerCount();
    choosePath(container);
    fireEvent.click(screen.getByRole("button", { name: "Cast" }));
    expect(animations.length).toBeGreaterThan(0);
    expect(vi.getTimerCount()).toBeGreaterThan(baselineTimers);
    unmount();
    expect(animations.every(({ cancel }) => cancel.mock.calls.length > 0)).toBe(
      true,
    );
    expect(mediaListeners.size).toBe(0);
    expect(vi.getTimerCount()).toBeLessThanOrEqual(baselineTimers);
  });
});

describe("Rune state accessibility", () => {
  it.each([
    ["red", "Attack"],
    ["blue", "Mana"],
    ["green", "Heal"],
    ["gold", "Guard"],
  ] as const)(
    "retains the %s identity and all combined state information",
    (type, name) => {
      const click = vi.fn();
      const { rerender } = render(
        <RuneCell type={type} dataR={0} dataC={0} onClick={click} />,
      );
      const button = screen.getByRole("button", { name: `${name} rune` });
      rerender(
        <RuneCell
          type={type}
          dataR={0}
          dataC={0}
          onClick={click}
          sealed
          corrupted
          corruptionSource
          linked
          eclipsed
          shifting
          treasure
          hazard
          selected
          selectionOrder={2}
        />,
      );
      expect(screen.getByRole("button")).toBe(button);
      for (const state of [
        "Sealed",
        "Corruption source on",
        "Linked",
        "Eclipsed",
        `${name} rune`,
        "cannot start chain",
        "shifting column",
        "treasure chamber cell",
        "hazard chamber cell",
      ]) {
        expect(button.getAttribute("aria-label")).toContain(state);
      }
      expect(button).toBeDisabled();
      expect(button).not.toHaveAttribute("data-rune-cell");
      expect(button).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByText("2")).toHaveAttribute("aria-hidden", "true");
      expect(
        [...button.querySelectorAll("svg")].every(
          (svg) => svg.getAttribute("aria-hidden") === "true",
        ),
      ).toBe(true);
      fireEvent.click(button);
      expect(click).not.toHaveBeenCalled();
      rerender(
        <RuneCell
          type={type}
          dataR={0}
          dataC={0}
          onClick={click}
          corrupted
          linked
          eclipsed
          shifting
          treasure
          hazard
        />,
      );
      expect(button).toBeEnabled();
      expect(button.getAttribute("aria-label")).toContain("Corrupted");
      expect(button.getAttribute("aria-label")).toContain("Linked");
      expect(button.getAttribute("aria-label")).toContain("Eclipsed");
    },
  );
});
