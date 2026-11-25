import { z } from 'zod';
import type { MesomonSaveV1 } from './types';

const move = z.enum(['brine-snap', 'reedstep', 'resonant-cry', 'tidal-veil', 'bank-break', 'mud-wrap', 'lantern-dust', 'quick-tackle', 'splinter-swipe', 'rift-lash']);
const species = z.enum(['rillik', 'muddren', 'gleamwing', 'tressel']);
const integer = (maximum: number) => z.number().int().min(0).max(maximum);
const line = z.object({ speaker: z.string().max(64), text: z.string().max(700) });
const events = z.enum(['captain-met', 'nia-met', 'workshop-entered', 'clues-complete', 'bram-met', 'gate-opened', 'first-bond', 'boss-introduced', 'sealed', 'page-found', 'chapter-complete', 'whistle-accepted', 'whistle-returned', 'wrong-catch', 'tutorial-complete', 'wild-complete']);
const dialogue = z.object({ id: z.string().min(1).max(80), lines: z.array(line).min(1).max(60), index: integer(59), onFinish: events.optional(), choices: z.array(z.object({ id: z.enum(['warm', 'wry', 'direct']), label: z.string().max(80), text: z.string().max(300) })).max(3).optional() }).refine(value => value.index < value.lines.length, 'Dialogue position is outside its conversation');
const bonded = z.object({ id: z.string().min(1).max(80), speciesId: species, level: z.number().int().min(1).max(100), vitality: integer(999), maxVitality: z.number().int().min(1).max(999), experience: integer(1000000), moves: z.array(move).min(1).max(4) }).refine(value => value.vitality <= value.maxVitality, 'Vitality exceeds its maximum');
const fighter = z.object({ id: z.string().min(1).max(80), speciesId: z.enum(['rillik', 'muddren', 'gleamwing', 'tressel', 'rift-wretch']), vitality: integer(999), maxVitality: z.number().int().min(1).max(999), power: integer(999), guard: integer(999), agility: integer(999), resonance: integer(999), moves: z.array(move).min(1).max(4) }).refine(value => value.vitality <= value.maxVitality);
const battle = z.object({ id: z.enum(['passage-encounter', 'gleamwing-encounter', 'chamber-boss']), allies: z.array(fighter).min(1).max(3), activeIndex: integer(2), enemy: fighter, agitation: integer(100), stability: integer(999), maxStability: integer(999), frenzy: z.boolean(), seed: integer(4294967295), turn: integer(10000), guarded: z.boolean(), evasion: z.boolean(), mudbound: integer(100), phase: z.enum(['choosing', 'won', 'lost', 'resonated', 'escaped']), log: z.array(z.string().max(400)).max(100), usedTinctures: integer(999) }).refine(value => value.activeIndex < value.allies.length && value.stability <= value.maxStability)
  .refine(value => value.id === 'chamber-boss' ? value.enemy.speciesId === 'rift-wretch' && value.maxStability > 0 : value.enemy.speciesId !== 'rift-wretch' && value.maxStability === 0, 'Battle category and stability disagree')
  .refine(value => new Set(value.allies.map(member => member.id)).size === value.allies.length && value.allies.every(member => member.speciesId !== 'rift-wretch'), 'Invalid battle companions')
  .refine(value => value.phase !== 'choosing' || (value.allies[value.activeIndex]?.vitality ?? 0) > 0, 'An active battle needs a conscious companion');
