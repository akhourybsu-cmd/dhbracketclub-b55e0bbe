import {
  AFTERIMAGE_ASSET_IDS, AFTERIMAGE_DIFFICULTY_COUNTS, AFTERIMAGE_LOGICAL_HEIGHT, AFTERIMAGE_LOGICAL_WIDTH,
  AFTERIMAGE_MATCH_MAX_SCORE, AFTERIMAGE_STUDY_MS, AFTERIMAGE_THEME_IDS,
  type AfterimageAccessibility, type AfterimageMatchComparison, type AfterimageObject, type AfterimagePhase,
  type AfterimagePiece, type AfterimagePlacement, type AfterimagePrivateSlot, type AfterimageRoundScore,
  type AfterimageSceneDefinition, type AfterimageSceneView, type AfterimageSlot, type AfterimageStanding,
} from './types';

export class AfterimageValidationError extends Error {
  constructor(message: string) { super(message); this.name = 'AfterimageValidationError'; }
}
function fail(message: string): never { throw new AfterimageValidationError(message); }
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const keys = (value: Record<string, unknown>, allowed: readonly string[]) => Object.keys(value).every(key => allowed.includes(key));
const identifier = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9][a-z0-9_-]{0,95}$/.test(value);
const text = (value: unknown, max = 80): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const numeric = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const pieceKeys = ['id', 'assetId', 'label', 'orientation', 'variant'];
const objectKeys = [...pieceKeys, 'x', 'y', 'layer'];
const slotKeys = ['id', 'x', 'y', 'width', 'height', 'label', 'layer'];
const baseKeys = ['id', 'version', 'difficulty', 'title', 'theme', 'background', 'width', 'height', 'a11y'];
const viewKeys = [...baseKeys, 'phase', 'objects', 'slots', 'tray', 'answers', 'study_started_at', 'study_expires_at', 'server_now', 'observation_remaining_ms', 'observation_received_at'];

function validPiece(value: unknown, allowed = pieceKeys): value is AfterimagePiece {
  return object(value) && keys(value, allowed) && identifier(value.id) && text(value.label)
    && (AFTERIMAGE_ASSET_IDS as readonly unknown[]).includes(value.assetId)
    && (value.orientation === undefined || numeric(value.orientation) && Math.abs(value.orientation) <= 360)
    && (value.variant === undefined || text(value.variant, 40));
}
function geometry(value: Record<string, unknown>) {
  return numeric(value.x) && value.x >= 90 && value.x <= 910 && numeric(value.y) && value.y >= 80 && value.y <= 620
    && Number.isInteger(value.layer) && Number(value.layer) >= 0 && Number(value.layer) <= 100;
}
function validObject(value: unknown): value is AfterimageObject {
  return validPiece(value, objectKeys) && geometry(value as unknown as Record<string, unknown>);
}
function validSlot(value: unknown, privateMap = false): value is AfterimageSlot | AfterimagePrivateSlot {
  return object(value) && keys(value, privateMap ? [...slotKeys, 'objectId'] : slotKeys)
    && identifier(value.id) && text(value.label) && geometry(value) && value.width === 180 && value.height === 160
    && (!privateMap || identifier(value.objectId));
}
function base(value: unknown): value is Record<string, unknown> & {
  id: string; version: number; difficulty: keyof typeof AFTERIMAGE_DIFFICULTY_COUNTS; a11y: AfterimageAccessibility;
} {
  return object(value) && identifier(value.id) && Number.isInteger(value.version) && Number(value.version) > 0
    && Object.keys(AFTERIMAGE_DIFFICULTY_COUNTS).includes(String(value.difficulty)) && text(value.title)
    && (AFTERIMAGE_THEME_IDS as readonly unknown[]).includes(value.theme)
    && (AFTERIMAGE_THEME_IDS as readonly unknown[]).includes(value.background)
    && value.width === AFTERIMAGE_LOGICAL_WIDTH && value.height === AFTERIMAGE_LOGICAL_HEIGHT
    && object(value.a11y) && keys(value.a11y, ['label', 'instructions']) && text(value.a11y.label, 160) && text(value.a11y.instructions, 320);
}
function assertUniquePieces(pieces: readonly AfterimagePiece[]) {
  if (new Set(pieces.map(piece => piece.id)).size !== pieces.length
    || new Set(pieces.map(piece => piece.assetId)).size !== pieces.length
    || new Set(pieces.map(piece => piece.label.trim().toLowerCase())).size !== pieces.length) fail('Scene pieces must have distinct identities, artwork and labels.');
}
function overlaps(first: { x: number; y: number }, second: { x: number; y: number }, dx: number, dy: number) {
  return Math.abs(first.x - second.x) < dx && Math.abs(first.y - second.y) < dy;
}
function assertGeometry(objects: readonly AfterimageObject[], slots: readonly AfterimageSlot[], fixed = objects) {
  for (let i = 0; i < objects.length; i++) for (let j = i + 1; j < objects.length; j++) {
    if (overlaps(objects[i], objects[j], 160, 150)) fail('Scene objects overlap or are too close to distinguish.');
  }
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) if (overlaps(slots[i], slots[j], 188, 168)) fail('Reconstruction targets overlap.');
    for (const placed of fixed) if (overlaps(slots[i], placed, 168, 153)) fail('A reconstruction target obscures a fixed object.');
  }
}

