/* eslint-disable @typescript-eslint/no-explicit-any -- This isolated Supabase transport intentionally carries heterogeneous saved rows. */
// In-memory transport fixture only. Uses production turn/results/rendering logic.
import { commissionerTables, createCommissionerFixture } from './draft-arena-commissioner';
import { createLineupConfig, validateLineupConfig } from '../../src/lib/draft/lineup';
type Row = Record<string, any>;
const params = new URLSearchParams(location.search);
const userId = params.get("user") || "u1";
const sharedKey = params.get("shared") ? `da-qa-shared:${params.get("shared")}` : null;
const date = "2026-10-30T12:00:00.000Z";
const profiles = [
  { id: "u1", display_name: "Alex", avatar_url: null },
  { id: "u2", display_name: "Blair", avatar_url: null },
  { id: "u3", display_name: "Casey", avatar_url: null },
];
const season = {
  id: "season-4", club_id: "club", name: "Season 4", year: 2026, season_number: 4, season_label: "S4",
  subtitle: "The championship circuit", starts_at: "2026-10-01T00:00:00Z", ends_at: "2026-12-31T00:00:00Z",
  status: "regular_season", regular_season_drafts: 12, regular_season_weeks: 12, playoff_weeks: 3,
  best_of: 3, commissioner_user_id: params.get("role") === "commissioner" ? userId : "u2",
};
function draft(id: string, topic: string, status: string, rounds = 4) {
  return { id, topic, status, club_id: "club", num_rounds: rounds, category: null, created_by: "u1", created_at: date,
    competition_id: `competition-${id}`, description: "Build the strongest roster, one selection at a time.",
    current_pick_user_id: "u1", current_pick_number: status === "in_progress" ? 7 : 1,
    current_round: status === "in_progress" ? 3 : 1, is_live: false, ai_context: null,
    ai_context_override: null, ceremony_enabled: false, ceremony_status: null, live_settings: {},
    timer_seconds: 90, pick_deadline_at: null, clock_paused_at: null,
  };
}
const drafts = [draft("active", "Greatest movie night", "in_progress"), draft("waiting", "Ultimate road trip", "setup"), draft("complete", "All-time movie icons", "complete", 2)];
const participants = drafts.flatMap((d) => profiles.filter((p) => d.id !== "waiting" || p.id !== "u3").map((p, i) => ({ id: `${d.id}-part-${p.id}`, draft_id: d.id, user_id: p.id, pick_order: i + 1, joined_at: date })));
const titles = ["Arrival", "The Grand Budapest Hotel", "Spirited Away", "The Godfather", "Alien", "The Matrix"];
const owners = ["u1", "u2", "u3", "u3", "u2", "u1"];
const picks = ["active", "complete"].flatMap((id) => titles.map((title, i) => ({ id: `${id}-pick-${i + 1}`, draft_id: id, user_id: owners[i], pick_text: title, pick_number: i + 1, round: Math.floor(i / 3) + 1, picked_at: date })));
const poster = new URL("/images/qa-draft-poster.svg", location.origin).href;
const tables: Record<string, Row[]> = {
  profiles, drafts, draft_participants: participants, draft_picks: picks,
  competitions: drafts.map((d) => ({ id: d.competition_id, title: d.topic, status: d.status === "complete" ? "complete" : "active", type: "draft", created_by: "u1" })),
  draft_seasons: [season],
  draft_season_entries: ["complete", "active", "waiting"].map((draftId, i) => ({ id: `entry-${draftId}`, season_id: season.id, draft_id: draftId, week_number: i + 1, is_playoff: false, season_points_awarded: {} })),
  draft_season_standings: profiles.map((p, i) => ({ id: `standing-${p.id}`, season_id: season.id, user_id: p.id, season_points: 10 - i * 3, drafts_played: 1, wins: i === 0 ? 1 : 0, podiums: 1, avg_finish: i + 1, avg_score: 18 - i * 2, best_score: 18 - i * 2, worst_score: 18 - i * 2, consistency: 100, rank: i + 1, playoff_seed: i + 1, is_eliminated: false })),
  draft_results: profiles.map((p, i) => {
    const own = picks.filter((pick) => pick.draft_id === "complete" && pick.user_id === p.id);
    const score = 9 - i;
    return { id: `result-${p.id}`, draft_id: "complete", user_id: p.id, rank: i + 1, total_score: own.length * score, points_awarded: 10 - i * 3,
      pick_ratings: own.map((pick) => ({ pick_id: pick.id, pick_text: pick.pick_text, score, explanation: "A lasting cultural landmark, supported by the saved judging report." })), summary: "A confident and memorable roster.", created_at: date };
  }),
  item_enrichments: picks.map((pick) => ({ id: `image-${pick.id}`, item_id: pick.id, item_type: "draft_pick", matched_name: pick.pick_text, normalized_name: pick.pick_text.toLowerCase(), confidence: 0.99, category: "movies", status: "matched", image_url: poster, thumbnail_url: poster, source_provider: "tmdb", metadata: { year: 2001, image_candidates: [{ url: poster + "?alternative=1", thumbnail: poster + "?alternative=1", source: "tmdb", label: "Alternative poster" }, { url: new URL("/images/qa-draft-missing.jpg", location.origin).href, thumbnail: new URL("/images/qa-draft-missing.jpg", location.origin).href, source: "tmdb", label: "Unavailable poster" }] }, summary: "An enduring cinematic selection." })),
  draft_desk_items: [{ id: "desk-1", draft_id: "active", user_id: userId, title: "Interstellar", notes: "Save for the next round", position: 0, is_favorite: true, is_on_deck: true, created_at: date, updated_at: date }],
  club_ai_settings: [{ club_id: "club", ai_enabled: false }],
  draft_season_intros: [{ id: "intro", season_id: season.id, club_id: "club", is_active: false }],
  draft_season_acknowledgements: [{ id: "ack", season_id: season.id, user_id: userId }],
  draft_playoff_matches: [], draft_pick_disputes: [], draft_skips: [], channels: [], messages: [], activity_feed: [],
  feature_flags: [{ key: "live-draft", enabled: false }], app_feature_flags: params.get("stress") === "live-flow" ? [{ key: "live-draft", enabled: true, rollout: {} }] : [],
  club_members: profiles.map((profile) => ({ id: `member-${profile.id}`, club_id: 'club', user_id: profile.id, role: 'member', joined_at: date })),
  notifications: [], ...Object.fromEntries(Object.values(commissionerTables).map((table) => [table, []])),
};
for (const table of ['draft_season_entries', 'draft_season_standings', 'draft_participants', 'draft_picks', 'draft_results', 'draft_pick_disputes', 'draft_playoff_matches'])
  for (const row of tables[table]) row.club_id = 'club';
