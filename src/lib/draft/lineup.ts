/** Frozen, versioned roster requirements shared by setup and the player room. */
export interface LineupSlot { id: string; label: string; description?: string }
export interface LineupConfig { version: 1; template_id: string; slots: LineupSlot[] }
export interface LineupTemplate {
  id: string; name: string; description: string; topic: string; slots: LineupSlot[];
}
export interface LineupAssignedPick { user_id: string; lineup_slot_id?: string | null }
export const LINEUP_SLOT_LIMIT = 20;

const slot = (id: string, label: string, description: string): LineupSlot => ({ id, label, description });
export const LINEUP_TEMPLATES: readonly LineupTemplate[] = [
  { id: 'breakfast', name: 'Breakfast Club', description: 'Build the perfect breakfast.', topic: 'The most complete breakfast', slots: [
    slot('drink', 'Drink', 'Something to sip with breakfast.'), slot('entree', 'Entrée', 'The main event on the plate.'),
    slot('side', 'Side', 'A companion to the main dish.'), slot('sweet', 'Dessert', 'A sweet final bite.'),
  ] },
  { id: 'football-skills', name: 'Fictional Football', description: 'Characters. Five starting spots.', topic: 'Fictional characters as a football offense', slots: [
    slot('quarterback', 'Quarterback', 'Leads the offense and throws the ball.'), slot('running-back', 'Running back', 'Carries the ball and finds a way through.'),
    slot('receiver-1', 'Receiver 1', 'Creates space and catches passes.'), slot('receiver-2', 'Receiver 2', 'A second passing threat.'),
    slot('tight-end', 'Tight end', 'Balances receiving and blocking.'),
  ] },
  { id: 'football-offense', name: 'Starting Eleven', description: 'A full fictional offense.', topic: 'The best eleven fictional characters for a football offense', slots: [
    slot('quarterback', 'Quarterback', 'Leads the offense and throws the ball.'), slot('running-back', 'Running back', 'Carries the ball.'),
    slot('receiver-1', 'Receiver 1', 'Creates space and catches passes.'), slot('receiver-2', 'Receiver 2', 'A second passing threat.'),
    slot('receiver-3', 'Receiver 3', 'A third receiving option.'), slot('tight-end', 'Tight end', 'Receives and blocks.'),
    slot('left-tackle', 'Left tackle', 'Protects the edge of the line.'), slot('left-guard', 'Left guard', 'Protects the interior line.'),
    slot('center', 'Center', 'Snaps the ball and anchors the line.'), slot('right-guard', 'Right guard', 'Protects the interior line.'),
    slot('right-tackle', 'Right tackle', 'Protects the other edge.'),
  ] },
  { id: 'band', name: 'Dream Band', description: 'Four musicians. One stage.', topic: 'The ultimate band', slots: [
    slot('vocals', 'Lead vocals', 'The voice of the band.'), slot('guitar', 'Guitar', 'The riffs and melodies.'),
    slot('bass', 'Bass', 'The low end and groove.'), slot('drums', 'Drums', 'The rhythmic backbone.'),
  ] },
  { id: 'heist', name: 'The Heist', description: 'Give every crew member a job.', topic: 'Fictional characters for the perfect heist crew', slots: [
    slot('mastermind', 'Mastermind', 'Plans the operation.'), slot('infiltrator', 'Infiltrator', 'Gets inside without drawing attention.'),
    slot('technician', 'Technician', 'Handles systems and security.'), slot('muscle', 'Muscle', 'Handles physical obstacles.'),
    slot('driver', 'Getaway driver', 'Gets everyone out.'),
  ] },
  { id: 'movie-cast', name: 'Dream Cast', description: 'Cast every part of your movie.', topic: 'The ultimate movie cast', slots: [
    slot('hero', 'Hero', 'The central protagonist.'), slot('villain', 'Villain', 'The main antagonist.'),
    slot('partner', 'Partner', 'The hero’s closest ally.'), slot('mentor', 'Mentor', 'Offers experience and guidance.'),
    slot('wildcard', 'Wildcard', 'Brings an unpredictable element.'), slot('comic-relief', 'Comic relief', 'Finds the humor in the story.'),
  ] },
  { id: 'custom', name: 'Your Lineup', description: 'Name the roles. Make it yours.', topic: '', slots: [
    slot('slot-1', 'Slot 1', ''), slot('slot-2', 'Slot 2', ''), slot('slot-3', 'Slot 3', ''), slot('slot-4', 'Slot 4', ''),
  ] },
];

