import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import library from '../../supabase/seed/afterimage-library.json';
import { scoreScene, validateSceneDefinition, validatePublishedScene } from '@/lib/showdown/afterimage/engine';
import { AFTERIMAGE_ASSET_IDS, AFTERIMAGE_DIFFICULTY_COUNTS, AFTERIMAGE_THEME_IDS, type AfterimageSceneDefinition } from '@/lib/showdown/afterimage/types';

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, piece]) => [key, canonical(piece)]));
  return value;
}
const fingerprint = (value: unknown) => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
function definition(entry: typeof library[number]): AfterimageSceneDefinition {
  const { validation: _certificate, ...data } = entry;
  validateSceneDefinition(data); return data;
}
describe('Afterimage authored launch library', () => {
  it('publishes six distinct certified scenes at each difficulty with exact original/removal/distractor counts', () => {
    expect(library).toHaveLength(18);
    expect(new Set(library.map(scene => scene.id)).size).toBe(18);
    const geometryAndIdentity = new Set<string>();
    const artwork = new Set<string>();
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const scenes = library.filter(scene => scene.difficulty === difficulty), count = AFTERIMAGE_DIFFICULTY_COUNTS[difficulty];
      expect(scenes).toHaveLength(6);
      expect(new Set(scenes.map(scene => scene.theme))).toEqual(new Set(AFTERIMAGE_THEME_IDS));
      for (const entry of scenes) {
        const scene = definition(entry);
        expect(validatePublishedScene(scene)).toEqual({ valid: true, errors: [] });
        expect(scene.objects).toHaveLength(count.objects);
        expect(scene.missingIds).toHaveLength(count.missing);
        expect(scene.distractors).toHaveLength(count.distractors);
        expect(scene.slots).toHaveLength(count.missing);
        expect(scene.trayOrder).toHaveLength(count.missing + count.distractors);
        expect(entry.validation).toMatchObject({ validator: 'afterimage_scene_v1', validated: true, definitionSha256: fingerprint(scene) });
        for (const slot of scene.slots) { expect(slot.width * 280 / 1000).toBeGreaterThanOrEqual(44); expect(slot.height * 280 / 1000).toBeGreaterThanOrEqual(44); }
        for (const piece of [...scene.objects, ...scene.distractors]) artwork.add(piece.assetId);
        geometryAndIdentity.add(fingerprint(scene.objects.map(({ assetId, x, y }) => ({ assetId, x, y }))));
        const correct = scene.slots.map(slot => ({ object_id: slot.objectId, slot_id: slot.id }));
        expect(scoreScene(scene, correct)).toMatchObject({ score: 125, perfect: true });
        for (let solved = 0; solved < count.missing; solved++) expect(scoreScene(scene, correct.slice(0, solved))).toMatchObject({ score: Math.round(100 * solved / count.missing), perfect: false });
      }
    }
    expect(geometryAndIdentity.size).toBe(18);
    expect(artwork).toEqual(new Set(AFTERIMAGE_ASSET_IDS));
  });
  it('seeds precisely the certified definitions and validates again before immutable publication', () => {
    const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/20261101050000_afterimage_library.sql'), 'utf8');
    const raw = sql.match(/\$afterimage_definitions\$([\s\S]*?)\$afterimage_definitions\$/)?.[1];
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!)).toEqual(library.map(({ validation, ...definition }) => ({ definition, validation })));
    expect(sql).toContain('perform public.afterimage_validate_v1');
    expect(sql).toContain('Published Afterimage scene version is immutable');
    expect(sql).toContain('minimum_rotations is not null');
  });
  it('keeps the authored answer catalog out of every production TypeScript module', () => {
    const files: string[] = [];
    function walk(directory: string) {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory() && entry.name !== 'test') walk(path);
        else if (entry.isFile() && /\.[cm]?tsx?$/.test(entry.name)) files.push(path);
      }
    }
    walk(resolve(__dirname, '..'));
    expect(files.length).toBeGreaterThan(100);
    for (const file of files) expect(readFileSync(file, 'utf8'), file).not.toMatch(/(?:afterimage-library\.json|supabase\/seed\/afterimage)/);
  });
});
