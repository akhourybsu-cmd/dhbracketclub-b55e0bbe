import { describe, expect, it } from "vitest";
import { visiblePresence } from "@/lib/clubPresence";

describe("verified club presence", () => {
  const roster = [
    { id: "member", display_name: "Alex", avatar_url: "saved.png" },
  ];
  it("excludes unlisted sessions and uses saved names rather than broadcast labels", () => {
    expect(
      visiblePresence(
        {
          a: [
            { user_id: "member", display_name: "spoofed" },
            { user_id: "private" },
          ],
          b: [{ user_id: "member" }],
        },
        roster,
      ),
    ).toEqual([
      { user_id: "member", display_name: "Alex", avatar_url: "saved.png" },
    ]);
  });
  it("fails closed while the roster is unavailable and ignores malformed payloads", () => {
    expect(
      visiblePresence({ a: [null, 5, {}, { user_id: "member" }] }, []),
    ).toEqual([]);
    expect(visiblePresence({ a: [null, 5, {}] }, roster)).toEqual([]);
  });
});