const dictionary = <T extends z.ZodTypeAny>(item: T, count: number) => z.record(item).refine(value => Object.keys(value).length <= count && Object.keys(value).every(key => key.length <= 100 && !['__proto__', 'constructor', 'prototype'].includes(key)), 'Invalid save dictionary');
const dimensions = { ship: [16, 14], harbor: [40, 36], workshop: [16, 14], 'tide-stairs': [20, 18], passage: [24, 22], chamber: [18, 16] } as const;
const schema = z.object({
  schemaVersion: z.literal(1), slot: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  player: z.object({ name: z.literal('Tavian'), mapId: z.enum(['ship', 'harbor', 'workshop', 'tide-stairs', 'passage', 'chamber']), x: integer(127), y: integer(127), facing: z.enum(['up', 'down', 'left', 'right']) }),
  party: z.array(bonded).max(3), collection: dictionary(bonded, 30), inventory: dictionary(integer(9999), 80),
  questFlags: dictionary(z.union([z.boolean(), z.number().finite().min(-1000000).max(1000000), z.string().max(500)]), 150),
  activeQuestId: z.string().min(1).max(100), rifts: dictionary(z.enum(['unseen', 'found', 'sealed']), 20),
  settings: z.object({ textSpeed: z.enum(['slow', 'normal', 'fast']), battleSpeed: z.enum(['normal', 'fast']), reducedMotion: z.boolean(), haptics: z.boolean(), mute: z.boolean(), sealAssist: z.boolean(), musicVolume: z.number().min(0).max(1).default(0.35), ambientVolume: z.number().min(0).max(1).default(0.3) }),
  playtimeSeconds: integer(315360000), savedAt: z.string().datetime({ offset: true }),
  battle: battle.nullable().default(null), seal: z.object({ active: z.boolean(), pulses: integer(3), attempts: integer(100000) }).default({ active: false, pulses: 0, attempts: 0 }),
  dialogue: dialogue.nullable().default(null), dialogueHistory: z.array(line).max(150).default([]),
}).refine(value => value.player.x < dimensions[value.player.mapId][0] && value.player.y < dimensions[value.player.mapId][1], 'Position is outside the map').refine(value => new Set(value.party.map(member => member.id)).size === value.party.length && value.party.every(member => value.collection[member.id]?.speciesId === member.speciesId), 'Party and collection disagree').refine(value => !value.battle || (value.battle.allies.length === value.party.length && value.battle.allies.every(ally => value.party.some(member => member.id === ally.id && member.speciesId === ally.speciesId))), 'Battle and party disagree');

export function migrateSave(input: unknown): MesomonSaveV1 | null {
  try {
    if (!input || typeof input !== 'object' || JSON.stringify(input).length > 131072) return null;
    const raw = input as Record<string, unknown>;
    // The pre-release V0 format used the same chapter fields without a schema
    // marker. Only explicitly marked V0 is migrated; arbitrary data is rejected.
    const candidate = raw.schemaVersion === 0 ? { ...raw, schemaVersion: 1 } : raw;
    const parsed = schema.safeParse(candidate);
    return parsed.success ? parsed.data as MesomonSaveV1 : null;
  } catch { return null; }
}

export function validateSave(input: unknown): input is MesomonSaveV1 { return migrateSave(input) !== null; }
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical((value as Record<string, unknown>)[key])]));
  return value;
}
/** PostgreSQL JSONB is free to reorder record keys. Compare chapter meaning,
 * preserve ordered arrays, and ignore only the top-level save receipt time. */
export function saveFingerprint(save: MesomonSaveV1): string {
  const semantic: Partial<MesomonSaveV1> = { ...save }; delete semantic.savedAt;
  return JSON.stringify(canonical(semantic));
}
export interface CloudSave { state: MesomonSaveV1; revision: number; updated_at: string; slot: 1 | 2 | 3; }
export function parseCloudSave(input: unknown): CloudSave | null {
  if (!input || typeof input !== 'object') return null;
  const row = input as Record<string, unknown>, state = migrateSave(row.state);
  if (!state || !Number.isSafeInteger(row.revision) || Number(row.revision) < 1 || typeof row.updated_at !== 'string' || !Number.isFinite(Date.parse(row.updated_at)) || row.slot !== state.slot) return null;
  return { state, revision: Number(row.revision), updated_at: row.updated_at, slot: state.slot };
}
export function compareCloudSave(localRevision: number, cloud: Pick<CloudSave, 'revision' | 'updated_at'>): 'same' | 'cloud-newer' | 'local-newer' {
  return cloud.revision > localRevision ? 'cloud-newer' : cloud.revision < localRevision ? 'local-newer' : 'same';
}
