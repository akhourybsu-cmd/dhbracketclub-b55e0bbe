// Offline, deterministic authoring. Validates every board before producing any
// publishable seed. Never imports this private catalog into the application.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

const compiled = await build({ entryPoints: ['src/lib/showdown/prism/solver.ts', 'src/lib/showdown/prism/engine.ts'], bundle: true, platform: 'node', format: 'esm', write: false, outdir: '/tmp/prism-authoring' });
const moduleFrom = async (name) => import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles.find(file => file.path.endsWith(`/${name}.js`)).text).toString('base64')}`);
const { solvePuzzle, validatePublishedPuzzle } = await moduleFrom('solver');
const { initialOrientations, traceValidatedPuzzle, replayActions } = await moduleFrom('engine');

const P = (points, color, label, options = {}) => ({ points, color, label, ...options });
const specs = [
  { id: 'first-light', title: 'First Light', difficulty: 'easy', size: 5, paths: [P([[0,2],[2,2],[2,0],[4,0],[4,3]], 'cyan', 'A')], flips: [0,2], walls: [[0,0],[0,4],[1,4],[3,4]], decoys: [[1,1]] },
  { id: 'corner-relay', title: 'Corner Relay', difficulty: 'easy', size: 5, paths: [P([[4,1],[1,1],[1,4],[3,4],[3,2]], 'magenta', 'A')], flips: [0,1,2], walls: [[0,0],[0,3],[4,4]], decoys: [[2,0]] },
  { id: 'folded-sky', title: 'Folded Sky', difficulty: 'easy', size: 5, paths: [P([[1,4],[1,2],[4,2],[4,0],[2,0],[2,1]], 'gold', 'A', { fixed: [2] })], flips: [0,1,2], walls: [[0,4],[0,3],[3,4]], decoys: [[0,1]] },
  { id: 'center-bend', title: 'Center Bend', difficulty: 'easy', size: 5, paths: [P([[4,3],[2,3],[2,1],[0,1],[0,4]], 'cyan', 'A')], flips: [0,1], walls: [[4,0],[3,0],[0,0]], decoys: [[3,2]] },
  { id: 'quiet-circuit', title: 'Quiet Circuit', difficulty: 'easy', size: 5, paths: [P([[0,4],[3,4],[3,1],[1,1],[1,3],[2,3]], 'magenta', 'A')], flips: [0,2,3], walls: [[0,0],[2,0],[4,2]], decoys: [[4,4]] },
  { id: 'switchback', title: 'Switchback', difficulty: 'easy', size: 5, paths: [P([[2,0],[2,2],[0,2],[0,4],[4,4],[4,1]], 'gold', 'A', { fixed: [1] })], flips: [0,1,2], walls: [[4,0],[3,0],[1,1],[3,3]], decoys: [[3,1]] },

  { id: 'azure-gate', title: 'Azure Gate', difficulty: 'medium', size: 6, paths: [P([[0,1],[3,1],[3,4],[1,4],[1,2],[5,2],[5,5]], 'white', 'A', { receiverColor: 'cyan' })], flips: [0,1,3,4], filters: [{ at: [2,1], accepts: ['white'], output: 'cyan' }], walls: [[0,3],[0,5],[2,5],[4,0]], decoys: [[4,4]] },
  { id: 'rose-window', title: 'Rose Window', difficulty: 'medium', size: 6, paths: [P([[5,0],[5,3],[2,3],[2,1],[0,1],[0,4],[4,4],[4,2]], 'white', 'A', { receiverColor: 'magenta', fixed: [3] })], flips: [0,1,3,4], filters: [{ at: [5,1], accepts: ['white'], output: 'magenta' }, { at: [1,4], accepts: ['magenta'] }], walls: [[1,0],[3,0],[5,5],[0,5]], decoys: [[3,5]] },
  { id: 'twin-lanterns', title: 'Twin Lanterns', difficulty: 'medium', size: 6, paths: [P([[0,0],[2,0],[2,2],[0,2],[0,4]], 'cyan', 'A'), P([[5,5],[3,5],[3,3],[5,3],[5,1]], 'magenta', 'B')], flips: [0,1,2,3,5], filters: [{ at: [1,0], accepts: ['cyan'] }, { at: [4,5], accepts: ['magenta'] }], walls: [[1,5],[4,0],[1,3],[4,2]], decoys: [[2,4]] },
  { id: 'gold-standard', title: 'Gold Standard', difficulty: 'medium', size: 6, paths: [P([[0,3],[4,3],[4,0],[1,0],[1,5],[3,5],[3,1]], 'white', 'A', { receiverColor: 'gold' })], flips: [0,1,2,4], filters: [{ at: [2,3], accepts: ['white','gold'], output: 'gold' }, { at: [1,2], accepts: ['gold'] }], walls: [[5,0],[5,4],[0,0],[0,5],[2,2]], decoys: [[5,2]] },
  { id: 'narrow-passage', title: 'Narrow Passage', difficulty: 'medium', size: 6, paths: [P([[3,5],[3,2],[5,2],[5,0],[1,0],[1,4],[4,4],[4,1]], 'white', 'A', { receiverColor: 'blue' })], flips: [0,1,2,4,5], filters: [{ at: [3,3], accepts: ['white'], output: 'blue' }, { at: [5,1], accepts: ['blue'] }, { at: [1,2], accepts: ['blue'] }], walls: [[0,0],[0,2],[2,1],[2,5],[5,5]], decoys: [[0,4]] },
  { id: 'crystal-causeway', title: 'Crystal Causeway', difficulty: 'medium', size: 6, paths: [P([[5,4],[2,4],[2,0],[4,0],[4,2],[0,2],[0,5],[3,5]], 'red', 'A', { receiverColor: 'gold', fixed: [2] })], flips: [0,1,2,3,4], filters: [{ at: [3,4], accepts: ['red'], output: 'gold' }, { at: [1,2], accepts: ['gold'] }], walls: [[5,0],[5,1],[1,0],[1,4]], decoys: [[3,3]] },

  { id: 'prism-crown', title: 'Prism Crown', difficulty: 'hard', size: 7, paths: [P([[0,3],[2,3],[2,1],[4,1]], 'white', '', { end: 'splitter' }), P([[4,1],[4,4],[1,4],[1,6],[3,6]], 'cyan', 'A', { start: 'splitter' }), P([[4,1],[6,1],[6,5],[5,5],[5,3]], 'magenta', 'B', { start: 'splitter' })], flips: [0,1,2,4,5,7], splitters: [{ at: [4,1], rules: [{ incoming: 'E', inputColor: 'white', outputs: [{ direction: 'S', color: 'cyan' }, { direction: 'E', color: 'magenta' }] }] }], filters: [{ at: [2,4], accepts: ['cyan'] }, { at: [6,3], accepts: ['magenta'] }], walls: [[0,0],[0,6],[3,0],[3,5],[6,6]], decoys: [[3,3]] },
  { id: 'threefold-bloom', title: 'Threefold Bloom', difficulty: 'hard', size: 7, paths: [P([[3,6],[3,3],[1,3],[1,1]], 'white', '', { end: 'splitter' }), P([[1,1],[4,1],[4,4],[6,4],[6,2]], 'cyan', 'A', { start: 'splitter' }), P([[1,1],[1,0],[5,0],[5,2]], 'gold', 'B', { start: 'splitter' }), P([[1,1],[0,1],[0,5],[2,5],[2,2]], 'magenta', 'C', { start: 'splitter' })], flips: [0,1,2,3,5,7,9], splitters: [{ at: [1,1], rules: [{ incoming: 'N', inputColor: 'white', outputs: [{ direction: 'E', color: 'cyan' }, { direction: 'N', color: 'gold' }, { direction: 'W', color: 'magenta' }] }] }], filters: [{ at: [3,1], accepts: ['cyan'] }, { at: [3,0], accepts: ['gold'] }, { at: [0,3], accepts: ['magenta'] }], walls: [[0,0],[4,6],[5,5],[6,6]], decoys: [[4,5]] },
  { id: 'polar-lattice', title: 'Polar Lattice', difficulty: 'hard', size: 7, paths: [P([[6,6],[3,6],[3,4],[1,4]], 'white', '', { end: 'splitter' }), P([[1,4],[1,1],[4,1],[4,3]], 'cyan', 'A', { start: 'splitter' }), P([[1,4],[0,4],[0,0],[5,0],[5,2]], 'gold', 'B', { start: 'splitter' }), P([[6,1],[6,5],[4,5],[4,4]], 'magenta', 'C')], flips: [0,1,2,4,5,7,8], splitters: [{ at: [1,4], rules: [{ incoming: 'W', inputColor: 'white', outputs: [{ direction: 'N', color: 'cyan' }, { direction: 'W', color: 'gold' }] }] }], filters: [{ at: [5,6], accepts: ['white'] }, { at: [3,1], accepts: ['cyan'] }, { at: [3,0], accepts: ['gold'] }, { at: [5,5], accepts: ['magenta'] }], walls: [[3,2],[2,5],[0,6],[5,4]], decoys: [[2,2]] },
  { id: 'refraction-engine', title: 'Refraction Engine', difficulty: 'hard', size: 7, paths: [P([[0,0],[3,0],[3,2],[1,2]], 'white', '', { end: 'splitter' }), P([[1,2],[1,5],[5,5],[5,3],[3,3]], 'magenta', 'A', { start: 'splitter' }), P([[1,2],[0,2],[0,6],[6,6],[6,1]], 'cyan', 'B', { start: 'splitter' })], flips: [0,1,2,3,5,7], splitters: [{ at: [1,2], rules: [{ incoming: 'W', inputColor: 'white', outputs: [{ direction: 'S', color: 'magenta' }, { direction: 'W', color: 'cyan' }] }] }], filters: [{ at: [2,5], accepts: ['magenta'] }, { at: [3,6], accepts: ['cyan'] }], walls: [[0,1],[1,1],[2,4],[4,2],[6,0]], decoys: [[4,4]] },
  { id: 'spectral-weave', title: 'Spectral Weave', difficulty: 'hard', size: 7, paths: [P([[2,0],[2,2],[4,2]], 'white', '', { end: 'splitter' }), P([[4,2],[4,0],[5,0],[5,1]], 'cyan', 'A', { start: 'splitter' }), P([[4,2],[4,5],[1,5],[1,3],[0,3]], 'magenta', 'B', { start: 'splitter' }), P([[4,2],[6,2],[6,6],[2,6],[2,4]], 'gold', 'C', { start: 'splitter' })], flips: [0,1,3,4,5,7,8], splitters: [{ at: [4,2], rules: [{ incoming: 'E', inputColor: 'white', outputs: [{ direction: 'N', color: 'cyan' }, { direction: 'S', color: 'magenta' }, { direction: 'E', color: 'gold' }] }] }], filters: [{ at: [4,1], accepts: ['cyan'] }, { at: [3,5], accepts: ['magenta'] }, { at: [4,6], accepts: ['gold'] }], walls: [[0,0],[0,1],[1,6],[3,3],[5,4]], decoys: [[0,6]] },
  { id: 'chromatic-vault', title: 'Chromatic Vault', difficulty: 'hard', size: 7, paths: [P([[0,6],[2,6],[2,3]], 'white', '', { end: 'splitter' }), P([[2,3],[0,3],[0,1],[3,1],[3,0]], 'cyan', 'A', { start: 'splitter' }), P([[2,3],[5,3]], 'white', '', { start: 'splitter', end: 'splitter' }), P([[5,3],[5,0],[6,0],[6,2]], 'gold', 'B', { start: 'splitter' }), P([[5,3],[5,6],[3,6],[3,4],[4,4]], 'magenta', 'C', { start: 'splitter' })], flips: [0,1,2,4,5,7,8], splitters: [{ at: [2,3], rules: [{ incoming: 'N', inputColor: 'white', outputs: [{ direction: 'W', color: 'cyan' }, { direction: 'E', color: 'white' }] }] }, { at: [5,3], rules: [{ incoming: 'E', inputColor: 'white', outputs: [{ direction: 'N', color: 'gold' }, { direction: 'S', color: 'magenta' }] }] }], filters: [{ at: [1,3], accepts: ['cyan'] }, { at: [5,1], accepts: ['gold'] }, { at: [4,6], accepts: ['magenta'] }], walls: [[0,0],[1,0],[1,5],[4,2],[6,5],[6,6]], decoys: [[1,2]] },
];

const direction = ([x,y], [nx,ny]) => nx > x ? 'E' : nx < x ? 'W' : ny > y ? 'S' : ny < y ? 'N' : (() => { throw new Error('Zero route segment'); })();
const reflected = { '/': { N: 'E', E: 'N', S: 'W', W: 'S' }, '\\': { N: 'W', W: 'N', S: 'E', E: 'S' } };
const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key,canonical(value[key])])) : value;
const fingerprint = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');

function author(spec) {
  const n = spec.size;
  const tiles = Array.from({ length: n*n }, () => ({ kind: 'empty' }));
  const routeCells = new Set();
  const active = [];
  const target = {};
  const index = ([x,y]) => { assert.ok(x>=0 && y>=0 && x<n && y<n); return y*n+x; };
  function put(point,tile) {
    const cell=index(point);
    assert.equal(tiles[cell].kind,'empty',`${spec.id}: overlapping target piece ${point}`);
    tiles[cell]=tile;
    return cell;
  }
  for (const path of spec.paths) {
    const { points }=path;
    for(let i=0;i<points.length-1;i++) {
      const [x,y]=points[i], [nx,ny]=points[i+1];
      assert.ok(x===nx || y===ny,`${spec.id}: diagonal route`);
      const dx=Math.sign(nx-x),dy=Math.sign(ny-y);
      for(let k=0;k<=Math.abs(nx-x)+Math.abs(ny-y);k++) routeCells.add(index([x+dx*k,y+dy*k]));
    }
    if(path.start!=='splitter') put(points[0],{kind:'emitter',direction:direction(points[0],points[1]),color:path.color});
    for(let i=1;i<points.length-1;i++) {
      const incoming=direction(points[i-1],points[i]),outgoing=direction(points[i],points[i+1]);
      const orientation=Object.keys(reflected).find(key=>reflected[key][incoming]===outgoing);
      assert.ok(orientation,`${spec.id}: route needs a reflection`);
      const rotatable=!(path.fixed??[]).includes(i-1);
      const cell=put(points[i],{kind:'mirror',orientation,rotatable});
      if(rotatable) { active.push(cell);target[cell]=orientation; }
    }
    if(path.end!=='splitter') put(points.at(-1),{kind:'receiver',color:path.receiverColor??path.color,label:path.label});
  }
  for(const splitter of spec.splitters??[]) put(splitter.at,{kind:'splitter',rules:splitter.rules});
  for(const filter of spec.filters??[]) { assert.ok(routeCells.has(index(filter.at)));const {at,...config}=filter;put(at,{kind:'filter',...config}); }
  for(const wall of spec.walls??[]) { assert.ok(!routeCells.has(index(wall)),`${spec.id}: wall crosses solution ${wall}`);put(wall,{kind:'wall'}); }
  for(const decoy of spec.decoys??[]) { assert.ok(!routeCells.has(index(decoy)));const cell=put(decoy,{kind:'mirror',orientation:'/',rotatable:true});target[cell]='/'; }
  const puzzle={id:`prism-${spec.id}`,version:1,difficulty:spec.difficulty,width:n,height:n,tiles};
  assert.equal(traceValidatedPuzzle(puzzle,target).solved,true,`${spec.id}: authored target must power every receiver`);
  for(const i of spec.flips) { assert.ok(active[i]!==undefined,`${spec.id}: unknown flip ${i}`);tiles[active[i]].orientation=tiles[active[i]].orientation==='/'?'\\':'/'; }
  assert.equal(traceValidatedPuzzle(puzzle,initialOrientations(puzzle)).solved,false,`${spec.id}: initial board already solved`);
  const solution=solvePuzzle(puzzle,{maxStates:4096});
  assert.equal(solution.exhausted,false,`${spec.id}: exhausted validation budget`);
  assert.equal(solution.solvable,true,`${spec.id}: no solution`);
  assert.ok(solution.minimumRotations>=2,`${spec.id}: trivial solution`);
  const definition={...puzzle,minimumRotations:solution.minimumRotations};
  const verified=validatePublishedPuzzle(definition);
  assert.deepEqual(verified.errors,[],spec.id);
  assert.equal(verified.valid,true,spec.id);
  const replay=replayActions(puzzle,solution.actions);
  assert.equal(replay.solved,true,spec.id);
  return {...definition,title:spec.title,validation:{validator:'prism_break_bounded_bfs_v1',validated:true,solverStates:solution.visitedStates,stateBudget:4096,rotatableMirrors:tiles.filter(tile=>tile.kind==='mirror'&&tile.rotatable).length,receivers:tiles.filter(tile=>tile.kind==='receiver').length,definitionSha256:fingerprint(puzzle)}};
}

const library=specs.map(author);
assert.equal(library.length,18);
for(const difficulty of ['easy','medium','hard']) assert.equal(library.filter(p=>p.difficulty===difficulty).length,6);
assert.equal(new Set(library.map(p=>p.id)).size,18);
const contentHash=fingerprint(library);
const catalogJson=JSON.stringify(library,null,2)+'\n';

const records=library.map(({minimumRotations,title,validation,...definition})=>({definition,minimumRotations,title,validation}));
const json=JSON.stringify(records);
assert.equal(json.includes('$prism_definitions$'),false);
const sql=`-- Authored Prism Break v1 launch library. Every definition passed bounded BFS,\n-- exact minimum-rotation verification and full receiver replay before publishing.\n-- Rebuild with: node scripts/author-prism-break.mjs (offline only).\n-- Library SHA-256: ${contentHash}\nbegin;\ndo $seed$\ndeclare entry jsonb; existing public.showdown_puzzles%rowtype;\nbegin\n  if not exists(select 1 from public.showdown_games where game_key='prism_break' and current_rules_version=1) then raise exception 'Prism Break registry must be installed first'; end if;\n  for entry in select value from jsonb_array_elements($prism_definitions$${json}$prism_definitions$::jsonb) loop\n    select * into existing from public.showdown_puzzles where game_key='prism_break' and rules_version=1\n      and puzzle_id=entry->'definition'->>'id' and puzzle_version=(entry->'definition'->>'version')::integer;\n    if found then\n      if existing.definition<>entry->'definition' or existing.minimum_rotations<>(entry->>'minimumRotations')::integer\n        or existing.difficulty<>entry->'definition'->>'difficulty' then raise exception 'Published Prism puzzle version is immutable: %',entry->'definition'->>'id'; end if;\n    else\n      insert into public.showdown_puzzles(game_key,rules_version,puzzle_id,puzzle_version,difficulty,title,definition,minimum_rotations,validation,published)\n        values('prism_break',1,entry->'definition'->>'id',(entry->'definition'->>'version')::integer,entry->'definition'->>'difficulty',entry->>'title',entry->'definition',(entry->>'minimumRotations')::integer,entry->'validation',true);\n    end if;\n  end loop;\nend $seed$;\ncommit;\n`;
if(process.argv.includes('--check')) {
  assert.equal(await readFile('supabase/seed/prism-break-library.json','utf8'),catalogJson,'Authored Prism catalog drifted from its validated source');
  assert.equal(await readFile('supabase/migrations/20261101020000_prism_break_library.sql','utf8'),sql,'Prism seed is stale or was edited without validation');
} else {
  await mkdir('supabase/seed',{recursive:true});
  await writeFile('supabase/seed/prism-break-library.json',catalogJson);
  await writeFile('supabase/migrations/20261101020000_prism_break_library.sql',sql);
}
console.log(JSON.stringify({puzzles:library.length,librarySha256:contentHash,difficulties:Object.fromEntries(['easy','medium','hard'].map(d=>[d,library.filter(p=>p.difficulty===d).map(p=>({id:p.id,minimum:p.minimumRotations,states:p.validation.solverStates,mirrors:p.validation.rotatableMirrors,receivers:p.validation.receivers}))]))},null,2));
