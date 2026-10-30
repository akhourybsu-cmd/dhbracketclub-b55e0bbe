import { QUERY_TIMEOUT_MS, withTimeout } from "@/lib/asyncGuards";
import { supabase } from "@/integrations/supabase/client";

/** Bound every Rune Delve request, including writes and secondary hydration.
 * A missing row is valid; a rejected/failed request must never become a fresh
 * save, an empty loadout, or a successful reward. */
export async function runeRequest<T>(
  request: PromiseLike<T>,
  label = "Rune Delve request",
): Promise<T> {
  const result = await withTimeout(request, QUERY_TIMEOUT_MS, label);
  const error = (result as { error?: unknown })?.error;
  if (error) throw error;
  return result;
}

export function runeRpc<T>(
  name: string,
  args: Record<string, unknown>,
  label?: string,
) {
  // Preserve the Supabase receiver. Extracting rpc without bind can crash
  // before a promise exists (as happened in Chat's presence request).
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{
    data: T | null;
    error: { message: string; code?: string } | null;
  }>;
  return runeRequest(
    Promise.resolve().then(() => rpc(name, args)),
    label,
  );
}
