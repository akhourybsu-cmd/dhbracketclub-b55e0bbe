#!/usr/bin/env node
/** Independent Ancient Deep add-on: never rewrites or rebakes released v1 assets. */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { PixelSurface, compileAtlas } from './lib/deep-claim-pixels.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), require = createRequire(import.meta.url), ts = require('typescript');
const inputs = new Set([fileURLToPath(import.meta.url), resolve(root, 'scripts/lib/deep-claim-pixels.mjs')]), modules = new Map();
function input(path) { const file = resolve(root, path); inputs.add(file); return readFileSync(file); }
function loadSource(path) {
  let file = resolve(path);
  if (!extname(file)) file = ['.ts', '.json'].map(extension => file + extension).find(existsSync) ?? file;
  if (file.endsWith('/renderer/ancientAtlas.ts')) return { drawDeepClaimAddon: () => false };
  if (modules.has(file)) return modules.get(file).exports;
  inputs.add(file); const content = readFileSync(file, 'utf8'), module = { exports: {} }; modules.set(file, module);
  if (extname(file) === '.json') { module.exports = JSON.parse(content); return module.exports; }
  const compiled = ts.transpileModule(content, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const localRequire = key => key.startsWith('@/') ? loadSource(resolve(root, 'src', key.slice(2))) : key.startsWith('.') ? loadSource(resolve(dirname(file), key)) : require(key);
  new Function('require', 'exports', 'module', compiled)(localRequire, module.exports, module); return module.exports;
}
const pack = JSON.parse(input('art/deep-claim/pack-v2.json').toString('utf8'));
const source = loadSource(resolve(root, 'src/components/deepClaim/renderer/ancientArt.ts'));
const released = JSON.parse(input('src/components/deepClaim/renderer/generated/atlas-v1.json').toString('utf8'));
const releasedPng = input('public/deep-claim/atlas-v1.png');
if (releasedPng[24] !== 8 || releasedPng[25] !== 6) throw new Error('Released source must be RGBA8.');
const compressed = [];
for (let offset = 8; offset < releasedPng.length;) {
  const length = releasedPng.readUInt32BE(offset), kind = releasedPng.toString('ascii', offset + 4, offset + 8);
  if (kind === 'IDAT') compressed.push(releasedPng.subarray(offset + 8, offset + 8 + length));
  offset += length + 12;
}
const scanlines = inflateSync(Buffer.concat(compressed)), stride = released.width * 4 + 1;
for (let row = 0; row < released.height; row++) if (scanlines[row * stride] !== 0) throw new Error('Unexpected released source PNG filter.');

const frames = new Map();
function add(key, width, height, paint) { const surface = new PixelSurface(width, height); paint(surface); if (surface.stack.length) throw new Error(`Unbalanced ${key}`); frames.set(key, { key, width, height, pixels: surface.pixels }); }
for (const material of [null, ...Object.keys(pack.mineral_palettes)]) for (const formation of [null, ...Object.keys(pack.rooms)]) for (let variant = 0; variant < 4; variant++) for (const detailed of [false, true]) {
  add(source.ancientTerrainKey(material, false, variant, detailed, formation, 0), 16, 16, context => source.paintAncientTerrainSource(context, 0, 0, material, false, variant, detailed, formation, 0));
}
for (const formation of [null, ...Object.keys(pack.rooms)]) for (let neighbors = 0; neighbors < (formation ? 16 : 1); neighbors++) for (let variant = 0; variant < 4; variant++) for (const detailed of [false, true]) {
  add(source.ancientTerrainKey(null, true, variant, detailed, formation, neighbors), 16, 16, context => source.paintAncientTerrainSource(context, 0, 0, null, true, variant, detailed, formation, neighbors));
}
const shaft = released.frames['building:mine_shaft:5'];
add('deep:building:mine_shaft:6', shaft.width, shaft.height, context => {
  for (let row = 0; row < shaft.height; row++) context.pixels.set(scanlines.subarray((shaft.y + row) * stride + 1 + shaft.x * 4, (shaft.y + row) * stride + 1 + (shaft.x + shaft.width) * 4), row * shaft.width * 4);
  source.paintAncientShaftOverlay(context, 0, 0);
});
add('deep:lift:edge', 16, 16, context => source.paintLiftEdgeSource(context));
add('deep:lift:cab', 24, 32, context => source.paintLiftCabSource(context));
const output = compileAtlas(frames, pack), hash = createHash('sha256');
for (const file of [...inputs].sort()) hash.update(relative(root, file) + '\0').update(readFileSync(file)).update('\0');
const metadata = { version: 2, width: output.width, height: output.height, pngBytes: output.png.length, uniqueSprites: output.uniqueSprites, sourceHash: hash.digest('hex'),
  region: pack.region, specifications: pack.specifications, sources: [...inputs].map(file => relative(root, file)).sort(), frames: output.frames };
for (const [path, bytes] of [['public/deep-claim/atlas-v2.png', output.png], ['src/components/deepClaim/renderer/generated/atlas-v2.json', Buffer.from(JSON.stringify(metadata, null, 2) + '\n')]]) {
  const file = resolve(root, path);
  if (process.argv.includes('--check')) { if (!existsSync(file) || !readFileSync(file).equals(bytes)) throw new Error(`Outdated add-on ${path}. Run node scripts/build-deep-claim-addon.mjs`); }
  else { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, bytes); }
}
console.log(`Ancient Deep authored add-on v2: ${frames.size} references / ${output.uniqueSprites} rectangles, ${output.width}×${output.height}, ${output.png.length} PNG bytes, ${output.width * output.height * 4} decoded bytes${process.argv.includes('--check') ? ' — reproducible outputs verified' : ''}.`);
