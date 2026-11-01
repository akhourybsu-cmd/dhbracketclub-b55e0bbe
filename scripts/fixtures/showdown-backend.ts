// Browser-local transport for production Showdown screens. Never imported by app routes.
import { compareMatch, replayActions, scoreRound } from '../../src/lib/showdown/prism/engine';
import { solvePuzzle } from '../../src/lib/showdown/prism/solver';
import type { PrismAction, PrismDifficulty, PrismPuzzle } from '../../src/lib/showdown/prism/types';
import { compareMatch as compareAfterimage, sanitizeScene, scoreScene, validatePlacements } from '../../src/lib/showdown/afterimage/engine';
import type { AfterimagePlacement, AfterimageSceneDefinition } from '../../src/lib/showdown/afterimage/types';

type Row = Record<string, unknown>;
interface CatalogEntry { puzzle: PrismPuzzle; title: string; minimum_rotations: number }
interface Attempt {
  actions: PrismAction[]; revision: number; submitted: boolean; skipped: boolean; solved: boolean;
  score: number | null; rotations: number;
  placements?: AfterimagePlacement[]; correct_count?: number | null; perfect?: boolean | null;
  study_started_at?: string | null; study_expires_at?: string | null;
}
interface Player { user_id: string; started_at: string | null; finished_at: string | null; attempts: Attempt[] }
interface Challenge {
  id: string; club_id: string; game_key: string; rules_version: number;
  status: 'pending' | 'active' | 'completed' | 'declined' | 'cancelled' | 'expired';
  challenger_id: string; recipient_id: string; created_at: string; expires_at: string;
  completed_at: string | null; winner_id: string | null; outcome: 'winner' | 'draw' | null;
  rematch_of: string | null; puzzle_keys: string[]; players: Player[];
}
interface State {
  challenges: Challenge[]; notifications: Row[]; receipts: Record<string, { signature: string; response: unknown }>;
  members: string[]; serial: number;
}

const params = new URLSearchParams(location.search);
export const SHOWDOWN_QA_MEMBERS = [
  { user_id: '00000000-0000-4000-8000-000000000001', display_name: 'Alex', avatar_url: null },
  { user_id: '00000000-0000-4000-8000-000000000002', display_name: 'Blair', avatar_url: null },
  { user_id: '00000000-0000-4000-8000-000000000003', display_name: 'Casey', avatar_url: null },
];
const userId = params.get('user') || SHOWDOWN_QA_MEMBERS[0].user_id;
const clubId = params.get('club') || '00000000-0000-4000-8000-000000000010';
const key = `dh-showdown-browser-v1:${params.get('run') || 'default'}`;
const clone = <T,>(value: T): T => structuredClone(value);
/** Match PostgreSQL JSONB serialization instead of masking client key-order bugs. */
const jsonb = <T,>(value: T): T => {
  if (Array.isArray(value)) return value.map(item => jsonb(item)) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .sort(([first], [second]) => first.length - second.length || first.localeCompare(second))
    .map(([key, item]) => [key, jsonb(item)])) as T;
  return value;
};
const same = (first: unknown, second: unknown) => JSON.stringify(jsonb(first)) === JSON.stringify(jsonb(second));
const initial = (): State => ({ challenges: [], notifications: [], receipts: {}, members: SHOWDOWN_QA_MEMBERS.map(member => member.user_id), serial: 0 });
let catalog: CatalogEntry[] = [];
let afterimageCatalog: AfterimageSceneDefinition[] = [];
let state: State = initial();
const calls: Row[] = [];
const failures = new Map<string, { count: number; afterCommit: boolean }>();
const held = new Set<string>();
if (params.get('fail')) failures.set(params.get('fail')!, { count: 100, afterCommit: false });
const callbacks = new Set<() => void>();

