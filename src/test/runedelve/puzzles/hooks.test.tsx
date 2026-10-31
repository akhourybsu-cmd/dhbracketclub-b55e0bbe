import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import {
  mergePuzzleProgress,
  parsePuzzleProgress,
  runePuzzleProgressKey,
  useCompleteRunePuzzle,
  useRunePuzzleProgress,
  useSelectRunePuzzleAvatar,
} from "@/hooks/useRunePuzzles";
import type {
  PuzzleCompletionReceipt,
  PuzzleProgress,
} from "@/lib/runedelve/puzzles/types";

const state = vi.hoisted(() => ({
  userId: "alice" as string | undefined,
  rpc: vi.fn(),
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: state.userId ? { id: state.userId } : null }),
}));
vi.mock("@/lib/runedelve/request", () => ({
  runeRpc: (...args: unknown[]) => state.rpc(...args),
}));
const requestId = "00000000-0000-4000-8000-000000000001";
const input = {
  roomId: "ember-01",
  definitionVersion: 1,
  actions: [
    "right" as const,
    "down" as const,
    "left" as const,
    "down" as const,
    "right" as const,
    "up" as const,
    "right" as const,
    "up" as const,
  ],
  requestId,
};
const fresh = (): PuzzleProgress => ({
  unlocked: 1,
  completed: 0,
  stars: 0,
  avatar: "warrior",
  records: [],
});
const one = (): PuzzleProgress => ({
  unlocked: 2,
  completed: 1,
  stars: 2,
  avatar: "warrior",
  records: [
    {
      room_id: "ember-01",
      definition_version: 1,
      stars: 2,
      best_pushes: 3,
      best_moves: 8,
      treasure_collected: false,
    },
  ],
});
const receipt = (): PuzzleCompletionReceipt => ({
  requestId,
  roomId: "ember-01",
  definitionVersion: 1,
  stars: 2,
  starsGained: 2,
  pushes: 3,
  moves: 8,
  treasureCollected: false,
  firstClear: true,
  unlocked: 2,
  progress: one(),
});
let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
beforeEach(() => {
  state.userId = "alice";
  state.rpc.mockReset();
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, retryDelay: 0 },
      mutations: { retry: false },
    },
  });
  state.rpc.mockImplementation(async (name, args) => ({
    data:
      name === "rune_puzzle_profile"
        ? fresh()
        : name === "rune_puzzle_select_avatar"
          ? { ...fresh(), avatar: args.p_avatar }
          : receipt(),
    error: null,
  }));
});
afterEach(() => {
  cleanup();
  client.clear();
});

