// Cheap, dependency-free Phase 6 rule preservation and asset-budget gate. It does not replace
// the atlas generator's --check, PostgreSQL proofs, or browser performance tests.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const baseline = JSON.parse(await readFile(resolve(root, 'scripts/fixtures/deep-claim-presentation-baseline.json'), 'utf8'));
const entries = Object.entries(baseline.sha256);
const expectedMigrations = entries.filter(([path]) => path.startsWith('supabase/migrations/')).map(([path]) => path.split('/').at(-1)).sort();
const actualMigrations = (await readdir(resolve(root, 'supabase/migrations'))).filter(path => /^20261102\d+_deep_claim.*\.sql$/.test(path)).sort();
assert.deepEqual(actualMigrations, expectedMigrations, 'Phase 6 presentation must not add or replace a Deep Claim migration');
for (const [path, expected] of entries) {
  const contents = await readFile(resolve(root, path));
  assert.equal(createHash('sha256').update(contents).digest('hex'), expected, `Presentation changed frozen gameplay source: ${path}`);
}
// Inspect the committed bytes independently of the generator. Compressed and
// decoded budgets are separate: a small download can still decode very large.
const metadata = JSON.parse(await readFile(resolve(root, 'src/components/deepClaim/renderer/generated/atlas-v1.json'), 'utf8'));
const png = await readFile(resolve(root, 'public/deep-claim/atlas-v1.png'));
assert.ok(png.length <= 256 * 1024, 'Pixel atlas exceeds the 256KiB compressed budget');
assert.equal(png.length, metadata.pngBytes);
assert.deepEqual(png.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
assert.equal(png.toString('ascii', 12, 16), 'IHDR'); assert.equal(png.readUInt32BE(8), 13);
const width = png.readUInt32BE(16), height = png.readUInt32BE(20), decodedBytes = width * height * 4;
assert.equal(width, metadata.width); assert.equal(height, metadata.height);
assert.ok(width > 0 && width <= 1024 && height > 0 && height <= 2048 && decodedBytes <= 8 * 1024 * 1024);
assert.deepEqual([...png.subarray(24, 29)], [8, 6, 0, 0, 0], 'Expected an 8-bit noninterlaced RGBA atlas');
const compressed = []; let ended = false;
for (let offset = 8; offset < png.length;) {
  assert.ok(offset + 12 <= png.length, 'Truncated PNG chunk');
  const length = png.readUInt32BE(offset), kind = png.toString('ascii', offset + 4, offset + 8);
  assert.ok(offset + 12 + length <= png.length, 'Invalid PNG chunk size');
  if (kind === 'IDAT') compressed.push(png.subarray(offset + 8, offset + 8 + length));
  offset += length + 12;
  if (kind === 'IEND') { assert.equal(length, 0); assert.equal(offset, png.length); ended = true; break; }
}
assert.ok(ended && compressed.length > 0, 'Incomplete PNG atlas');
const scanlines = inflateSync(Buffer.concat(compressed), { maxOutputLength: 8 * 1024 * 1024 + 2048 });
assert.equal(scanlines.length, height * (width * 4 + 1));
for (let row = 0; row < height; row++) assert.ok(scanlines[row * (width * 4 + 1)] <= 4, 'Invalid PNG row filter');
assert.equal(metadata.version, 1); assert.match(metadata.sourceHash, /^[a-f0-9]{64}$/);
const frames = Object.entries(metadata.frames); assert.ok(frames.length > 0 && frames.length <= 4096);
const uniqueRectangles = new Set();
for (const [key, frame] of frames) {
  for (const coordinate of ['x', 'y', 'width', 'height']) assert.ok(Number.isInteger(frame[coordinate]), `Invalid sprite geometry: ${key}`);
  assert.ok(frame.x >= 0 && frame.y >= 0 && frame.width > 0 && frame.height > 0
    && frame.x + frame.width <= width && frame.y + frame.height <= height, `Sprite outside atlas: ${key}`);
  uniqueRectangles.add(`${frame.x}:${frame.y}:${frame.width}:${frame.height}`);
}
assert.equal(uniqueRectangles.size, metadata.uniqueSprites, 'Alias references must not be counted as distinct pixel rectangles');
console.log(JSON.stringify({ baseline: baseline.baseline, preserved_sources: entries.length,
  published_migrations: expectedMigrations.length, rule_modules: entries.filter(([path]) => path.endsWith('.ts')).length,
  canonical_catalogs: entries.filter(([path]) => path.endsWith('.json')).length,
  atlas: { width, height, registered_references: frames.length, unique_rectangles: uniqueRectangles.size,
    png_bytes: png.length, decoded_bytes: decodedBytes, compressed_budget_bytes: 256 * 1024, decoded_budget_bytes: 8 * 1024 * 1024 },
  scope: 'Source and committed-asset budgets only; no live database, hardware or playtime verification.' }, null, 2));
