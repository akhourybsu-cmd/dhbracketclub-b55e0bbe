import { tokenizeChatInline } from "@/lib/chatMarkdown";

describe("chat inline markdown compatibility", () => {
  it("keeps bold and italic boundaries distinct without lookbehind", () => {
    expect(tokenizeChatInline("**bold** and *italic*")).toEqual([
      { type: "bold", value: "bold" },
      { type: "text", value: " and " },
      { type: "italic", value: "italic" },
    ]);
    expect(tokenizeChatInline("**unfinished*")).toEqual([
      { type: "text", value: "**unfinished*" },
    ]);
  });
  it("preserves plain text and opaque inline code", () => {
    expect(tokenizeChatInline("Hi `*literal*` ~~old~~ ||secret||")).toEqual([
      { type: "text", value: "Hi " },
      { type: "code", value: "*literal*" },
      { type: "text", value: " " },
      { type: "strike", value: "old" },
      { type: "text", value: " " },
      { type: "spoiler", value: "secret" },
    ]);
  });
});
