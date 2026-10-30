import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRuneViewport } from "@/hooks/useRuneViewport";
import { RunePager } from "@/components/runedelve/RunePager";
import { RuneSoundSettings } from "@/components/runedelve/RuneSoundSettings";
import { getSoundSettings } from "@/hooks/useSoundSettings";

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("viewport game controls", () => {
  it("keeps bounded pages reachable and announces the current page", () => {
    const change = vi.fn();
    const view = render(
      <RunePager page={0} pageCount={3} onPageChange={change} label="Relics" />,
    );
    expect(
      screen.getByRole("button", { name: "Previous relics page" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Next relics page" }));
    expect(change).toHaveBeenCalledExactlyOnceWith(1);
    view.rerender(
      <RunePager page={2} pageCount={3} onPageChange={change} label="Relics" />,
    );
    expect(
      screen.getByRole("button", { name: "Next relics page" }),
    ).toBeDisabled();
    expect(screen.getByRole("navigation")).toHaveTextContent("3 / of 3");
    fireEvent.click(
      screen.getByRole("button", { name: "Previous relics page" }),
    );
    expect(change).toHaveBeenLastCalledWith(1);
    view.rerender(<RunePager page={8} pageCount={1} onPageChange={change} />);
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("tracks visible keyboard height and orientation and cancels queued resize work", () => {
    const frames = new Map<number, FrameRequestCallback>();
    let id = 0;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.set(++id, callback);
      return id;
    });
    vi.stubGlobal("cancelAnimationFrame", (key: number) => frames.delete(key));
    const visual = new EventTarget() as EventTarget & { height: number };
    visual.height = 844;
    vi.stubGlobal("visualViewport", visual);
    vi.stubGlobal("innerWidth", 390);
    const view = renderHook(useRuneViewport);
    expect(view.result.current).toMatchObject({
      width: 390,
      height: 844,
      short: false,
      landscape: false,
    });
    act(() => {
      vi.stubGlobal("innerWidth", 844);
      visual.height = 390;
      visual.dispatchEvent(new Event("resize"));
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((callback) => callback(0));
    });
    expect(view.result.current).toMatchObject({
      width: 844,
      height: 390,
      short: true,
      landscape: true,
    });
    visual.dispatchEvent(new Event("resize"));
    expect(frames.size).toBe(1);
    view.unmount();
    expect(frames.size).toBe(0);
  });

  it("keeps persisted audio categories accessible on the compact settings panels", () => {
    render(<RuneSoundSettings />);
    fireEvent.click(screen.getByRole("switch", { name: "Background Music" }));
    expect(localStorage.getItem("dh-club-music-enabled-v1")).toBe("true");
    fireEvent.click(screen.getByRole("switch", { name: "Master Sound" }));
    expect(getSoundSettings().master).toBe(false);
    expect(
      screen.getByRole("switch", { name: "Haptics (Vibration)" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("switch", { name: "Master Sound" }));
    const tab = screen.getByRole("tab", { name: "Effects" });
    fireEvent.mouseDown(tab, { button: 0, ctrlKey: false });
    fireEvent.click(screen.getByRole("switch", { name: "Combat" }));
    expect(getSoundSettings().categories.combat).toBe(false);
    expect(getSoundSettings().categories.rewards).toBe(true);
    fireEvent.click(
      screen.getByRole("button", { name: "Reset sound settings to defaults" }),
    );
    expect(getSoundSettings().categories.combat).toBe(true);
    expect(localStorage.getItem("dh-club-music-enabled-v1")).toBe("false");
  });
});
