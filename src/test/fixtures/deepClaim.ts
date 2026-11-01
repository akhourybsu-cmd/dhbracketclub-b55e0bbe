import type { DeepClaimSnapshot } from '@/lib/deepClaim/types';

export function companySnapshot(revision = 1): DeepClaimSnapshot {
  return { schema_version: 1, revision, server_now: '2026-11-01T12:00:00Z',
    company: { id: 'company-a', club_id: 'club-a', user_id: 'user-a', name: 'Flint & Co.', cash: 180,
      timezone: 'America/New_York', energy_day: '2026-11-01', tutorial_used: false, warehouse_capacity: 120, warehouse_used: 8, crew_slots: 1 },
    resources: { stone: 8 }, workers: ['a','b','c'].map(id => ({ id: `worker-${id}`, name: `Worker ${id}`, specialty: 'miner', traits: [],
      stats: { mining: 50, geology: 50, engineering: 50, logistics: 50, safety: 50, endurance: 50, leadership: 50 }, xp: 0, level: 1, energy: 6, assigned_job_id: null })),
    world: { width: 96, chunk_size: 32, max_depth: 49, revision, tiles: [{ x: 48, y: 1, terrain: 'excavated', material: null, remaining: 0, initial_amount: 0 }] },
    expeditions: [], buildings: ['mine_office','mine_shaft','warehouse','tool_station'].map(key => ({ key: key as DeepClaimSnapshot['buildings'][number]['key'], level: 1, max_level: 3, upgrade_cost: 100, effect: 'Improves this building.' })), log: [] };
}
