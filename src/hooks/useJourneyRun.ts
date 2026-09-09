// The Splendid Journey — active campaign run.
//
// The runtime is server-authoritative in both directions now:
//   • Reads go through `journey_get_runtime_scene`, which returns ONLY the
//     current scene, with author notes, requirements, effects, destinations
//     and hidden branches stripped out. Players can no longer query future
//     story content directly.
//   • Writes go through `journey_execute_choice` / `journey_advance_scene`,
//     which apply effects, enforce scene-entry conditions, follow automatic
//     transitions and resolve endings by priority.
//
// The run is pinned to the campaign version it started on, so publishing new
// content can never rewrite a journey already in progress.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { withTimeout, QUERY_TIMEOUT_MS } from '@/lib/asyncGuards';
import { EMPTY_RUN_STATE } from '@/lib/journey/types';
import type {
  CampaignSummary, RuntimeBlock, RuntimeChoice, RuntimeEncounterPayload, RuntimeScene, RunRow, RunState,
} from '@/lib/journey/types';

export interface JourneyRunView {
  run: RunRow | null;
  campaign: CampaignSummary | null;
  scene: RuntimeScene | null;
  chapterTitle: string | null;
  locationName: string | null;
  blocks: RuntimeBlock[];
  choices: RuntimeChoice[];
  encounter: RuntimeEncounterPayload | null;
  state: RunState;
  loading: boolean;
  busy: boolean;
  error: string | null;
  notices: string[];
  clearNotices: () => void;
  refresh: () => Promise<void>;
  chooseChoice: (choiceKey: string) => Promise<boolean>;
  resolveEncounterAction: (actionKey: string) => Promise<boolean>;
  /** Follow an authored automatic transition ("Continue"). */
  advance: () => Promise<boolean>;
}

interface RuntimePayload {
  run: RunRow;
  campaign: CampaignSummary | null;
  scene: RuntimeScene | null;
  chapter_title: string | null;
  location_name: string | null;
  blocks: RuntimeBlock[];
  choices: RuntimeChoice[];
  encounter: RuntimeEncounterPayload | null;
}

interface JourneyRpcError { message: string }
interface JourneyRpcResult<T> { data: T | null; error: JourneyRpcError | null }
interface JourneyMutationPayload { notices?: unknown }

const journeyRpc = <T,>(
  functionName: string,
  args: Record<string, string>,
): PromiseLike<JourneyRpcResult<T>> => (
  supabase.rpc as unknown as (
    name: string,
    params: Record<string, string>,
  ) => PromiseLike<JourneyRpcResult<T>>
)(functionName, args);

export function useJourneyRun(runId: string | undefined): JourneyRunView {
  const [payload, setPayload] = useState<RuntimePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notices, setNotices] = useState<string[]>([]);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (!runId) { setLoading(false); return; }
    setError(null);
    try {
      const { data, error: rpcErr } = await withTimeout<JourneyRpcResult<RuntimePayload>>(
        journeyRpc<RuntimePayload>('journey_get_runtime_scene', { _run_id: runId }),
        QUERY_TIMEOUT_MS, 'journey runtime scene',
      );
      if (rpcErr) throw new Error(rpcErr.message);
      if (!data) throw new Error('This journey could not be found.');
      setPayload(data as RuntimePayload);
    } catch (e) {
      setError((e as Error).message ?? 'Something went wrong loading this journey.');
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => { load(); }, [load]);

  const run = payload?.run ?? null;

  const state: RunState = useMemo(
    () => ({ ...EMPTY_RUN_STATE, ...(run?.state ?? {}) }) as RunState,
    [run?.state],
  );

  const mutate = useCallback(async (fn: () => PromiseLike<JourneyRpcResult<JourneyMutationPayload>>) => {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const { data, error: rpcErr } = await fn();
      if (rpcErr) throw new Error(rpcErr.message);
      const nextNotices = Array.isArray(data?.notices)
        ? data.notices.filter((notice): notice is string => typeof notice === 'string' && notice.length > 0)
        : [];
      setNotices(nextNotices);
      // The scene payload (blocks, choices, availability) is always rebuilt
      // server-side so nothing stale survives a transition.
      await load();
      return true;
    } catch (e) {
      setError((e as Error).message ?? 'That could not be done.');
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [load]);

  const chooseChoice = useCallback(async (choiceKey: string) => {
    if (!run?.current_scene_key) return false;
    return mutate(() => journeyRpc<JourneyMutationPayload>('journey_execute_choice', {
      _run_id: run.id, _scene_key: run.current_scene_key, _choice_key: choiceKey,
    }));
  }, [run, mutate]);

  const resolveEncounterAction = useCallback(async (actionKey: string) => {
    if (!run?.current_scene_key) return false;
    return mutate(() => journeyRpc<JourneyMutationPayload>('journey_resolve_encounter_action', {
      _run_id: run.id,
      _scene_key: run.current_scene_key,
      _action_key: actionKey,
    }));
  }, [run, mutate]);

  const advance = useCallback(async () => {
    if (!run) return false;
    return mutate(() => journeyRpc<JourneyMutationPayload>('journey_advance_scene', { _run_id: run.id }));
  }, [run, mutate]);

  return {
    run,
    campaign: payload?.campaign ?? null,
    scene: payload?.scene ?? null,
    chapterTitle: payload?.chapter_title ?? null,
    locationName: payload?.location_name ?? null,
    blocks: payload?.blocks ?? [],
    choices: payload?.choices ?? [],
    encounter: payload?.encounter ?? null,
    state,
    loading, busy, error, notices,
    clearNotices: () => setNotices([]),
    refresh: load,
    chooseChoice,
    resolveEncounterAction,
    advance,
  };
}