function reload() {
  try { const saved = localStorage.getItem(key); state = saved ? JSON.parse(saved) as State : initial(); }
  catch { state = initial(); }
}
function persist() { localStorage.setItem(key, JSON.stringify(state)); callbacks.forEach(callback => callback()); }
function fail(message: string, code = 'P0001'): never { throw Object.assign(new Error(message), { code }); }
function actor() {
  if (clubId !== '00000000-0000-4000-8000-000000000010' || !state.members.includes(userId)) fail('Club membership required', '42501');
}
function profile(id: string) { return state.members.includes(id) ? SHOWDOWN_QA_MEMBERS.find(member => member.user_id === id)! : { user_id: id, display_name: 'Former member', avatar_url: null }; }
function entry(key: string) { const value = catalog.find(row => `${row.puzzle.id}:${row.puzzle.version}` === key); if (!value) fail('Frozen puzzle is unavailable.'); return value; }
function afterimageEntry(key: string) { const value = afterimageCatalog.find(row => `${row.id}:${row.version}` === key); if (!value) fail('Frozen scene is unavailable.'); return value; }
function findChallenge(id: string) {
  actor();
  const challenge = state.challenges.find(row => row.id === id && row.club_id === clubId && [row.challenger_id, row.recipient_id].includes(userId));
  if (!challenge) fail('Challenge unavailable', '42501');
  if (['pending', 'active'].includes(challenge.status)) {
    if (![challenge.challenger_id, challenge.recipient_id].every(id => state.members.includes(id))) challenge.status = 'cancelled';
    else if (Date.parse(challenge.expires_at) <= Date.now()) challenge.status = 'expired';
  }
  return challenge;
}
function totals(player: Player) {
  return { total_score: player.attempts.reduce((sum, round) => sum + (round.score || 0), 0),
    solved_count: player.attempts.filter(round => round.submitted && round.solved).length,
    rotations: player.attempts.filter(round => round.submitted).reduce((sum, round) => sum + round.rotations, 0),
    perfect_count: player.attempts.filter(round => round.submitted && round.perfect).length };
}
function challengeView(challenge: Challenge) {
  return { ...Object.fromEntries(Object.entries(challenge).filter(([name]) => !['puzzle_keys', 'players'].includes(name))),
    players: challenge.players.map(player => {
      const visible = player.user_id === userId || challenge.status === 'completed';
      return { ...profile(player.user_id), started_at: player.started_at, finished_at: player.finished_at,
        rounds_completed: player.attempts.filter(round => round.submitted).length,
        ...(visible ? totals(player) : { total_score: null, solved_count: null, rotations: null, perfect_count: null }) };
    }) };
}
function detail(challenge: Challenge) {
  const own = challenge.players.find(player => player.user_id === userId)!;
  const other = challenge.players.find(player => player.user_id !== userId)!;
  const next = own.attempts.findIndex(round => !round.submitted);
  const active = ['pending', 'active'].includes(challenge.status);
  return { challenge: challengeView(challenge), current_round: next < 0 ? null : next + 1,
    can_play: active && Boolean(own.started_at) && next >= 0, can_decline: active && userId === challenge.recipient_id && !own.started_at,
    can_cancel: active && userId === challenge.challenger_id && !other.started_at,
    readonly_reason: challenge.status === 'cancelled' ? 'Challenge cancelled.' : challenge.status === 'expired' ? 'This challenge has expired.' : null,
    server_now: new Date().toISOString(),
    record: record(undefined, challenge.game_key), rivalry: { ...profile(other.user_id), opponent_id: other.user_id, ...record(other.user_id, challenge.game_key) },
    rounds: challenge.puzzle_keys.map((key, index) => {
      if (challenge.game_key === 'afterimage') {
        const definition = afterimageEntry(key), attempt = own.attempts[index];
        const available = index <= next || attempt.submitted || challenge.status === 'completed';
        const phase = challenge.status === 'completed' ? 'review' : attempt.submitted ? 'submitted'
          : !attempt.study_started_at ? 'ready' : active && Date.now() < Date.parse(attempt.study_expires_at!) ? 'study' : 'reconstruct';
        const scene = available ? sanitizeScene(definition, phase, { study_started_at: attempt.study_started_at,
          study_expires_at: attempt.study_expires_at, server_now: new Date().toISOString() }) : null;
        return { round_number: index + 1, difficulty: definition.difficulty, puzzle_id: definition.id, puzzle_version: definition.version,
          title: definition.title, puzzle: null, minimum_rotations: null, scene,
          me: clone(attempt), opponent: challenge.status === 'completed' ? clone(other.attempts[index]) : null };
      }
      const definition = entry(key);
      return { round_number: index + 1, difficulty: definition.puzzle.difficulty, puzzle_id: definition.puzzle.id,
        puzzle_version: definition.puzzle.version, title: definition.title,
        puzzle: index <= next || own.attempts[index].submitted || challenge.status === 'completed' ? clone(definition.puzzle) : null,
        minimum_rotations: own.attempts[index].submitted || challenge.status === 'completed' ? definition.minimum_rotations : null,
        me: clone(own.attempts[index]), opponent: challenge.status === 'completed' ? clone(other.attempts[index]) : null };
    }) };
}
function record(opponent?: string, game = 'prism_break') {
  const rows = state.challenges.filter(challenge => challenge.club_id === clubId && challenge.game_key === game && challenge.status === 'completed'
    && [challenge.challenger_id, challenge.recipient_id].includes(userId)
    && (!opponent || [challenge.challenger_id, challenge.recipient_id].includes(opponent)));
  const wins = rows.filter(row => row.winner_id === userId).length;
  const draws = rows.filter(row => row.outcome === 'draw').length;
  return { wins, draws, losses: rows.length - wins - draws, played: rows.length };
}
function notify(to: string, title: string, challengeId: string, body: string) {
  state.notifications.push({ id: crypto.randomUUID(), user_id: to, club_id: clubId, type: 'showdown', title, body,
    url: `/showdown/${challengeId}`, actor_user_id: userId, created_at: new Date().toISOString(), read_at: null });
}
function create(args: Row) {
  actor();
  const recipient = String(args.p_recipient_id || '');
  if (recipient === userId || !state.members.includes(recipient)) fail(recipient === userId ? 'Cannot challenge yourself' : 'Choose a member of your club');
  const game = String(args.p_game_key);
  if (!['prism_break', 'afterimage'].includes(game) || game === 'afterimage' && !afterimageCatalog.length || game === 'prism_break' && !catalog.length) fail('Game is not enabled');
  const rematch = args.p_rematch_of ? findChallenge(String(args.p_rematch_of)) : null;
  if (rematch && (rematch.status !== 'completed' || rematch.game_key !== game || ![rematch.challenger_id, rematch.recipient_id].includes(recipient))) fail('Rematch unavailable.');
  if (state.challenges.filter(row => row.challenger_id === userId && Date.now() - Date.parse(row.created_at) < 300000).length >= 10) fail('Challenge rate limit reached. Try again later');
  const now = new Date().toISOString();
  const previous = state.challenges.filter(row => row.game_key === game && [row.challenger_id, row.recipient_id].includes(userId) && [row.challenger_id, row.recipient_id].includes(recipient)).slice(-2);
  const chosen = (['easy', 'medium', 'hard'] as PrismDifficulty[]).map(difficulty => {
    const options = (game === 'afterimage' ? afterimageCatalog.map(scene => ({ puzzle: scene })) : catalog).filter(row => row.puzzle.difficulty === difficulty);
    const unused = options.filter(row => !previous.some(challenge => challenge.puzzle_keys.includes(`${row.puzzle.id}:${row.puzzle.version}`)));
    const selected = (unused.length ? unused : options)[state.serial % (unused.length || options.length)];
    if (!selected) fail('No validated puzzles are available');
    return `${selected.puzzle.id}:${selected.puzzle.version}`;
  });
  state.serial++;
  const attempts = () => chosen.map(() => ({ actions: [], revision: 0, submitted: false, skipped: false, solved: false, score: null, rotations: 0,
    ...(game === 'afterimage' ? { placements: [], correct_count: null, perfect: null, study_started_at: null, study_expires_at: null } : {}) }));
  const challenge: Challenge = { id: crypto.randomUUID(), club_id: clubId, game_key: game, rules_version: 1,
    challenger_id: userId, recipient_id: recipient, created_at: now, expires_at: new Date(Date.now() + 72 * 3600000).toISOString(),
    status: 'pending', completed_at: null, winner_id: null, outcome: null, rematch_of: rematch?.id ?? null, puzzle_keys: chosen,
    players: [{ user_id: userId, started_at: now, finished_at: null, attempts: attempts() }, { user_id: recipient, started_at: null, finished_at: null, attempts: attempts() }] };
  state.challenges.push(challenge);
  notify(recipient, rematch ? 'Rematch invitation' : 'New Showdown challenge', challenge.id, `${game === 'afterimage' ? 'Afterimage' : 'Prism Break'} · Three rounds. Play whenever you are ready.`);
  return detail(challenge);
}
function finishPlayer(challenge: Challenge, own: Player) {
  if (!own.attempts.every(round => round.submitted) || own.finished_at) return;
  own.finished_at = new Date().toISOString();
  const other = challenge.players.find(player => player !== own)!;
  if (!other.finished_at) notify(other.user_id, `Your opponent finished ${challenge.game_key === 'afterimage' ? 'Afterimage' : 'Prism Break'}`, challenge.id, 'Your scores stay sealed until you finish.');
  if (!challenge.players.every(player => player.finished_at)) return;
  const a = totals(challenge.players[0]), b = totals(challenge.players[1]);
  const comparison = challenge.game_key === 'afterimage'
    ? compareAfterimage({ totalScore: a.total_score, perfectRounds: a.perfect_count }, { totalScore: b.total_score, perfectRounds: b.perfect_count })
    : compareMatch({ totalScore: a.total_score, solvedRounds: a.solved_count, totalRotations: a.rotations }, { totalScore: b.total_score, solvedRounds: b.solved_count, totalRotations: b.rotations });
  challenge.status = 'completed'; challenge.completed_at = new Date().toISOString();
  challenge.outcome = comparison === 'draw' ? 'draw' : 'winner';
  challenge.winner_id = comparison === 'draw' ? null : challenge.players[comparison === 'first' ? 0 : 1].user_id;
  for (const player of challenge.players) notify(player.user_id, comparison === 'draw' ? 'Showdown drawn' : 'Showdown result is ready', challenge.id, 'Open the match for the round-by-round result.');
}
function roundMutation(name: string, args: Row) {
  const challenge = findChallenge(String(args.p_challenge_id));
  if (challenge.game_key !== 'prism_break') fail('This operation is only available for Prism Break');
  if (['declined', 'cancelled', 'expired'].includes(challenge.status)) return detail(challenge);
  const own = challenge.players.find(player => player.user_id === userId)!;
  const number = Number(args.p_round_number), next = own.attempts.findIndex(round => !round.submitted) + 1;
  const current = own.attempts[number - 1];
  if (!current || !Array.isArray(args.p_actions)) fail('Invalid round submission.');
  const actions = clone(args.p_actions) as PrismAction[];
  if (current.submitted) {
    if (name === 'showdown_submit_round' && same(current.actions, actions) && current.skipped === Boolean(args.p_skip)) return detail(challenge);
    fail('This round was already submitted');
  }
  if (challenge.status === 'completed') fail('This challenge is already complete');
  if (!own.started_at) fail('Open the challenge before playing');
  if (number !== next) fail('Round is not available');
  if (current.revision !== Number(args.p_expected_revision)) fail('A newer round save exists. Reload before continuing', '40001');
  if (actions.length < current.actions.length || !same(actions.slice(0, current.actions.length), current.actions)) fail('Saved moves cannot be removed or changed');
  const definition = entry(challenge.puzzle_keys[number - 1]);
  const replay = replayActions(definition.puzzle, actions);
  if (!same(current.actions, actions) || name === 'showdown_submit_round') current.revision++;
  current.actions = actions; current.rotations = replay.rotations; current.solved = replay.solved;
  own.started_at ||= new Date().toISOString(); challenge.status = 'active';
  if (name === 'showdown_submit_round') {
    if (!args.p_skip && !replay.solved) fail('Activate every receiver before submitting.');
    current.submitted = true; current.skipped = Boolean(args.p_skip);
    current.solved = !current.skipped && replay.solved;
    current.score = current.skipped ? 0 : scoreRound(definition.minimum_rotations, replay.rotations);
    finishPlayer(challenge, own);
  }
  return detail(challenge);
}
function reconstructionMutation(name: string, args: Row) {
  const challenge = findChallenge(String(args.p_challenge_id));
  if (challenge.game_key !== 'afterimage') fail('This operation is only available for Afterimage');
  if (['declined', 'cancelled', 'expired'].includes(challenge.status)) return detail(challenge);
  const own = challenge.players.find(player => player.user_id === userId)!;
  const number = Number(args.p_round_number), next = own.attempts.findIndex(round => !round.submitted) + 1, current = own.attempts[number - 1];
  if (!current) fail('Round unavailable');
  if (current.submitted) {
    if (name === 'showdown_submit_reconstruction' && same(current.placements, args.p_placements)) return detail(challenge);
    fail('This round was already submitted');
  }
  if (!own.started_at) fail('Open the challenge before playing');
  if (number !== next) fail('Complete your current round first');
  if (name === 'showdown_start_study') {
    if (!current.study_started_at) { const now = Date.now(); current.study_started_at = new Date(now).toISOString(); current.study_expires_at = new Date(now + 7000).toISOString(); current.revision++; }
    challenge.status = 'active'; return detail(challenge);
  }
  if (!current.study_expires_at || Date.now() < Date.parse(current.study_expires_at)) fail('The study window has not ended');
  if (current.revision !== Number(args.p_expected_revision)) fail('This round changed on another device', '40001');
  const definition = afterimageEntry(challenge.puzzle_keys[number - 1]);
  const view = sanitizeScene(definition, 'reconstruct'); validatePlacements(args.p_placements, view);
  const placements = clone(args.p_placements) as AfterimagePlacement[];
  if (!same(placements, current.placements) || name === 'showdown_submit_reconstruction') current.revision++;
  current.placements = placements;
  if (name === 'showdown_submit_reconstruction') {
    const result = scoreScene(definition, placements);
    current.submitted = true; current.score = result.score; current.correct_count = result.correct_count; current.perfect = result.perfect; current.solved = result.perfect;
    finishPlayer(challenge, own);
  }
  return detail(challenge);
}
function execute(name: string, args: Row) {
  if (name === 'showdown_lobby') {
    actor();
    const game = String(args.p_game_key || 'prism_break');
    const rows = state.challenges.filter(row => row.club_id === clubId && row.game_key === game && [row.challenger_id, row.recipient_id].includes(userId));
    rows.forEach(row => findChallenge(row.id));
    const standings = SHOWDOWN_QA_MEMBERS.filter(member => state.members.includes(member.user_id)).map(member => {
      const own = state.challenges.filter(row => row.club_id === clubId && row.game_key === game && row.status === 'completed' && [row.challenger_id, row.recipient_id].includes(member.user_id));
      const wins = own.filter(row => row.winner_id === member.user_id).length, draws = own.filter(row => row.outcome === 'draw').length;
      return { ...member, wins, draws, losses: own.length - wins - draws, played: own.length, points: wins * 3 + draws };
    }).sort((a, b) => b.points - a.points || b.wins - a.wins || a.display_name.localeCompare(b.display_name));
    return { games: [
      ...(catalog.length ? [{ game_key: 'prism_break', name: 'Prism Break', current_rules_version: 1, description: 'Three precision beam puzzles. Same boards. Your own time.', enabled: true }] : []),
      ...(afterimageCatalog.length ? [{ game_key: 'afterimage', name: 'Afterimage', current_rules_version: 1, description: 'Study a scene. Rebuild its missing details.', enabled: true }] : []),
    ],
      members: SHOWDOWN_QA_MEMBERS.filter(member => state.members.includes(member.user_id) && member.user_id !== userId),
      challenges: rows.sort((a, b) => b.created_at.localeCompare(a.created_at)).map(challengeView), next_cursor: null,
      record: record(undefined, game), rivalries: SHOWDOWN_QA_MEMBERS.filter(member => member.user_id !== userId).map(member => ({ ...member, opponent_id: member.user_id, ...record(member.user_id, game) })).filter(row => row.played > 0), standings: standings.filter(row => row.played > 0) };
  }
  if (name === 'showdown_create') return create(args);
  if (name === 'showdown_get') {
    const challenge = findChallenge(String(args.p_challenge_id));
    const own = challenge.players.find(player => player.user_id === userId)!;
    if (args.p_start && ['pending', 'active'].includes(challenge.status) && !own.finished_at) { own.started_at ||= new Date().toISOString(); challenge.status = 'active'; }
    return detail(challenge);
  }
  if (name === 'showdown_save_round' || name === 'showdown_submit_round') return roundMutation(name, args);
  if (['showdown_start_study', 'showdown_save_reconstruction', 'showdown_submit_reconstruction'].includes(name)) return reconstructionMutation(name, args);
  if (name === 'showdown_act') {
    const challenge = findChallenge(String(args.p_challenge_id));
    const own = challenge.players.find(player => player.user_id === userId)!, other = challenge.players.find(player => player !== own)!;
    if (args.p_action === 'decline' && userId === challenge.recipient_id && !own.started_at && ['pending', 'active'].includes(challenge.status)) challenge.status = 'declined';
    else if (args.p_action === 'cancel' && userId === challenge.challenger_id && !other.started_at && ['pending', 'active'].includes(challenge.status)) challenge.status = 'cancelled';
    else fail('This challenge can no longer be changed.');
    return detail(challenge);
  }
  fail(`Unexpected browser fixture RPC: ${name}`);
}
async function executeRpc(name: string, args: Row = {}) {
  reload();
  const failure = failures.get(name);
  if (failure?.count && !failure.afterCommit) { failure.count--; return { data: null, error: { code: 'NETWORK_ERROR', message: 'Connection interrupted. Please retry.' } }; }
  const before = clone(state);
  try {
    actor();
    const receiptKey = String(args.p_request_id || '');
    const signature = JSON.stringify(jsonb([clubId, userId, name, args]));
    let response: unknown;
    if (args.p_request_id && state.receipts[receiptKey]) {
      if (state.receipts[receiptKey].signature !== signature) fail('Request identity already used.');
      const saved = state.receipts[receiptKey].response as { challenge: { id: string } };
      response = detail(findChallenge(saved.challenge.id));
    } else {
      response = execute(name, args);
      if (args.p_request_id) state.receipts[receiptKey] = { signature, response: clone(response) };
    }
    if (JSON.stringify(state) !== JSON.stringify(before)) persist();
    calls.push({ response_for: name, data: jsonb(clone(response)), user_id: userId });
    if (failure?.count && failure.afterCommit) { failure.count--; return { data: null, error: { code: 'NETWORK_ERROR', message: 'Connection interrupted after save. Please retry.' } }; }
    return { data: jsonb(clone(response)), error: null };
  } catch (error) {
    state = before;
    const cause = error as Error & { code?: string };
    return { data: null, error: { code: cause.code || 'P0001', message: cause.message } };
  }
}

