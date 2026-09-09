import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { generateLevel, chapterFor, type LevelDefinition } from '@/lib/runedelve/levelGenerator';
import type { HeroClass } from '@/lib/runedelve/classConfig';

/**
 * Self-heal legacy `rune_delve_levels` rows that were persisted before the
 * boss/mini-boss + multi-wave system existed. If the stored modifiers lack
 * `boss_kind` (or `waves`) but the deterministic generator now produces one
 * for that level number, we overlay the generator's `enemy_config` and
 * `modifiers` in-memory. The DB row is left untouched (preserves run FK
 * history); only what the play page reads gets the new fields.
 */
function hydrateLegacy(row: RuneDelveLevel): RuneDelveLevel {
  // The generator is the deterministic source of truth per level number, so we
  // always overlay the balance-relevant fields (enemy_config, turn_limit,
  // generator modifiers) in-memory on read. This lets balance patches — HP
  // caps, boss-slot caps, turn budgets, the Rebalance v6 curve — reach ALL
  // already-seeded rows (not just boss levels) WITHOUT a DB migration. The
  // stored row is never mutated, so run FK history is preserved; only what the
  // play page reads gets refreshed. The generator owns every gameplay field,
  // including objectives and mechanic lists, so old seeded rows receive later
  // balance fixes without a destructive migration.
  const def = generateLevel(row.level_number);
  const storedMods = (row.modifiers ?? {}) as Record<string, unknown>;
  const hasStoredMods = Object.keys(storedMods).length > 0;
  return {
    ...row,
    chapter: def.chapter,
    difficulty_tier: def.difficulty_tier,
    generation_seed: def.generation_seed,
    board_size: def.board_size,
    enemy_config: def.enemy_config,
    turn_limit: def.turn_limit,
    objective_type: def.objective_type,
    objective_target: def.objective_target,
    modifiers: {
      ...(hasStoredMods ? storedMods : {}),
      ...def.modifiers,
    },
  };
}

export interface RuneDelveLevel {
  id: string;
  level_number: number;
  chapter: number;
  difficulty_tier: number;
  generation_seed: number;
  board_size: number;
  enemy_config: any;
  turn_limit: number;
  objective_type: string;
  objective_target: number;
  modifiers: any;
  status: string;
}

export interface RuneDelveProgress {
  id: string;
  user_id: string;
  /** Present on per-class campaign rows; absent on the aggregate leaderboard row. */
  class?: HeroClass;
  highest_unlocked_level: number;
  highest_completed_level: number;
  total_levels_cleared: number;
  current_chapter: number;
}

// Fetch a single canonical level by number; auto-generate + persist if missing.
export function useLevel(levelNumber: number | undefined) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ['rune-delve-level', levelNumber],
    enabled: typeof levelNumber === 'number' && levelNumber > 0,
    staleTime: Infinity,
    queryFn: async (): Promise<RuneDelveLevel> => {
      if (!levelNumber) throw new Error('No level number');
      const { data: existing } = await supabase
        .from('rune_delve_levels')
        .select('*')
        .eq('level_number', levelNumber)
        .maybeSingle();
      if (existing) return hydrateLegacy(existing as RuneDelveLevel);

      // Generate deterministically client-side, then attempt to persist.
      // RLS only allows admins to insert — non-admins will fall through to the
      // re-fetch (someone else, or a future admin, will seed it). Until then,
      // we still return a transient level so play can continue.
      const def: LevelDefinition = generateLevel(levelNumber);
      const { data: inserted, error } = await supabase
        .from('rune_delve_levels')
        .insert({
          level_number: def.level_number,
          chapter: def.chapter,
          difficulty_tier: def.difficulty_tier,
          generation_seed: def.generation_seed,
          board_size: def.board_size,
          enemy_config: def.enemy_config,
          turn_limit: def.turn_limit,
          objective_type: def.objective_type,
          objective_target: def.objective_target,
          modifiers: def.modifiers,
        } as any)
        .select()
        .maybeSingle();
      if (inserted) {
        qc.invalidateQueries({ queryKey: ['rune-delve-levels-batch'] });
        return hydrateLegacy(inserted as RuneDelveLevel);
      }
      // Always re-fetch when insert returned no row — covers both unique-violation
      // races AND any RLS regression. We never want to fall through to a transient
      // row if a canonical one is reachable, because submissions on transient ids
      // silently fail (UUID FK on rune_delve_runs.level_id) and freeze progression.
      {
        const { data: again } = await supabase
          .from('rune_delve_levels')
          .select('*')
          .eq('level_number', levelNumber)
          .maybeSingle();
        if (again) return hydrateLegacy(again as RuneDelveLevel);
      }
      console.warn('[rune-delve] Falling back to transient level — submissions will fail. Insert error:', error, 'level:', levelNumber);
      return {
        id: `transient-${def.level_number}`,
        level_number: def.level_number,
        chapter: def.chapter,
        difficulty_tier: def.difficulty_tier,
        generation_seed: def.generation_seed,
        board_size: def.board_size,
        enemy_config: def.enemy_config,
        turn_limit: def.turn_limit,
        objective_type: def.objective_type,
        objective_target: def.objective_target,
        modifiers: def.modifiers,
        status: 'active',
      };
    },
  });
}

