import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CountUp } from "@/components/runedelve/fx/CountUp";

let nextFrame: number;
let frames: Map<number, FrameRequestCallback>;

function advanceFrame(time: number) {
  act(() => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback(time));
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  nextFrame = 0;
  frames = new Map();
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: false,
  });
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((callback: FrameRequestCallback) => {
      const id = ++nextFrame;
      frames.set(id, callback);
      return id;
    }),
  );
  vi.stubGlobal(
    "cancelAnimationFrame",
    vi.fn((id: number) => frames.delete(id)),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: false,
  });
});

describe("Rune score count-up", () => {
  it.each([0, -10])(
    "shows the final formatted score immediately for duration %s",
    (duration) => {
      const onDone = vi.fn();
      const format = (value: number) => value.toLocaleString("en-US");
      const view = render(
        <CountUp
          value={1234}
          duration={duration}
          delay={300}
          format={format}
          onDone={onDone}
        />,
      );
      expect(screen.getByText("1,234")).toBeInTheDocument();
      expect(requestAnimationFrame).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
      expect(onDone).toHaveBeenCalledTimes(1);
      view.rerender(
        <CountUp
          value={2345}
          duration={duration}
          format={format}
          onDone={onDone}
        />,
      );
      expect(screen.getByText("2,345")).toBeInTheDocument();
      expect(onDone).toHaveBeenCalledTimes(2);
    },
  );

  it("commits the exact target after a normal count that starts at frame zero", () => {
    const onDone = vi.fn();
    render(<CountUp value={1234} duration={900} onDone={onDone} />);
    act(() => vi.runOnlyPendingTimers());
    advanceFrame(0);
    advanceFrame(450);
    expect(Number(screen.getByText(/\d+/).textContent)).toBeGreaterThan(0);
    expect(Number(screen.getByText(/\d+/).textContent)).toBeLessThan(1234);
    advanceFrame(900);
    expect(screen.getByText("1234")).toBeInTheDocument();
    expect(frames.size).toBe(0);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it.each(["delay", "count"])(
    "finishes and cancels work when hidden during %s",
    (phase) => {
      const onDone = vi.fn();
      render(
        <CountUp value={1234} duration={900} delay={200} onDone={onDone} />,
      );
      if (phase === "count") {
        act(() => vi.advanceTimersByTime(200));
        advanceFrame(0);
        advanceFrame(200);
        expect(frames.size).toBe(1);
      }
      act(() => {
        Object.defineProperty(document, "hidden", {
          configurable: true,
          value: true,
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      expect(screen.getByText("1234")).toBeInTheDocument();
      expect(frames.size).toBe(0);
      expect(vi.getTimerCount()).toBe(0);
      expect(onDone).toHaveBeenCalledTimes(1);
      act(() => {
        Object.defineProperty(document, "hidden", {
          configurable: true,
          value: false,
        });
        document.dispatchEvent(new Event("visibilitychange"));
        vi.runOnlyPendingTimers();
      });
      expect(frames.size).toBe(0);
      expect(onDone).toHaveBeenCalledTimes(1);
    },
  );
});
