import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CREATURES, MESOMON_ASSETS, PEOPLE, SCENERY, TILES, portraitUrl, dialoguePortrait, personArt, propArt } from '../assets';
import { BATTLE_CELL, BATTLE_POSES } from './battleMotion';

const root = resolve(process.cwd(), 'public/games/mesomon');
function dimensions(file: string) {
  const bytes = readFileSync(resolve(root, file));
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}
describe('Mesomon original asset geometry', () => {
  it('keeps atlas geometry and native logical cells in sync', () => {
    expect(dimensions('harbor-tiles.png')).toEqual([TILES.length * 16, 16]);
    expect(dimensions('people.png')).toEqual([15 * 16, PEOPLE.length * 16]);
    expect(dimensions('mesomon.png')).toEqual([8 * 16, CREATURES.length * 16]);
    const battleFilename = MESOMON_ASSETS.battle.split('?')[0].split('/').pop()!;
    expect(dimensions(battleFilename)).toEqual([BATTLE_POSES.length * BATTLE_CELL, CREATURES.length * BATTLE_CELL]);
    const [width, height] = dimensions('scenery.png');
    expect([width, height]).toEqual([128, 64]);
    for (const frame of Object.values(SCENERY)) {
      expect(frame.x + frame.width).toBeLessThanOrEqual(width);
      expect(frame.y + frame.height).toBeLessThanOrEqual(height);
    }
    expect(dimensions('cover.png')).toEqual([320, 180]);
    expect(dimensions('fieldcase.png')).toEqual([216, 90]);
  });
  it('ships every manifest asset and an individual portrait for every named character and species', () => {
    const manifest = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8')) as {
      version: number; scenery: typeof SCENERY; assets: string[];
      people: { cell: number[] }; creatures: { rows: string[]; cell: number[] };
      battle: { file: string; rows: string[]; cell: number[]; poses: string[] };
      fieldGuide: { size: number[]; files: string[] };
    };
    expect(manifest.version).toBe(MESOMON_ASSETS.version);
    expect(manifest.scenery).toEqual(SCENERY);
    expect(manifest.people.cell).toEqual([16, 16]);
    expect(manifest.creatures.cell).toEqual([16, 16]);
    expect(manifest.creatures.rows).toEqual([...CREATURES]);
    expect(manifest.battle.file).toBe('creature-battle-v1.png');
    expect(manifest.battle.cell).toEqual([BATTLE_CELL, BATTLE_CELL]);
    expect(manifest.battle.poses).toEqual([...BATTLE_POSES]);
    expect(manifest.battle.rows).toEqual([...CREATURES]);
    expect(manifest.assets).toContain(manifest.battle.file);
    expect(manifest.fieldGuide.size).toEqual([512, 512]);
    expect([...manifest.fieldGuide.files].sort()).toEqual(CREATURES.map(id => `field-guide/${id}.webp`).sort());
    for (const asset of manifest.assets) expect(readFileSync(resolve(root, asset)).byteLength).toBeGreaterThan(32);
    for (const id of [...PEOPLE, ...CREATURES]) expect(dimensions(`portraits/${id}.png`)).toEqual([48, 48]);
  });
  it('uses the authored harbor roles and tile-matched props', () => {
    expect(personArt('lamp-keeper', 'worker')).toBe('lanternkeeper');
    expect(personArt('merchant', 'worker')).toBe('vendor');
    expect(personArt('rope-worker', 'worker')).toBe('porter');
    expect(personArt('nia-stairs', 'nia')).toBe('nia');
    expect(propArt('reeds')).toBe('reeds');
    expect(propArt('gangplank')).toBe('gangplank');
    expect(propArt('stairs')).toBe('stair');
  });
  it('matches named speakers and keeps narration faceless', () => {
    expect(dialoguePortrait('Edda’s letter')).toBe(portraitUrl('edda'));
    expect(dialoguePortrait('Crane rigger')).toBe(portraitUrl('worker'));
    expect(dialoguePortrait('Quay runner')).toBe(portraitUrl('porter'));
    expect(dialoguePortrait('Nia')).toBe(portraitUrl('nia'));
    expect(dialoguePortrait('Port Marche')).toBeNull();
    expect(dialoguePortrait('Field note')).toBeNull();
  });
  it('keeps speaker portraits on the fixed asset path', () => {
    expect(portraitUrl('Nia')).toBe(`/games/mesomon/portraits/nia.png?v=${MESOMON_ASSETS.version}`);
    expect(portraitUrl('../../auth')).toBe(`/games/mesomon/portraits/tavian.png?v=${MESOMON_ASSETS.version}`);
  });
});
