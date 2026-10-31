// Regenerate the launch SQL seed only after all authored gold routes validate.
// Running this edits a local migration; it never connects to any database.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { build } from "esbuild";

const rooms = JSON.parse(
  await readFile("src/lib/runedelve/puzzles/rooms.json", "utf8"),
).filter((room) => room.order <= 18);
const stable = (value) =>
  Array.isArray(value)
    ? value.map(stable)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, stable(value[key])]),
        )
      : value;
assert.equal(
  createHash("sha256")
    .update(JSON.stringify(stable(rooms)))
    .digest("hex"),
  "c9c42e63af6c3e44694b4471fbceaed0efa98ae7681f6e05b96581778e5da169",
  "Released puzzles stay immutable; append new content through a new migration",
);
const compiled = await build({
  entryPoints: ["src/lib/runedelve/puzzles/engine.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const { validatePuzzleRoom, replayPuzzle, puzzleStars } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`
);
assert.equal(rooms.length, 18);
const definitions = rooms.map((room, index) => {
  assert.equal(room.order, index + 1);
  assert.deepEqual(validatePuzzleRoom(room), [], room.id);
  const replay = replayPuzzle(room, room.solution);
  assert.equal(replay.valid, true, room.id);
  assert.equal(replay.state.status, "solved", room.id);
  assert.equal(puzzleStars(room, replay.state), 3, room.id);
  const { solution: _solution, ...definition } = room;
  return definition;
});
assert.equal(
  new Set(definitions.map((room) => `${room.id}:${room.version}`)).size,
  18,
);
const json = JSON.stringify(definitions);
assert.equal(json.includes("$puzzle_rooms$"), false);
const seed = `-- ROOM_DEFINITIONS_SEED: authored, solution-verified immutable definitions.
do $seed$
declare entry jsonb; existing jsonb;
begin
  for entry in select value from jsonb_array_elements($puzzle_rooms$${json}$puzzle_rooms$::jsonb) loop
    select definition into existing from public.rune_puzzle_definitions
      where room_id=entry->>'id' and definition_version=(entry->>'version')::integer;
    if found then
      if existing<>entry then raise exception 'puzzle_definition_version_immutable: %',entry->>'id'; end if;
    else
      insert into public.rune_puzzle_definitions(room_id,definition_version,ordinal,definition)
        values(entry->>'id',(entry->>'version')::integer,(entry->>'order')::integer,entry);
    end if;
  end loop;
end $seed$;
-- END_ROOM_DEFINITIONS_SEED`;
const path =
  "supabase/migrations/20261031050000_rune_delve_spatial_puzzles.sql";
const sql = await readFile(path, "utf8");
const start = sql.indexOf("-- ROOM_DEFINITIONS_SEED:");
const end =
  sql.indexOf("-- END_ROOM_DEFINITIONS_SEED") +
  "-- END_ROOM_DEFINITIONS_SEED".length;
assert.ok(start >= 0 && end > start);
await writeFile(path, sql.slice(0, start) + seed + sql.slice(end));
console.log(
  `Seeded ${definitions.length} immutable, gold-solution-verified definitions into the local migration.`,
);
