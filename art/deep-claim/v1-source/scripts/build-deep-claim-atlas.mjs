#!/usr/bin/env node
/** Reproducible offline RGBA atlas. Uses the repository's existing TypeScript dev dependency and Node built-ins only. */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), require = createRequire(import.meta.url), ts = require('typescript');
const inputFiles = new Set([fileURLToPath(import.meta.url)]), modules = new Map();
// Compile trusted local source painters offline. Runtime image loading is deliberately disabled.
function loadSource(path) {
  let file = resolve(path);
  if (!extname(file)) file = ['.ts', '.tsx', '.json'].map(extension => file + extension).find(existsSync) ?? file;
  if (file.endsWith('/renderer/authoredAtlas.ts')) return { drawAuthoredSprite: () => false };
  if (modules.has(file)) return modules.get(file).exports;
  inputFiles.add(file); const source = readFileSync(file, 'utf8'), module = { exports: {} }; modules.set(file, module);
  if (extname(file) === '.json') { module.exports = JSON.parse(source); return module.exports; }
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const localRequire = key => key.startsWith('@/') ? loadSource(resolve(root, 'src', key.slice(2))) : key.startsWith('.') ? loadSource(resolve(dirname(file), key)) : require(key);
  new Function('require', 'exports', 'module', '__filename', '__dirname', compiled)(localRequire, module.exports, module, file, dirname(file));
  return module.exports;
}
const packPath = resolve(root, 'art/deep-claim/pack-v1.json'), pack = JSON.parse(readFileSync(packPath, 'utf8')); inputFiles.add(packPath);
const art = loadSource(resolve(root, 'src/components/deepClaim/renderer/artManifest.ts'));
const source = loadSource(resolve(root, 'src/components/deepClaim/renderer/pixelArt.ts'));
const field = loadSource(resolve(root, 'src/components/deepClaim/renderer/fieldSprites.ts'));
const fieldSource = loadSource(resolve(root, 'src/components/deepClaim/renderer/fieldAtlas.ts'));
const types = loadSource(resolve(root, 'src/lib/deepClaim/types.ts'));