// Fetch a window of levels (for the level map). Generates missing rows lazily on
// open of each — which is fine for the size of the window.
export function useLevelWindow(start: number, count: number) {
  return useQuery({
    queryKey: ['rune-delve-levels-batch', start, count],
    staleTime: 60_000,
    queryFn: async (): Promise<RuneDelveLevel[]> => {
      const numbers = Array.from({ length: count }, (_, i) => start + i).filter(n => n >= 1);
      const { data } = await supabase
        .from('rune_delve_levels')
        .select('*')
        .in('level_number', numbers);
      const byNum = new Map<number, RuneDelveLevel>();
      (data ?? []).forEach((r: any) => byNum.set(r.level_number, r as RuneDelveLevel));
      // Synthesize transient rows for any numbers the DB doesn't have yet so the
      // map is fully populated. They share the same seed so they will eventually
      // hydrate into identical canonical rows when an admin (or first run) seeds them.
      return numbers.map(n => {
        const existing = byNum.get(n);
        if (existing) return hydrateLegacy(existing);
        const def = generateLevel(n);
        return {
          id: `transient-${n}`,
          level_number: n,
          chapter: def.chapter,
          difficulty_tier: def.difficulty_tier,
          generation_seed: def.generation_seed,
          board_size: def.board_size,
          enemy_config: def.enemy_config,
          turn_limit: def.turn_limit,
          objective_type: def.objective_type,
          objective_target: def.objective_target,
          modifiers: def.modifiers,
          status: 'active',
        } as RuneDelveLevel;
      }).sort((a, b) => a.level_number - b.level_number);
    },
  });
}

// Per-class campaign progress. Each class starts at Level 1 and restores its
// own unlock position when selected. The legacy per-user progress row remains
// the aggregate leaderboard record and is used as a pre-migration fallback.
export function useMyProgress(heroClass: HeroClass | undefined) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useQuery({
    queryKey: ['rune-delve-progress', user?.id, heroClass],
    enabled: !!user && !!heroClass,
    staleTime: 30_000,
    queryFn: async (): Promise<RuneDelveProgress | null> => {
      if (!user || !heroClass) return null;
      const { data: classRow, error: classError } = await supabase
        .from('rune_delve_class_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('class', heroClass)
        .maybeSingle();
      if (classError) throw classError;

      // Once the migration is applied these fields are always numeric. Until
      // then, fall back to the legacy aggregate so a staged deployment remains
      // playable while the SQL is being applied.
      if (classRow && typeof classRow.highest_unlocked_level === 'number') {
        return classRow as unknown as RuneDelveProgress;
      }

      const [{ data: legacy }, { data: activeHero }] = await Promise.all([
        supabase
          .from('rune_delve_progress')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('rune_delve_heroes')
          .select('class')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);
      if (classRow) {
        // On the old schema only the currently active class can inherit the
        // shared campaign. Inactive classes must still preview as fresh L1.
        const legacyBelongsToClass = activeHero?.class === heroClass;
        return {
          id: classRow.id,
          user_id: user.id,
          class: heroClass,
          highest_unlocked_level: legacyBelongsToClass ? (legacy?.highest_unlocked_level ?? 1) : 1,
          highest_completed_level: legacyBelongsToClass ? (legacy?.highest_completed_level ?? 0) : 0,
          total_levels_cleared: legacyBelongsToClass ? (legacy?.total_levels_cleared ?? 0) : 0,
          current_chapter: legacyBelongsToClass ? (legacy?.current_chapter ?? 1) : 1,
        };
      }

      const { data: created, error } = await supabase
        .from('rune_delve_class_progress')
        .insert({ user_id: user.id, class: heroClass })
        .select()
        .single();
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['rune-delve-class-progress', user.id] });
      return {
        id: created.id,
        user_id: user.id,
        class: heroClass,
        highest_unlocked_level: created.highest_unlocked_level ?? 1,
        highest_completed_level: created.highest_completed_level ?? 0,
        total_levels_cleared: created.total_levels_cleared ?? 0,
        current_chapter: created.current_chapter ?? 1,
      };
    },
  });
}

