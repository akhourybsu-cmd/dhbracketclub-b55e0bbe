import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DailyFind } from "@/lib/dailyFind";

const fixture = vi.hoisted(() => ({
  imageError: false,
  imageUrl: "/photo.jpg" as string | null,
  retry: vi.fn(),
  navigate: vi.fn(),
  find: null as DailyFind | null,
}));

vi.mock("@/hooks/useDailyFinds", () => ({
  useFindImage: () => ({
    url: fixture.imageUrl,
    error: fixture.imageError,
    retry: fixture.retry,
  }),
  useDailyFind: () => ({ data: fixture.find, isLoading: false }),
  useToggleFindReaction: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  )),
  useNavigate: () => fixture.navigate,
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "member" } }),
}));
vi.mock("@/contexts/ClubContext", () => ({
  useClub: () => ({ club: { id: "club" } }),
}));
vi.mock("@/components/dailyFind/FindShareSheet", () => ({
  FindShareSheet: () => null,
}));
vi.mock("@/components/dailyFind/FindCommentsSheet", () => ({
  FindCommentsSheet: () => null,
}));
vi.mock("@/components/dailyFind/FindLinkPreview", () => ({
  FindLinkPreview: () => null,
}));

import { FindPhoto } from "@/components/dailyFind/FindCard";
import { FindCalendar } from "@/components/dailyFind/FindCalendar";
import { DailyFindShareCard } from "@/components/chat/DailyFindShareCard";

const find: DailyFind = {
  id: "shared-photo",
  club_id: "club",
  user_id: "member",
  find_date: "2020-01-15",
  kind: "photo",
  title: "A photo for the club",
  note: null,
  url: null,
  image_path: "club/member/photo.jpg",
  tags: [],
  created_at: "2020-01-15T12:00:00Z",
  updated_at: "2020-01-15T12:00:00Z",
};

beforeEach(() => {
  fixture.imageError = false;
  fixture.imageUrl = "/photo.jpg";
  fixture.find = find;
  fixture.retry.mockReset();
  fixture.navigate.mockReset();
});
afterEach(() => cleanup());

describe("Drop thumbnail interaction layers", () => {
  it("keeps a failed calendar thumbnail inside one date target", () => {
    fixture.imageError = true;
    fixture.imageUrl = null;
    const selectDay = vi.fn();
    const { container } = render(
      <FindCalendar
        month={new Date(2020, 0, 1)}
        onMonthChange={vi.fn()}
        finds={[find]}
        selectedDay={find.find_date}
        onSelectDay={selectDay}
      />,
    );
    const day = screen.getByRole("button", {
      name: "2020-01-15, 1 finds",
    });
    const fallback = screen.getByRole("img", { name: "Photo unavailable" });
    expect(day).toContainElement(fallback);
    expect(container.querySelector("button button")).toBeNull();
    expect(screen.queryByRole("button", { name: "Load photo" })).toBeNull();
    fireEvent.click(fallback);
    expect(selectDay).toHaveBeenCalledExactlyOnceWith("2020-01-15");
    expect(fixture.retry).not.toHaveBeenCalled();
  });

  it("keeps a decoded-image failure in a shared chat card as one navigation target", () => {
    const { container } = render(<DailyFindShareCard findId={find.id} />);
    fireEvent.error(screen.getByRole("img", { name: "Shared photo" }));
    const fallback = screen.getByRole("img", { name: "Photo unavailable" });
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(container.querySelector("button button")).toBeNull();
    fireEvent.click(fallback);
    expect(fixture.navigate).toHaveBeenCalledExactlyOnceWith(
      "/finds/shared-photo",
    );
    expect(fixture.retry).not.toHaveBeenCalled();
  });

  it("retains an explicit retry for a full photo when signing fails", () => {
    fixture.imageError = true;
    fixture.imageUrl = null;
    render(<FindPhoto path={find.image_path} />);
    fireEvent.click(screen.getByRole("button", { name: "Load photo" }));
    expect(fixture.retry).toHaveBeenCalledOnce();
  });

  it("retries a full-photo decode failure without changing its source", () => {
    render(<FindPhoto path={find.image_path} />);
    fireEvent.error(screen.getByRole("img", { name: "Shared photo" }));
    fireEvent.click(screen.getByRole("button", { name: "Load photo" }));
    expect(fixture.retry).toHaveBeenCalledOnce();
    expect(screen.getByRole("img", { name: "Shared photo" })).toHaveAttribute(
      "src",
      "/photo.jpg",
    );
  });
});