const colors = new Map();
function rgba(color) {
  if (colors.has(color)) return colors.get(color);
  if (!/^#[\da-f]{6}([\da-f]{2})?$/i.test(color)) throw new Error(`Unsupported source color ${color}`);
  const value = [1, 3, 5].map(offset => Number.parseInt(color.slice(offset, offset + 2), 16)); value.push(color.length === 9 ? Number.parseInt(color.slice(7, 9), 16) : 255);
  colors.set(color, value); return value;
}
class PixelSurface {
  constructor(width, height) { this.width = width; this.height = height; this.pixels = new Uint8Array(width * height * 4); this.fillStyle = '#000000'; this.globalAlpha = 1; this.matrix = [1, 1, 0, 0]; this.stack = []; }
  save() { this.stack.push([this.matrix.slice(), this.fillStyle, this.globalAlpha]); }
  restore() { const previous = this.stack.pop(); if (!previous) throw new Error('Unbalanced painter restore.'); [this.matrix, this.fillStyle, this.globalAlpha] = previous; }
  translate(x, y) { this.matrix[2] += this.matrix[0] * x; this.matrix[3] += this.matrix[1] * y; }
  scale(x, y) { this.matrix[0] *= x; this.matrix[1] *= y; }
  fillRect(x, y, width, height) {
    const [sx, sy, tx, ty] = this.matrix, [red, green, blue, alpha] = rgba(this.fillStyle), opacity = alpha / 255 * this.globalAlpha;
    const left = Math.max(0, Math.round(Math.min(x * sx + tx, (x + width) * sx + tx))), right = Math.min(this.width, Math.round(Math.max(x * sx + tx, (x + width) * sx + tx)));
    const top = Math.max(0, Math.round(Math.min(y * sy + ty, (y + height) * sy + ty))), bottom = Math.min(this.height, Math.round(Math.max(y * sy + ty, (y + height) * sy + ty)));
    for (let py = top; py < bottom; py++) for (let px = left; px < right; px++) {
      const offset = (py * this.width + px) * 4, existing = this.pixels[offset + 3] / 255, mixed = opacity + existing * (1 - opacity);
      for (const [channel, value] of [red, green, blue].entries()) this.pixels[offset + channel] = mixed ? Math.round((value * opacity + this.pixels[offset + channel] * existing * (1 - opacity)) / mixed) : 0;
      this.pixels[offset + 3] = Math.round(mixed * 255);
    }
  }
}

const frames = new Map();
function add(key, width, height, paint) {
  if (frames.has(key)) return;
  const surface = new PixelSurface(width, height); paint(surface);
  if (surface.stack.length) throw new Error(`Unbalanced painter ${key}`);
  frames.set(key, { key, width, height, pixels: surface.pixels });
}
for (const [id, bounds] of Object.entries(art.BUILDING_ART)) {
  const maximum = id === 'mine_shaft' ? 5 : id === 'research_office' ? 2 : 3, minimum = ['mine_office', 'mine_shaft', 'warehouse', 'tool_station'].includes(id) ? 1 : 0;
  for (let level = minimum; level <= maximum; level++) add(`building:${id}:${level}`, bounds.width * 16 + 16, bounds.height * 16 + 24, context => {
    context.translate(-bounds.x * 16 + 8, -bounds.y * 16 + 16); source.paintBuildingSource(context, id, level, 0, false);
  });
}
for (const specialty of types.DEEP_CLAIM_SPECIALTIES) for (const pose of ['idle', 'walk', 'mine', 'haul', 'setup', 'survey', 'build']) for (let appearance = 0; appearance < 4; appearance++) for (let frame = 0; frame < 4; frame++) {
  add(`worker:${specialty}:${pose}:${appearance}:${frame}`, 24, 32, context => { context.translate(12, 28); source.paintWorkerBodySource(context, specialty, pose, frame * 220, appearance, true); });
}
for (let variant = 0; variant < 4; variant++) for (const detailed of [false, true]) {
  for (const formation of [null, ...types.DEEP_CLAIM_FORMATIONS]) {
    for (const resource of [null, ...types.DEEP_CLAIM_MINERAL_IDS]) for (const soil of [false, true]) {
      const key = source.terrainSpriteKey(resource, false, variant, detailed, soil, formation, 0);
      add(key, 16, 16, context => source.paintTerrain(context, 0, 0, resource, false, variant, detailed, soil, formation, 0));
    }
    for (let neighbors = 0; neighbors < (formation ? 16 : 1); neighbors++) {
      const key = source.terrainSpriteKey(null, true, variant, detailed, false, formation, neighbors);
      add(key, 16, 16, context => source.paintTerrain(context, 0, 0, null, true, variant, detailed, false, formation, neighbors));
    }
  }
}
for (let variant = 0; variant < 4; variant++) add(`fog:${variant}`, 16, 16, context => {
  context.fillStyle = '#17191b'; context.fillRect(0, 0, 16, 16); context.fillStyle = '#1c1d1e'; context.fillRect(1, 1, 14, 1); context.fillStyle = '#101315'; context.fillRect(0, 15, 16, 1);
  if (variant < 2) { context.fillStyle = '#202122'; context.fillRect(3 + variant, 7, 5, 2); }
});
for (const key of types.DEEP_CLAIM_INFRASTRUCTURE_KEYS) for (let grade = 1; grade <= 3; grade++) for (const installed of [false, true]) for (let frame = 0; frame < 2; frame++) {
  add(`infrastructure:${key}:${grade}:${installed ? 1 : 0}:${frame}`, 16, 16, context => { for (const [color, x, y, width, height] of field.infrastructureSprite(key, grade, installed, frame).blocks) { context.fillStyle = color; context.fillRect(x, y, width, height); } });
}
for (const kind of types.DEEP_CLAIM_DISCOVERY_KINDS) for (const quality of types.DEEP_CLAIM_DISCOVERY_QUALITIES) add(`discovery:${kind}:${quality}`, 18, 18, context => fieldSource.paintDiscoverySource(context, kind, quality));
for (const [key, decoration] of Object.entries(pack.decorations)) add(`decor:${key}`, decoration.width, decoration.height, context => { for (const [color, x, y, width, height] of decoration.blocks) { context.fillStyle = color; context.fillRect(x, y, width, height); } });

// Identical authored frames share a rectangle. No gameplay/coordinate seed participates.
const unique = new Map(), aliases = new Map();
for (const frame of frames.values()) {
  const hash = `${frame.width}:${frame.height}:${createHash('sha256').update(frame.pixels).digest('hex')}`;
  if (!unique.has(hash)) unique.set(hash, frame);
  aliases.set(frame.key, unique.get(hash));
}
const atlasWidth = pack.specifications.atlas_width, padding = pack.specifications.padding_pixels;
let shelfX = padding, shelfY = padding, shelfHeight = 0;
for (const frame of [...unique.values()].sort((a, b) => b.height - a.height || b.width - a.width || a.key.localeCompare(b.key, 'en'))) {
  if (shelfX + frame.width + padding > atlasWidth) { shelfX = padding; shelfY += shelfHeight + padding * 2; shelfHeight = 0; }
  frame.x = shelfX; frame.y = shelfY; shelfX += frame.width + padding * 2; shelfHeight = Math.max(shelfHeight, frame.height);
}
const atlasHeight = Math.ceil((shelfY + shelfHeight + padding) / 32) * 32;
if (atlasHeight > pack.specifications.maximum_atlas_height) throw new Error(`Atlas exceeded its ${pack.specifications.maximum_atlas_height}px memory budget: ${atlasHeight}`);
const atlasPixels = new Uint8Array(atlasWidth * atlasHeight * 4);
for (const frame of unique.values()) for (let y = 0; y < frame.height; y++) atlasPixels.set(frame.pixels.subarray(y * frame.width * 4, (y + 1) * frame.width * 4), ((frame.y + y) * atlasWidth + frame.x) * 4);
const crcTable = Array.from({ length: 256 }, (_, entry) => { let value = entry; for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ value >>> 1 : value >>> 1; return value >>> 0; });
function pngChunk(name, payload) {
  const type = Buffer.from(name), body = Buffer.concat([type, payload]); let crc = 0xffffffff;
  for (const value of body) crc = crcTable[(crc ^ value) & 255] ^ crc >>> 8;
  const header = Buffer.alloc(4), footer = Buffer.alloc(4); header.writeUInt32BE(payload.length); footer.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([header, body, footer]);
}
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(atlasWidth, 0); ihdr.writeUInt32BE(atlasHeight, 4); ihdr[8] = 8; ihdr[9] = 6;
const raw = Buffer.alloc((atlasWidth * 4 + 1) * atlasHeight);
for (let y = 0; y < atlasHeight; y++) raw.set(atlasPixels.subarray(y * atlasWidth * 4, (y + 1) * atlasWidth * 4), y * (atlasWidth * 4 + 1) + 1);
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk('IHDR', ihdr), pngChunk('IDAT', deflateSync(raw, { level: 9 })), pngChunk('IEND', Buffer.alloc(0))]);
const hash = createHash('sha256'); for (const file of [...inputFiles].sort()) hash.update(relative(root, file) + '\0').update(readFileSync(file)).update('\0');
const outputMetadata = { version: 1, width: atlasWidth, height: atlasHeight, sourceHash: hash.digest('hex'), pngBytes: png.length, uniqueSprites: unique.size,
  specifications: pack.specifications, sources: [...inputFiles].map(file => relative(root, file)).sort(),
  frames: Object.fromEntries([...aliases].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([key, frame]) => [key, { x: frame.x, y: frame.y, width: frame.width, height: frame.height }])) };
const outputs = [[resolve(root, 'public/deep-claim/atlas-v1.png'), png], [resolve(root, 'src/components/deepClaim/renderer/generated/atlas-v1.json'), Buffer.from(JSON.stringify(outputMetadata, null, 2) + '\n')]];
if (process.argv.includes('--check')) {
  for (const [file, bytes] of outputs) if (!existsSync(file) || !readFileSync(file).equals(bytes)) throw new Error(`Outdated authored asset: ${relative(root, file)}. Run node scripts/build-deep-claim-atlas.mjs`);
} else for (const [file, bytes] of outputs) { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, bytes); }
console.log(`Deep Claim authored pack v1: ${frames.size} frames / ${unique.size} unique sprites, ${atlasWidth}×${atlasHeight}, ${png.length} PNG bytes, ${atlasWidth * atlasHeight * 4} decoded bytes${process.argv.includes('--check') ? ' — reproducible outputs verified' : ''}.`);
