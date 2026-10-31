import { useRef } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type MutateOptions,
} from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { runeRpc } from "@/lib/runedelve/request";
import type { HeroClass } from "@/lib/runedelve/classConfig";
import type {
  PuzzleCompletionReceipt,
  PuzzleDirection,
  PuzzleProgress,
  PuzzleRecord,
} from "@/lib/runedelve/puzzles/types";

const CLASSES: readonly HeroClass[] = ["warrior", "mage", "rogue", "cleric"];
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const integer = (value: unknown, min = 0, max = 100_000): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= min &&
  value <= max;
export const runePuzzleProgressKey = (userId: string | undefined) =>
  ["rune-puzzle-progress", userId] as const;

function validRecord(value: unknown): value is PuzzleRecord {
  return (
    object(value) &&
    typeof value.room_id === "string" &&
    value.room_id.length > 0 &&
    integer(value.definition_version, 1) &&
    integer(value.stars, 1, 3) &&
    integer(value.best_pushes) &&
    integer(value.best_moves) &&
    typeof value.treasure_collected === "boolean"
  );
}
export function parsePuzzleProgress(value: unknown): PuzzleProgress {
  if (
    !object(value) ||
    !integer(value.unlocked, 1) ||
    !integer(value.completed) ||
    !integer(value.stars) ||
    !CLASSES.includes(value.avatar as HeroClass) ||
    !Array.isArray(value.records) ||
    !value.records.every(validRecord) ||
    new Set(
      value.records.map(
        (record) => `${record.room_id}:${record.definition_version}`,
      ),
    ).size !== value.records.length ||
    value.completed !== value.records.length ||
    value.stars !== value.records.reduce((sum, record) => sum + record.stars, 0)
  )
    throw new Error(
      "Your puzzle progress could not be confirmed. Please retry.",
    );
  return value as unknown as PuzzleProgress;
}

/** A frozen completion receipt can be older than the current profile. Never roll earned records back. */
export function mergePuzzleProgress(
  current: PuzzleProgress | undefined,
  incoming: PuzzleProgress,
  preserveAvatar = true,
): PuzzleProgress {
  if (!current) return incoming;
  const records = new Map(
    current.records.map((record) => [record.room_id, record]),
  );
  for (const record of incoming.records) {
    const old = records.get(record.room_id);
    if (!old || record.definition_version > old.definition_version)
      records.set(record.room_id, record);
    else if (record.definition_version === old.definition_version) {
      const betterPushes = record.best_pushes < old.best_pushes;
      records.set(record.room_id, {
        ...old,
        stars: Math.max(old.stars, record.stars),
        best_pushes: Math.min(old.best_pushes, record.best_pushes),
        best_moves: betterPushes
          ? record.best_moves
          : record.best_pushes === old.best_pushes
            ? Math.min(old.best_moves, record.best_moves)
            : old.best_moves,
        treasure_collected: old.treasure_collected || record.treasure_collected,
      });
    }
  }
  return {
    ...incoming,
    avatar: preserveAvatar ? current.avatar : incoming.avatar,
    unlocked: Math.max(current.unlocked, incoming.unlocked),
    completed: Math.max(current.completed, incoming.completed, records.size),
    stars: Math.max(
      current.stars,
      incoming.stars,
      [...records.values()].reduce((sum, record) => sum + record.stars, 0),
    ),
    records: [...records.values()],
  };
}

interface AccountScope {
  userId: string | undefined;
}
function usePuzzleScope() {
  const { user } = useAuth();
  const ref = useRef<AccountScope>({ userId: user?.id });
  if (ref.current.userId !== user?.id) ref.current = { userId: user?.id };
  return ref;
}
export function useRunePuzzleProgress() {
  const scope = usePuzzleScope();
  const renderScope = scope.current;
  return useQuery({
    queryKey: runePuzzleProgressKey(renderScope.userId),
    enabled: !!renderScope.userId,
    staleTime: 30_000,
    retry: 1,
    queryFn: async () => {
      const origin = renderScope;
      if (!origin.userId || scope.current !== origin)
        throw new Error("Sign in to load your puzzle journey.");
      const { data } = await runeRpc<unknown>(
        "rune_puzzle_profile",
        {},
        "Load puzzle journey",
      );
      if (scope.current !== origin)
        throw new Error("Your account changed. Reload your puzzle journey.");
      return parsePuzzleProgress(data);
    },
  });
}

interface ScopedInput<T> {
  input: T;
  scope: AccountScope;
}
function scopedOptions<T, R>(
  input: T,
  options?: MutateOptions<R, Error, T, unknown>,
): MutateOptions<R, Error, ScopedInput<T>, unknown> | undefined {
  return options
    ? {
        onSuccess: (data, _variables, context) =>
          options.onSuccess?.(data, input, context),
        onError: (error, _variables, context) =>
          options.onError?.(error, input, context),
        onSettled: (data, error, _variables, context) =>
          options.onSettled?.(data, error, input, context),
      }
    : undefined;
}