// All runs for a given level by current user (latest best-score upserted).
// Self-healing: always revalidates on mount/focus, and if the play page just
// submitted a run for this level (sessionStorage signal) we briefly poll until
// the row appears — this eliminates the post-submit race that left users
// staring at "No run yet" until they cleared their cache.
export function useMyLevelRun(
  levelId: string | undefined,
  levelNumber: number | undefined,
  heroClass: HeroClass | undefined,
) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['rune-delve-level-run', levelId, user?.id, heroClass],
    enabled: !!user && !!heroClass && !!levelId && !levelId.startsWith('transient-'),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!user || !heroClass || !levelId) return null;
      const fetchOnce = async () => {
        const { data } = await supabase
          .from('rune_delve_runs')
          .select('*')
          .eq('user_id', user.id)
          .eq('level_id', levelId)
          .eq('hero_class', heroClass)
          .maybeSingle();
        return data ?? null;
      };
      let row = await fetchOnce();
      if (row) return row;

      // If the play page just submitted, give the write a few short retries
      // to land before we report "no run yet".
      let justSubmitted = false;
      try {
        if (typeof levelNumber === 'number' && typeof sessionStorage !== 'undefined') {
          const key = `rd-just-submitted-${heroClass}-${levelNumber}`;
          const ts = sessionStorage.getItem(key);
          if (ts && Date.now() - parseInt(ts, 10) < 15_000) {
            justSubmitted = true;
          }
        }
      } catch { /* sessionStorage may be unavailable */ }

      if (!justSubmitted) return null;

      for (let i = 0; i < 4; i++) {
        await new Promise(r => setTimeout(r, 400));
        row = await fetchOnce();
        if (row) {
          try {
            if (typeof levelNumber === 'number') {
              sessionStorage.removeItem(`rd-just-submitted-${heroClass}-${levelNumber}`);
            }
          } catch { /* noop */ }
          return row;
        }
      }
      return null;
    },
  });
}