/** Offline/server definition validation. The application never imports a scene catalog. */
export function validateSceneDefinition(value: unknown): asserts value is AfterimageSceneDefinition {
  if (!base(value) || !keys(value, [...baseKeys, 'objects', 'missingIds', 'distractors', 'slots', 'trayOrder'])) fail('Invalid Afterimage scene definition.');
  const count = AFTERIMAGE_DIFFICULTY_COUNTS[value.difficulty];
  if (!Array.isArray(value.objects) || value.objects.length !== count.objects || !value.objects.every(validObject)
    || !Array.isArray(value.missingIds) || value.missingIds.length !== count.missing || !value.missingIds.every(identifier)
    || !Array.isArray(value.distractors) || value.distractors.length !== count.distractors || !value.distractors.every(piece => validPiece(piece))
    || !Array.isArray(value.slots) || value.slots.length !== count.missing || !value.slots.every(slot => validSlot(slot, true))
    || !Array.isArray(value.trayOrder)) fail('Scene content does not match its difficulty.');
  const objects = value.objects as AfterimageObject[], distractors = value.distractors as AfterimagePiece[], slots = value.slots as AfterimagePrivateSlot[];
  const missing = value.missingIds as string[], order = value.trayOrder as unknown[];
  assertUniquePieces([...objects, ...distractors]);
  const allPieces = new Set([...objects, ...distractors].map(piece => piece.id));
  const originals = new Map(objects.map(piece => [piece.id, piece]));
  if (new Set(missing).size !== missing.length || missing.some(id => !originals.has(id))) fail('Missing objects must reference distinct original objects.');
  if (new Set(slots.map(slot => slot.id)).size !== slots.length || slots.some(slot => [...allPieces].some(id => slot.id.includes(id)))
    || new Set(slots.map(slot => slot.objectId)).size !== missing.length || slots.some(slot => !missing.includes(slot.objectId))) fail('Required slots must form a private one-to-one answer map.');
  for (const slot of slots) {
    const original = originals.get(slot.objectId)!;
    if (slot.x !== original.x || slot.y !== original.y || slot.layer !== original.layer) fail('Every required slot must match its canonical object position.');
    if ([...objects, ...distractors].some(piece => slot.label.trim().toLowerCase().includes(piece.label.trim().toLowerCase()))) fail('Target labels must describe places, never the answer.');
  }
  const trayIds = [...missing, ...distractors.map(piece => piece.id)];
  if (order.length !== trayIds.length || order.some(id => typeof id !== 'string' || !trayIds.includes(id)) || new Set(order).size !== order.length) fail('The frozen tray must contain each removed object and distractor exactly once.');
  assertGeometry(objects, slots, objects.filter(piece => !missing.includes(piece.id)));
}