describe("puzzle journey data boundaries", () => {
  it("loads a fresh puzzle profile independently of legacy hero state", async () => {
    const hook = renderHook(useRunePuzzleProgress, { wrapper });
    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
    expect(hook.result.current.data).toEqual(fresh());
    expect(state.rpc).toHaveBeenCalledWith(
      "rune_puzzle_profile",
      {},
      "Load puzzle journey",
    );
    expect(
      state.rpc.mock.calls.every(([name]) => !name.includes("rune_delve")),
    ).toBe(true);
  });

  it("keeps profile responses bound to their originating account query", async () => {
    const alice = deferred<{ data: PuzzleProgress; error: null }>();
    const bob = deferred<{ data: PuzzleProgress; error: null }>();
    state.rpc.mockImplementation(() =>
      state.userId === "alice" ? alice.promise : bob.promise,
    );
    const hook = renderHook(useRunePuzzleProgress, { wrapper });
    await waitFor(() => expect(state.rpc).toHaveBeenCalledTimes(1));
    state.userId = "bob";
    hook.rerender();
    await waitFor(() => expect(state.rpc).toHaveBeenCalledTimes(2));
    await act(async () => {
      bob.resolve({ data: { ...fresh(), avatar: "rogue" }, error: null });
    });
    await waitFor(() => expect(hook.result.current.data?.avatar).toBe("rogue"));
    await act(async () => {
      alice.resolve({ data: one(), error: null });
    });
    expect(
      client.getQueryData<PuzzleProgress>(runePuzzleProgressKey("bob"))
        ?.completed,
    ).toBe(0);
    expect(
      client.getQueryData<PuzzleProgress>(runePuzzleProgressKey("bob"))?.avatar,
    ).toBe("rogue");
    expect(client.getQueryData(runePuzzleProgressKey("alice"))).toBeUndefined();
  });

  it("keeps missing or malformed progress as an error, never a fresh unlock", async () => {
    state.rpc.mockResolvedValue({ data: null, error: null });
    const hook = renderHook(useRunePuzzleProgress, { wrapper });
    await waitFor(() => expect(hook.result.current.isError).toBe(true));
    expect(hook.result.current.data).toBeUndefined();
    expect(() => parsePuzzleProgress({ ...fresh(), stars: 999 })).toThrow();
    expect(() =>
      parsePuzzleProgress({
        ...one(),
        records: [one().records[0], one().records[0]],
      }),
    ).toThrow();
  });

  it("freezes completion identity/actions and only accepts the matching confirmed receipt", async () => {
    const pending = deferred<{ data: PuzzleCompletionReceipt; error: null }>();
    state.rpc.mockReturnValue(pending.promise);
    const hook = renderHook(useCompleteRunePuzzle, { wrapper });
    const actions = [...input.actions];
    let save!: Promise<PuzzleCompletionReceipt>;
    act(() => {
      save = hook.result.current.mutateAsync({ ...input, actions });
    });
    actions.push("right");
    await waitFor(() => expect(state.rpc).toHaveBeenCalledTimes(1));
    expect(state.rpc.mock.calls[0][1]).toEqual({
      p_room_id: "ember-01",
      p_definition_version: 1,
      p_actions: input.actions,
      p_request_id: requestId,
    });
    await act(async () => {
      pending.resolve({ data: receipt(), error: null });
      await save;
    });
    expect(client.getQueryData(runePuzzleProgressKey("alice"))).toEqual(one());
    state.rpc.mockResolvedValue({
      data: { ...receipt(), roomId: "another-room" },
      error: null,
    });
    await act(async () => {
      await expect(hook.result.current.mutateAsync(input)).rejects.toThrow(
        "not confirmed",
      );
    });
    expect(client.getQueryData(runePuzzleProgressKey("alice"))).toEqual(one());
  });

  it("does not hydrate a successor account or accept an old A→B→A completion", async () => {
    const pending = deferred<{ data: PuzzleCompletionReceipt; error: null }>();
    state.rpc.mockReturnValue(pending.promise);
    const hook = renderHook(useCompleteRunePuzzle, { wrapper });
    let save!: Promise<unknown>;
    act(() => {
      save = hook.result.current.mutateAsync(input).catch((error) => error);
    });
    await waitFor(() => expect(state.rpc).toHaveBeenCalledTimes(1));
    state.userId = "bob";
    hook.rerender();
    state.userId = "alice";
    hook.rerender();
    await act(async () => {
      pending.resolve({ data: receipt(), error: null });
    });
    expect(await save).toBeInstanceOf(Error);
    expect(client.getQueryData(runePuzzleProgressKey("bob"))).toBeUndefined();
    expect(client.getQueryData(runePuzzleProgressKey("alice"))).toBeUndefined();
  });

  it("merges immutable old receipts without losing later stars, records or avatar choices", () => {
    const current: PuzzleProgress = {
      unlocked: 3,
      completed: 2,
      stars: 6,
      avatar: "rogue",
      records: [
        {
          ...one().records[0],
          stars: 3,
          best_pushes: 2,
          best_moves: 9,
          treasure_collected: true,
        },
        {
          room_id: "ember-02",
          definition_version: 1,
          stars: 3,
          best_pushes: 4,
          best_moves: 10,
          treasure_collected: true,
        },
      ],
    };
    expect(mergePuzzleProgress(current, one())).toEqual(current);
    const improved = one();
    improved.records[0] = {
      ...improved.records[0],
      best_pushes: 1,
      best_moves: 14,
    };
    const merged = mergePuzzleProgress(current, improved);
    expect(merged).toMatchObject({
      unlocked: 3,
      completed: 2,
      stars: 6,
      avatar: "rogue",
    });
    expect(merged.records[0]).toMatchObject({
      best_pushes: 1,
      best_moves: 14,
      stars: 3,
      treasure_collected: true,
    });
  });

  it("does not let an in-flight old profile response undo a confirmed avatar", async () => {
    const pending = deferred<{ data: PuzzleProgress; error: null }>();
    let profileCalls = 0;
    state.rpc.mockImplementation((name, args) =>
      name === "rune_puzzle_profile"
        ? ++profileCalls === 1
          ? pending.promise
          : Promise.resolve({
              data: { ...fresh(), avatar: "mage" },
              error: null,
            })
        : Promise.resolve({
            data: { ...fresh(), avatar: args.p_avatar },
            error: null,
          }),
    );
    const hook = renderHook(
      () => ({
        profile: useRunePuzzleProgress(),
        avatar: useSelectRunePuzzleAvatar(),
      }),
      { wrapper },
    );
    await waitFor(() => expect(state.rpc).toHaveBeenCalledTimes(1));
    await act(async () => {
      await hook.result.current.avatar.mutateAsync("mage");
    });
    expect(
      client.getQueryData<PuzzleProgress>(runePuzzleProgressKey("alice"))
        ?.avatar,
    ).toBe("mage");
    await act(async () => {
      pending.resolve({ data: fresh(), error: null });
    });
    expect(
      client.getQueryData<PuzzleProgress>(runePuzzleProgressKey("alice"))
        ?.avatar,
    ).toBe("mage");
  });
});
