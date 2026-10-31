/* eslint-disable @typescript-eslint/no-explicit-any -- This isolated Supabase transport intentionally carries heterogeneous saved rows. */
// In-memory transport fixture only. Uses production turn/results/rendering logic.
type Row = Record<string, any>;
const params = new URLSearchParams(location.search);
const userId = params.get("user") || "u1";
const date = "2026-10-30T12:00:00.000Z";
const profiles = [
  { id: "u1", display_name: "Alex", avatar_url: null },
  { id: "u2", display_name: "Blair", avatar_url: null },
  { id: "u3", display_name: "Casey", avatar_url: null },
];
const season = {
  id: "season-4", name: "Season 4", year: 2026, season_number: 4, season_label: "S4",
  subtitle: "The championship circuit", starts_at: "2026-10-01T00:00:00Z", ends_at: "2026-12-31T00:00:00Z",
  status: "regular_season", regular_season_drafts: 12, regular_season_weeks: 12, playoff_weeks: 3,
  best_of: 3, commissioner_user_id: params.get("role") === "commissioner" ? userId : "u2",
};
function draft(id: string, topic: string, status: string, rounds = 4) {
  return { id, topic, status, num_rounds: rounds, category: null, created_by: "u1", created_at: date,
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
  feature_flags: [{ key: "live-draft", enabled: false }], app_feature_flags: [],
};
const operations: Row[] = [];
const calls: Row[] = [];
let serial = 100;
const clone = <T,>(value: T): T => structuredClone(value);
const imageURL = (name: string) => new URL(`/images/qa-draft-art/${name}.svg`, location.origin).href;
if (params.get("stress") === "large") {
  profiles[0].display_name = "ÆTHER⚡無限🚀".repeat(8);
  for (let index = 4; index <= 20; index++) profiles.push({ id: `u${index}`, display_name: index === 20 ? "終章の挑戦者⚡".repeat(9) : `Player ${index} · 星際`, avatar_url: null });
  const topic = Array.from("不滅のアリーナ🚀".repeat(12)).slice(0, 100).join("");
  const large = draft("stress", topic, "in_progress", 10);
  large.current_pick_number = 121; large.current_round = 7;
  tables.drafts.push(large);
  tables.competitions.push({ id: large.competition_id, title: topic, status: "active", type: "draft", created_by: "u1" });
  for (const [index, profile] of profiles.entries()) tables.draft_participants.push({ id: `stress-part-${profile.id}`, draft_id: "stress", user_id: profile.id, pick_order: index + 1, joined_at: date });
  for (let index = 0; index < 120; index++) {
    const roundIndex = Math.floor(index / 20), position = index % 20;
    const owner = profiles[roundIndex % 2 === 0 ? position : 19 - position];
    const pick = { id: `stress-pick-${index + 1}`, draft_id: "stress", user_id: owner.id, pick_text: `${index + 1}·${Array.from("星際の物語🚀".repeat(15)).slice(0, 90).join("")}`, pick_number: index + 1, round: roundIndex + 1, picked_at: date };
    tables.draft_picks.push(pick);
    tables.item_enrichments.push({ ...clone(tables.item_enrichments[0]), id: `image-${pick.id}`, item_id: pick.id, matched_name: pick.pick_text, image_url: imageURL(["portrait", "wide", "square", "slow"][index % 4]), thumbnail_url: imageURL(["portrait", "wide", "square", "slow"][index % 4]) });
  }
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
function hydrate(table: string, row: Row) {
  const value = clone(row);
  if (row.user_id) value.profiles = profiles.find((p) => p.id === row.user_id) || null;
  if (table === "drafts") {
    value.profiles = profiles.find((p) => p.id === row.created_by);
    value.current_pick_profiles = profiles.find((p) => p.id === row.current_pick_user_id);
    value.competitions = tables.competitions.find((c) => c.id === row.competition_id);
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
    const source = tables[this.table] ||= [];
    let rows = source.filter((row) => this.filters.every((filter) => filter(row)));
    if (this.mode === "insert" || this.mode === "upsert") {
      rows = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((value) => ({ id: `qa-${++serial}`, created_at: new Date().toISOString(), picked_at: new Date().toISOString(), ...clone(value) }));
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
    if (this.mode !== "select") operations.push({ table: this.table, mode: this.mode, rows: clone(rows) });
    for (const { key, ascending } of [...this.orders].reverse()) rows.sort((a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0) * (ascending ? 1 : -1));
    rows = rows.slice(this.start, this.end === Infinity ? undefined : this.end + 1).map((row) => hydrate(this.table, row));
    return { data: this.singular ? rows[0] ?? null : rows, error: null, count: rows.length };
  }
  then(resolve: any, reject: any) { return this.run().then(resolve, reject); }
}
const channel = () => ({ on() { return this; }, subscribe(callback?: (state: string) => void) { queueMicrotask(() => callback?.("SUBSCRIBED")); return this; }, unsubscribe() {}, send: async () => ({}), track: async () => ({}), presenceState: () => ({}) });
export const supabase = {
  from: (table: string) => new Query(table),
  rpc: async (name: string) => {
    calls.push({ rpc: name });
    return { data: name === "is_app_admin" ? false : name === "current_user_club_id" ? "club" : name === "server_now" ? new Date().toISOString() : null, error: null };
  },
  functions: { invoke: async (name: string, args?: any) => { calls.push({ function: name, args: clone(args || {}) }); return { data: { success: true, enriched: 0 }, error: null }; } },
  channel, removeChannel: async () => {}, removeAllChannels: async () => {},
  auth: { getSession: async () => ({ data: { session: { access_token: "fixture-only", user: { id: userId } } }, error: null }), getUser: async () => ({ data: { user: { id: userId } }, error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
  storage: { from: () => ({ getPublicUrl: (path: string) => ({ data: { publicUrl: path } }) }) },
};
Object.assign(window, { daQa: { tables, operations, calls, userId, ready: true } });
export const draftArenaFixture = { tables, userId };