const isTimestamp = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
/** Validate phase-specific server data, including absence of private answers before review. */
export function validateSceneView(value: unknown): asserts value is AfterimageSceneView {
  if (!base(value) || !keys(value, viewKeys) || !['ready', 'study', 'reconstruct', 'submitted', 'review'].includes(String(value.phase))) fail('Invalid Afterimage scene payload.');
  const count = AFTERIMAGE_DIFFICULTY_COUNTS[value.difficulty];
  if (!Array.isArray(value.objects) || !value.objects.every(validObject) || !Array.isArray(value.slots)
    || !value.slots.every(slot => validSlot(slot)) || !Array.isArray(value.tray) || !value.tray.every(piece => validPiece(piece))) fail('Invalid public scene pieces.');
  const objects = value.objects as AfterimageObject[], slots = value.slots as AfterimageSlot[], tray = value.tray as AfterimagePiece[];
  const phase = value.phase as AfterimagePhase;
  if (phase === 'ready' && (objects.length || slots.length || tray.length)) fail('A ready scene must not reveal its memory objects.');
  if (phase === 'study' && (objects.length !== count.objects || slots.length || tray.length)) fail('A study scene must not reveal missing selections or its tray.');
  if (['reconstruct', 'submitted'].includes(phase) && (objects.length !== count.objects - count.missing || slots.length !== count.missing || tray.length !== count.missing + count.distractors)) fail('A reconstruction scene must not reveal removed-object positions.');
  if (phase === 'review' && (objects.length !== count.objects || slots.length !== count.missing || tray.length !== count.missing + count.distractors)) fail('Invalid completed scene review.');
  assertUniquePieces(objects); assertUniquePieces(tray);
  const objectIds = new Set(objects.map(piece => piece.id)), trayIds = new Set(tray.map(piece => piece.id));
  if (new Set(slots.map(slot => slot.id)).size !== slots.length
    || slots.some(slot => [...objectIds, ...trayIds].some(id => slot.id.includes(id)))) fail('Invalid public reconstruction target identity.');
  if (slots.some(slot => [...objects, ...tray].some(piece => slot.label.trim().toLowerCase().includes(piece.label.trim().toLowerCase())))) fail('Target labels must describe places, never the answer.');
  if (['reconstruct', 'submitted'].includes(phase)) {
    if (objects.some(piece => trayIds.has(piece.id))) fail('A removed tray object cannot expose its original coordinates.');
    assertUniquePieces([...objects, ...tray]);
  }
  if (phase !== 'review' && value.answers !== undefined) fail('Answers remain sealed until the match is complete.');
  if (phase === 'review' && value.answers !== undefined) {
    assertPlacements(value.answers, slots, tray);
    const answers = value.answers as AfterimagePlacement[];
    if (answers.length !== count.missing || answers.some(answer => !objectIds.has(answer.object_id))) fail('Invalid completed answer map.');
    for (const answer of answers) {
      const placed = objects.find(piece => piece.id === answer.object_id)!, slot = slots.find(slot => slot.id === answer.slot_id)!;
      if (placed.x !== slot.x || placed.y !== slot.y || placed.layer !== slot.layer) fail('Invalid completed canonical position.');
    }
  }
  assertGeometry(objects, slots, phase === 'review' ? objects.filter(piece => !trayIds.has(piece.id)) : objects);
  for (const field of ['study_started_at', 'study_expires_at'] as const) if (value[field] != null && !isTimestamp(value[field])) fail('Invalid study timestamps.');
  if (value.server_now !== undefined && !isTimestamp(value.server_now)) fail('Invalid server time.');
  if (phase === 'ready' && (value.study_started_at != null || value.study_expires_at != null)) fail('A ready scene cannot have a renewed study window.');
  if (phase === 'study') {
    if (!isTimestamp(value.study_started_at) || !isTimestamp(value.study_expires_at) || !isTimestamp(value.server_now)
      || Date.parse(value.study_expires_at) - Date.parse(value.study_started_at) !== AFTERIMAGE_STUDY_MS
      || Date.parse(value.server_now) < Date.parse(value.study_started_at) || Date.parse(value.server_now) >= Date.parse(value.study_expires_at)) fail('The study window must be the original seven-second server window.');
  }
  if (value.observation_remaining_ms !== undefined && (!numeric(value.observation_remaining_ms) || value.observation_remaining_ms < 0 || value.observation_remaining_ms > AFTERIMAGE_STUDY_MS)) fail('Invalid study observation.');
  if (value.observation_received_at !== undefined && (!numeric(value.observation_received_at) || value.observation_received_at < 0)) fail('Invalid monotonic observation.');
}

function assertPlacements(value: unknown, slots: readonly AfterimageSlot[], tray: readonly AfterimagePiece[]): asserts value is AfterimagePlacement[] {
  if (!Array.isArray(value) || value.length > slots.length) fail('Invalid reconstruction placements.');
  const objects = new Set<string>(), usedSlots = new Set<string>();
  for (const entry of value) {
    if (!object(entry) || !keys(entry, ['object_id', 'slot_id']) || !identifier(entry.object_id) || !identifier(entry.slot_id)
      || !tray.some(piece => piece.id === entry.object_id) || !slots.some(slot => slot.id === entry.slot_id)
      || objects.has(entry.object_id) || usedSlots.has(entry.slot_id)) fail('Use each available object and target at most once.');
    objects.add(entry.object_id); usedSlots.add(entry.slot_id);
  }
}
/** Legality only. This helper intentionally provides no correctness feedback. */
export function validatePlacements(value: unknown, view: AfterimageSceneView): asserts value is AfterimagePlacement[] {
  validateSceneView(view); assertPlacements(value, view.slots, view.tray);
}
export function normalizePlacements(value: readonly AfterimagePlacement[]): AfterimagePlacement[] {
  return value.map(entry => ({ object_id: entry.object_id, slot_id: entry.slot_id })).sort((a, b) => a.slot_id.localeCompare(b.slot_id) || a.object_id.localeCompare(b.object_id));
}
/** Move, remove or swap a piece. Reset is simply an empty final placement array. */
export function updatePlacement(value: readonly AfterimagePlacement[], pieceId: string, slotId: string | null): AfterimagePlacement[] {
  if (!identifier(pieceId) || slotId !== null && !identifier(slotId)) fail('Invalid reconstruction selection.');
  if (!Array.isArray(value) || value.some(entry => !object(entry) || !keys(entry, ['object_id', 'slot_id']) || !identifier(entry.object_id) || !identifier(entry.slot_id))
    || new Set(value.map(entry => entry.object_id)).size !== value.length || new Set(value.map(entry => entry.slot_id)).size !== value.length) fail('Invalid current reconstruction.');
  const before = value.find(entry => entry.object_id === pieceId), occupied = slotId ? value.find(entry => entry.slot_id === slotId) : undefined;
  const next = value.filter(entry => entry.object_id !== pieceId && (slotId === null || entry.slot_id !== slotId)).map(entry => ({ ...entry }));
  if (slotId) {
    next.push({ object_id: pieceId, slot_id: slotId });
    if (before && occupied && occupied.object_id !== pieceId) next.push({ object_id: occupied.object_id, slot_id: before.slot_id });
  }
  return normalizePlacements(next);
}

