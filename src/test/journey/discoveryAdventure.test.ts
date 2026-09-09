import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  encounterFocus,
  encounterProgressPercent,
  exposureBand,
  latestEncounterRoll,
  statLabel,
} from '@/lib/journey/adventure';
import { validateCampaign } from '@/lib/journey/validate';
import { EMPTY_RUN_STATE } from '@/lib/journey/types';
import type { CampaignPackage, RuntimeEncounterPayload } from '@/lib/journey/types';

const campaign = JSON.parse(
  readFileSync(resolve(process.cwd(), 'public/campaigns/the-discovery-below.json'), 'utf8'),
) as CampaignPackage;

interface BalanceAction {
  action_key: string;
  stat: 'might' | 'finesse' | 'wits' | 'resolve';
  difficulty: number;
  focus_cost: number;
  roll_bonus?: number;
  success_progress?: number;
  costly_progress?: number;
  setback_progress?: number;
  costly_damage?: number;
  setback_damage?: number;
  requirements?: unknown;
  locked_hint?: string;
}

interface BalanceEncounter {
  target_progress: number;
  max_rounds: number;
  max_focus: number;
  actions: BalanceAction[];
}

const authoredEncounters = () => (
  campaign.campaign.config?.adventure as { encounters: Record<string, BalanceEncounter> }
).encounters;

const theronStats = { might: 2, finesse: 2, wits: 3, resolve: 3 };

function outcomeWeights(action: BalanceAction) {
  let success = 0;
  let costly = 0;
  let setback = 0;
  for (let die = 1; die <= 20; die += 1) {
    const total = die + theronStats[action.stat] + (action.roll_bonus ?? 0);
    if (die === 20 || total >= action.difficulty) success += 1;
    else if (die !== 1 && total >= action.difficulty - 3) costly += 1;
    else setback += 1;
  }
  return { success: success / 20, costly: costly / 20, setback: setback / 20 };
}

function actionValue(action: BalanceAction): number {
  const p = outcomeWeights(action);
  const progress = p.success * (action.success_progress ?? 2)
    + p.costly * (action.costly_progress ?? 1)
    + p.setback * (action.setback_progress ?? 0);
  const strain = p.costly * (action.costly_damage ?? 1) + p.setback * (action.setback_damage ?? 2);
  return progress - strain * 0.08;
}

function makeRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function simulateEncounter(encounter: BalanceEncounter, seed: number): boolean {
  const random = makeRandom(seed);
  let progress = 0;
  let focus = encounter.max_focus;
  let health = 20;
  for (let round = 1; round <= encounter.max_rounds; round += 1) {
    // Keep the baseline balance test honest: earned approaches are only
    // available after earlier story decisions and should not inflate every run.
    const usable = encounter.actions.filter((action) => !action.requirements && action.focus_cost <= focus);
    const action = [...usable].sort((a, b) => actionValue(b) - actionValue(a))[0];
    focus -= action.focus_cost;
    const die = Math.floor(random() * 20) + 1;
    const total = die + theronStats[action.stat] + (action.roll_bonus ?? 0);
    if (die === 20 || total >= action.difficulty) {
      progress += (action.success_progress ?? 2) + (die === 20 ? 1 : 0);
    } else if (die !== 1 && total >= action.difficulty - 3) {
      progress += action.costly_progress ?? 1;
      health -= action.costly_damage ?? 1;
    } else {
      progress += action.setback_progress ?? 0;
      health -= action.setback_damage ?? 2;
    }
    if (progress >= encounter.target_progress) return true;
    if (health <= 0) return false;
  }
  return false;
}

