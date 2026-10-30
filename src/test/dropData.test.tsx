/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DailyFind } from "@/lib/dailyFind";
import { patchDropData, setDropReaction } from "@/lib/dropData";

const mock = vi.hoisted(() => ({
  user: "member",
  club: "club",
  rows: [] as any[],
  requests: [] as any[],
  writes: [] as any[],
  gate: null as null | (() => Promise<void>),
  failReaction: false,
  uncertainInsert: false,
  uploads: 0,
  photoFails: false,
  photoGate: null as null | (() => Promise<void>),
}));
function from(table: string) {
  const filters: Array<(r: any) => boolean> = [];
  const orders: Array<{ key: string; ascending: boolean }> = [];
  let limit = Infinity,
    verb = "select",
    body: any,
    single = false;
  const request: any = { table, cursor: null };
  const q: any = {
    select: () => q,
    eq: (k: string, v: any) => {
      filters.push((r) => r[k] === v);
      return q;
    },
    gte: (k: string, v: any) => {
      filters.push((r) => r[k] >= v);
      return q;
    },
    lte: (k: string, v: any) => {
      filters.push((r) => r[k] <= v);
      return q;
    },
    order: (key: string, options: any = {}) => {
      orders.push({ key, ascending: options.ascending !== false });
      return q;
    },
    limit: (n: number) => {
      limit = n;
      return q;
    },
    abortSignal: () => q,
    or: (cursor: string) => {
      request.cursor = cursor;
      const m = cursor.match(
        /^created_at\.lt\.(.+),and\(created_at\.eq\.(.+),id\.lt\.(.+)\)$/,
      );
      if (m)
        filters.push(
          (r) => r.created_at < m[1] || (r.created_at === m[2] && r.id < m[3]),
        );
      return q;
    },
    insert: (data: any) => {
      verb = "insert";
      body = data;
      return q;
    },
    delete: () => {
      verb = "delete";
      return q;
    },
    single: () => {
      single = true;
      return q;
    },
    maybeSingle: () => {
      single = true;
      return q;
    },
    then: (resolve: any, reject: any) => run().then(resolve, reject),
  };
  async function run() {
    mock.requests.push({ ...request, verb });
    if (verb !== "select") {
      mock.writes.push({ table, verb, body });
      if (mock.gate) await mock.gate();
      if (table === "daily_find_reactions" && mock.failReaction)
        return { data: null, error: { message: "Rejected", code: "42501" } };
      if (table === "daily_finds" && verb === "insert") {
        if (mock.rows.some((r) => r.id === body.id))
          return { data: null, error: { code: "23505", message: "duplicate" } };
        mock.rows.push({ ...body, created_at: "2026-10-30T12:00:00Z" });
        if (mock.uncertainInsert) {
          mock.uncertainInsert = false;
          return { data: null, error: { message: "Failed to fetch" } };
        }
        return { data: { id: body.id }, error: null };
      }
      return { data: null, error: null };
    }
    let rows =
      table === "daily_finds"
        ? mock.rows.filter((r) => filters.every((f) => f(r)))
        : [];
    rows = [...rows]
      .sort((a, b) => {
        for (const o of orders) {
          const n = String(a[o.key]).localeCompare(String(b[o.key]));
          if (n) return o.ascending ? n : -n;
        }
        return 0;
      })
      .slice(0, limit);
    return { data: single ? rows[0] || null : rows, error: null };
  }
  return q;
}
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => from(table),
    storage: {
      from: () => ({
        upload: async () => {
          mock.uploads++;
          return { data: {}, error: null };
        },
        remove: async () => ({ data: [], error: null }),
        createSignedUrl: async (path: string) => {
          if (mock.photoGate) await mock.photoGate();
          return mock.photoFails
            ? { data: null, error: { message: "Unavailable", code: "404" } }
            : { data: { signedUrl: "signed:" + path }, error: null };
        },
      }),
    },
  },
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: mock.user ? { id: mock.user } : null }),
}));
vi.mock("@/contexts/ClubContext", () => ({
  useClub: () => ({ club: mock.club ? { id: mock.club } : null }),
}));
import {
  useCreateFind,
  useDropFeed,
  useFindImage,
  useToggleFindReaction,
} from "@/hooks/useDailyFinds";
let cache: QueryClient;
function Wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={cache}>{children}</QueryClientProvider>;
}
const row = (n: number, extra: Partial<DailyFind> = {}): DailyFind => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  club_id: "club",
  user_id: "member",
  find_date: "2026-10-30",
  created_at: "2026-10-30T12:00:00Z",
  updated_at: "2026-10-30T12:00:00Z",
  kind: "learned",
  title: "A Drop",
  note: null,
  url: null,
  image_path: null,
  tags: [],
  reactions: [],
  comments: [{ count: 0 }],
  ...extra,
});
beforeEach(() => {
  mock.user = "member";
  mock.club = "club";
  mock.rows = [];
  mock.requests = [];
  mock.writes = [];
  mock.gate = null;
  mock.failReaction = false;
  mock.uncertainInsert = false;
  mock.uploads = 0;
  mock.photoFails = false;
  mock.photoGate = null;
  cache = new QueryClient({
    defaultOptions: { queries: { retryDelay: 1, gcTime: Infinity } },
  });
});
afterEach(() => {
  cleanup();
  cache.clear();
});

