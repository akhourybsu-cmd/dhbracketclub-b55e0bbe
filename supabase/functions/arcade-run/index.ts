// The game and verifier import the same rules. Only this server entry point holds a trusted database client.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { ArcadeFailure, handleArcadeRequest, type Rpc } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, options);
function rpcFor(client: typeof admin): Rpc {
  return async (name, args) => {
    const response = await client.rpc(name, args).abortSignal(AbortSignal.timeout(10000));
    if (response.error) throw response.error;
    return response.data;
  };
}

Deno.serve(request => handleArcadeRequest(request, {
  async authenticate(token) {
    const member = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      ...options,
      global: { headers: { Authorization: 'Bearer ' + token } },
    });
    const { data, error } = await member.auth.getUser(token);
    if (error && (error.status === 0 || (error.status ?? 500) >= 500)) {
      throw new ArcadeFailure('unavailable', 503, 'Sign-in verification is temporarily unavailable.', true);
    }
    if (error || !data.user) throw new ArcadeFailure('unauthorized', 401, 'Sign in to play a ranked run.');
    return { userId: data.user.id, memberRpc: rpcFor(member), trustedRpc: rpcFor(admin) };
  },
}));
