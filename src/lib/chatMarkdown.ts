// Inline markdown without RegExp lookbehind, including older iOS/WebKit.
const INLINE_TOKEN_PATTERNS: Array<{
  type: "code" | "bold" | "strike" | "italic" | "spoiler";
  re: RegExp;
}> = [
  // Order matters: `code` first so backtick-wrapped content is opaque,
  // ||spoiler|| before *bold/italic* so its inner text stays intact,
  // **bold** before *italic* so ** isn't confused with two italic *s,
  // ~~strike~~ standalone.
  { type: "code", re: /`([^`\n]+?)`/ },
  { type: "spoiler", re: /\|\|([^\n]+?)\|\|/ },
  { type: "bold", re: /\*\*([^*\n]+?)\*\*/ },
  { type: "strike", re: /~~([^~\n]+?)~~/ },
  { type: "italic", re: /\*([^*\n]+?)\*(?!\*)/ },
];

export interface InlineToken {
  type: "text" | "code" | "bold" | "strike" | "italic" | "spoiler";
  value: string;
}

export function tokenizeChatInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    let earliest: {
      idx: number;
      type: InlineToken["type"];
      raw: string;
      inner: string;
    } | null = null;
    for (const p of INLINE_TOKEN_PATTERNS) {
      const re = new RegExp(p.re.source, "g");
      re.lastIndex = cursor;
      let m = re.exec(text);
      // Older iOS/WebKit cannot parse lookbehind in a module-level RegExp.
      // Check the preceding character here while preserving markdown boundaries.
      while (
        m &&
        p.type === "italic" &&
        m.index > 0 &&
        text[m.index - 1] === "*"
      ) {
        re.lastIndex = m.index + 1;
        m = re.exec(text);
      }
      if (m && (!earliest || m.index < earliest.idx)) {
        earliest = { idx: m.index, type: p.type, raw: m[0], inner: m[1] };
      }
    }
    if (!earliest) {
      tokens.push({ type: "text", value: text.slice(cursor) });
      break;
    }
    if (earliest.idx > cursor)
      tokens.push({ type: "text", value: text.slice(cursor, earliest.idx) });
    tokens.push({ type: earliest.type, value: earliest.inner });
    cursor = earliest.idx + earliest.raw.length;
  }
  return tokens;
}