const operations: Row[] = [];
const calls: Row[] = [];
const failedReads = new Map<string, number>();
const failedWrites = new Map<string, number>();
const blockedWrites = new Set<string>();
const heldWrites = new Map<string, Set<() => void>>();
const functionReplies = new Map<string, Row[]>();
const failedRpcs = new Map<string, number>();
const heldReads = new Set<() => void>();
let holdActiveReads = params.get("stress") === "delayed-room";
function releaseActiveReads() {
  holdActiveReads = false;
  for (const release of heldReads) release();
  heldReads.clear();
}
let serial = 100;
const clone = <T,>(value: T): T => structuredClone(value);
const imageURL = (name: string) => new URL(`/images/qa-draft-art/${name}.svg`, location.origin).href;
if (params.get('stress') === 'keyboard') {
  tables.club_ai_settings[0].ai_enabled = true;
  tables.drafts.find((row) => row.id === 'active')!.topic = 'World cinema and unforgettable stories across every country, decade and genre — a club film draft';
  for (let index = 1; index <= 12; index++) tables.draft_desk_items.push({
    id: `keyboard-desk-${index}`, draft_id: 'active', user_id: userId,
    title: `Film idea ${index} with a deliberately descriptive title`,
    notes: 'A saved private note that makes the expanded shortlist genuinely longer than the visible keyboard area.',
    position: index, is_favorite: false, is_on_deck: false, created_at: date, updated_at: date,
  });
}
if (["projector", "live-host", "live-actions"].includes(params.get("stress") || "")) {
  const clockStart = new Date().toISOString();
  const deadline = new Date(Date.now() + 90_000).toISOString();
  for (const item of tables.drafts.filter((row) => row.id === "active" || row.id === "complete")) Object.assign(item, {
    is_live: true, kiosk_code: item.id === "active" ? "DH5ZX" : "END4X",
    clock_started_at: clockStart, clock_paused_at: clockStart, pick_deadline_at: deadline,
    live_settings: { pickSeconds: 90, timeoutBehavior: "alert", autoStartClock: false, announce: true, ticker: true, sound: false, ceremony: false, broadcast: true, reportBroadcast: true },
  });
}
if (params.get("stress") === "live-actions") {
  // A legitimate saved round-two position: Blair owns slot five. The host
  // must deliberately resume the paused near-expiry clock to trigger timeout.
  tables.draft_picks = tables.draft_picks.filter((pick) => pick.draft_id !== "active" || pick.pick_number <= 4);
  const active = tables.drafts.find((row) => row.id === "active")!;
  const pausedAt = new Date().toISOString();
  Object.assign(active, { current_pick_number: 5, current_round: 2, current_pick_user_id: "u2",
    clock_started_at: new Date(Date.now() - 88_500).toISOString(), clock_paused_at: pausedAt,
    pick_deadline_at: new Date(Date.parse(pausedAt) + 1_500).toISOString(),
    live_settings: { ...active.live_settings, timeoutBehavior: "auto_skip", autoStartClock: false },
  });
}
if (params.get("stress") === "empty") {
  for (const table of ["drafts", "competitions", "draft_participants", "draft_picks", "draft_results", "draft_season_entries", "draft_season_standings", "draft_seasons", "item_enrichments", "draft_desk_items"]) tables[table] = [];
}
if (["commissioner", "commissioner-gallery"].includes(params.get("stress") || '')) {
  tables.draft_season_standings.find((row) => row.user_id === 'u3')!.season_points = 5;
  tables.draft_season_entries.find((row) => row.draft_id === 'complete')!.season_points_awarded = { u1: 10, u2: 7, u3: 5 };
}
if (params.get('stress') === 'commissioner-gallery') {
  // Persisted local records exercise presentation; this branch never calls a mutation.
  const base = { season_id: season.id, club_id: 'club', created_by: 'u1', created_at: date };
  const settings = { pickSeconds: 90, timeoutBehavior: 'alert', sound: true, ticker: true, autoStartClock: true, announce: true, ceremony: true, broadcast: true, reportBroadcast: true };
  const preset = { ...base, id: crypto.randomUUID(), name: 'Cinema night setup', version: 1, updated_by: 'u1', updated_at: date, config: { topic: 'Cinema legends', description: 'A compact film night for the club.', num_rounds: 3, ai_context: 'World cinema is eligible.', is_live: false, live_settings: settings } };
  const plan = { ...base, id: crypto.randomUUID(), topic: 'November cinema night', notes: 'Bring a list of three films.', ai_context: 'World cinema is eligible.', num_rounds: 3, is_live: false, live_settings: settings, scheduled_at: new Date(Date.now() + 7 * 86_400_000).toISOString(), due_at: new Date(Date.now() + 7 * 86_400_000 + 3_600_000).toISOString(), draft_id: null, preset_id: preset.id, status: 'ready', version: 1, updated_by: 'u1', updated_at: date };
  const adjustment = { ...base, id: crypto.randomUUID(), user_id: 'u2', delta: 4, reason: 'Correct a documented season ruling.', revoked_at: null, revoked_by: null, revocation_reason: null };
  const notification = { id: crypto.randomUUID(), user_id: 'u2', club_id: 'club', type: 'draft', title: 'Upcoming draft: November cinema night', body: 'Your next club draft is ready to review.', url: '/drafts?tab=season', actor_user_id: 'u1', created_at: date, read_at: null };
  const reminder = { ...base, id: crypto.randomUUID(), target_user_id: 'u2', draft_id: null, match_id: null, plan_id: plan.id, kind: 'plan', notification_id: notification.id };
  tables[commissionerTables.presets].push(preset); tables[commissionerTables.plans].push(plan);
  tables[commissionerTables.adjustments].push(adjustment); tables[commissionerTables.reminders].push(reminder); tables.notifications.push(notification);
  for (const [action, record, reason] of [['add_adjustment', adjustment, adjustment.reason], ['upsert_preset', preset, 'Save a reusable film night format.'], ['upsert_plan', plan, 'Schedule the next club draft.'], ['send_reminder', reminder, notification.body]] as [string, Row, string][]) tables[commissionerTables.audit].push({ ...base, id: crypto.randomUUID(), actor_user_id: 'u1', action, reason, before_data: null, after_data: clone(record), request_id: crypto.randomUUID() });
  for (const standing of tables.draft_season_standings) {
    if (standing.user_id === 'u2') { standing.season_points = 11; standing.rank = 1; standing.playoff_seed = 1; }
    if (standing.user_id === 'u1') { standing.rank = 2; standing.playoff_seed = 2; }
  }
}
if (["large", "player-scroll"].includes(params.get("stress") || '')) {
  const playerScroll = params.get('stress') === 'player-scroll';
  profiles[0].display_name = "ÆTHER⚡無限🚀".repeat(8);
  for (let index = 4; index <= 20; index++) profiles.push({ id: `u${index}`, display_name: index === 20 ? "終章の挑戦者⚡".repeat(9) : `Player ${index} · 星際`, avatar_url: null });
  const topic = playerScroll ? 'Cinema night · The complete player view' : Array.from("不滅のアリーナ🚀".repeat(12)).slice(0, 100).join("");
  const large = draft("stress", topic, "in_progress", 10);
  large.current_pick_number = playerScroll ? 200 : 121; large.current_round = playerScroll ? 10 : 7;
  tables.drafts.push(large);
  tables.competitions.push({ id: large.competition_id, title: topic, status: "active", type: "draft", created_by: "u1" });
  for (const [index, profile] of profiles.entries()) tables.draft_participants.push({ id: `stress-part-${profile.id}`, draft_id: "stress", user_id: profile.id, pick_order: index + 1, joined_at: date });
  // The tenth reverse-order round reaches Alex at slot200; nine own picks
  // plus the current real slot exercise a long team without changing rules.
  for (let index = 0; index < (playerScroll ? 199 : 120); index++) {
    const roundIndex = Math.floor(index / 20), position = index % 20;
    const owner = profiles[roundIndex % 2 === 0 ? position : 19 - position];
    const pick = { id: `stress-pick-${index + 1}`, draft_id: "stress", user_id: owner.id, pick_text: `${index + 1}·${Array.from("星際の物語🚀".repeat(15)).slice(0, 90).join("")}`, pick_number: index + 1, round: roundIndex + 1, picked_at: date };
    tables.draft_picks.push(pick);
    tables.item_enrichments.push({ ...clone(tables.item_enrichments[0]), id: `image-${pick.id}`, item_id: pick.id, matched_name: pick.pick_text, image_url: imageURL(["portrait", "wide", "square", "slow"][index % 4]), thumbnail_url: imageURL(["portrait", "wide", "square", "slow"][index % 4]) });
  }
}
if (params.get("stress") === "ceremony") {
  for (let index = 4; index <= 20; index++) profiles.push({ id: `u${index}`, display_name: `Player ${index} · 星際`, avatar_url: null });
  const ceremony = draft("ceremony", "Legends of draft night · Twenty-player LIVE event", "setup", 5);
  Object.assign(ceremony, { is_live: true, kiosk_code: "DH7ZX", current_pick_user_id: null,
    ceremony_enabled: true, ceremony_status: "revealing",
    // A projector may reconnect to a reveal already in progress.
    ceremony_reveal_index: params.get("route")?.endsWith("/kiosk") ? 12 : 0,
    live_settings: { pickSeconds: 90, timeoutBehavior: "alert", autoStartClock: false, announce: true, ticker: true, sound: false, ceremony: true, broadcast: true, reportBroadcast: true },
  });
  tables.drafts.push(ceremony);
  tables.competitions.push({ id: ceremony.competition_id, title: ceremony.topic, status: "active", type: "draft", created_by: "u1" });
  for (const [index, profile] of profiles.entries()) tables.draft_participants.push({ id: `ceremony-part-${profile.id}`, draft_id: "ceremony", user_id: profile.id, pick_order: index + 1, joined_at: date });
}
if (params.get("stress") === "secondary") {
  profiles[0].avatar_url = new URL("/images/qa-draft-missing.jpg", location.origin).href;
  const archivedSeason = { ...season, id: "season-3", name: "Season 3", season_number: 3, season_label: "S3", status: "complete", starts_at: "2026-07-01T00:00:00Z", ends_at: "2026-09-30T00:00:00Z", regular_season_drafts: 1, regular_season_weeks: 1, champion_user_id: "u1", runner_up_user_id: "u2", third_place_user_id: "u3", archived_at: date };
  tables.draft_seasons.push(archivedSeason);
  tables.draft_season_standings.push(...tables.draft_season_standings.map((row) => ({ ...clone(row), id: `past-${row.id}`, season_id: "season-3" })));
  tables.draft_season_entries.push({ id: "entry-archived", season_id: "season-3", draft_id: "archived", week_number: 1, is_playoff: false, season_points_awarded: { u1: 10, u2: 7, u3: 4 } });
  tables.drafts.push({ ...clone(tables.drafts.find((row) => row.id === "complete")), id: "archived", competition_id: "competition-archived", topic: "The champions’ collection · 映画の伝説" });
  tables.competitions.push({ id: "competition-archived", title: "The champions’ collection", status: "complete", type: "draft", created_by: "u1" });
  tables.draft_participants.push(...tables.draft_participants.filter((row) => row.draft_id === "complete").map((row) => ({ ...clone(row), id: `past-${row.id}`, draft_id: "archived" })));
  tables.draft_picks.push(...tables.draft_picks.filter((row) => row.draft_id === "complete").map((row) => ({ ...clone(row), id: row.id.replace("complete", "archived"), draft_id: "archived" })));
  tables.draft_results.push(...tables.draft_results.filter((row) => row.draft_id === "complete").map((row) => ({ ...clone(row), id: `past-${row.id}`, draft_id: "archived", pick_ratings: row.pick_ratings.map((rating: Row) => ({ ...clone(rating), pick_id: rating.pick_id.replace("complete", "archived") })) })));
  tables.item_enrichments.push(...tables.item_enrichments.filter((row) => row.item_id.startsWith("complete-")).map((row) => ({ ...clone(row), id: `past-${row.id}`, item_id: row.item_id.replace("complete", "archived") })));
}
if (params.get("art") === "varied") {
  for (const [index, image] of tables.item_enrichments.entries()) {
    const source = index === 5 ? new URL("/images/qa-draft-missing.jpg", location.origin).href : imageURL(["portrait", "wide", "square", "slow"][index % 4]);
    image.image_url = source; image.thumbnail_url = source;
  }
  tables.item_enrichments[0].metadata.image_candidates = Array.from({ length: 9 }, (_, index) => ({ url: `${imageURL(["portrait", "wide", "square", "slow"][index % 4])}?detail=1&candidate=${index + 1}`, thumbnail: `${imageURL(["portrait", "wide", "square", "slow"][index % 4])}?thumb=1&candidate=${index + 1}`, source: "tmdb", label: `Catalog alternative ${index + 1}` }));
}
if (params.get('stress') === 'lineup') {
  const config = createLineupConfig('breakfast');
  const active = { ...draft('lineup-active', 'The breakfast starting lineup', 'in_progress', 4), draft_format:'lineup', lineup_config:config, current_pick_number:4, current_round:2, current_pick_user_id:'u1', timer_seconds:null };
  const done = { ...draft('lineup-complete', 'A complete breakfast lineup', 'complete', 4), draft_format:'lineup', lineup_config:clone(config), current_pick_number:9, current_round:4, current_pick_user_id:null, timer_seconds:null };
  for (const room of [active,done]) {
    tables.drafts.push(room); tables.competitions.push({id:room.competition_id,club_id:'club',created_by:'u1',title:room.topic,type:'draft',status:room.status,description:'A saved lineup with every role visible.'});
    for (const [i,who] of ['u1','u2'].entries()) tables.draft_participants.push({id:`${room.id}-player-${who}`,club_id:'club',draft_id:room.id,user_id:who,pick_order:i+1,joined_at:date});
  }
  const food = ['Orange juice','French toast','Cinnamon roll','Chocolate croissant','Hash browns','Fruit bowl','Black coffee','Eggs Benedict'];
  const who = ['u1','u2','u2','u1','u1','u2','u2','u1'];
  const slots = ['drink','entree','sweet','sweet','side','side','drink','entree'];
  for (const room of [active,done]) for(let i=0;i<(room.id==='lineup-active'?3:8);i++) tables.draft_picks.push({id:`${room.id}-pick-${i+1}`,club_id:'club',draft_id:room.id,user_id:who[i],pick_text:food[i],pick_number:i+1,round:Math.floor(i/2)+1,lineup_slot_id:slots[i],picked_at:date});
  for (const [i,who] of ['u1','u2'].entries()) { const own=tables.draft_picks.filter(row=>row.draft_id===done.id&&row.user_id===who); tables.draft_results.push({id:`${done.id}-result-${who}`,club_id:'club',draft_id:done.id,user_id:who,rank:i+1,total_score:own.length*(9-i),points_awarded:0,summary:'A balanced breakfast, judged in its assigned roles.',pick_ratings:own.map(row=>({pick_id:row.id,pick_text:row.pick_text,score:9-i,explanation:'Merit 9.0/10 · Role fit 9.0/10 (60/40). Fits this breakfast role.',scoring_version:'lineup_v1',lineup_slot_id:row.lineup_slot_id,lineup_slot_label:config.slots.find(slot=>slot.id===row.lineup_slot_id)!.label})),created_at:date}); }
}
if (sharedKey) {
  const saved = localStorage.getItem(sharedKey);
  if (saved) {
    const snapshot = JSON.parse(saved);
    for (const [table, rows] of Object.entries(snapshot.tables)) tables[table] = clone(rows) as Row[];
    serial = snapshot.serial;
  } else localStorage.setItem(sharedKey, JSON.stringify({ tables, serial }));
}