// Submit a run with per-stat best-of merge semantics.
//
// Why this is a single merged upsert (not "if better score, update"):
//   - Score-tie or lower-score replays still might improve secondary stats
//     (longer chain, faster clear, more HP left, first-time clear).
//   - Replay metadata (attempts, clears, last_played_at) must always tick.
// Returns the saved row + a `wasNewBest` flag (server truth) so the caller
// doesn't have to rely on a possibly-stale cached `existingRun` to decide
// whether to bump hero lifetime XP/runs.
export function useSubmitLevelRun() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      level_id: string;
      level_number: number;
      score: number;
      enemies_defeated: number;
      dungeon_cleared: boolean;
      turns_used: number;
      total_damage: number;
      longest_chain: number;
      hp_remaining: number;
      xp_earned: number;
      ability_used: boolean;
      hero_class: string;
    }): Promise<{ row: any; wasNewBest: boolean; improvedChain: boolean; improvedTurns: boolean; improvedHp: boolean; firstClear: boolean }> => {
      if (!user) throw new Error('Not authenticated');

      const { data: existing } = await (supabase as any)
        .from('rune_delve_runs')
        .select('*')
        .eq('user_id', user.id)
        .eq('level_id', params.level_id)
        .eq('hero_class', params.hero_class)
        .maybeSingle();

      const prevScore = existing?.score ?? 0;
      const prevChain = existing?.longest_chain ?? 0;
      const prevEnemies = existing?.enemies_defeated ?? 0;
      const prevDamage = existing?.total_damage ?? 0;
      const prevHpBest = existing?.best_hp_remaining ?? 0;
      const prevTurnsBest = existing?.best_turns_used ?? null;
      const prevAttempts = existing?.attempts ?? 0;
      const prevClears = existing?.clears ?? 0;
      const prevCleared = !!existing?.dungeon_cleared;
      const prevXp = existing?.xp_earned ?? 0;

      const wasNewBest = params.score > prevScore;
      const improvedChain = params.longest_chain > prevChain;
      // Only count "fastest clear" improvements when this run actually cleared.
      const improvedTurns = params.dungeon_cleared
        && (prevTurnsBest == null || params.turns_used < prevTurnsBest);
      const improvedHp = params.dungeon_cleared && params.hp_remaining > prevHpBest;
      const firstClear = params.dungeon_cleared && !prevCleared;

      // Per-stat best-of merge. Score is canonical for leaderboards/XP, but
      // the saved row keeps the maximum of every secondary stat ever seen.
      const merged: Record<string, any> = {
        // Always-tick replay metadata
        attempts: prevAttempts + 1,
        clears: prevClears + (params.dungeon_cleared ? 1 : 0),
        last_played_at: new Date().toISOString(),
        // Identity
        hero_class: params.hero_class,
        level_number: params.level_number,
        ability_used: params.ability_used,
        // Best-of (max)
        score: Math.max(prevScore, params.score),
        longest_chain: Math.max(prevChain, params.longest_chain),
        enemies_defeated: Math.max(prevEnemies, params.enemies_defeated),
        total_damage: Math.max(prevDamage, params.total_damage),
        best_hp_remaining: Math.max(prevHpBest, params.dungeon_cleared ? params.hp_remaining : 0),
        // Sticky-true
        dungeon_cleared: prevCleared || params.dungeon_cleared,
        // Best XP earned (mirrors best score)
        xp_earned: Math.max(prevXp, params.xp_earned),
        // Fastest clear (min over clears only). Stays null until first clear.
        best_turns_used: improvedTurns ? params.turns_used : prevTurnsBest,
      };

      // Snapshot fields ("latest best attempt" view) — only refresh on a new
      // best so the headline run on the Results page reflects the best run.
      if (wasNewBest) {
        merged.hp_remaining = params.hp_remaining;
        merged.turns_used = params.turns_used;
      }

      // Helper: re-fetch the canonical row for this (user, level) when the
      // post-write SELECT returns no row (can happen under RLS / replica lag).
      const refetch = async () => {
        const { data } = await (supabase as any)
          .from('rune_delve_runs')
          .select('*')
          .eq('user_id', user.id)
          .eq('level_id', params.level_id)
          .eq('hero_class', params.hero_class)
          .maybeSingle();
        return data ?? null;
      };

      let row: any = null;
      if (existing) {
        const { data, error } = await (supabase as any)
          .from('rune_delve_runs')
          .update(merged)
          .eq('id', existing.id)
          .select()
          .maybeSingle();
        if (error) throw error;
        row = data ?? (await refetch());
        // Defensive verification: if RLS silently filters the UPDATE the row
        // won't reflect our merged payload. Surface that loudly instead of
        // pretending the write succeeded.
        if (row && (row.attempts ?? 0) < merged.attempts) {
          console.warn('[rune-delve] UPDATE on rune_delve_runs returned stale row', {
            expectedAttempts: merged.attempts,
            actualAttempts: row.attempts,
            rowId: existing.id,
          });
          throw new Error('Failed to save run — please try again.');
        }
      } else {
        const { data, error } = await (supabase as any)
          .from('rune_delve_runs')
          .insert({
            user_id: user.id,
            level_id: params.level_id,
            level_number: params.level_number,
            score: params.score,
            enemies_defeated: params.enemies_defeated,
            dungeon_cleared: params.dungeon_cleared,
            turns_used: params.turns_used,
            total_damage: params.total_damage,
            longest_chain: params.longest_chain,
            hp_remaining: params.hp_remaining,
            xp_earned: params.xp_earned,
            ability_used: params.ability_used,
            hero_class: params.hero_class,
            attempts: 1,
            clears: params.dungeon_cleared ? 1 : 0,
            best_turns_used: params.dungeon_cleared ? params.turns_used : null,
            best_hp_remaining: params.dungeon_cleared ? params.hp_remaining : 0,
            last_played_at: new Date().toISOString(),
          })
          .select()
          .maybeSingle();
        if (error) {
          // Unique-violation race (another submit landed first): merge into it.
          if ((error as any)?.code === '23505') {
            const current = await refetch();
            if (current) {
              const { data: upd, error: updErr } = await (supabase as any)
                .from('rune_delve_runs')
                .update(merged)
                .eq('id', current.id)
                .select()
                .maybeSingle();
              if (updErr) throw updErr;
              row = upd ?? (await refetch());
            } else {
              // Deployment bridge: before the class-specific unique index is
              // applied, the legacy (user, level) row blocks this class's
              // insert. Reuse that one row so saves remain functional during
              // the brief code/SQL rollout window.
              const { data: legacy } = await (supabase as any)
                .from('rune_delve_runs')
                .select('*')
                .eq('user_id', user.id)
                .eq('level_id', params.level_id)
                .maybeSingle();
              if (legacy) {
                const { data: upd, error: updErr } = await (supabase as any)
                  .from('rune_delve_runs')
                  .update({ ...merged, hero_class: params.hero_class })
                  .eq('id', legacy.id)
                  .select()
                  .maybeSingle();
                if (updErr) throw updErr;
                row = upd ?? null;
              }
            }
          } else {
            throw error;
          }
        } else {
          row = data ?? (await refetch());
        }
      }
      // Last-resort fallback: synthesize a client-side row so the UI can still
      // render Results even if RLS hides the post-write SELECT.
      if (!row) {
        row = { ...merged, user_id: user.id, level_id: params.level_id };
      }
      return { row, wasNewBest, improvedChain, improvedTurns, improvedHp, firstClear };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rune-delve-level-run'] });
      qc.invalidateQueries({ queryKey: ['rune-delve-progress'] });
      qc.invalidateQueries({ queryKey: ['rune-delve-progress-leaderboard'] });
      qc.invalidateQueries({ queryKey: ['rune-delve-history'] });
      qc.invalidateQueries({ queryKey: ['rune-delve-level-history'] });
      qc.invalidateQueries({ queryKey: ['rune-delve-hero', user?.id] });
    },
  });
}