export interface CompleteRunePuzzleInput {
  roomId: string;
  definitionVersion: number;
  actions: PuzzleDirection[];
  requestId: string;
}
export function useCompleteRunePuzzle() {
  const scope = usePuzzleScope();
  const client = useQueryClient();
  const mutation = useMutation<
    PuzzleCompletionReceipt,
    Error,
    ScopedInput<CompleteRunePuzzleInput>
  >({
    mutationFn: async ({ input, scope: origin }) => {
      if (!origin.userId || scope.current !== origin)
        throw new Error("Sign in to save this puzzle.");
      if (
        !UUID.test(input.requestId) ||
        !integer(input.definitionVersion, 1) ||
        !input.roomId ||
        input.actions.length > 1200 ||
        !input.actions.every((action) =>
          ["up", "right", "down", "left"].includes(action),
        )
      )
        throw new Error("This puzzle result is invalid. Restart the chamber.");
      const { data } = await runeRpc<unknown>(
        "rune_puzzle_complete",
        {
          p_room_id: input.roomId,
          p_definition_version: input.definitionVersion,
          p_actions: [...input.actions],
          p_request_id: input.requestId,
        },
        "Save puzzle result",
      );
      if (scope.current !== origin)
        throw new Error(
          "Your account changed. This result remains saved for its original account.",
        );
      if (
        !object(data) ||
        data.requestId !== input.requestId ||
        data.roomId !== input.roomId ||
        data.definitionVersion !== input.definitionVersion ||
        !integer(data.stars, 1, 3) ||
        !integer(data.starsGained, 0, 3) ||
        data.starsGained > data.stars ||
        !integer(data.pushes) ||
        !integer(data.moves) ||
        data.moves !== input.actions.length ||
        data.pushes > data.moves ||
        typeof data.treasureCollected !== "boolean" ||
        typeof data.firstClear !== "boolean" ||
        !integer(data.unlocked, 1)
      )
        throw new Error(
          "Your puzzle result was not confirmed. Retry the same save.",
        );
      const progress = parsePuzzleProgress(data.progress);
      if (
        progress.unlocked !== data.unlocked ||
        !progress.records.some(
          (record) =>
            record.room_id === input.roomId &&
            record.definition_version === input.definitionVersion &&
            record.stars === data.stars,
        )
      )
        throw new Error(
          "Your puzzle result was not confirmed. Retry the same save.",
        );
      return { ...data, progress } as unknown as PuzzleCompletionReceipt;
    },
    onSuccess: async (receipt, variables) => {
      if (scope.current !== variables.scope) return;
      await client.cancelQueries({
        queryKey: runePuzzleProgressKey(variables.scope.userId),
      });
      if (scope.current !== variables.scope) return;
      client.setQueryData<PuzzleProgress>(
        runePuzzleProgressKey(variables.scope.userId),
        (current) => mergePuzzleProgress(current, receipt.progress),
      );
      void client.invalidateQueries({
        queryKey: runePuzzleProgressKey(variables.scope.userId),
      });
    },
  });
  return {
    ...mutation,
    variables: mutation.variables?.input,
    mutate: (
      input: CompleteRunePuzzleInput,
      options?: MutateOptions<
        PuzzleCompletionReceipt,
        Error,
        CompleteRunePuzzleInput,
        unknown
      >,
    ) =>
      mutation.mutate(
        {
          input: { ...input, actions: [...input.actions] },
          scope: scope.current,
        },
        scopedOptions(input, options),
      ),
    mutateAsync: (
      input: CompleteRunePuzzleInput,
      options?: MutateOptions<
        PuzzleCompletionReceipt,
        Error,
        CompleteRunePuzzleInput,
        unknown
      >,
    ) =>
      mutation.mutateAsync(
        {
          input: { ...input, actions: [...input.actions] },
          scope: scope.current,
        },
        scopedOptions(input, options),
      ),
  };
}

export function useSelectRunePuzzleAvatar() {
  const scope = usePuzzleScope();
  const client = useQueryClient();
  const mutation = useMutation<PuzzleProgress, Error, ScopedInput<HeroClass>>({
    onMutate: async (variables) => {
      if (scope.current === variables.scope)
        await client.cancelQueries({
          queryKey: runePuzzleProgressKey(variables.scope.userId),
        });
    },
    mutationFn: async ({ input, scope: origin }) => {
      if (!origin.userId || scope.current !== origin)
        throw new Error("Sign in to choose your delver.");
      if (!CLASSES.includes(input))
        throw new Error("Choose one of the four delvers.");
      const { data } = await runeRpc<unknown>(
        "rune_puzzle_select_avatar",
        { p_avatar: input },
        "Choose puzzle delver",
      );
      if (scope.current !== origin)
        throw new Error("Your account changed. Reload your delver.");
      const profile = parsePuzzleProgress(data);
      if (profile.avatar !== input)
        throw new Error("Your delver was not confirmed. Please retry.");
      return profile;
    },
    onSuccess: async (profile, variables) => {
      if (scope.current !== variables.scope) return;
      await client.cancelQueries({
        queryKey: runePuzzleProgressKey(variables.scope.userId),
      });
      if (scope.current !== variables.scope) return;
      client.setQueryData<PuzzleProgress>(
        runePuzzleProgressKey(variables.scope.userId),
        (current) => mergePuzzleProgress(current, profile, false),
      );
      void client.invalidateQueries({
        queryKey: runePuzzleProgressKey(variables.scope.userId),
      });
    },
  });
  return {
    ...mutation,
    variables: mutation.variables?.input,
    mutate: (
      input: HeroClass,
      options?: MutateOptions<PuzzleProgress, Error, HeroClass, unknown>,
    ) =>
      mutation.mutate(
        { input, scope: scope.current },
        scopedOptions(input, options),
      ),
    mutateAsync: (
      input: HeroClass,
      options?: MutateOptions<PuzzleProgress, Error, HeroClass, unknown>,
    ) =>
      mutation.mutateAsync(
        { input, scope: scope.current },
        scopedOptions(input, options),
      ),
  };
}