/** Return errors rather than silently repairing a ranked draft's requirements. */
export function validateLineupConfig(value: unknown): string[] {
  const errors: string[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['Choose a lineup.'];
  const config = value as Record<string, unknown>;
  if (Object.keys(config).some(key => !['version', 'template_id', 'slots'].includes(key))) errors.push('This lineup contains unsupported settings.');
  if (config.version !== 1) errors.push('This lineup version is not supported.');
  if (typeof config.template_id !== 'string' || !/^[a-z][a-z0-9_-]{0,47}$/.test(config.template_id)) errors.push('Choose a valid lineup template.');
  if (!Array.isArray(config.slots) || config.slots.length < 2 || config.slots.length > LINEUP_SLOT_LIMIT) return [...errors, 'Use between 2 and 20 slots.'];
  const ids = new Set<string>();
  for (const [index, raw] of config.slots.entries()) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) { errors.push(`Slot ${index + 1} is invalid.`); continue; }
    const row = raw as Record<string, unknown>;
    if (Object.keys(row).some(key => !['id', 'label', 'description'].includes(key))) errors.push(`Slot ${index + 1} contains unsupported settings.`);
    if (typeof row.id !== 'string' || !/^[a-z][a-z0-9_-]{0,47}$/.test(row.id) || ids.has(row.id)) errors.push(`Slot ${index + 1} needs a unique ID.`);
    if (typeof row.id === 'string') ids.add(row.id);
    if (typeof row.label !== 'string' || !row.label.trim() || row.label.length > 36) errors.push(`Name slot ${index + 1} using up to 36 characters.`);
    if (row.description !== undefined && (typeof row.description !== 'string' || row.description.length > 120)) errors.push(`Keep slot ${index + 1}'s description under 120 characters.`);
  }
  return errors;
}

export function parseLineupConfig(value: unknown): LineupConfig | null {
  if (validateLineupConfig(value).length) return null;
  const config = value as LineupConfig;
  return { version: 1, template_id: config.template_id, slots: config.slots.map(row => ({ id: row.id, label: row.label.trim(), ...(row.description !== undefined ? { description: row.description } : {}) })) };
}
export const getLineupConfig = parseLineupConfig;

export function createLineupConfig(templateId: string): LineupConfig {
  const template = LINEUP_TEMPLATES.find(row => row.id === templateId);
  if (!template) throw new Error('Choose a lineup template.');
  return { version: 1, template_id: template.id, slots: template.slots.map(row => ({ ...row })) };
}

export function openLineupSlots(config: LineupConfig, picks: readonly LineupAssignedPick[], userId: string): LineupSlot[] {
  const occupied = new Set(picks.filter(pick => pick.user_id === userId).map(pick => pick.lineup_slot_id));
  return config.slots.filter(row => !occupied.has(row.id));
}

export function lineupProgress(config: LineupConfig, picks: readonly LineupAssignedPick[], userId: string) {
  const total = config.slots.length;
  const filled = total - openLineupSlots(config, picks, userId).length;
  return { filled, total, complete: filled === total, percent: Math.round(100 * filled / total) };
}

/** Shared links can still point at /drafts/:id; that page redirects Lineups. */
export function draftRoomPath(draft: { id: string; draft_format?: string | null; is_live?: boolean | null }) {
  return draft.draft_format === 'lineup' ? `/drafts/lineup/${encodeURIComponent(draft.id)}`
    : draft.is_live ? `/drafts/live/${encodeURIComponent(draft.id)}` : `/drafts/${encodeURIComponent(draft.id)}`;
}