// Advance progress after a successful clear: unlocks the next level.
export function useAdvanceProgress() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ clearedLevel, heroClass }: { clearedLevel: number; heroClass: HeroClass }) => {
      if (!user) throw new Error('Not authenticated');
      const { data: classExisting, error: classReadError } = await supabase
        .from('rune_delve_class_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('class', heroClass)
        .maybeSingle();
      if (classReadError) throw classReadError;

      let classCampaignReady = classExisting == null
        || typeof classExisting.highest_unlocked_level === 'number';
      const classCompleted = classCampaignReady ? (classExisting?.highest_completed_level ?? 0) : 0;
      const classUnlocked = classCampaignReady ? (classExisting?.highest_unlocked_level ?? 1) : 1;
      const classTotal = classCampaignReady ? (classExisting?.total_levels_cleared ?? 0) : 0;
      const isNewClassClear = clearedLevel > classCompleted;
      const classPayload = {
        highest_unlocked_level: Math.max(classUnlocked, clearedLevel + 1),
        highest_completed_level: Math.max(classCompleted, clearedLevel),
        total_levels_cleared: classTotal + (isNewClassClear ? 1 : 0),
        current_chapter: chapterFor(Math.max(classUnlocked, clearedLevel + 1)),
      };

      let savedClass: RuneDelveProgress | null = null;
      if (classCampaignReady) {
        if (classExisting) {
          const { data, error } = await supabase
            .from('rune_delve_class_progress')
            .update(classPayload)
            .eq('user_id', user.id)
            .eq('class', heroClass)
            .select()
            .single();
          if (error) throw error;
          savedClass = data as unknown as RuneDelveProgress;
        } else {
          const { data, error } = await supabase
            .from('rune_delve_class_progress')
            .insert({ user_id: user.id, class: heroClass, ...classPayload })
            .select()
            .single();
          if (error) {
            // Staged-deploy bridge: the old schema rejects the new campaign
            // fields. Keep global progression working until the SQL is applied.
            const message = String(error.message ?? '').toLowerCase();
            if (error.code === 'PGRST204' || message.includes('highest_unlocked_level')) {
              classCampaignReady = false;
            } else {
              throw error;
            }
          } else {
            savedClass = data as unknown as RuneDelveProgress;
          }
        }
      }

      // Keep the original per-user row as an aggregate leaderboard record:
      // furthest depth across all classes + total first-clears across builds.
      const { data: globalExisting } = await supabase
        .from('rune_delve_progress')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      const globalCompleted = globalExisting?.highest_completed_level ?? 0;
      const globalUnlocked = globalExisting?.highest_unlocked_level ?? 1;
      const globalTotal = globalExisting?.total_levels_cleared ?? 0;
      const countsAsNew = classCampaignReady ? isNewClassClear : clearedLevel > globalCompleted;
      const aggregatePayload = {
        highest_unlocked_level: Math.max(globalUnlocked, clearedLevel + 1),
        highest_completed_level: Math.max(globalCompleted, clearedLevel),
        total_levels_cleared: globalTotal + (countsAsNew ? 1 : 0),
        current_chapter: chapterFor(Math.max(globalUnlocked, clearedLevel + 1)),
      };
      if (globalExisting) {
        const { error } = await supabase
          .from('rune_delve_progress')
          .update(aggregatePayload)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('rune_delve_progress')
          .insert({ user_id: user.id, ...aggregatePayload });
        if (error) throw error;
      }

      // Before the migration, class campaign columns do not exist. Returning
      // the aggregate preserves legacy behavior until the provided SQL lands.
      return savedClass ?? {
        id: globalExisting?.id ?? '',
        user_id: user.id,
        class: heroClass,
        highest_unlocked_level: aggregatePayload.highest_unlocked_level,
        highest_completed_level: aggregatePayload.highest_completed_level,
        total_levels_cleared: aggregatePayload.total_levels_cleared,
        current_chapter: aggregatePayload.current_chapter,
      } as RuneDelveProgress;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rune-delve-progress'] });
      qc.invalidateQueries({ queryKey: ['rune-delve-class-progress', user?.id] });
      qc.invalidateQueries({ queryKey: ['rune-delve-progress-leaderboard'] });
    },
  });
}

