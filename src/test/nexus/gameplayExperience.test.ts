import { describe, expect, it } from 'vitest';
import { initBattle, placeTower, startWave, tick } from '@/lib/nexus/engine';
import { MISSIONS } from '@/lib/nexus/missions';
import { runMission } from '@/lib/nexus/simulator';
import { getBriefing } from '@/lib/nexus/missionBriefings';
import { getEnginePathVariant } from '@/lib/nexus/mapLayouts';

function runLiveLayout(strategy: Parameters<typeof runMission>[0], seed: number, mission: (typeof MISSIONS)[number]) {
  const pathVariantId = getEnginePathVariant(getBriefing(mission.id)?.layoutId);
  return runMission(strategy, seed, mission, { pathVariantId });
}

describe('Nexus · campaign playability', () => {
  it('keeps every campaign mission finite and winnable for a strong strategy', () => {
    for (const mission of MISSIONS) {
      const runs = Array.from({ length: 6 }, (_, index) =>
        runLiveLayout('optimizer', 10_000 + mission.id * 100 + index, mission),
      );
      const wins = runs.filter(run => run.victory).length;

      expect(
        wins,
        `mission ${mission.id} should have a viable winning line (waves: ${runs.map(run => run.wavesCleared).join(', ')})`,
      ).toBeGreaterThanOrEqual(3);
      for (const run of runs) {
        expect(Number.isFinite(run.score)).toBe(true);
        expect(Number.isFinite(run.durationSec)).toBe(true);
        expect(run.durationSec).toBeGreaterThan(0);
        expect(run.wavesCleared).toBeGreaterThanOrEqual(0);
        expect(run.wavesCleared).toBeLessThanOrEqual(mission.waves.length);
      }
    }
  }, 30_000);

  it('makes First Contact a reliable onboarding mission', () => {
    const mission = MISSIONS[0];
    const runs = Array.from({ length: 8 }, (_, index) =>
      runLiveLayout('basic', 20_000 + index, mission),
    );
    expect(runs.filter(run => run.victory).length).toBeGreaterThanOrEqual(6);
  });

  it('preserves meaningful pressure in the campaign finale', () => {
    const finale = MISSIONS[MISSIONS.length - 1];
    const runs = Array.from({ length: 12 }, (_, index) =>
      runLiveLayout('realmix', 30_000 + index, finale),
    );
    const wins = runs.filter(run => run.victory).length;
    expect(wins).toBeGreaterThan(0);
    expect(wins).toBeLessThan(runs.length);
  }, 15_000);
});

describe('Nexus · premium combat telemetry', () => {
  it('emits damage-bearing shot events for visual feedback', () => {
    const mission = MISSIONS[0];
    let state = initBattle(mission.id, ['orbital', 'emp'], { mission });
    const placement = placeTower(state, 'pulse', 2, 1);
    expect(placement.ok).toBe(true);
    if (!placement.ok) return;

    state = startWave(placement.state, mission);
    for (let index = 0; index < 30 && !state.events.some(event => event.type === 'shot'); index += 1) {
      state = tick(state, mission);
    }

    const shot = state.events.find(event => event.type === 'shot');
    expect(shot).toBeTruthy();
    if (shot?.type === 'shot') expect(shot.damage).toBeGreaterThan(0);
  });
});
