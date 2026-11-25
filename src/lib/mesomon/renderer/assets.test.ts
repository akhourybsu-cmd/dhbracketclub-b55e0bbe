import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CREATURES, MESOMON_ASSETS, PEOPLE, TILES, portraitUrl, dialoguePortrait, personArt, propArt } from '../assets';

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
    expect(dimensions('battle.png')).toEqual([CREATURES.length * 48, 48]);
    expect(dimensions('cover.png')).toEqual([320, 180]);
  });
  it('ships every manifest asset and an individual portrait for every named character and species', () => {
    const manifest = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8')) as { version: number; assets: string[]; people: { cell: number[] }; creatures: { rows: string[]; cell: number[] } };
    expect(manifest.version).toBe(MESOMON_ASSETS.version);
    expect(manifest.people.cell).toEqual([16, 16]);
    expect(manifest.creatures.cell).toEqual([16, 16]);
    expect(manifest.creatures.rows).toEqual([...CREATURES]);
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
    expect(dialoguePortrait('Nia')).toBe(portraitUrl('nia'));
    expect(dialoguePortrait('Port Marche')).toBeNull();
    expect(dialoguePortrait('Field note')).toBeNull();
  });
  it('keeps speaker portraits on the fixed asset path', () => {
    expect(portraitUrl('Nia')).toBe('/games/mesomon/portraits/nia.png');
    expect(portraitUrl('../../auth')).toBe('/games/mesomon/portraits/tavian.png');
  });
});