const pieceView = (piece: AfterimagePiece): AfterimagePiece => ({ id: piece.id, assetId: piece.assetId, label: piece.label,
  ...(piece.orientation === undefined ? {} : { orientation: piece.orientation }), ...(piece.variant === undefined ? {} : { variant: piece.variant }) });
/** Server/fixture sanitization contract; this function contains no authored scene content. */
export function sanitizeScene(definition: AfterimageSceneDefinition, phase: AfterimagePhase,
  timing: Pick<AfterimageSceneView, 'study_started_at' | 'study_expires_at' | 'server_now' | 'observation_remaining_ms' | 'observation_received_at'> = {}): AfterimageSceneView {
  validateSceneDefinition(definition);
  const reconstructing = phase === 'reconstruct' || phase === 'submitted', publicTargets = reconstructing || phase === 'review';
  const pieces = [...definition.objects, ...definition.distractors];
  const view: AfterimageSceneView = {
    id: definition.id, version: definition.version, difficulty: definition.difficulty, title: definition.title,
    theme: definition.theme, background: definition.background, width: definition.width, height: definition.height,
    a11y: { ...definition.a11y }, phase,
    objects: phase === 'ready' ? [] : definition.objects.filter(piece => !reconstructing || !definition.missingIds.includes(piece.id)).map(piece => ({ ...pieceView(piece), x: piece.x, y: piece.y, layer: piece.layer })),
    slots: publicTargets ? definition.slots.map(({ objectId: _private, ...slot }) => ({ ...slot })) : [],
    tray: publicTargets ? definition.trayOrder.map(id => pieceView(pieces.find(piece => piece.id === id)!)) : [],
    ...(phase === 'review' ? { answers: definition.slots.map(slot => ({ object_id: slot.objectId, slot_id: slot.id })) } : {}),
    ...timing,
  };
  validateSceneView(view); return view;
}

/** Explanatory pure scorer; ranked authority independently evaluates the frozen server definition. */
export function scoreScene(definition: AfterimageSceneDefinition, placements: unknown, skipped = false): AfterimageRoundScore {
  validateSceneDefinition(definition);
  const view = sanitizeScene(definition, 'reconstruct');
  assertPlacements(placements, view.slots, view.tray);
  const required_count = definition.slots.length;
  const correct_count = skipped ? 0 : placements.filter(entry => definition.slots.some(slot => slot.id === entry.slot_id && slot.objectId === entry.object_id)).length;
  const usedDistractor = placements.some(entry => definition.distractors.some(piece => piece.id === entry.object_id));
  const perfect = !skipped && correct_count === required_count && !usedDistractor;
  return { score: skipped ? 0 : Math.round(100 * correct_count / required_count) + (perfect ? 25 : 0), correct_count, required_count, perfect };
}
export function compareMatch(first: AfterimageStanding, second: AfterimageStanding): AfterimageMatchComparison {
  for (const standing of [first, second]) if (!Number.isInteger(standing.totalScore) || standing.totalScore < 0 || standing.totalScore > AFTERIMAGE_MATCH_MAX_SCORE
    || !Number.isInteger(standing.perfectRounds) || standing.perfectRounds < 0 || standing.perfectRounds > 3) fail('Invalid Afterimage match totals.');
  const difference = first.totalScore - second.totalScore || first.perfectRounds - second.perfectRounds;
  return difference > 0 ? 'first' : difference < 0 ? 'second' : 'draw';
}
export function validatePublishedScene(value: unknown): { valid: boolean; errors: string[] } {
  try { validateSceneDefinition(value); return { valid: true, errors: [] }; }
  catch (error) { return { valid: false, errors: [error instanceof Error ? error.message : 'Invalid Afterimage scene.'] }; }
}