describe('The Discovery Below adventure layer', () => {
  it('remains structurally publishable after the RPG pass', () => {
    const result = validateCampaign(campaign);
    expect(result.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    expect(result.issues.filter((issue) => issue.code.startsWith('undefined_'))).toEqual([]);
    expect(result.canPublish).toBe(true);
    expect(result.stats.reachable).toBe(result.stats.scenes);
  });

  it('places a tactical encounter at every pivotal gameplay scene', () => {
    const encounters = authoredEncounters();

    expect(Object.keys(encounters)).toEqual(['S04', 'S05', 'S08', 'S09', 'S13', 'S14']);
    Object.values(encounters).forEach((encounter) => {
      expect(encounter.actions.length).toBeGreaterThanOrEqual(3);
      expect(encounter.actions.some((action) => action.focus_cost === 0)).toBe(true);
      expect(new Set(encounter.actions.map((action) => action.action_key)).size).toBe(encounter.actions.length);
      encounter.actions.forEach((action) => expect(action.difficulty).toBeGreaterThanOrEqual(10));
    });
  });

  it('turns every authored decision into a visible identity and consequence signal', () => {
    const scenes = campaign.scenes ?? [];
    const choices = scenes.flatMap((scene) => scene.choices ?? []);

    expect(scenes).toHaveLength(21);
    expect(choices).toHaveLength(47);
    choices.forEach((choice) => {
      expect(choice.tags?.filter((tag) => tag.startsWith('path:'))).toHaveLength(1);
      expect(choice.tags?.some((tag) => tag.startsWith('impact:'))).toBe(true);
      expect(choice.tags?.filter((tag) => tag.startsWith('outcome:'))).toHaveLength(1);
    });

    const agency = campaign.campaign.config?.agency as {
      paths: Array<{ key: string; variable: string }>;
    };
    expect(agency.paths.map((path) => path.key)).toEqual(['guardian', 'seeker', 'defiant', 'maker']);
    expect(agency.paths.every((path) => campaign.variables?.some((variable) => variable.variable_key === path.variable))).toBe(true);
  });

  it('replaces passive transitions with decisions and a three-way late-game branch', () => {
    for (const sceneKey of ['S06A', 'S06B', 'S10A', 'S10B', 'S10C']) {
      expect(campaign.scenes.find((scene) => scene.scene_key === sceneKey)?.choices).toHaveLength(3);
    }

    const stormScene = campaign.scenes.find((scene) => scene.scene_key === 'S11')!;
    expect(stormScene.choices?.map((choice) => choice.next_scene_key)).toEqual(['S11A', 'S11B', 'S11C']);
    for (const branch of ['S11A', 'S11B', 'S11C']) {
      const scene = campaign.scenes.find((candidate) => candidate.scene_key === branch)!;
      expect(scene.auto_next_scene_key).toBe('S12');
      expect(scene.blocks?.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('rewards prior exploration with enforceable encounter approaches', () => {
    const encounters = authoredEncounters();
    const earned = Object.entries(encounters).flatMap(([sceneKey, encounter]) =>
      encounter.actions
        .filter((action) => action.requirements)
        .map((action) => ({ sceneKey, action })),
    );

    expect(earned.map(({ sceneKey, action }) => `${sceneKey}:${action.action_key}`)).toEqual([
      'S05:answer_with_the_fragment',
      'S09:call_the_witness',
      'S13:move_as_one_crew',
      'S14:lay_the_copper_path',
      'S14:chalk_the_missing_arc',
    ]);
    earned.forEach(({ action }) => expect(action.locked_hint).toBeTruthy());
  });

  it('keeps every challenge winnable without making outcomes automatic', () => {
    Object.entries(authoredEncounters()).forEach(([sceneKey, encounter]) => {
      const attempts = 2_000;
      let victories = 0;
      for (let seed = 1; seed <= attempts; seed += 1) {
        if (simulateEncounter(encounter, seed * 97 + sceneKey.charCodeAt(2))) victories += 1;
      }
      const winRate = victories / attempts;
      expect(winRate, `${sceneKey} should reward good decisions`).toBeGreaterThan(0.45);
      expect(winRate, `${sceneKey} should retain meaningful danger`).toBeLessThan(0.97);
    });
  });

  it('gates each encounter scene consequence behind its persisted resolution flag', () => {
    for (const sceneKey of ['S04', 'S05', 'S08', 'S09', 'S13', 'S14']) {
      const scene = campaign.scenes.find((candidate) => candidate.scene_key === sceneKey)!;
      const serialized = JSON.stringify(scene.choices?.map((choice) => choice.requirements));
      expect(serialized).toContain(`encounter_${sceneKey}_resolved`);
    }
  });

  it('adds concrete world rewards and progression', () => {
    expect(campaign.items?.length).toBeGreaterThanOrEqual(3);
    expect(campaign.quests?.some((quest) => quest.quest_key === 'what_the_stone_holds')).toBe(true);
    expect(campaign.codex?.length).toBeGreaterThanOrEqual(6);
    expect(campaign.enemies?.length).toBeGreaterThanOrEqual(2);
  });
});

describe('journey adventure presentation helpers', () => {
  const payload = {
    definition: {
      encounter_key: 'test',
      kind: 'hazard',
      title: 'Test',
      objective: 'Advance',
      stakes: 'Danger',
      target_progress: 5,
      max_rounds: 4,
      max_focus: 2,
      actions: [],
    },
    session: {
      status: 'active',
      round: 2,
      player_state: {
        progress: 3,
        focus: 1,
        last_result: {
          action_key: 'read', action_label: 'Read', stat: 'wits', die: 12,
          stat_score: 3, bonus: 0, total: 15, difficulty: 11,
          result: 'success', progress_gained: 2, damage: 0,
        },
      },
      log: [],
    },
    resolved: false,
    outcome: 'active',
  } as RuntimeEncounterPayload;

  it('normalizes progress, focus and the most recent roll', () => {
    expect(encounterProgressPercent(payload)).toBe(60);
    expect(encounterFocus(payload)).toBe(1);
    expect(latestEncounterRoll(payload)?.total).toBe(15);
    expect(statLabel('wits')).toBe('Wits');
  });

  it('translates exposure into legible pressure bands', () => {
    expect(exposureBand({ ...EMPTY_RUN_STATE, variables: { EXPOSURE: 0 } }).band).toBe('steady');
    expect(exposureBand({ ...EMPTY_RUN_STATE, variables: { EXPOSURE: 3 } }).band).toBe('strained');
    expect(exposureBand({ ...EMPTY_RUN_STATE, variables: { EXPOSURE: 5 } }).band).toBe('dangerous');
    expect(exposureBand({ ...EMPTY_RUN_STATE, variables: { EXPOSURE: 7 } }).band).toBe('critical');
  });
});
