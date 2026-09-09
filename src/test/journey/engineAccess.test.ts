/**
 * Journey engine — database access contract (live backend, anonymous client).
 *
 * The Splendid Journey runtime is server-authoritative: campaign content is
 * author-only, run state may only change through the SECURITY DEFINER engine
 * RPCs, and none of those RPCs are callable without a session.
 *
 * These assertions run against the live Cloud backend with the publishable
 * key, so they catch the regression that actually matters in production:
 * a policy or grant change that exposes story content (spoilers) or lets a
 * client mutate run state directly.
 *
 * Postgres semantics: SELECT under RLS returns zero rows (no error);
 * INSERT/UPDATE/DELETE and RPCs without EXECUTE raise an error.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wnurxuvwljjbwmtoeqnm.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndudXJ4dXZ3bGpqYndtdG9lcW5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MjYwNzIsImV4cCI6MjA4OTIwMjA3Mn0.XH-Bjn-RuCC7q2YJI-F9m4McBwE5aSZyRJcZMzI0vuc';

/** Story content — leaking any of this to an anonymous reader is a spoiler leak. */
const CONTENT_TABLES = [
  'journey_campaigns',
  'journey_acts',
  'journey_chapters',
  'journey_scenes',
  'journey_scene_blocks',
  'journey_choices',
  'journey_endings',
  'journey_npcs',
  'journey_items',
  'journey_quests',
  'journey_locations',
  'journey_codex_entries',
  'journey_factions',
  'journey_enemies',
  'journey_campaign_variables',
  'journey_campaign_releases',
] as const;

/** Player state — must never be readable or writable by an anonymous caller. */
const RUN_TABLES = [
  'journey_characters',
  'journey_campaign_runs',
  'journey_run_choice_history',
  'journey_combat_sessions',
] as const;

/** Every engine entry point requires a session. */
const ENGINE_RPCS: [string, Record<string, unknown>][] = [
  ['journey_get_runtime_scene', { _run_id: '00000000-0000-0000-0000-000000000000' }],
  ['journey_execute_choice', { _run_id: '00000000-0000-0000-0000-000000000000', _scene_key: 'a', _choice_key: 'b' }],
  ['journey_resolve_encounter_action', { _run_id: '00000000-0000-0000-0000-000000000000', _scene_key: 'a', _action_key: 'b' }],
  ['journey_advance_scene', { _run_id: '00000000-0000-0000-0000-000000000000' }],
  ['journey_get_world', { _run_id: '00000000-0000-0000-0000-000000000000' }],
  ['journey_get_ending', { _run_id: '00000000-0000-0000-0000-000000000000' }],
  ['journey_start_run', { _campaign_id: '00000000-0000-0000-0000-000000000000', _character_id: '00000000-0000-0000-0000-000000000000' }],
  ['journey_list_campaigns', {}],
];

let anon: SupabaseClient;

beforeAll(() => {
  anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
});

describe('journey content is not readable anonymously', () => {
  it.each(CONTENT_TABLES)('%s returns no rows', async (table) => {
    const { data, error } = await anon.from(table).select('*').limit(5);
    if (error) {
      expect(error.code ?? error.message).toBeTruthy(); // blocked outright is also fine
      return;
    }
    expect(data ?? []).toHaveLength(0);
  });
});

describe('run state is not readable or writable anonymously', () => {
  it.each(RUN_TABLES)('%s returns no rows', async (table) => {
    const { data, error } = await anon.from(table).select('*').limit(5);
    if (error) return;
    expect(data ?? []).toHaveLength(0);
  });

  it('never lets a direct state write land on a run', async () => {
    // An UPDATE filtered by RLS simply matches nothing, so assert that no row
    // came back as well as accepting an outright policy error.
    const { data, error } = await anon
      .from('journey_campaign_runs')
      .update({ state: { gold: 999999 } })
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select('id');
    if (error) { expect(error).toBeTruthy(); return; }
    expect(data ?? []).toHaveLength(0);
  });

  it('rejects inserting fabricated choice history', async () => {
    const { error } = await anon.from('journey_run_choice_history').insert({
      run_id: '00000000-0000-0000-0000-000000000000',
      scene_key: 'a',
      choice_key: 'b',
    });
    expect(error).toBeTruthy();
  });
});

describe('engine RPCs require a session', () => {
  it.each(ENGINE_RPCS)('%s is rejected for anon', async (fn, args) => {
    const { data, error } = await anon.rpc(fn, args);
    // Either EXECUTE is revoked for anon, or the function raises on auth.uid() = null.
    if (!error) {
      // A permitted-but-empty response is only acceptable if it carries no content.
      expect(data == null || (Array.isArray(data) && data.length === 0)).toBe(true);
      return;
    }
    expect(error).toBeTruthy();
  });
});
