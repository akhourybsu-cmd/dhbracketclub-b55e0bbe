import { beforeEach, describe, expect, it, vi } from "vitest";
import { PUZZLE_ROOMS } from "@/lib/runedelve/puzzles/rooms";

let fixture: typeof import("../../../../scripts/fixtures/rune-backend");
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const rpc = (name: string, args = {}) => fixture.supabase.rpc(name, args);
const complete = (index = 0, requestId = id(1)) =>
  rpc("rune_puzzle_complete", {
    p_room_id: PUZZLE_ROOMS[index].id,
    p_definition_version: PUZZLE_ROOMS[index].version,
    p_actions: PUZZLE_ROOMS[index].solution,
    p_request_id: requestId,
  });
beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  history.replaceState({}, "", "/?scenario=new");
  fixture = await import("../../../../scripts/fixtures/rune-backend");
});

describe("isolated spatial puzzle transport", () => {
  it("starts a new journey without creating or crediting any legacy character or wallet", async () => {
    const old = structuredClone(
      Object.fromEntries(
        Object.entries(fixture.qa.tables).filter(([key]) =>
          key.startsWith("rune_delve_"),
        ),
      ),
    );
    const profile = await rpc("rune_puzzle_profile");
    expect(profile.data).toEqual({
      unlocked: 1,
      completed: 0,
      stars: 0,
      avatar: "warrior",
      records: [],
    });
    const solved = await complete();
    expect(solved.error).toBeNull();
    expect(solved.data).toMatchObject({
      firstClear: true,
      roomId: PUZZLE_ROOMS[0].id,
      stars: 3,
      starsGained: 3,
      unlocked: 2,
    });
    for (const [key, value] of Object.entries(old))
      expect(fixture.qa.tables[key]).toEqual(value);
  });

  it.each([
    "rune_puzzle_definitions",
    "rune_puzzle_profiles",
    "rune_puzzle_results",
    "rune_puzzle_receipts",
  ])(
    "denies direct progress and canonical-definition mutation of %s",
    async (table) => {
      fixture.qa.tables[table].push({
        id: "seed",
        user_id: "member",
        stars: 1,
      });
      const old = structuredClone(fixture.qa.tables[table]);
      for (const request of [
        fixture.supabase
          .from(table)
          .insert({ id: "forged", user_id: "member", stars: 999 }),
        fixture.supabase.from(table).update({ stars: 999 }).eq("id", "seed"),
        fixture.supabase.from(table).delete().eq("id", "seed"),
      ])
        expect((await request).error?.message).toContain("permission denied");
      expect(fixture.qa.tables[table]).toEqual(old);
    },
  );

  it("rejects unsolved and locked chambers instead of accepting client-supplied stars", async () => {
    const locked = await complete(1);
    expect(locked.error?.message).toContain("locked");
    const unsolved = await rpc("rune_puzzle_complete", {
      p_room_id: PUZZLE_ROOMS[0].id,
      p_definition_version: 1,
      p_actions: [],
      p_request_id: id(1),
      stars: 3,
      cleared: true,
    });
    expect(unsolved.error?.message).toContain("not_solved");
    expect(fixture.qa.tables.rune_puzzle_results).toHaveLength(0);
  });

  it("keeps a committed receipt stable when acknowledgement is lost and a later room has progressed", async () => {
    fixture.qa.losePuzzleReceiptOnce = true;
    const lost = await complete(0, id(1));
    expect(lost.error?.message).toContain("lost result acknowledgement");
    expect(fixture.qa.tables.rune_puzzle_results).toHaveLength(1);
    const first = await complete(0, id(1));
    expect(first.error).toBeNull();
    await complete(1, id(2));
    const retry = await complete(0, id(1));
    expect(retry.data).toEqual(first.data);
    expect(retry.data.progress.completed).toBe(1);
    expect((await rpc("rune_puzzle_profile")).data.completed).toBe(2);
    expect(fixture.qa.tables.rune_puzzle_receipts).toHaveLength(2);
    const reused = await complete(1, id(1));
    expect(reused.error?.message).toContain("request_id_reused");
  });

  it("binds delayed fixture requests and private record reads to their account", async () => {
    await complete();
    fixture.qa.delayRpc.rune_puzzle_profile = 10;
    const original = rpc("rune_puzzle_profile");
    fixture.qa.puzzleUserId = "bob";
    expect((await original).data.completed).toBe(1);
    expect((await rpc("rune_puzzle_profile")).data.completed).toBe(0);
    expect(
      (await fixture.supabase.from("rune_puzzle_results").select("*")).data,
    ).toEqual([]);
    const bob = await complete(0, id(1));
    expect(bob.data.firstClear).toBe(true);
    fixture.qa.puzzleUserId = "member";
    expect(
      (await fixture.supabase.from("rune_puzzle_results").select("*")).data,
    ).toHaveLength(1);
    expect((await complete(0, id(1))).data.progress.completed).toBe(1);
  });

  it("persists cloud-like puzzle records across fixture reload and separates accounts", async () => {
    await complete();
    await rpc("rune_puzzle_select_avatar", { p_avatar: "mage" });
    vi.resetModules();
    fixture = await import("../../../../scripts/fixtures/rune-backend");
    expect((await rpc("rune_puzzle_profile")).data).toMatchObject({
      completed: 1,
      stars: 3,
      avatar: "mage",
    });
    fixture.qa.puzzleUserId = "bob";
    expect((await rpc("rune_puzzle_profile")).data).toMatchObject({
      completed: 0,
      stars: 0,
      avatar: "warrior",
    });
    fixture.qa.puzzleUserId = "member";
    expect((await rpc("rune_puzzle_profile")).data).toMatchObject({
      completed: 1,
      stars: 3,
      avatar: "mage",
    });
    fixture.qa.authenticated = false;
    expect((await rpc("rune_puzzle_profile")).error?.message).toContain(
      "not_authenticated",
    );
  });
});
