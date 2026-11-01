// Deterministic, offline scene authoring. No generated content or answer catalog enters the app bundle.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

const compiled = await build({ entryPoints: ['src/lib/showdown/afterimage/engine.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
const engine = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const { validateSceneDefinition, validatePublishedScene, sanitizeScene, scoreScene } = engine;
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const fingerprint = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const token = (kind, value) => `${kind}-${fingerprint(value).slice(0, 16)}`;
const labels = {
  book: 'Book', lantern: 'Lantern', key: 'Key', orb: 'Orb', flask: 'Flask', compass: 'Compass', cup: 'Cup', clock: 'Clock',
  flower: 'Flower', shell: 'Shell', anchor: 'Anchor', fish: 'Fish', bell: 'Bell', telescope: 'Telescope', candle: 'Candle',
  teapot: 'Teapot', crown: 'Crown', crystal: 'Crystal', quill: 'Quill', globe: 'Globe', scroll: 'Scroll', acorn: 'Acorn',
  pear: 'Pear', watering_can: 'Watering can', gear: 'Gear', bottle: 'Bottle', star: 'Star', map: 'Map', satchel: 'Satchel', feather: 'Feather',
};
// Each world has a coherent inventory, its own spatial arrangement, fixed omissions,
// and plausible distractors. Variants are authored content rather than palette swaps.
const worlds = [
  { theme: 'workshop', title: 'The Lantern Bench', inventory: ['gear','lantern','key','flask','compass','clock','bell','book','crystal','bottle','scroll','satchel','candle','map','feather'], distractors: { medium: ['candle'], hard: ['orb','quill'] } },
  { theme: 'greenhouse', title: 'Mosslight Conservatory', inventory: ['flower','watering_can','acorn','pear','bottle','cup','book','lantern','crystal','teapot','feather','globe','clock','bell','candle'], distractors: { medium: ['key'], hard: ['flask','scroll'] } },
  { theme: 'harbor', title: 'The Tidekeeper Cabin', inventory: ['anchor','fish','shell','map','compass','lantern','bottle','satchel','bell','star','quill','cup','book','key','feather'], distractors: { medium: ['clock'], hard: ['crown','teapot'] } },
  { theme: 'clockmaker', title: 'The Midnight Clockmaker', inventory: ['clock','gear','bell','key','lantern','crystal','orb','flask','compass','book','candle','cup','map','scroll','globe'], distractors: { medium: ['quill'], hard: ['feather','star'] } },
  { theme: 'kitchen', title: 'The Copper Kettle', inventory: ['teapot','cup','pear','bottle','flower','book','candle','clock','key','lantern','watering_can','acorn','shell','quill','bell'], distractors: { medium: ['flask'], hard: ['gear','crystal'] } },
  { theme: 'observatory', title: 'The Starlit Archive', inventory: ['telescope','globe','star','compass','crystal','orb','map','book','quill','flask','clock','lantern','candle','bell','feather'], distractors: { medium: ['scroll'], hard: ['key','bottle'] } },
];
const courses = [
  { difficulty: 'easy', count: 9, columns: [180,500,820], missing: [[1,4,7],[0,5,8],[2,3,6],[0,4,7],[1,3,8],[2,4,6]], subtitle: 'First impressions' },
  { difficulty: 'medium', count: 12, columns: [130,370,630,870], missing: [[1,5,8,10],[0,4,7,11],[2,3,6,9],[0,5,7,10],[1,4,8,11],[2,5,6,10]], subtitle: 'A closer look' },
  { difficulty: 'hard', count: 15, columns: [100,300,500,700,900], missing: [[0,3,6,10,14],[1,4,8,10,12],[0,5,7,11,13],[2,4,6,9,14],[1,3,7,10,13],[0,4,6,11,14]], subtitle: 'Every detail matters' },
];
const rows = [185,405,605];
function author(world, worldIndex, course) {
  const id = `afterimage-${world.theme}-${course.difficulty}`;
  const inventory = world.inventory.slice(0, course.count);
  // A world-specific stable ordering makes identity/location associations distinct
  // even where accessible shelf geometry is intentionally shared.
  const ordered = inventory.map((assetId, index) => ({ assetId, order: fingerprint([id, assetId, index, 'room-layout']) }))
    .sort((a,b) => a.order.localeCompare(b.order)).map(row => row.assetId);
  const objects = ordered.map((assetId, index) => ({
    id: token('object', [id, assetId]), assetId, label: labels[assetId],
    x: course.columns[index % course.columns.length] + ((worldIndex * 3 + index * 7) % 11 - 5),
    y: rows[Math.floor(index / course.columns.length)] + ((worldIndex * 5 + index * 3) % 17 - 8),
    layer: index + 1,
  }));
  const missingIds = course.missing[worldIndex].map(index => objects[index].id);
  const distractors = (world.distractors[course.difficulty] ?? []).map(assetId => ({ id: token('decoy', [id, assetId]), assetId, label: labels[assetId] }));
  const slots = missingIds.map((objectId, index) => {
    const original = objects.find(object => object.id === objectId);
    return { id: token('place', [id, index, 'neutral-target']), objectId,
      x: original.x, y: original.y, width: 180, height: 160, layer: original.layer, label: `Place ${String.fromCharCode(65 + index)}` };
  });
  const trayOrder = [...missingIds, ...distractors.map(piece => piece.id)]
    .sort((a,b) => fingerprint([id, a, 'tray-order-v1']).localeCompare(fingerprint([id, b, 'tray-order-v1'])));
  const definition = { id, version: 1, difficulty: course.difficulty, title: `${world.title} · ${course.subtitle}`,
    theme: world.theme, background: world.theme, width: 1000, height: 700, objects, missingIds, distractors, slots, trayOrder,
    a11y: { label: `${world.title}, ${course.difficulty} memory scene`, instructions: 'Study the room, then put the missing objects back into their empty places. Select an object and a place, or drag it there.' } };
  validateSceneDefinition(definition);
  assert.deepEqual(validatePublishedScene(definition), { valid: true, errors: [] });
  const answers = slots.map(slot => ({ object_id: slot.objectId, slot_id: slot.id }));
  assert.deepEqual(scoreScene(definition, answers), { score: 125, correct_count: slots.length, required_count: slots.length, perfect: true });
  assert.equal(scoreScene(definition, []).score, 0);
  assert.equal(sanitizeScene(definition, 'reconstruct').objects.length, course.count - missingIds.length);
  const publicScene = JSON.stringify(sanitizeScene(definition, 'reconstruct'));
  assert.equal(publicScene.includes('objectId'), false);
  assert.equal(publicScene.includes('missingIds'), false);
  assert.equal(publicScene.includes('answers'), false);
  return { ...definition, validation: { validator: 'afterimage_scene_v1', validated: true, definitionSha256: fingerprint(definition),
    originalObjects: objects.length, missingObjects: missingIds.length, distractors: distractors.length,
    minMobileTargetPx: { width: 50.4, height: 44.8 }, mobileReferenceWidth: 280 } };
}

const library = courses.flatMap(course => worlds.map((world, index) => author(world, index, course)));
assert.equal(library.length, 18);
assert.equal(new Set(library.map(scene => scene.id)).size, library.length);
for (const course of courses) assert.equal(library.filter(scene => scene.difficulty === course.difficulty).length, 6);
assert.equal(new Set(library.map(scene => fingerprint({ objects: scene.objects.map(({ assetId,x,y }) => ({ assetId,x,y })), missing: scene.missingIds }))).size, 18);
const contentHash = fingerprint(library);
const catalogJson = JSON.stringify(library, null, 2) + '\n';
const records = library.map(({ validation, ...definition }) => ({ definition, validation }));
const json = JSON.stringify(records);
assert.equal(json.includes('$afterimage_definitions$'), false);
const sql = `-- Authored Afterimage v1 launch library. Every scene passed strict identity,\n-- answer-map, distractor, geometry and mobile-target validation before publishing.\n-- Rebuild with: node scripts/author-afterimage.mjs (offline only).\n-- Library SHA-256: ${contentHash}\nbegin;\ndo $seed$\ndeclare entry jsonb; existing public.showdown_puzzles%rowtype;\nbegin\n  if not exists(select 1 from public.showdown_games where game_key='afterimage' and current_rules_version=1) then raise exception 'Afterimage registry must be installed first'; end if;\n  for entry in select value from jsonb_array_elements($afterimage_definitions$${json}$afterimage_definitions$::jsonb) loop\n    perform public.afterimage_validate_v1(entry->'definition');\n    select * into existing from public.showdown_puzzles where game_key='afterimage' and rules_version=1\n      and puzzle_id=entry->'definition'->>'id' and puzzle_version=(entry->'definition'->>'version')::integer;\n    if found then\n      if existing.definition<>entry->'definition' or existing.minimum_rotations is not null\n        or existing.difficulty<>entry->'definition'->>'difficulty' then raise exception 'Published Afterimage scene version is immutable: %',entry->'definition'->>'id'; end if;\n    else\n      insert into public.showdown_puzzles(game_key,rules_version,puzzle_id,puzzle_version,difficulty,title,definition,minimum_rotations,validation,published)\n        values('afterimage',1,entry->'definition'->>'id',(entry->'definition'->>'version')::integer,entry->'definition'->>'difficulty',entry->'definition'->>'title',entry->'definition',NULL,entry->'validation',true);\n    end if;\n  end loop;\nend $seed$;\ncommit;\n`;
if (process.argv.includes('--check')) {
  assert.equal(await readFile('supabase/seed/afterimage-library.json', 'utf8'), catalogJson, 'Afterimage library is stale or was edited without validation.');
  assert.equal(await readFile('supabase/migrations/20261101050000_afterimage_library.sql', 'utf8'), sql, 'Afterimage seed is stale or was edited without validation.');
} else {
  await mkdir('supabase/seed', { recursive: true });
  await writeFile('supabase/seed/afterimage-library.json', catalogJson);
  await writeFile('supabase/migrations/20261101050000_afterimage_library.sql', sql);
}
console.log(JSON.stringify({ scenes: library.length, librarySha256: contentHash, difficulties: Object.fromEntries(courses.map(course => [course.difficulty,
  library.filter(scene => scene.difficulty === course.difficulty).map(scene => ({ id: scene.id, objects: scene.objects.length, missing: scene.missingIds.length, distractors: scene.distractors.length }))])) }, null, 2));