interface FixtureSubscription { type: string; config: Row; callback: (payload: Row) => void }
const channels = new Set<FixtureChannel>();
class FixtureChannel {
  subscriptions: FixtureSubscription[] = [];
  status?: (state: string) => void;
  on(type: string, config: Row, callback: (payload: Row) => void) { this.subscriptions.push({ type, config, callback }); return this; }
  subscribe(callback?: (state: string) => void) { this.status = callback; channels.add(this); queueMicrotask(() => callback?.("SUBSCRIBED")); return this; }
  unsubscribe() { channels.delete(this); return Promise.resolve(); }
  send() { return Promise.resolve({}); }
  track() { return Promise.resolve({}); }
  presenceState() { return {}; }
}
function emitChange(event: Row) {
  for (const channel of channels) for (const subscription of channel.subscriptions) {
    if (subscription.type !== "postgres_changes" || subscription.config.table !== event.table || (subscription.config.event !== "*" && subscription.config.event !== event.eventType)) continue;
    const [key, value] = (subscription.config.filter || "").split("=eq.");
    if (key && String((event.new || event.old)?.[key]) !== value) continue;
    queueMicrotask(() => subscription.callback(event));
  }
}
function publish(table: string, mode: string, rows: Row[]) {
  if (!sharedKey) return;
  const events = rows.map((row) => ({ schema: "public", table, eventType: mode === "delete" ? "DELETE" : mode === "update" ? "UPDATE" : "INSERT", new: mode === "delete" ? {} : clone(row), old: mode === "delete" ? clone(row) : {} }));
  localStorage.setItem(sharedKey, JSON.stringify({ tables, serial, events, revision: crypto.randomUUID() }));
  for (const event of events) emitChange(event);
}
const commissionerFixture = createCommissionerFixture(tables, userId, (table, mode, rows) => {
  operations.push({ table, mode, rows: clone(rows), transport: 'commissioner-rpc' });
  publish(table, mode, rows);
});
if (sharedKey) window.addEventListener("storage", (event) => {
  if (event.key !== sharedKey || !event.newValue) return;
  const snapshot = JSON.parse(event.newValue);
  for (const [table, rows] of Object.entries(snapshot.tables)) tables[table] = clone(rows) as Row[];
  serial = Math.max(serial, snapshot.serial);
  for (const change of snapshot.events || []) emitChange(change);
});
// This adapter validates transport state; official SQL is tested independently.
function lineupAction(args: Row) {
  const reject = (message: string, code = 'P0001') => ({ data: null, error: { code, message } });
  if (args.p_club_id !== 'club' || !tables.club_members.some(member => member.club_id === 'club' && member.user_id === userId)) return reject('You must belong to this club.', '42501');
  if (typeof args.p_request_id !== 'string' || !args.p_request_id) return reject('A request ID is required.');
  const receipts = tables.draft_lineup_requests ||= [];
  const fingerprint = JSON.stringify([args.p_draft_id ?? null, args.p_action, args.p_payload ?? {}]);
  const previous = receipts.find(row => row.user_id === userId && row.request_id === args.p_request_id);
  if (previous) return previous.fingerprint === fingerprint ? { data: { ...clone(previous.result), replayed: true }, error: null } : reject('Request ID belongs to a different action.');
  const action = args.p_action, payload = args.p_payload ?? {};
  let room = tables.drafts.find(row => row.id === args.p_draft_id && row.club_id === 'club' && row.draft_format === 'lineup');
  const changed: Array<[string, string, Row[]]> = [];
  const mark = (table: string, mode: string, rows: Row[]) => changed.push([table, mode, rows]);
  if (action === 'create') {
    if (validateLineupConfig(payload.lineup_config).length) return reject('Choose a valid lineup.');
    if (typeof payload.topic !== 'string' || !payload.topic.trim() || payload.topic.length > 100) return reject('Enter a topic using up to 100 characters.');
    const competition = { id: crypto.randomUUID(), club_id: 'club', created_by: userId, title: payload.topic.trim(), description: payload.description ?? '', type: 'draft', status: 'setup', created_at: new Date().toISOString() };
    room = { ...draft(crypto.randomUUID(), payload.topic.trim(), 'setup', payload.lineup_config.slots.length), created_by: userId, competition_id: competition.id, draft_format: 'lineup', lineup_config: clone(payload.lineup_config), ai_context: payload.ai_context ?? null, timer_seconds: null, current_pick_user_id: null };
    const member = { id: crypto.randomUUID(), club_id: 'club', draft_id: room.id, user_id: userId, pick_order: 1, joined_at: new Date().toISOString() };
    tables.competitions.push(competition); tables.drafts.push(room); tables.draft_participants.push(member);
    mark('competitions', 'insert', [competition]); mark('drafts', 'insert', [room]); mark('draft_participants', 'insert', [member]);
  } else {
    if (!room) return reject('This lineup is unavailable.', '42501');
    const players = tables.draft_participants.filter(row => row.draft_id === room!.id).sort((a,b) => a.pick_order-b.pick_order);
    const own = players.find(row => row.user_id === userId);
    const host = room.created_by === userId;
    const selected = tables.draft_picks.filter(row => row.draft_id === room!.id);
    if (action === 'join') {
      if (room.status !== 'setup') return reject('This lineup has already started.');
      if (!own) { const member = { id: crypto.randomUUID(), club_id: 'club', draft_id: room.id, user_id: userId, pick_order: players.length + 1, joined_at: new Date().toISOString() }; tables.draft_participants.push(member); mark('draft_participants', 'insert', [member]); }
    } else if (action === 'leave') {
      if (room.status !== 'setup' || host) return reject('The host cannot leave this lineup.');
      tables.draft_participants = tables.draft_participants.filter(row => row.id !== own?.id);
      if (own) mark('draft_participants', 'delete', [own]);
      tables.draft_participants.filter(row => row.draft_id === room!.id).sort((a,b)=>a.pick_order-b.pick_order).forEach((row,index)=> { row.pick_order=index+1; });
    } else if (action === 'start') {
      if (!host) return reject('Only the host can start.', '42501');
      if (room.status !== 'setup' || players.length < 2) return reject('At least two players are needed.');
      Object.assign(room, { status: 'in_progress', current_pick_number: 1, current_round: 1, current_pick_user_id: players[0].user_id }); mark('drafts', 'update', [room]);
    } else if (action === 'cancel') {
      if (!host || !['setup','in_progress'].includes(room.status)) return reject('Only the host can cancel an open lineup.', '42501');
      room.status = 'cancelled'; room.current_pick_user_id = null; mark('drafts', 'update', [room]);
    } else if (action === 'pick' || action === 'edit_pick') {
      if (!own || room.status !== 'in_progress') return reject('This lineup is not accepting picks.');
      if (typeof payload.text !== 'string' || !payload.text.trim() || payload.text.length > 100) return reject('Enter a valid pick.');
      const normalized = (text: string) => text.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
      if (selected.some(row => row.id !== payload.pick_id && normalized(row.pick_text) === normalized(payload.text))) return reject('That selection has already been drafted.');
      if (action === 'edit_pick') {
        const old = selected.find(row => row.id === payload.pick_id && (row.user_id === userId || host));
        if (!old) return reject('You cannot edit that pick.', '42501'); old.pick_text = payload.text.trim(); mark('draft_picks','update',[old]);
      } else {
        if (room.current_pick_user_id !== userId) return reject('Wait for your turn.');
        if (!room.lineup_config.slots.some((slot: Row) => slot.id === payload.slot_id)) return reject('Choose an open slot.');
        if (selected.some(row => row.user_id === userId && row.lineup_slot_id === payload.slot_id)) return reject('That slot is filled.');
        const pick = { id: crypto.randomUUID(), club_id:'club', draft_id:room.id, user_id:userId, pick_number:room.current_pick_number, round:room.current_round, pick_text:payload.text.trim(), lineup_slot_id:payload.slot_id, picked_at:new Date().toISOString() };
        tables.draft_picks.push(pick); mark('draft_picks','insert',[pick]);
        const number = selected.length + 2, total = players.length * room.num_rounds;
        const roundIndex = Math.floor((number - 1) / players.length), offset = (number - 1) % players.length;
        Object.assign(room, { current_pick_number:number, current_round:roundIndex+1, status:number>total?'complete':'in_progress', current_pick_user_id:number>total?null:players[roundIndex%2===0?offset:players.length-1-offset].user_id }); mark('drafts','update',[room]);
      }
    } else return reject('Unsupported lineup action.');
  }
  const result = { draft_id:room!.id, action };
  receipts.push({ user_id:userId, request_id:args.p_request_id, fingerprint, result });
  for (const [table, mode, rows] of changed) { operations.push({table,mode,rows:clone(rows),transport:'lineup-rpc'}); publish(table,mode,rows); }
  if (loseLineupReply) { loseLineupReply=false; return reject('Fixture: response lost after server commit.', '08006'); }
  return { data:result, error:null };
}
let loseLineupReply = false;
function hydrate(table: string, row: Row) {
  const value = clone(row);
  if (row.user_id) value.profiles = profiles.find((p) => p.id === row.user_id) || null;
  if (table === "drafts") {
    value.profiles = profiles.find((p) => p.id === row.created_by);
    value.current_pick_profiles = profiles.find((p) => p.id === row.current_pick_user_id);
    value.competitions = tables.competitions.find((c) => c.id === row.competition_id);
    value.draft_participants = tables.draft_participants.filter(participant => participant.draft_id === row.id).map(participant => ({ user_id: participant.user_id }));
  }
  if (table === "draft_season_entries") value.drafts = clone(tables.drafts.find((d) => d.id === row.draft_id));
  return value;
}
class Query implements PromiseLike<any> {
  filters: ((row: Row) => boolean)[] = [];
  orders: { key: string; ascending: boolean }[] = [];
  mode = "select";
  payload: Row | Row[] | null = null;
  singular = false;
  start = 0;
  end = Infinity;
  constructor(public table: string) {}
  select() { return this; }
  insert(value: Row | Row[]) { this.mode = "insert"; this.payload = value; return this; }
  update(value: Row) { this.mode = "update"; this.payload = value; return this; }
  upsert(value: Row | Row[]) { this.mode = "upsert"; this.payload = value; return this; }
  delete() { this.mode = "delete"; return this; }
  eq(key: string, value: any) { this.filters.push((row) => row[key] === value); return this; }
  neq(key: string, value: any) { this.filters.push((row) => row[key] !== value); return this; }
  in(key: string, values: any[]) { this.filters.push((row) => values.includes(row[key])); return this; }
  is(key: string, value: any) { return this.eq(key, value); }
  gt(key: string, value: any) { this.filters.push((row) => row[key] > value); return this; }
  gte(key: string, value: any) { this.filters.push((row) => row[key] >= value); return this; }
  lt(key: string, value: any) { this.filters.push((row) => row[key] < value); return this; }
  lte(key: string, value: any) { this.filters.push((row) => row[key] <= value); return this; }
  not(key: string, operator: string, value: any) { if (operator === "is") return this.neq(key, value); return this; }
  or() { return this; }
  match(value: Row) { for (const [key, item] of Object.entries(value)) this.eq(key, item); return this; }
  order(key: string, options: any = {}) { this.orders.push({ key, ascending: options.ascending !== false }); return this; }
  limit(value: number) { this.end = this.start + value - 1; return this; }
  range(start: number, end: number) { this.start = start; this.end = end; return this; }
  single() { this.singular = true; return this; }
  maybeSingle() { this.singular = true; return this; }
  abortSignal() { return this; }
  async run() {
    calls.push({ table: this.table, mode: this.mode });
    if (this.mode !== 'select' && blockedWrites.has(this.table)) await new Promise<void>((resolve) => {
      const pending = heldWrites.get(this.table) ?? new Set<() => void>();
      pending.add(resolve); heldWrites.set(this.table, pending);
    });
    if (this.mode !== 'select' && (failedWrites.get(this.table) || 0) > 0) {
      failedWrites.set(this.table, failedWrites.get(this.table)! - 1);
      return { data: null, error: { message: 'Fixture: interrupted write' } };
    }
    if (this.mode === "select" && (failedReads.get(this.table) || 0) > 0) {
      failedReads.set(this.table, failedReads.get(this.table)! - 1);
      return { data: null, error: { message: "Fixture: interrupted read" } };
    }
    const source = tables[this.table] ||= [];
    let rows = source.filter((row) => this.filters.every((filter) => filter(row)));
    if (holdActiveReads && this.mode === "select" && this.table === "drafts" && this.singular && rows.some((row) => row.id === "active")) await new Promise<void>((resolve) => heldReads.add(resolve));
    if (this.mode === "insert" || this.mode === "upsert") {
      rows = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((value) => ({ id: `qa-${++serial}`, club_id: "club", created_at: new Date().toISOString(), picked_at: new Date().toISOString(), ...clone(value) }));
      if (this.table === "draft_picks") {
        for (const pick of rows) {
          if (pick.user_id !== userId) return { data: null, error: { message: "Fixture: wrong account" } };
          if (source.some((old) => old.draft_id === pick.draft_id && old.pick_number === pick.pick_number)) return { data: null, error: { message: "Fixture: duplicate pick number" } };
        }
      }
      source.push(...rows);
    } else if (this.mode === "update") {
      rows.forEach((row) => Object.assign(row, clone(this.payload)));
    } else if (this.mode === "delete") {
      tables[this.table] = source.filter((row) => !rows.includes(row));
    }
    if (this.mode !== "select") { operations.push({ table: this.table, mode: this.mode, rows: clone(rows) }); publish(this.table, this.mode, rows); }
    for (const { key, ascending } of [...this.orders].reverse()) rows.sort((a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0) * (ascending ? 1 : -1));
    rows = rows.slice(this.start, this.end === Infinity ? undefined : this.end + 1).map((row) => hydrate(this.table, row));
    return { data: this.singular ? rows[0] ?? null : rows, error: null, count: rows.length };
  }
  then(resolve: any, reject: any) { return this.run().then(resolve, reject); }
}
const channel = () => new FixtureChannel();
export const supabase = {
  from: (table: string) => new Query(table),
  rpc: async (name: string, args: Row = {}) => {
    calls.push({ rpc: name, args: clone(args) });
    if ((failedRpcs.get(name) || 0) > 0) {
      failedRpcs.set(name, failedRpcs.get(name)! - 1);
      return { data: null, error: { code: '08006', message: 'Fixture: interrupted commissioner request' } };
    }
    if (name === "draft_lineup_action") return lineupAction(args);
    if (commissionerFixture.handles(name)) return commissionerFixture.rpc(name, args);
    return { data: name === "is_app_admin" ? false : name === "current_user_club_id" ? "club" : name === "server_now" ? new Date().toISOString() : null, error: null };
  },
  functions: { invoke: async (name: string, args?: any) => { calls.push({ function: name, args: clone(args || {}) }); return { data: functionReplies.get(name)?.shift() ?? { success: true, enriched: 0 }, error: null }; } },
  channel, removeChannel: async (item: FixtureChannel) => { await item.unsubscribe(); }, removeAllChannels: async () => { channels.clear(); },
  auth: { getSession: async () => ({ data: { session: { access_token: "fixture-only", user: { id: userId } } }, error: null }), getUser: async () => ({ data: { user: { id: userId } }, error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
  storage: { from: () => ({ getPublicUrl: (path: string) => ({ data: { publicUrl: path } }) }) },
};
Object.assign(window, { daQa: { tables, operations, calls, userId, ready: true, releaseActiveReads,
  failNextRead: (table: string) => failedReads.set(table, (failedReads.get(table) || 0) + 1),
  failNextWrite: (table: string) => failedWrites.set(table, (failedWrites.get(table) || 0) + 1),
  blockWrites: (table: string) => { blockedWrites.add(table); },
  releaseWrites: (table: string) => { blockedWrites.delete(table); for (const release of heldWrites.get(table) ?? []) release(); heldWrites.delete(table); },
  replyNextFunction: (name: string, data: Row) => { functionReplies.set(name, [...(functionReplies.get(name) ?? []), clone(data)]); },
  loseNextLineupResponse: () => { loseLineupReply = true; },
  failNextRPC: (name: string) => failedRpcs.set(name, (failedRpcs.get(name) || 0) + 1),
  blockRPC: (name: string) => failedRpcs.set(name, Infinity),
  releaseRPC: (name: string) => failedRpcs.delete(name),
  refreshRow: (table: string, id: string) => {
    const row = tables[table]?.find((item) => item.id === id);
    if (row) emitChange({ schema: "public", table, eventType: "UPDATE", new: clone(row), old: clone(row) });
  },
  setConnection: (status: string) => { for (const item of channels) item.status?.(status); },
} });
export const draftArenaFixture = { tables, userId };
