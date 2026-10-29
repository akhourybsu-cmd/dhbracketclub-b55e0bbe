import React, { useState } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ upload: vi.fn(), mobile: false }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { storage: { from: () => ({ upload: mocks.upload }) } },
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => mocks.mobile }));
vi.mock("@/lib/gifProvider", () => ({ isGifProviderConfigured: () => false }));
import { MessageComposer } from "@/components/chat/MessageComposer";
function Composer({ send }: { send: ReturnType<typeof vi.fn> }) {
  const [value, setValue] = useState("Keep this draft");
  return (
    <MessageComposer
      value={value}
      onChange={setValue}
      onSend={send}
      userId="member"
    />
  );
}
beforeEach(() => {
  mocks.mobile = false;
  mocks.upload
    .mockReset()
    .mockResolvedValue({ data: { path: "file" }, error: null });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) =>
    setTimeout(() => fn(0), 0),
  );
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }),
  });
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("chat composer safety", () => {
  it("keeps an attachment after a rejected send and reuses its upload on retry", async () => {
    const send = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    const { container } = render(<Composer send={send} />);
    fireEvent.change(container.querySelectorAll("input[type=file]")[2], {
      target: {
        files: [
          new File(["%PDF-1.4"], "plan.pdf", { type: "application/pdf" }),
        ],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(send).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Remove file" })).toBeEnabled(),
    );
    expect(screen.getByText("plan.pdf")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveValue(
      "Keep this draft",
    );
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Remove file" }),
      ).not.toBeInTheDocument(),
    );
    expect(mocks.upload).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledTimes(2);
  });
  it("never publishes partial attachments when an upload fails", async () => {
    mocks.upload.mockResolvedValue({
      data: null,
      error: { message: "network failure" },
    });
    const send = vi.fn(),
      { container } = render(<Composer send={send} />);
    fireEvent.change(container.querySelectorAll("input[type=file]")[2], {
      target: {
        files: [new File(["%PDF"], "plan.pdf", { type: "application/pdf" })],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Remove file" })).toBeEnabled(),
    );
    expect(send).not.toHaveBeenCalled();
    expect(screen.getByText("plan.pdf")).toBeInTheDocument();
  });
  it("locks an in-flight send against repeated activation", async () => {
    let settle: (value: boolean) => void;
    const send = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          settle = resolve;
        }),
    );
    render(<Composer send={send} />);
    const button = screen.getByRole("button", { name: "Send message" });
    act(() => {
      fireEvent.click(button);
      fireEvent.click(button);
    });
    expect(send).toHaveBeenCalledOnce();
    await act(async () => {
      settle(true);
    });
  });
  it("leaves IME confirmation and phone Return to the input", () => {
    mocks.mobile = true;
    const send = vi.fn();
    render(<Composer send={send} />);
    const input = screen.getByRole("textbox", { name: "Message" });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(send).not.toHaveBeenCalled();
  });
});
