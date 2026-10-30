import { StrictMode } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RuneDelveLayout } from "@/components/runedelve/RuneDelveLayout";
import { RouteWipe } from "@/components/runedelve/fx/RouteWipe";

const preferences = vi.hoisted(() => ({ reduced: false, play: vi.fn() }));
vi.mock("framer-motion", () => ({
  useReducedMotion: () => preferences.reduced,
}));
vi.mock("@/hooks/useRuneDelveSfx", () => ({
  useRuneDelveSfx: () => ({ play: preferences.play }),
}));
vi.mock("@/hooks/useQuests", () => ({ useActiveQuests: () => undefined }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "member" } }),
}));
vi.mock("@/components/runedelve/RuneDelveHUD", () => ({
  RuneDelveHUD: () => null,
}));
vi.mock("@/components/runedelve/RuneDelveBoot", () => ({
  RuneDelveBoot: () => null,
}));
vi.mock("@/components/runedelve/RuneWorldScene", () => ({
  RuneWorldScene: () => null,
}));

const frames = new Map<number, FrameRequestCallback>();
let nextFrame = 0;
function visibility(hidden: boolean) {
  act(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: hidden,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
}
function frame() {
  act(() => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback(performance.now()));
  });
}
function Shell() {
  return (
    <StrictMode>
      <MemoryRouter>
        <RuneDelveLayout>
          <button className="rd-btn-juice">Ripple</button>
        </RuneDelveLayout>
      </MemoryRouter>
    </StrictMode>
  );
}
function Travel() {
  const navigate = useNavigate();
  return (
    <>
      <RouteWipe />
      <button onClick={() => navigate("/rune-delve/hero")}>Travel</button>
    </>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  preferences.reduced = false;
  preferences.play.mockClear();
  frames.clear();
  nextFrame = 0;
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
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: false,
  });
});

describe("shell motion lifecycle", () => {
  it("releases pointer and keyboard press feedback without adding another timer", () => {
    render(<Shell />);
    const button = screen.getByRole("button", { name: "Ripple" });
    fireEvent.pointerDown(button);
    expect(button).toHaveAttribute("data-rd-press", "true");
    expect(vi.getTimerCount()).toBe(1);
    fireEvent.pointerUp(window);
    expect(button).not.toHaveAttribute("data-rd-press");
    fireEvent.keyDown(button, { key: "Enter" });
    expect(button).toHaveAttribute("data-rd-press", "true");
    expect(button.style.getPropertyValue("--rd-ripple-x")).toBe("50%");
    fireEvent.keyUp(window, { key: "Enter" });
    expect(button).not.toHaveAttribute("data-rd-press");
    visibility(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("keeps one ripple timer per control and clears it on hide or unmount in StrictMode", () => {
    const view = render(<Shell />);
    expect(document.documentElement).toHaveClass("rd-viewport-active");
    expect(document.body).toHaveClass("rd-viewport-active");
    const button = screen.getByRole("button", { name: "Ripple" });
    fireEvent.pointerDown(button);
    expect(button).toHaveClass("is-rippling");
    expect(vi.getTimerCount()).toBe(1);
    act(() => vi.advanceTimersByTime(300));
    fireEvent.pointerDown(button);
    expect(vi.getTimerCount()).toBe(1);
    act(() => vi.advanceTimersByTime(221));
    expect(button).toHaveClass("is-rippling");
    visibility(true);
    expect(button).not.toHaveClass("is-rippling");
    expect(vi.getTimerCount()).toBe(0);
    visibility(false);
    fireEvent.pointerDown(button);
    view.unmount();
    expect(document.documentElement).not.toHaveClass("rd-viewport-active");
    expect(document.body).not.toHaveClass("rd-viewport-active");
    expect(button).not.toHaveClass("is-rippling");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("suppresses reduced and hidden ripples, responds to preference changes, and preserves tap audio", () => {
    const view = render(<Shell />);
    const button = screen.getByRole("button", { name: "Ripple" });
    fireEvent.pointerDown(button);
    preferences.reduced = true;
    view.rerender(<Shell />);
    expect(button).not.toHaveClass("is-rippling");
    expect(vi.getTimerCount()).toBe(0);
    fireEvent.pointerDown(button);
    expect(button).not.toHaveClass("is-rippling");
    preferences.reduced = false;
    view.rerender(<Shell />);
    visibility(true);
    fireEvent.pointerDown(button);
    expect(button).not.toHaveClass("is-rippling");
    expect(vi.getTimerCount()).toBe(0);
    expect(
      preferences.play.mock.calls.filter(([cue]) => cue === "ui.tap"),
    ).toHaveLength(3);
  });

  it("cancels scheduled doorway light on hide and never replays it on return", () => {
    const view = render(
      <MemoryRouter initialEntries={["/rune-delve"]}>
        <Travel />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Travel" }));
    expect(frames.size).toBe(1);
    expect(vi.getTimerCount()).toBe(1);
    visibility(true);
    expect(frames.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    visibility(false);
    frame();
    expect(view.container.querySelector(".rd-doorway-light")).not.toHaveClass(
      "is-passing",
    );
    expect(preferences.play).toHaveBeenCalledTimes(1);
  });

  it("rechecks visibility inside the frame and clears a running doorway light on hide", () => {
    const view = render(
      <MemoryRouter initialEntries={["/rune-delve"]}>
        <Travel />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Travel" }));
    // A queued frame can encounter a hidden document before the event arrives.
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    frame();
    expect(view.container.querySelector(".rd-doorway-light")).not.toHaveClass(
      "is-passing",
    );
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);

    visibility(false);
    const active = render(
      <MemoryRouter initialEntries={["/rune-delve"]}>
        <Travel />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Travel" }));
    frame();
    expect(active.container.querySelector(".rd-doorway-light")).toHaveClass(
      "is-passing",
    );
    visibility(true);
    expect(active.container.querySelector(".rd-doorway-light")).not.toHaveClass(
      "is-passing",
    );
    expect(vi.getTimerCount()).toBe(0);
  });
});
