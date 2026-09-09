// Campaign validation engine.
//
// Runs over a CampaignPackage (imported or exported from the DB) and reports
// structural problems before publishing. Errors block publishing; warnings and
// info do not.

import type {
  CampaignPackage,
  Requirement,
  Effect,
  SceneDef,
  RuntimeEncounterAction,
  RuntimeEncounterDefinition,
} from './types';
import { isGroup } from './types';

export type Severity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  severity: Severity;
  code: string;
  message: string;
  scene_key?: string;
  choice_key?: string;
}

export interface ValidationResult {
  issues: ValidationIssue[];
  errors: number;
  warnings: number;
  infos: number;
  canPublish: boolean;
  stats: {
    scenes: number; choices: number; blocks: number; endings: number;
    reachable: number; unreachable: string[]; deadEnds: string[];
  };
}

interface AuthoredEncounterAction extends RuntimeEncounterAction {
  success_effects?: Effect[];
  costly_effects?: Effect[];
  setback_effects?: Effect[];
}

interface AuthoredEncounter extends Omit<RuntimeEncounterDefinition, 'actions'> {
  resolved_flag?: string;
  success_effects?: Effect[];
  failure_effects?: Effect[];
  actions: AuthoredEncounterAction[];
}

function flatten(req: Requirement | Requirement[] | null | undefined): Requirement[] {
  if (req == null) return [];
  if (Array.isArray(req)) return req.flatMap(flatten);
  if (isGroup(req)) return [req, ...(req.conditions ?? []).flatMap(flatten)];
  return [req];
}

const REQ_KEY_BUCKET: Record<string, 'flag' | 'item' | 'quest' | 'npc' | 'codex' | 'location' | 'variable' | 'faction' | 'choice' | null> = {
  flag_equals: 'flag', flag_exists: 'flag', flag_not_exists: 'flag',
  has_item: 'item', does_not_have_item: 'item',
  quest_status: 'quest',
  relationship_minimum: 'npc', relationship_maximum: 'npc',
  character_alive: 'npc', character_dead: 'npc',
  codex_unlocked: 'codex', location_visited: 'location',
  variable_equals: 'variable', campaign_variable_equals: 'variable',
  variable_minimum: 'variable', variable_maximum: 'variable',
  faction_reputation_minimum: 'faction', faction_reputation_maximum: 'faction',
  previous_choice: 'choice',
  // Checks that reference no declared package entity (stat/trait/ability/level/
  // health/world-state keys are runtime state, not authored rows) → null bucket
  // means "valid type, skip key-existence check". Mirrors the engine's runtime.
  stat_minimum: null, stat_maximum: null,
  has_trait: null, has_ability: null,
  level_minimum: null, health_minimum: null,
  world_state_equals: null,
};

const EFFECT_KEY_BUCKET: Record<string, 'flag' | 'item' | 'quest' | 'npc' | 'codex' | 'location' | 'variable' | 'faction' | null> = {
  set_flag: 'flag', unset_flag: 'flag',
  add_item: 'item', remove_item: 'item',
  start_quest: 'quest', advance_quest: 'quest', complete_quest: 'quest', fail_quest: 'quest',
  increase_relationship: 'npc', decrease_relationship: 'npc', set_relationship: 'npc',
  character_alive: 'npc', character_dead: 'npc',
  unlock_codex: 'codex', unlock_location: 'location', visit_location: 'location',
  set_variable: 'variable', increment_variable: 'variable', decrement_variable: 'variable',
  increase_faction_reputation: 'faction', decrease_faction_reputation: 'faction',
  // Resource / stat / world effects reference runtime state, not authored rows
  // → null bucket = valid type, no key-existence check. Mirrors the engine.
  gain_gold: null, lose_gold: null, gain_xp: null,
  increase_stat: null, decrease_stat: null,
  unlock_trait: null, unlock_ability: null,
  damage_player: null, heal_player: null,
  change_world_state: null,
};

