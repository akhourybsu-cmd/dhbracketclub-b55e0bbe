import { measureChatViewport } from "@/hooks/useChatViewport";

describe("chat mobile viewport measurements", () => {
  it("reserves the bottom navigation without changing keyboard detection", () => {
    expect(
      measureChatViewport({
        layoutHeight: 844,
        visualHeight: 844,
        bottomInset: 70,
      }),
    ).toEqual({ height: 774, keyboardOpen: false });
    expect(
      measureChatViewport({
        layoutHeight: 844,
        visualHeight: 460,
        restingHeight: 844,
        editableFocused: true,
      }),
    ).toEqual({ height: 460, keyboardOpen: true });
  });
  it("uses the full viewport when the keyboard is closed", () => {
    expect(
      measureChatViewport({
        layoutHeight: 852,
        visualHeight: 852,
        restingHeight: 852,
      }),
    ).toEqual({ height: 852, keyboardOpen: false });
  });

  it("fits above an Android keyboard that shrinks the visual viewport", () => {
    expect(
      measureChatViewport({
        layoutHeight: 915,
        visualHeight: 522,
        restingHeight: 915,
        editableFocused: true,
      }),
    ).toEqual({ height: 522, keyboardOpen: true });
  });

  it("includes iOS visual viewport panning without extending past layout bounds", () => {
    expect(
      measureChatViewport({
        layoutHeight: 852,
        visualHeight: 470,
        visualOffsetTop: 42,
        restingHeight: 852,
        editableFocused: true,
      }),
    ).toEqual({ height: 512, keyboardOpen: true });

    expect(
      measureChatViewport({
        layoutHeight: 852,
        visualHeight: 840,
        visualOffsetTop: 60,
        restingHeight: 852,
        editableFocused: false,
      }),
    ).toEqual({ height: 852, keyboardOpen: false });
  });

  it("does not impose a minimum that overlaps short landscape keyboards", () => {
    expect(
      measureChatViewport({
        layoutHeight: 390,
        visualHeight: 178,
        restingHeight: 390,
        editableFocused: true,
      }),
    ).toEqual({ height: 178, keyboardOpen: true });
  });
});
