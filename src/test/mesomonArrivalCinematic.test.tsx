import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArrivalCinematic } from "@/components/mesomon/ArrivalCinematic";

function setup(reducedMotion = false) {
  const finish = vi.fn();
  const view = render(<StrictMode><ArrivalCinematic reducedMotion={reducedMotion} onFinish={finish} /></StrictMode>);
  return { ...view, finish, dialog: screen.getByRole("dialog", { name: "Opening cinematic" }) };
}
function elapse(ms: number) {
  act(() => { vi.advanceTimersByTime(ms); });
}
function hidden(value: boolean) {
  Object.defineProperty(document, "hidden", { configurable: true, value });
  fireEvent(document, new Event("visibilitychange"));
}

beforeEach(() => { vi.useFakeTimers(); hidden(false); });
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Reflect.deleteProperty(document, "hidden");
});

describe("Port Marche opening cinematic", () => {
  it("shows three illustrated scenes before handing over once", () => {
    const { dialog, finish } = setup();
    expect(dialog).toHaveFocus();
    expect(dialog).toHaveAttribute("data-shot", "sea");
    expect(screen.getByText(/I left at sixteen to chart the coast/)).toBeVisible();
    elapse(7200);
    expect(dialog).toHaveAttribute("data-shot", "letter");
    expect(screen.getByRole("heading", { name: "“Come home. Bring the core.”" })).toBeVisible();
    expect(screen.getByText(/The harbor is singing in two voices/)).toBeVisible();
    elapse(5900);
    expect(dialog).toHaveAttribute("data-shot", "quay");
    expect(screen.getByRole("heading", { name: "Port Marche" })).toBeVisible();
    expect(screen.getByText(/took the first boat home/)).toBeVisible();
    elapse(6700);
    fireEvent.click(screen.getByRole("button", { name: "Skip opening" }));
    expect(finish).toHaveBeenCalledTimes(1);
  });

  it("keeps elapsed reading time through backgrounding and manual pause", () => {
    const { dialog } = setup();
    elapse(1100);
    hidden(true);
    elapse(60000);
    expect(dialog).toHaveAttribute("data-shot", "sea");
    hidden(false);
    elapse(1000);
    fireEvent.click(screen.getByRole("button", { name: "Pause opening" }));
    elapse(10000);
    expect(dialog).toHaveAttribute("data-shot", "sea");
    fireEvent.click(screen.getByRole("button", { name: "Play opening" }));
    elapse(5099);
    expect(dialog).toHaveAttribute("data-shot", "sea");
    elapse(1);
    expect(dialog).toHaveAttribute("data-shot", "letter");
  });

  it("lets reduced-motion readers advance every still at their own pace", () => {
    const { dialog, finish } = setup(true);
    expect(dialog).toHaveAttribute("data-still");
    expect(screen.queryByRole("button", { name: "Pause opening" })).toBeNull();
    elapse(30000);
    expect(dialog).toHaveAttribute("data-shot", "sea");
    fireEvent.click(screen.getByRole("button", { name: "Next scene" }));
    expect(dialog).toHaveAttribute("data-shot", "letter");
    fireEvent.keyDown(dialog, { key: "z" });
    fireEvent.keyUp(dialog, { key: "z" });
    expect(dialog).toHaveAttribute("data-shot", "quay");
    fireEvent.click(screen.getByRole("button", { name: "Arrive at Port Marche" }));
    expect(finish).toHaveBeenCalledOnce();
  });

  it("consumes game keys and skips on release without repeating the entry key", () => {
    const { dialog, finish } = setup();
    const fieldKey = vi.fn();
    window.addEventListener("keydown", fieldKey);
    try {
      fireEvent.keyUp(dialog, { key: "Enter" });
      expect(dialog).toHaveAttribute("data-shot", "sea");
      fireEvent.keyDown(dialog, { key: "Escape" });
      fireEvent.keyDown(dialog, { key: "Escape", repeat: true });
      expect(fieldKey).not.toHaveBeenCalled();
      expect(finish).not.toHaveBeenCalled();
      fireEvent.keyUp(dialog, { key: "Escape" });
      expect(finish).toHaveBeenCalledOnce();
    } finally {
      window.removeEventListener("keydown", fieldKey);
    }
  });

  it("wraps keyboard focus and cancels the timer when the player leaves", () => {
    const { dialog, finish, unmount } = setup();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(screen.getByRole("button", { name: "Next scene" })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: "Tab" });
    expect(screen.getByRole("button", { name: "Skip opening" })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: "Enter" });
    fireEvent.keyUp(document.activeElement!, { key: "Enter" });
    expect(finish).toHaveBeenCalledOnce();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    elapse(60000);
    expect(finish).toHaveBeenCalledOnce();
  });
});