export function validateCampaign(pkg: CampaignPackage): ValidationResult {
  const issues: ValidationIssue[] = [];
  const add = (severity: Severity, code: string, message: string, scene_key?: string, choice_key?: string) =>
    issues.push({ severity, code, message, scene_key, choice_key });

  const scenes = pkg.scenes ?? [];
  const sceneKeys = new Set<string>();
  const dupScenes = new Set<string>();
  for (const s of scenes) {
    if (!s.scene_key) add('error', 'scene_missing_key', 'A scene has no scene_key.');
    else if (sceneKeys.has(s.scene_key)) dupScenes.add(s.scene_key);
    else sceneKeys.add(s.scene_key);
  }
  dupScenes.forEach((k) => add('error', 'duplicate_scene_key', `Duplicate scene key "${k}".`, k));

  const chapterKeys = new Set((pkg.chapters ?? []).map((c) => c.chapter_key));
  const actKeys = new Set((pkg.acts ?? []).map((a) => a.act_key));
  (pkg.chapters ?? []).forEach((c) => {
    if (c.act_key && !actKeys.has(c.act_key)) add('warning', 'missing_act', `Chapter "${c.chapter_key}" references unknown act "${c.act_key}".`);
  });

  const known = {
    flag: new Set<string>(),
    item: new Set((pkg.items ?? []).map((i) => i.item_key)),
    quest: new Set((pkg.quests ?? []).map((q) => q.quest_key)),
    npc: new Set((pkg.npcs ?? []).map((n) => n.npc_key)),
    codex: new Set((pkg.codex ?? []).map((c) => c.codex_key)),
    location: new Set((pkg.locations ?? []).map((l) => l.location_key)),
    variable: new Set((pkg.variables ?? []).map((v) => v.variable_key)),
    faction: new Set((pkg.factions ?? []).map((f) => f.faction_key)),
    choice: new Set<string>(),
  };
  const adventure = pkg.campaign?.config?.adventure as { encounters?: Record<string, AuthoredEncounter> } | undefined;
  const encounters = adventure?.encounters ?? {};

  // Flags and choice keys are declared implicitly by effects.
  const allChoices = scenes.flatMap((s) => (s.choices ?? []).map((c) => ({ scene: s, choice: c })));
  allChoices.forEach(({ choice }) => known.choice.add(choice.choice_key));
  const collectEffects = (fx: Effect[] | undefined) => (fx ?? []).forEach((e) => {
    if (EFFECT_KEY_BUCKET[e.type] === 'flag' && e.key) known.flag.add(e.key);
  });
  scenes.forEach((s) => collectEffects(s.entry_effects));
  allChoices.forEach(({ choice }) => collectEffects(choice.effects));
  Object.entries(encounters).forEach(([sceneKey, encounter]) => {
    known.flag.add(encounter.resolved_flag || `encounter_${sceneKey}_resolved`);
    collectEffects(encounter.success_effects);
    collectEffects(encounter.failure_effects);
    (encounter.actions ?? []).forEach((action) => {
      collectEffects(action.success_effects);
      collectEffects(action.costly_effects);
      collectEffects(action.setback_effects);
    });
  });

  // Choice keys must be unique WITHIN a scene (the runtime resolves a choice by
  // scene_key + choice_key), not across the whole campaign — reusing
  // "continue" in every scene is legal and idiomatic.
  const seenChoice = new Set<string>();          // all keys, for combat outcome refs
  const perScene = new Map<string, Set<string>>();
  allChoices.forEach(({ scene, choice }) => {
    if (!choice.choice_key) {
      add('error', 'choice_missing_key', 'A choice has no choice_key.', scene.scene_key);
      return;
    }
    seenChoice.add(choice.choice_key);
    const bucket = perScene.get(scene.scene_key) ?? new Set<string>();
    if (bucket.has(choice.choice_key)) {
      add('error', 'duplicate_choice_key', `Duplicate choice key "${choice.choice_key}" within scene "${scene.scene_key}".`, scene.scene_key, choice.choice_key);
    } else {
      bucket.add(choice.choice_key);
      perScene.set(scene.scene_key, bucket);
    }
  });

  const checkRefs = (
    reqs: Requirement[], fx: Effect[], scene_key?: string, choice_key?: string,
  ) => {
    reqs.forEach((r) => {
      if (isGroup(r)) {
        if (!(r.conditions ?? []).length) add('warning', 'empty_group', `Empty "${r.type}" requirement group.`, scene_key, choice_key);
        return;
      }
      const bucket = REQ_KEY_BUCKET[r.type];
      if (bucket === undefined) add('error', 'invalid_requirement', `Unknown requirement type "${r.type}".`, scene_key, choice_key);
      if (bucket && r.key && !known[bucket].has(r.key)) {
        add('warning', `undefined_${bucket}`, `Requirement references undefined ${bucket} "${r.key}".`, scene_key, choice_key);
      }
    });
    fx.forEach((e) => {
      const bucket = EFFECT_KEY_BUCKET[e.type];
      if (bucket === undefined) add('error', 'invalid_effect', `Unknown effect type "${e.type}".`, scene_key, choice_key);
      if (bucket && bucket !== 'flag' && e.key && !known[bucket].has(e.key)) {
        add('warning', `undefined_${bucket}`, `Effect references undefined ${bucket} "${e.key}".`, scene_key, choice_key);
      }
      if (bucket && !e.key) add('error', 'effect_missing_key', `Effect "${e.type}" has no key.`, scene_key, choice_key);
    });
  };

  // Adventure encounters are stored in campaign config so immutable releases
  // pin their rules with the authored scene graph. Validate that free-form
  // config as strictly as ordinary choices before Studio allows publishing.
  Object.entries(encounters).forEach(([sceneKey, encounter]) => {
    if (!sceneKeys.has(sceneKey)) {
      add('error', 'encounter_missing_scene', `Adventure encounter references missing scene "${sceneKey}".`, sceneKey);
    }
    if (!encounter.encounter_key || !encounter.title || !encounter.objective) {
      add('error', 'encounter_missing_identity', `Adventure encounter in "${sceneKey}" needs a key, title and objective.`, sceneKey);
    }
    if (!Number.isFinite(encounter.target_progress) || encounter.target_progress < 1) {
      add('error', 'encounter_bad_progress', `Adventure encounter in "${sceneKey}" needs positive target_progress.`, sceneKey);
    }
    if (!Number.isFinite(encounter.max_rounds) || encounter.max_rounds < 1) {
      add('error', 'encounter_bad_rounds', `Adventure encounter in "${sceneKey}" needs positive max_rounds.`, sceneKey);
    }
    if (!(encounter.actions ?? []).length) {
      add('error', 'encounter_no_actions', `Adventure encounter in "${sceneKey}" has no approaches.`, sceneKey);
    }

    checkRefs([], encounter.success_effects ?? [], sceneKey);
    checkRefs([], encounter.failure_effects ?? [], sceneKey);
    const actionKeys = new Set<string>();
    (encounter.actions ?? []).forEach((action) => {
      if (!action.action_key || actionKeys.has(action.action_key)) {
        add('error', 'encounter_bad_action_key', `Encounter in "${sceneKey}" has a missing or duplicate action key.`, sceneKey);
      }
      actionKeys.add(action.action_key);
      if (!['might', 'finesse', 'wits', 'resolve'].includes(action.stat)) {
        add('error', 'encounter_bad_stat', `Approach "${action.action_key}" uses unknown stat "${action.stat}".`, sceneKey);
      }
      if (!Number.isFinite(action.difficulty) || action.difficulty < 5 || action.difficulty > 30) {
        add('error', 'encounter_bad_difficulty', `Approach "${action.action_key}" has an invalid difficulty.`, sceneKey);
      }
      if (!['measured', 'bold', 'desperate'].includes(action.risk)) {
        add('error', 'encounter_bad_risk', `Approach "${action.action_key}" has an invalid risk.`, sceneKey);
      }
      checkRefs([], action.success_effects ?? [], sceneKey, action.action_key);
      checkRefs([], action.costly_effects ?? [], sceneKey, action.action_key);
      checkRefs([], action.setback_effects ?? [], sceneKey, action.action_key);
    });
  });

  // Scene-level checks
  const outgoing = new Map<string, string[]>();
  let blockCount = 0;
  scenes.forEach((s) => {
    blockCount += (s.blocks ?? []).length;
    checkRefs(flatten(s.entry_conditions), s.entry_effects ?? [], s.scene_key);
    (s.blocks ?? []).forEach((b) => checkRefs(flatten(b.conditions), [], s.scene_key));

    if (s.location_key && !known.location.has(s.location_key)) {
      add('warning', 'undefined_location', `Scene references undefined location "${s.location_key}".`, s.scene_key);
    }
    if (s.ending_key && !(pkg.endings ?? []).some((e) => e.ending_key === s.ending_key)) {
      add('error', 'undefined_ending', `Scene references undefined ending "${s.ending_key}".`, s.scene_key);
    }

    const dests: string[] = [];
    if (s.auto_next_scene_key) {
      if (!sceneKeys.has(s.auto_next_scene_key)) {
        add('error', 'invalid_destination', `Automatic transition on "${s.scene_key}" points at missing scene "${s.auto_next_scene_key}".`, s.scene_key);
      } else {
        dests.push(s.auto_next_scene_key);
      }
    }

    // Routing nodes are invisible: the engine chains straight through them, so
    // they must have an automatic destination and can never end a run.
    if (s.is_routing_node) {
      if (!s.auto_next_scene_key) {
        add('error', 'routing_node_no_destination', `Routing node "${s.scene_key}" has no auto_next_scene_key.`, s.scene_key);
      }
      if (s.is_terminal) {
        add('error', 'routing_node_terminal', `Routing node "${s.scene_key}" cannot be terminal — routing nodes are never displayed.`, s.scene_key);
      }
      if ((s.choices ?? []).length) {
        add('warning', 'routing_node_choices', `Routing node "${s.scene_key}" has choices that will never be shown.`, s.scene_key);
      }
      if ((s.blocks ?? []).length) {
        add('warning', 'routing_node_blocks', `Routing node "${s.scene_key}" has narrative blocks that will never be shown.`, s.scene_key);
      }
    }
    (s.choices ?? []).forEach((c) => {
      checkRefs(flatten(c.requirements), c.effects ?? [], s.scene_key, c.choice_key);
      if (!c.next_scene_key) {
        add('error', 'choice_missing_destination', `Choice "${c.choice_key}" has no destination scene.`, s.scene_key, c.choice_key);
      } else if (!sceneKeys.has(c.next_scene_key)) {
        add('error', 'invalid_destination', `Choice "${c.choice_key}" points at missing scene "${c.next_scene_key}".`, s.scene_key, c.choice_key);
      } else {
        dests.push(c.next_scene_key);
      }
      if (c.next_scene_key === s.scene_key && !c.requirements) {
        add('info', 'self_loop', `Choice "${c.choice_key}" loops back to its own scene (fine for hubs).`, s.scene_key, c.choice_key);
      }
    });
    outgoing.set(s.scene_key, dests);

    if (s.chapter_key && !chapterKeys.has(s.chapter_key)) {
      add('warning', 'missing_chapter', `Scene references unknown chapter "${s.chapter_key}".`, s.scene_key);
    }
    if (!s.is_terminal && dests.length === 0) {
      add('error', 'dead_end', `Scene "${s.scene_key}" has no way out and is not marked terminal.`, s.scene_key);
    }
    if (s.is_terminal && dests.length > 0) {
      add('warning', 'terminal_with_exits', `Terminal scene "${s.scene_key}" still has outgoing choices.`, s.scene_key);
    }
    if (!(s.blocks ?? []).length && !s.is_routing_node) {
      add('warning', 'empty_scene', `Scene "${s.scene_key}" has no narrative blocks.`, s.scene_key);
    }
    (s.blocks ?? []).forEach((b) => {
      if (b.block_type === 'combat') {
        const md = (b.metadata ?? {}) as Record<string, unknown>;
        const keys = (md.enemy_keys as string[]) ?? [];
        if (!keys.length) add('error', 'combat_no_enemies', `Combat block in "${s.scene_key}" has no enemy_keys.`, s.scene_key);
        keys.forEach((k) => {
          if (!(pkg.enemies ?? []).some((e) => e.enemy_key === k)) {
            add('error', 'undefined_enemy', `Combat block references undefined enemy "${k}".`, s.scene_key);
          }
        });
        ['victory_choice_key', 'defeat_choice_key'].forEach((f) => {
          const v = md[f] as string | undefined;
          if (!v) add('error', 'combat_missing_outcome', `Combat block in "${s.scene_key}" is missing ${f}.`, s.scene_key);
          else if (!seenChoice.has(v)) add('error', 'combat_bad_outcome', `Combat block ${f} "${v}" is not a choice in this campaign.`, s.scene_key);
        });
      }
      if (b.block_type === 'dialogue') {
        const speaker = (b.metadata ?? {}).speaker_key as string | undefined;
        if (speaker && !known.npc.has(speaker)) {
          add('warning', 'undefined_npc', `Dialogue references undefined NPC "${speaker}".`, s.scene_key);
        }
      }
    });
  });

  // Reachability from the starting scene
  const start = pkg.campaign?.starting_scene_key;
  if (!start) add('error', 'no_start', 'Campaign has no starting_scene_key.');
  else if (!sceneKeys.has(start)) add('error', 'bad_start', `starting_scene_key "${start}" does not exist.`);

  const reachable = new Set<string>();
  if (start && sceneKeys.has(start)) {
    const queue = [start];
    while (queue.length) {
      const cur = queue.shift()!;
      if (reachable.has(cur)) continue;
      reachable.add(cur);
      (outgoing.get(cur) ?? []).forEach((d) => { if (!reachable.has(d)) queue.push(d); });
    }
  }
  const unreachable = scenes.map((s) => s.scene_key).filter((k) => k && !reachable.has(k));
  unreachable.forEach((k) => add('warning', 'unreachable_scene', `Scene "${k}" cannot be reached from the start.`, k));

  // Endings
  (pkg.endings ?? []).forEach((e) => {
    const hasScene = scenes.some((s) => s.ending_key === e.ending_key);
    if (!hasScene) add('warning', 'unreachable_ending', `Ending "${e.ending_key}" is not attached to any terminal scene.`);
  });
  if (!scenes.some((s) => s.is_terminal)) add('warning', 'no_terminal_scene', 'Campaign has no terminal scene — it can never end.');

  // Unconditional cycles that can never leave (accidental infinite loops)
  detectTrappedLoops(scenes, outgoing).forEach((group) =>
    add('info', 'cycle', `Scenes ${group.join(' → ')} form a loop. Intentional for hubs; verify there is an exit.`, group[0]));

  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;
  const infos = issues.filter((i) => i.severity === 'info').length;

  return {
    issues, errors, warnings, infos,
    canPublish: errors === 0,
    stats: {
      scenes: scenes.length,
      choices: allChoices.length,
      blocks: blockCount,
      endings: (pkg.endings ?? []).length,
      reachable: reachable.size,
      unreachable,
      deadEnds: scenes.filter((s) => !s.is_terminal && (outgoing.get(s.scene_key) ?? []).length === 0).map((s) => s.scene_key),
    },
  };
}

/** Strongly-connected components with more than one node, or self loops. */
function detectTrappedLoops(scenes: SceneDef[], outgoing: Map<string, string[]>): string[][] {
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const out: string[][] = [];
  let counter = 0;

  const strongConnect = (v: string) => {
    index.set(v, counter); low.set(v, counter); counter += 1;
    stack.push(v); onStack.add(v);
    for (const w of outgoing.get(v) ?? []) {
      if (!index.has(w)) {
        strongConnect(w);
        low.set(v, Math.min(low.get(v)!, low.get(w)!));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v)!, index.get(w)!));
      }
    }
    if (low.get(v) === index.get(v)) {
      const comp: string[] = [];
      let w: string;
      do { w = stack.pop()!; onStack.delete(w); comp.push(w); } while (w !== v);
      if (comp.length > 1) out.push(comp.reverse());
    }
  };

  scenes.forEach((s) => { if (s.scene_key && !index.has(s.scene_key)) strongConnect(s.scene_key); });
  return out;
}
