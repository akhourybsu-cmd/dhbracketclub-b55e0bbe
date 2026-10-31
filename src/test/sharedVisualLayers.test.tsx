import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileAppHeader } from "@/components/mobile/MobileAppHeader";

vi.mock("@/components/NotificationBell", () => ({
  NotificationBell: () => <button aria-label="Notifications" />,
}));

beforeEach(() => {
  document.body.scrollTop = 0;
  document.documentElement.scrollTop = 0;
  vi.spyOn(window, "scrollY", "get").mockReturnValue(0);
});
afterEach(() => {
  cleanup();
  document.body.scrollTop = 0;
  document.documentElement.scrollTop = 0;
  vi.restoreAllMocks();
});

describe("shared mobile visual layers", () => {
  it("connects the header's raised surface to actual body scrolling", () => {
    render(
      <MemoryRouter initialEntries={["/finds"]}>
        <MobileAppHeader title="The Drop" onOpenMenu={vi.fn()} />
      </MemoryRouter>,
    );
    const header = screen.getByRole("banner");
    expect(header).toHaveAttribute("data-scrolled", "false");
    document.body.scrollTop = 160;
    fireEvent.scroll(document.body);
    expect(window.scrollY).toBe(0);
    expect(header).toHaveAttribute("data-scrolled", "true");
    expect(header).toHaveClass("border-border/50");
    document.body.scrollTop = 0;
    fireEvent.scroll(document.body);
    expect(header).toHaveAttribute("data-scrolled", "false");
    expect(header).toHaveClass("border-transparent");
  });

  it("does not treat an inner panel's scroll as page scrolling", () => {
    render(
      <MemoryRouter initialEntries={["/finds"]}>
        <MobileAppHeader title="The Drop" onOpenMenu={vi.fn()} />
        <div data-testid="inner-panel" />
      </MemoryRouter>,
    );
    const panel = screen.getByTestId("inner-panel");
    panel.scrollTop = 100;
    fireEvent.scroll(panel);
    expect(screen.getByRole("banner")).toHaveAttribute("data-scrolled", "false");
  });
});