describe("Drop social data", () => {
  it("paginates tied timestamps without skipping, scopes club and My Drops, and stops after the final page", async () => {
    mock.rows = Array.from({ length: 65 }, (_, n) => row(n));
    mock.rows.push(
      row(100, { club_id: "other" }),
      row(101, { user_id: "other" }),
    );
    const { result } = renderHook(() => useDropFeed("mine"), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.data?.pages[0]).toHaveLength(30));
    await act(() => result.current.fetchNextPage());
    await waitFor(() =>
      expect(result.current.data?.pages.flat()).toHaveLength(60),
    );
    await act(() => result.current.fetchNextPage());
    await waitFor(() => {
      expect(result.current.data?.pages.flat()).toHaveLength(65);
      expect(result.current.hasNextPage).toBe(false);
    });
    const finds = result.current.data!.pages.flat();
    expect(finds).toHaveLength(65);
    expect(new Set(finds.map((f) => f.id)).size).toBe(65);
    expect(
      finds.every((f) => f.club_id === "club" && f.user_id === "member"),
    ).toBe(true);
    expect(result.current.hasNextPage).toBe(false);
    expect(mock.requests.some((r) => r.cursor?.includes("id.lt."))).toBe(true);
  });
  it("updates every current-club cache immediately and rolls back only the reacting member on failure", async () => {
    const target = row(1),
      key = ["drop-feed", "club", "member", "all"];
    cache.setQueryData(key, { pages: [[target]], pageParams: [null] });
    cache.setQueryData(["daily-find", target.id, "club", "member"], target);
    cache.setQueryData(
      ["daily-finds-search", "club", "member", "drop", null],
      [target],
    );
    cache.setQueryData(["drop-feed", "other", "member", "all"], {
      pages: [[target]],
      pageParams: [null],
    });
    let release!: () => void;
    mock.gate = () =>
      new Promise<void>((resolve) => {
        release = resolve;
      });
    mock.failReaction = true;
    const { result } = renderHook(() => useToggleFindReaction(), {
      wrapper: Wrapper,
    });
    let work: Promise<any>;
    act(() => {
      work = result.current
        .mutateAsync({ findId: target.id, emoji: "❤️", has: false })
        .catch((e) => e);
    });
    await waitFor(() =>
      expect(cache.getQueryData<any>(key).pages[0][0].reactions).toContainEqual(
        { user_id: "member", emoji: "❤️" },
      ),
    );
    expect(
      cache.getQueryData<DailyFind>([
        "daily-find",
        target.id,
        "club",
        "member",
      ])!.reactions,
    ).toHaveLength(1);
    expect(
      cache.getQueryData<any>(["drop-feed", "other", "member", "all"])
        .pages[0][0].reactions,
    ).toHaveLength(0);
    cache.setQueryData(key, (data: any) =>
      patchDropData(data, target.id, (f) =>
        setDropReaction(f, "peer", "❤️", true),
      ),
    );
    await act(async () => {
      release();
      await work;
    });
    expect(cache.getQueryData<any>(key).pages[0][0].reactions).toEqual([
      { user_id: "peer", emoji: "❤️" },
    ]);
    expect(
      cache.getQueryData<DailyFind>([
        "daily-find",
        target.id,
        "club",
        "member",
      ])!.reactions,
    ).toHaveLength(0);
  });
  it("confirms an uncertain successful post with the same UUID and reuses its uploaded photo", async () => {
    mock.uncertainInsert = true;
    const { result } = renderHook(() => useCreateFind(), { wrapper: Wrapper });
    const input = {
      kind: "photo" as const,
      title: "Shared photo",
      tags: [],
      image: new File(["photo"], "photo.png", { type: "image/png" }),
    };
    await act(async () => {
      await expect(result.current.mutateAsync(input)).rejects.toThrow(
        "Failed to fetch",
      );
    });
    await act(async () => {
      await expect(
        result.current.mutateAsync({ ...input }),
      ).resolves.toHaveProperty("id");
    });
    expect(mock.rows).toHaveLength(1);
    expect(mock.uploads).toBe(1);
    const inserts = mock.writes.filter((w) => w.table === "daily_finds");
    expect(inserts[0].body.id).toBe(inserts[1].body.id);
  });
  it("never shows the previous photo while a changed path loads and exposes retry on signing failure", async () => {
    const { result, rerender } = renderHook(({ path }) => useFindImage(path), {
      wrapper: Wrapper,
      initialProps: { path: "first.png" },
    });
    await waitFor(() => expect(result.current.url).toBe("signed:first.png"));
    let release!: () => void;
    mock.photoFails = true;
    mock.photoGate = () =>
      new Promise<void>((resolve) => {
        release = resolve;
      });
    rerender({ path: "second.png" });
    expect(result.current.url).toBeNull();
    await waitFor(() => expect(release).toBeTypeOf("function"));
    mock.photoGate = null;
    await act(async () => release());
    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.url).toBeNull();
    mock.photoFails = false;
    await act(() => result.current.retry());
    await waitFor(() => expect(result.current.url).toBe("signed:second.png"));
  });
});
