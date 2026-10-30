import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock("@/hooks/useDailyFinds", () => ({
  useCreateFind: () => ({ mutate: mock.mutate, isPending: false }),
}));
vi.mock("@/components/dailyFind/useDropSheetViewport", () => ({
  useDropSheetViewport: () => {},
}));
vi.mock("@/components/chat/ChatBottomSheet", () => ({
  ChatBottomSheet: ({
    open,
    title,
    children,
    onOpenChange,
  }: {
    open: boolean;
    title: string;
    children: React.ReactNode;
    onOpenChange: (open: boolean) => void;
  }) =>
    open ? (
      <section role="dialog" aria-label={title}>
        {children}
        <button onClick={() => onOpenChange(false)}>Close</button>
      </section>
    ) : null,
}));
import { ComposeFindSheet } from "@/components/dailyFind/ComposeFindSheet";
import {
  composeDropContent,
  dropCaptionOverflow,
  pastedDropUrl,
} from "@/components/dailyFind/composeDraft";
beforeEach(() => {
  mock.mutate.mockReset();
  URL.createObjectURL = vi.fn(() => "blob:drop-photo");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => cleanup());
describe("social Drop composition", () => {
  it("infers kind and preserves the existing headline/note limits", () => {
    expect(composeDropContent("A thought\nThe rest", "", false)).toEqual({
      kind: "learned",
      title: "A thought",
      note: "The rest",
    });
    expect(
      composeDropContent("", "https://www.youtube.com/watch?v=abc", false),
    ).toEqual({ kind: "article", title: "Shared from youtube.com", note: "" });
    expect(composeDropContent("", "", true)).toEqual({
      kind: "photo",
      title: "A photo for the club",
      note: "",
    });
    const long = composeDropContent("x".repeat(2500), "", false);
    expect(long.title).toHaveLength(160);
    expect(long.note).toHaveLength(2000);
    expect(dropCaptionOverflow("Short\n" + "x".repeat(2010))).toBe(10);
    expect(pastedDropUrl("https://example.com/video")).toBe(
      "https://example.com/video",
    );
    expect(pastedDropUrl("javascript:alert(1)")).toBeNull();
    expect(pastedDropUrl("Words and https://example.com")).toBeNull();
  });
  it("keeps an unfinished draft when dismissed and does not send on Return", () => {
    const close = vi.fn();
    const view = render(<ComposeFindSheet open onOpenChange={close} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Your Drop" }), {
      target: { value: "Keep this thought" },
    });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Your Drop" }), {
      key: "Enter",
    });
    expect(mock.mutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(close).toHaveBeenCalledWith(false);
    view.rerender(<ComposeFindSheet open={false} onOpenChange={close} />);
    view.rerender(<ComposeFindSheet open onOpenChange={close} />);
    expect(screen.getByRole("textbox", { name: "Your Drop" })).toHaveValue(
      "Keep this thought",
    );
  });
  it("accepts a pasted video link without a type menu or required headline", () => {
    render(<ComposeFindSheet open onOpenChange={vi.fn()} />);
    fireEvent.paste(screen.getByRole("textbox", { name: "Your Drop" }), {
      clipboardData: { getData: () => "https://youtu.be/abcdefghijk" },
    });
    expect(screen.getByRole("textbox", { name: "Drop link" })).toHaveValue(
      "https://youtu.be/abcdefghijk",
    );
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Share Drop" }));
    expect(mock.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "article",
        title: "Shared from youtu.be",
        url: "https://youtu.be/abcdefghijk",
      }),
      expect.any(Object),
    );
  });
  it("prevents duplicate sharing and retains the draft and image after a failure", async () => {
    render(<ComposeFindSheet open onOpenChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Choose Drop photo"), {
      target: {
        files: [new File(["photo"], "photo.png", { type: "image/png" })],
      },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Your Drop" }), {
      target: { value: "A good day" },
    });
    await waitFor(() =>
      expect(
        screen.getByRole("img", { name: "Photo ready to share" }),
      ).toBeVisible(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Share Drop" }));
    fireEvent.click(screen.getByRole("button", { name: "Sharing…" }));
    expect(mock.mutate).toHaveBeenCalledOnce();
    const options = mock.mutate.mock.calls[0][1];
    act(() => {
      options.onError(new Error("Offline"));
      options.onSettled();
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Your draft is ready to retry",
    );
    expect(screen.getByRole("textbox", { name: "Your Drop" })).toHaveValue(
      "A good day",
    );
    expect(
      screen.getByRole("img", { name: "Photo ready to share" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Share Drop" })).toBeEnabled();
  });
});
