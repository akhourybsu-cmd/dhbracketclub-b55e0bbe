// Isolated stateful transport for production save-hook browser tests. This file
// is never imported by the application and never contacts a real backend.
const USER = '11111111-1111-4111-8111-111111111111';
const CLUB = '22222222-2222-4222-8222-222222222222';
const key = 'mesomon-qa-cloud-v1';
type Row = { state: unknown; revision: number; updated_at: string; slot: number };
type Receipt = { fingerprint: string; result: unknown };
type Store = { rows: Record<string, Row>; receipts: Record<string, Receipt> };
function read(): Store {
  try { return copy(JSON.parse(localStorage.getItem(key) || 'null') || { rows: {}, receipts: {} }); }
  catch { return { rows: {}, receipts: {} }; }
}
function write(store: Store) { localStorage.setItem(key, JSON.stringify(copy(store))); }
// JSONB does not retain JavaScript dictionary insertion order. Reorder every
// object at this transport boundary while preserving meaningful array order.
function copy<T>(value: T): T {
  if (Array.isArray(value)) return value.map(item => copy(item)) as T;
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([name, item]) => [name, copy(item)])) as T;
  return value;
}
const calls: { operation: string; args: unknown }[] = [];
let loseNextReply = false;
class Query {
  filters: Record<string, unknown> = {};
  constructor(private readonly table: string) {}
  select() { return this; }
  eq(column: string, value: unknown) { this.filters[column] = value; return this; }
  async maybeSingle() {
    calls.push({ operation: 'read', args: copy(this.filters) });
    if (this.table !== 'mesomon_save_slots' || this.filters.user_id !== USER) return { data: null, error: null };
    return { data: copy(read().rows[String(this.filters.slot)] || null), error: null };
  }
}
export const supabase = {
  from: (table: string) => new Query(table),
  async rpc(name: string, args: Record<string, unknown>) {
    calls.push({ operation: name, args: copy(args) });
    if (name !== 'mesomon_save' || args.p_club_id !== CLUB || args.p_expected_user_id !== USER) return { data: null, error: { message: 'Fixture authorization rejected.' } };
    const slot = Number(args.p_slot), expected = Number(args.p_expected_revision);
    if (![1, 2, 3].includes(slot) || !Number.isInteger(expected) || expected < 0 || typeof args.p_request_id !== 'string') return { data: null, error: { message: 'Invalid save request.' } };
    const state = args.p_state as { slot?: number; schemaVersion?: number };
    if (!state || state.slot !== slot || state.schemaVersion !== 1) return { data: null, error: { message: 'Invalid save state.' } };
    const store = read(), request = String(args.p_request_id), fingerprint = JSON.stringify(copy(args));
    const previous = store.receipts[request];
    if (previous) {
      if (previous.fingerprint !== fingerprint) return { data: null, error: { message: 'Request ID payload mismatch.' } };
      return { data: { ...(copy(previous.result) as object), replayed: true }, error: null };
    }
    const current = store.rows[String(slot)];
    if ((current?.revision || 0) !== expected) return { data: { conflict: true, replayed: false, save: copy(current || null) }, error: null };
    const row = { state: copy(state), revision: expected + 1, updated_at: new Date().toISOString(), slot };
    store.rows[String(slot)] = row;
    const result = { conflict: false, replayed: false, save: row };
    store.receipts[request] = { fingerprint, result: copy(result) };
    write(store);
    if (loseNextReply) { loseNextReply = false; throw new Error('Connection interrupted after commit.'); }
    return { data: copy(result), error: null };
  },
};
Object.assign(window, { mmQaTransport: { calls, read, loseNextReply: () => { loseNextReply = true; } } });