async function rpc(name: string, args: Row = {}) {
  calls.push({ name, args: clone(args), user_id: userId, at: Date.now() });
  // A transport barrier must not hold the simulated database transaction lock.
  while (held.has(name)) await new Promise(resolve => setTimeout(resolve, 20));
  return navigator.locks.request(`showdown-server:${key}`, () => executeRpc(name, args));
}

reload();
addEventListener('storage', event => { if (event.key === key) { reload(); callbacks.forEach(callback => callback()); } });
const fixture = {
  userId, clubId, calls,
  get state() { reload(); return clone(state); },
  installLibrary(entries: CatalogEntry[]) { catalog = entries; },
  installAfterimageLibrary(entries: AfterimageSceneDefinition[]) { afterimageCatalog = entries; },
  reset() { state = initial(); persist(); calls.length = 0; },
  selectionOffset(value: number) { reload(); state.serial = Math.max(0, Math.floor(value)); persist(); },
  failNext(name: string, afterCommit = false, count = 1) { failures.set(name, { count, afterCommit }); },
  hold(name: string) { held.add(name); }, release(name: string) { held.delete(name); },
  expire(id: string) { reload(); const row = state.challenges.find(row => row.id === id); if (row) row.expires_at = new Date(Date.now() - 1).toISOString(); persist(); },
  removeMember(id: string) { reload(); state.members = state.members.filter(member => member !== id); persist(); },
  expireStudy(id: string, round: number) { reload(); const current = findChallenge(id).players.find(player => player.user_id === userId)!.attempts[round - 1]; if (!current.study_started_at) fail('Start the study window first'); const now = Date.now(); current.study_started_at = new Date(now - 8000).toISOString(); current.study_expires_at = new Date(now - 1000).toISOString(); persist(); },
  answers(id: string, round: number) { reload(); const challenge = findChallenge(id); return afterimageEntry(challenge.puzzle_keys[round - 1]).slots.map(slot => ({ object_id: slot.objectId, slot_id: slot.id })); },
  solve(id: string, round: number) {
    reload();
    const challenge = findChallenge(id), definition = entry(challenge.puzzle_keys[round - 1]);
    const actions = challenge.players.find(player => player.user_id === userId)!.attempts[round - 1].actions;
    const replay = replayActions(definition.puzzle, actions);
    const puzzle: PrismPuzzle = { ...clone(definition.puzzle), tiles: definition.puzzle.tiles.map((tile, cell) => tile.kind === 'mirror' ? { ...tile, orientation: replay.orientations[cell] } : { ...tile }) };
    return solvePuzzle(puzzle);
  },
  showcase(id: string, round: number) {
    const challenge = findChallenge(id), definition = entry(challenge.puzzle_keys[round - 1]);
    const solution = fixture.solve(id, round).actions;
    let best: PrismAction[] = [], rank = -1;
    for (let omitted = 0; omitted < solution.length; omitted++) {
      const actions = solution.filter((_action, index) => index !== omitted);
      const replay = replayActions(definition.puzzle, actions);
      const value = replay.trace.activatedReceivers.length * 10 + new Set(replay.trace.segments.map(segment => segment.color)).size;
      if (!replay.solved && value > rank) { best = actions; rank = value; }
    }
    return best;
  },
  currentActions(id: string, round: number) { return findChallenge(id).players.find(player => player.user_id === userId)!.attempts[round - 1].actions; },
  rpc,
};
Object.assign(window, { showdownQa: fixture });
export { fixture as showdownFixture };
export const supabase = {
  rpc,
  auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }) },
  channel: () => {
    const listeners: (() => void)[] = [];
    const channel = { on(_type: string, _filter: unknown, callback: () => void) { listeners.push(callback); return channel; }, subscribe() { listeners.forEach(listener => callbacks.add(listener)); return channel; }, unsubscribe() { listeners.forEach(listener => callbacks.delete(listener)); } };
    return channel;
  },
  removeChannel(channel: { unsubscribe: () => void }) { channel.unsubscribe(); return Promise.resolve('ok'); },
};