// Campaign leaderboard — ranked by highest_completed_level then total cleared.
export function useCampaignLeaderboard() {
  return useQuery({
    queryKey: ['rune-delve-progress-leaderboard'],
    staleTime: 30_000,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from('rune_delve_progress')
        .select('*')
        .order('highest_completed_level', { ascending: false })
        .order('total_levels_cleared', { ascending: false })
        .limit(100);
      const list = (rows ?? []) as RuneDelveProgress[];
      const userIds = Array.from(new Set(list.map(r => r.user_id)));
      let profiles: Record<string, { display_name: string | null; avatar_url: string | null }> = {};
      let heroes: Record<string, { class: string; level: number; hero_name: string; cosmetic_title: string | null; current_streak: number }> = {};
      if (userIds.length) {
        const [{ data: pdata }, { data: hdata }] = await Promise.all([
          supabase.from('profiles').select('id, display_name, avatar_url').in('id', userIds),
          supabase.from('rune_delve_heroes').select('user_id, class, level, hero_name, cosmetic_title, current_streak').in('user_id', userIds),
        ]);
        profiles = Object.fromEntries((pdata ?? []).map((p: any) => [p.id, p]));
        heroes = Object.fromEntries((hdata ?? []).map((h: any) => [h.user_id, h]));
      }
      return list.map((r, i) => ({
        ...r,
        rank: i + 1,
        profile: profiles[r.user_id] ?? { display_name: 'Unknown', avatar_url: null },
        hero: heroes[r.user_id] ?? null,
      }));
    },
  });
}

// Best score per level across all players (top 5) — for the level details popover.
export function useLevelBestScores(levelId: string | undefined) {
  return useQuery({
    queryKey: ['rune-delve-level-best', levelId],
    enabled: !!levelId && !levelId.startsWith('transient-'),
    staleTime: 30_000,
    queryFn: async () => {
      if (!levelId) return [];
      const { data: runs } = await supabase
        .from('rune_delve_runs')
        .select('*')
        .eq('level_id', levelId)
        .order('score', { ascending: false })
        .limit(5);
      const list = runs ?? [];
      const userIds = Array.from(new Set(list.map((r: any) => r.user_id))) as string[];
      let heroes: Record<string, { hero_name: string; class: string }> = {};
      if (userIds.length) {
        const { data: hdata } = await supabase
          .from('rune_delve_heroes').select('user_id, hero_name, class').in('user_id', userIds);
        heroes = Object.fromEntries((hdata ?? []).map((h: any) => [h.user_id, h]));
      }
      return list.map((r: any, i: number) => ({
        ...r,
        rank: i + 1,
        hero: heroes[r.user_id] ?? null,
      }));
    },
  });
}
