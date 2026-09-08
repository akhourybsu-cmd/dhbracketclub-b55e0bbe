import { MissionDef } from './types';

// 6 missions in Sector I "Outer Rim" — last is a boss.
export const MISSIONS: MissionDef[] = [
  {
    id: 1,
    name: 'First Contact',
    sector: 'Outer Rim',
    startEnergy: 180,
    baseHp: 20,
    rewardCores: 25,
    waves: [
      { index: 0, rewardEnergy: 40, spawns: [{ enemy: 'drone', count: 8, intervalMs: 900 }] },
      { index: 1, rewardEnergy: 50, spawns: [{ enemy: 'drone', count: 14, intervalMs: 700 }] },
      { index: 2, rewardEnergy: 60, spawns: [
        { enemy: 'drone', count: 10, intervalMs: 600 },
        { enemy: 'walker', count: 2, intervalMs: 1500, delayMs: 2000 },
      ] },
    ],
  },
  {
    id: 2,
    name: 'Heavy Footprint',
    sector: 'Outer Rim',
    startEnergy: 200,
    baseHp: 22,
    rewardCores: 35,
    modifier: { label: 'Reinforced Hulls', description: 'Walkers have +25% HP.' },
    modifierIds: ['reinforced_hulls', 'bonus_bounty'],
    waves: [
      { index: 0, rewardEnergy: 50, spawns: [{ enemy: 'drone', count: 12, intervalMs: 700 }] },
      { index: 1, rewardEnergy: 60, spawns: [
        { enemy: 'walker', count: 4, intervalMs: 1400 },
        { enemy: 'drone', count: 8, intervalMs: 600, delayMs: 1500 },
      ] },
      { index: 2, rewardEnergy: 70, spawns: [
        { enemy: 'walker', count: 6, intervalMs: 1100 },
        { enemy: 'drone', count: 16, intervalMs: 500, delayMs: 1500 },
      ] },
      { index: 3, rewardEnergy: 90, spawns: [
        { enemy: 'walker', count: 8, intervalMs: 1000 },
      ] },
    ],
  },
  {
    id: 3,
    name: 'Shield Wall',
    sector: 'Outer Rim',
    startEnergy: 220,
    baseHp: 22,
    rewardCores: 45,
    modifier: { label: 'Shielded Vanguard', description: 'Shielded Troopers regenerate 10 shield/sec.' },
    modifierIds: ['shielded_vanguard', 'arc_resonance'],
    waves: [
      { index: 0, rewardEnergy: 60, spawns: [{ enemy: 'shielded', count: 5, intervalMs: 1200 }] },
      { index: 1, rewardEnergy: 70, spawns: [
        { enemy: 'shielded', count: 8, intervalMs: 1000 },
        { enemy: 'drone', count: 10, intervalMs: 500, delayMs: 1200 },
        { enemy: 'runner', count: 8, intervalMs: 320, delayMs: 3000 },
      ] },
      { index: 2, rewardEnergy: 80, spawns: [
        { enemy: 'shielded', count: 6, intervalMs: 900 },
        { enemy: 'walker', count: 4, intervalMs: 1300, delayMs: 2000 },
        { enemy: 'runner', count: 12, intervalMs: 280, delayMs: 3500 },
      ] },
      { index: 3, rewardEnergy: 100, spawns: [
        { enemy: 'shielded', count: 12, intervalMs: 800 },
        { enemy: 'walker', count: 6, intervalMs: 1100, delayMs: 1500 },
      ] },
    ],
  },
  {
    id: 4,
    name: 'Ghost Signal',
    sector: 'Outer Rim',
    startEnergy: 260,
    baseHp: 22,
    rewardCores: 55,
    modifier: { label: 'Cloaked Approach', description: 'Stealth units only visible to Rail Battery.' },
    modifierIds: ['cloaked_approach', 'emergency_reserves'],
    waves: [
      // Tutorialize stealth: a couple stealth + a slow walker so non-Rail towers still contribute.
      { index: 0, rewardEnergy: 70, spawns: [
        { enemy: 'stealth', count: 3, intervalMs: 1500 },
        { enemy: 'walker', count: 2, intervalMs: 1600, delayMs: 800 },
      ] },
      { index: 1, rewardEnergy: 80, spawns: [
        { enemy: 'stealth', count: 6, intervalMs: 1100 },
        { enemy: 'drone', count: 12, intervalMs: 500, delayMs: 1000 },
      ] },
      { index: 2, rewardEnergy: 90, spawns: [
        { enemy: 'stealth', count: 8, intervalMs: 900 },
        { enemy: 'shielded', count: 4, intervalMs: 1200, delayMs: 1500 },
        { enemy: 'flyer', count: 3, intervalMs: 1400, delayMs: 2500 },
      ] },
      { index: 3, rewardEnergy: 110, spawns: [
        { enemy: 'stealth', count: 10, intervalMs: 800 },
        { enemy: 'walker', count: 6, intervalMs: 1100, delayMs: 1200 },
        { enemy: 'flyer', count: 6, intervalMs: 1000, delayMs: 2000 },
      ] },
    ],
  },
  {
    id: 5,
    name: 'Convergence',
    sector: 'Outer Rim',
    startEnergy: 280,
    baseHp: 25,
    rewardCores: 70,
    modifier: { label: 'Mixed Assault', description: 'All enemy types appear together.' },
    modifierIds: ['mixed_assault', 'supply_drought', 'rapid_command'],
    waves: [
      { index: 0, rewardEnergy: 60, spawns: [
        { enemy: 'drone', count: 14, intervalMs: 500 },
        { enemy: 'walker', count: 4, intervalMs: 1400, delayMs: 1500 },
      ] },
      { index: 1, rewardEnergy: 80, spawns: [
        { enemy: 'shielded', count: 6, intervalMs: 1000 },
        { enemy: 'stealth', count: 4, intervalMs: 1200, delayMs: 1000 },
      ] },
      { index: 2, rewardEnergy: 100, spawns: [
        { enemy: 'walker', count: 6, intervalMs: 1100 },
        { enemy: 'shielded', count: 6, intervalMs: 1000, delayMs: 1500 },
        { enemy: 'healer', count: 2, intervalMs: 1500, delayMs: 500 },
        { enemy: 'stealth', count: 4, intervalMs: 1100, delayMs: 3000 },
      ] },
      { index: 3, rewardEnergy: 130, spawns: [
        { enemy: 'drone', count: 20, intervalMs: 400 },
        { enemy: 'splitter', count: 4, intervalMs: 1300, delayMs: 1000 },
        { enemy: 'walker', count: 8, intervalMs: 900, delayMs: 1500 },
        { enemy: 'healer', count: 3, intervalMs: 1400, delayMs: 2000 },
        { enemy: 'flyer', count: 5, intervalMs: 1100, delayMs: 3000 },
      ] },
    ],
  },
  {
    id: 6,
    name: 'Siege of the Nexus',
    sector: 'Outer Rim',
    startEnergy: 320,
    baseHp: 30,
    rewardCores: 120,
    isBoss: true,
    modifier: { label: 'BOSS · Siege Mech inbound', description: 'Survive the assault, then face the Siege Mech.' },
    modifierIds: ['hardened_boss', 'comms_jammed', 'bonus_bounty'],
    waves: [
      { index: 0, rewardEnergy: 80, spawns: [
        { enemy: 'drone', count: 18, intervalMs: 450 },
        { enemy: 'shielded', count: 4, intervalMs: 1200, delayMs: 2000 },
      ] },
      { index: 1, rewardEnergy: 100, spawns: [
        { enemy: 'walker', count: 8, intervalMs: 900 },
        { enemy: 'stealth', count: 6, intervalMs: 1100, delayMs: 1500 },
        { enemy: 'flyer', count: 5, intervalMs: 1100, delayMs: 2500 },
      ] },
      { index: 2, rewardEnergy: 120, spawns: [
        { enemy: 'brute', count: 2, intervalMs: 2200 },
        { enemy: 'healer', count: 2, intervalMs: 1600, delayMs: 1500 },
        { enemy: 'shielded', count: 10, intervalMs: 800, delayMs: 1000 },
        { enemy: 'drone', count: 18, intervalMs: 400, delayMs: 2500 },
      ] },
      { index: 3, rewardEnergy: 220, spawns: [
        { enemy: 'boss', count: 1, intervalMs: 1000 },
        { enemy: 'flyer', count: 6, intervalMs: 1000, delayMs: 3000 },
        { enemy: 'brute', count: 2, intervalMs: 2500, delayMs: 6000 },
        { enemy: 'splitter', count: 4, intervalMs: 1300, delayMs: 9000 },
      ] },
    ],
  },

  // ── Sector II · Inner Belt (missions 7–12) — the full roster ──
  {
    id: 7,
    name: 'Skyfall',
    sector: 'Inner Belt',
    startEnergy: 300,
    baseHp: 26,
    rewardCores: 90,
    modifierIds: ['bonus_bounty'],
    waves: [
      { index: 0, rewardEnergy: 70, spawns: [
        { enemy: 'drone', count: 14, intervalMs: 600 },
        { enemy: 'flyer', count: 3, intervalMs: 1400, delayMs: 2500 },
      ] },
      { index: 1, rewardEnergy: 85, spawns: [
        { enemy: 'runner', count: 16, intervalMs: 300 },
        { enemy: 'flyer', count: 5, intervalMs: 1100, delayMs: 2000 },
      ] },
      { index: 2, rewardEnergy: 100, spawns: [
        { enemy: 'walker', count: 6, intervalMs: 1000 },
        { enemy: 'flyer', count: 6, intervalMs: 1000, delayMs: 1500 },
        { enemy: 'runner', count: 12, intervalMs: 300, delayMs: 3000 },
      ] },
      { index: 3, rewardEnergy: 130, spawns: [
        { enemy: 'flyer', count: 10, intervalMs: 900 },
        { enemy: 'drone', count: 20, intervalMs: 400, delayMs: 2000 },
        { enemy: 'walker', count: 4, intervalMs: 1200, delayMs: 3000 },
      ] },
    ],
  },
  {
    id: 8,
    name: 'Field Hospital',
    sector: 'Inner Belt',
    startEnergy: 300,
    baseHp: 28,
    rewardCores: 100,
    modifierIds: ['reinforced_hulls', 'bonus_bounty'],
    waves: [
      { index: 0, rewardEnergy: 75, spawns: [
        { enemy: 'brute', count: 2, intervalMs: 2200 },
        { enemy: 'drone', count: 12, intervalMs: 600, delayMs: 1000 },
      ] },
      { index: 1, rewardEnergy: 90, spawns: [
        { enemy: 'healer', count: 2, intervalMs: 1600 },
        { enemy: 'walker', count: 6, intervalMs: 1000, delayMs: 1000 },
        { enemy: 'shielded', count: 6, intervalMs: 1000, delayMs: 2500 },
      ] },
      { index: 2, rewardEnergy: 105, spawns: [
        { enemy: 'brute', count: 3, intervalMs: 2200 },
        { enemy: 'healer', count: 3, intervalMs: 1500, delayMs: 1500 },
        { enemy: 'runner', count: 12, intervalMs: 320, delayMs: 3000 },
      ] },
      { index: 3, rewardEnergy: 140, spawns: [
        { enemy: 'brute', count: 3, intervalMs: 2000 },
        { enemy: 'healer', count: 4, intervalMs: 1400, delayMs: 1000 },
        { enemy: 'shielded', count: 10, intervalMs: 800, delayMs: 2500 },
        { enemy: 'flyer', count: 5, intervalMs: 1100, delayMs: 4000 },
      ] },
    ],
  },
  {
    id: 9,
    name: 'Serpent Run',
    sector: 'Inner Belt',
    startEnergy: 320,
    baseHp: 28,
    rewardCores: 110,
    modifierIds: ['swarm_protocol', 'rapid_command'],
    waves: [
      { index: 0, rewardEnergy: 75, spawns: [
        { enemy: 'splitter', count: 4, intervalMs: 1300 },
        { enemy: 'drone', count: 14, intervalMs: 500, delayMs: 1500 },
      ] },
      { index: 1, rewardEnergy: 90, spawns: [
        { enemy: 'runner', count: 20, intervalMs: 260 },
        { enemy: 'splitter', count: 5, intervalMs: 1200, delayMs: 2500 },
      ] },
      { index: 2, rewardEnergy: 110, spawns: [
        { enemy: 'splitter', count: 6, intervalMs: 1100 },
        { enemy: 'walker', count: 6, intervalMs: 1000, delayMs: 1500 },
        { enemy: 'drone', count: 20, intervalMs: 400, delayMs: 2500 },
      ] },
      { index: 3, rewardEnergy: 150, spawns: [
        { enemy: 'splitter', count: 8, intervalMs: 1000 },
        { enemy: 'runner', count: 24, intervalMs: 240, delayMs: 2000 },
        { enemy: 'shielded', count: 6, intervalMs: 1000, delayMs: 4000 },
      ] },
    ],
  },
  {
    id: 10,
    name: 'Blackout Maze',
    sector: 'Inner Belt',
    startEnergy: 320,
    baseHp: 30,
    rewardCores: 130,
    modifierIds: ['cloaked_approach', 'comms_jammed'],
    waves: [
      { index: 0, rewardEnergy: 80, spawns: [
        { enemy: 'stealth', count: 5, intervalMs: 1200 },
        { enemy: 'flyer', count: 3, intervalMs: 1400, delayMs: 2000 },
      ] },
      { index: 1, rewardEnergy: 95, spawns: [
        { enemy: 'stealth', count: 8, intervalMs: 1000 },
        { enemy: 'flyer', count: 5, intervalMs: 1100, delayMs: 1500 },
        { enemy: 'runner', count: 12, intervalMs: 300, delayMs: 3000 },
      ] },
      { index: 2, rewardEnergy: 115, spawns: [
        { enemy: 'stealth', count: 10, intervalMs: 900 },
        { enemy: 'flyer', count: 6, intervalMs: 1000, delayMs: 1500 },
        { enemy: 'shielded', count: 6, intervalMs: 1000, delayMs: 3000 },
      ] },
      { index: 3, rewardEnergy: 160, spawns: [
        { enemy: 'stealth', count: 12, intervalMs: 800 },
        { enemy: 'flyer', count: 8, intervalMs: 900, delayMs: 2000 },
        { enemy: 'walker', count: 6, intervalMs: 1000, delayMs: 3000 },
        { enemy: 'healer', count: 3, intervalMs: 1500, delayMs: 4500 },
      ] },
    ],
  },
  {
    id: 11,
    name: 'Onslaught',
    sector: 'Inner Belt',
    // The short Funnel path plus Supply Drought's +15% tower costs made the
    // Wave-2 stealth + air check unwinnable even for the optimizer profile.
    // This funds one deliberate counter-build without softening later waves.
    startEnergy: 340,
    baseHp: 30,
    rewardCores: 150,
    modifierIds: ['supply_drought', 'mixed_assault'],
    waves: [
      { index: 0, rewardEnergy: 80, spawns: [
        { enemy: 'drone', count: 18, intervalMs: 450 },
        { enemy: 'runner', count: 12, intervalMs: 300, delayMs: 2000 },
        { enemy: 'walker', count: 4, intervalMs: 1200, delayMs: 3000 },
      ] },
      { index: 1, rewardEnergy: 100, spawns: [
        { enemy: 'shielded', count: 8, intervalMs: 900 },
        { enemy: 'stealth', count: 6, intervalMs: 1000, delayMs: 1500 },
        { enemy: 'flyer', count: 5, intervalMs: 1100, delayMs: 3000 },
      ] },
      { index: 2, rewardEnergy: 120, spawns: [
        { enemy: 'brute', count: 3, intervalMs: 2200 },
        { enemy: 'healer', count: 3, intervalMs: 1500, delayMs: 1000 },
        { enemy: 'splitter', count: 6, intervalMs: 1100, delayMs: 2500 },
        { enemy: 'flyer', count: 6, intervalMs: 1000, delayMs: 4000 },
      ] },
      { index: 3, rewardEnergy: 170, spawns: [
        { enemy: 'drone', count: 24, intervalMs: 350 },
        { enemy: 'walker', count: 8, intervalMs: 900, delayMs: 1500 },
        { enemy: 'shielded', count: 10, intervalMs: 800, delayMs: 3000 },
        { enemy: 'stealth', count: 8, intervalMs: 900, delayMs: 4500 },
        { enemy: 'flyer', count: 8, intervalMs: 900, delayMs: 6000 },
      ] },
    ],
  },
  {
    id: 12,
    name: 'The Leviathan',
    sector: 'Inner Belt',
    startEnergy: 380,
    baseHp: 34,
    rewardCores: 250,
    isBoss: true,
    modifierIds: ['hardened_boss', 'comms_jammed', 'bonus_bounty'],
    waves: [
      { index: 0, rewardEnergy: 100, spawns: [
        { enemy: 'drone', count: 20, intervalMs: 400 },
        { enemy: 'flyer', count: 6, intervalMs: 1000, delayMs: 2000 },
      ] },
      { index: 1, rewardEnergy: 130, spawns: [
        { enemy: 'brute', count: 4, intervalMs: 2000 },
        { enemy: 'healer', count: 3, intervalMs: 1500, delayMs: 1500 },
        { enemy: 'shielded', count: 10, intervalMs: 800, delayMs: 2500 },
      ] },
      { index: 2, rewardEnergy: 150, spawns: [
        { enemy: 'splitter', count: 8, intervalMs: 1000 },
        { enemy: 'stealth', count: 10, intervalMs: 900, delayMs: 1500 },
        { enemy: 'flyer', count: 8, intervalMs: 900, delayMs: 3000 },
      ] },
      { index: 3, rewardEnergy: 320, spawns: [
        { enemy: 'boss', count: 1, intervalMs: 1000 },
        { enemy: 'brute', count: 3, intervalMs: 2200, delayMs: 4000 },
        { enemy: 'boss', count: 1, intervalMs: 1000, delayMs: 10000 },
        { enemy: 'flyer', count: 8, intervalMs: 900, delayMs: 14000 },
        { enemy: 'shielded', count: 10, intervalMs: 800, delayMs: 18000 },
      ] },
    ],
  },
];

import { ENDLESS_MISSION, ENDLESS_MISSION_ID } from './endless';
import { getLiveEndlessMission } from './missionDrafts';

export function getMission(id: number): MissionDef | undefined {
  // Endless: prefer the admin-applied live draft if one is loaded; otherwise
  // fall back to the canonical hardcoded mission. The live draft cache is
  // refreshed at app start (see src/main.tsx) and after admin "Apply Live".
  if (id === ENDLESS_MISSION_ID) return getLiveEndlessMission();
  return MISSIONS.find(m => m.id === id);
}
