// Test-only loopback transport. Every economy response comes from the actual
// migrations running in an isolated local PostgreSQL database.
const parameters = new URLSearchParams(location.search);
const identity = parameters.get('user') || '00000000-0000-4000-8000-000000000001';
const run = parameters.get('run') || 'default';
const token = parameters.get('token') || '';

async function request(operation: string, input: Record<string, unknown>) {
  const response = await fetch('/__deep_claim_qa', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Deep-Claim-QA': token },
    body: JSON.stringify({ operation, run, user: identity, ...input }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || 'Isolated transport failed');
  return result;
}

export const deepClaimFixture = {
  command: (command: string, input: Record<string, unknown> = {}) => request('command', { command, input }),
  rpc: async (name: string, args: Record<string, unknown> = {}) => {
    try { return await request('rpc', { name, args }); }
    catch (error) { return { data: null, error: { message: error instanceof Error ? error.message : 'Local transport unavailable', code: 'FETCH_ERROR' } }; }
  },
};

export const supabase = {
  rpc: deepClaimFixture.rpc,
  from(table: string) {
    let columns = '', column = '', value: unknown;
    return {
      select(selected: string) { columns = selected; return this; },
      eq(selected: string, input: unknown) { column = selected; value = input; return this; },
      maybeSingle: () => request('table', { table, method: 'select', columns, column, value }),
      upsert: (payload: Record<string, unknown>) => request('table', { table, method: 'upsert', payload }),
    };
  },
  channel: () => ({ on() { return this; }, subscribe() { return this; }, unsubscribe: async () => ({ error: null }) }),
  removeChannel: async () => 'ok',
};
Object.assign(window, { deepClaimQa: deepClaimFixture });
