// Append-only adventure seed generation. Never connects to a database and never
// modifies the previously deployed launch migration.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { build } from "esbuild";

const canonical = JSON.parse(
  await readFile("src/lib/runedelve/puzzles/rooms.json", "utf8"),
);
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
  canonical.length,
  36,
  "The complete six-chapter catalog must be frozen first",
);
const launchHash = createHash("sha256")
  .update(JSON.stringify(stable(canonical.slice(0, 18))))
  .digest("hex");
assert.equal(
  launchHash,
  "c9c42e63af6c3e44694b4471fbceaed0efa98ae7681f6e05b96581778e5da169",
  "Released puzzles must remain unchanged",
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
const definitions = canonical.slice(18).map((room, index) => {
  assert.equal(room.order, index + 19);
  assert.ok(
    room.areas?.length >= 2 && room.areas.length <= 3,
    `${room.id}: connected boards`,
  );
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
assert.equal(json.includes("$rune_adventures$"), false);
const seed = `-- ADVENTURE_DEFINITIONS_SEED: appended, solution-verified immutable definitions.
do $seed$
declare entry jsonb; existing jsonb;
begin
  for entry in select value from jsonb_array_elements($rune_adventures$${json}$rune_adventures$::jsonb) loop
    if (entry->>'order')::integer not between 19 and 36 then raise exception 'invalid_adventure_ordinal'; end if;
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
-- END_ADVENTURE_DEFINITIONS_SEED`;
const path = "supabase/migrations/20261031090000_rune_delve_adventures.sql";
const sql = await readFile(path, "utf8");
const start = sql.indexOf("-- ADVENTURE_DEFINITIONS_SEED:");
const end =
  sql.indexOf("-- END_ADVENTURE_DEFINITIONS_SEED") +
  "-- END_ADVENTURE_DEFINITIONS_SEED".length;
assert.ok(start >= 0 && end > start);
await writeFile(path, sql.slice(0, start) + seed + sql.slice(end));
console.log(
  JSON.stringify({
    appendedDefinitions: definitions.length,
    launchHash,
    definitionHash: createHash("sha256")
      .update(JSON.stringify(stable(definitions)))
      .digest("hex"),
  }),
);
