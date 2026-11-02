// Dependency-free versioned preservation and asset-budget gate. It does not replace
// the atlas generator's --check, PostgreSQL proofs, or browser performance tests.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
assert.ok(args.length <= 1 && args.every(arg => ['--phase=6', '--phase=7', '--phase=8'].includes(arg)), 'Use --phase=6 (default), --phase=7 or --phase=8');
const phase = args[0] === '--phase=8' ? 8 : args[0] === '--phase=7' ? 7 : 6;
const baselinePath = phase === 8 ? 'scripts/fixtures/deep-claim-phase8-preservation-baseline.json' : 'scripts/fixtures/deep-claim-presentation-baseline.json';
const baseline = JSON.parse(await readFile(resolve(root, baselinePath), 'utf8'));
const entries = Object.entries(baseline.sha256);
// Phase 7 intentionally extends current rule code. The seven released SQL
// sources and five old catalogs remain immutable; do not rewrite their hashes
// or the Phase 6 baseline merely to accept an authorized new rules version.
const auditedEntries = phase === 7 ? entries.filter(([path]) => path.startsWith('supabase/migrations/') || path.endsWith('.json')) : entries;
const expectedMigrations = entries.filter(([path]) => path.startsWith('supabase/migrations/')).map(([path]) => path.split('/').at(-1)).sort();
if (phase === 7) expectedMigrations.push('20261102070000_deep_claim_ancient_deep.sql');
if (phase === 8) expectedMigrations.push('20261102080000_deep_claim_training_journal.sql');
const actualMigrations = (await readdir(resolve(root, 'supabase/migrations'))).filter(path => /^20261102\d+_deep_claim.*\.sql$/.test(path)).sort();
// Phase7's historical artifact remains checkable after the additive journal.
// The current Phase8 gate still audits the complete migration list exactly.
const scopedMigrations = phase === 7 ? actualMigrations.filter(path => path < '20261102080000_') : actualMigrations;
assert.deepEqual(scopedMigrations, expectedMigrations, `Unexpected migration in the Phase ${phase} release`);
for (const [path, expected] of auditedEntries) {
  const contents = await readFile(resolve(root, path));
  assert.equal(createHash('sha256').update(contents).digest('hex'), expected, `Presentation changed frozen gameplay source: ${path}`);
}
let frozenArtFiles = 0, extension;
if (phase >= 7) {
  const artBaseline = JSON.parse(await readFile(resolve(root, 'scripts/fixtures/deep-claim-phase7-preservation-baseline.json'), 'utf8'));
  const frozen = [...Object.entries(artBaseline.frozen_art_v1), ...Object.entries({ ...artBaseline.archived_v1_sources, ...artBaseline.archived_v1_resolution }).map(([path, hash]) => [`${artBaseline.archive_root}/${path}`, hash])];
  for (const [path, expected] of frozen) {
    assert.equal(createHash('sha256').update(await readFile(resolve(root, path))).digest('hex'), expected, `Phase 7 changed frozen v1 artwork or compiler input: ${path}`);
  }
  frozenArtFiles = frozen.length;
  const catalogBytes = await readFile(resolve(root, 'supabase/seed/deep-claim-phase7-catalog.json'));
  const catalog = JSON.parse(catalogBytes.toString());
  assert.equal(catalog.version, 7); assert.equal(catalog.shaft.max_depth, 999);
  assert.equal(catalog.resources.length, 3); assert.equal(catalog.recipes.length, 2); assert.equal(catalog.equipment.length, 1);
  extension = { baseline: artBaseline.baseline, catalog_sha256: createHash('sha256').update(catalogBytes).digest('hex'),
    migration_sha256: createHash('sha256').update(await readFile(resolve(root, 'supabase/migrations/20261102070000_deep_claim_ancient_deep.sql'))).digest('hex') };
}
// Inspect the committed bytes independently of the generator. Compressed and
// decoded budgets are separate: a small download can still decode very large.
async function auditAtlas(version, limits) {
const metadata = JSON.parse(await readFile(resolve(root, `src/components/deepClaim/renderer/generated/atlas-v${version}.json`), 'utf8'));
const png = await readFile(resolve(root, `public/deep-claim/atlas-v${version}.png`));
assert.ok(png.length <= limits.compressed, `Pixel atlas v${version} exceeds its compressed budget`);
assert.equal(png.length, metadata.pngBytes);
assert.deepEqual(png.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
assert.equal(png.toString('ascii', 12, 16), 'IHDR'); assert.equal(png.readUInt32BE(8), 13);
const width = png.readUInt32BE(16), height = png.readUInt32BE(20), decodedBytes = width * height * 4;
assert.equal(width, metadata.width); assert.equal(height, metadata.height);
assert.ok(width > 0 && width <= limits.width && height > 0 && height <= limits.height && decodedBytes <= limits.decoded);
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
const scanlines = inflateSync(Buffer.concat(compressed), { maxOutputLength: limits.decoded + limits.height });
assert.equal(scanlines.length, height * (width * 4 + 1));
for (let row = 0; row < height; row++) assert.ok(scanlines[row * (width * 4 + 1)] <= 4, 'Invalid PNG row filter');
assert.equal(metadata.version, version); assert.match(metadata.sourceHash, /^[a-f0-9]{64}$/);
const frames = Object.entries(metadata.frames); assert.ok(frames.length > 0 && frames.length <= limits.references);
const uniqueRectangles = new Set();
for (const [key, frame] of frames) {
  for (const coordinate of ['x', 'y', 'width', 'height']) assert.ok(Number.isInteger(frame[coordinate]), `Invalid sprite geometry: ${key}`);
  assert.ok(frame.x >= 0 && frame.y >= 0 && frame.width > 0 && frame.height > 0
    && frame.x + frame.width <= width && frame.y + frame.height <= height, `Sprite outside atlas: ${key}`);
  uniqueRectangles.add(`${frame.x}:${frame.y}:${frame.width}:${frame.height}`);
}
assert.equal(uniqueRectangles.size, metadata.uniqueSprites, 'Alias references must not be counted as distinct pixel rectangles');
return { version, width, height, registered_references: frames.length, unique_rectangles: uniqueRectangles.size,
  png_bytes: png.length, decoded_bytes: decodedBytes, compressed_budget_bytes: limits.compressed, decoded_budget_bytes: limits.decoded };
}
const atlases = [await auditAtlas(1, { width: 1024, height: 2048, compressed: 256 * 1024, decoded: 8 * 1024 * 1024, references: 4096 })];
if (phase >= 7) atlases.push(await auditAtlas(2, { width: 512, height: 1024, compressed: 128 * 1024, decoded: 2 * 1024 * 1024, references: 2048 }));
console.log(JSON.stringify({ phase, baseline: baseline.baseline, preserved_sources: auditedEntries.length,
  published_migrations: phase === 8 ? 8 : phase === 7 ? 7 : expectedMigrations.length, total_migrations: expectedMigrations.length,
  rule_modules: auditedEntries.filter(([path]) => path.endsWith('.ts')).length,
  canonical_catalogs: auditedEntries.filter(([path]) => path.startsWith('supabase/seed/') || path === 'src/lib/feats/deepClaimCatalog.json').length,
  ...(phase === 8 ? { frozen_atlas_files: auditedEntries.filter(([path]) => /atlas-v[12]\.(png|json)$/.test(path)).length } : {}),
  frozen_art_files: frozenArtFiles, extension, atlases,
  scope: 'Source and committed-asset budgets only; no live database, hardware or playtime verification.' }, null, 2));
