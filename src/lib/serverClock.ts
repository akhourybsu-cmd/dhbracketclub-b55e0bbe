import { supabase } from '@/integrations/supabase/client';

/**
 * Shared server-time clock. Every device measures its offset from the
 * database clock so live-draft deadlines are written AND read on one timeline
 * — a phone running 4s fast no longer shows a different countdown than the
 * projector.
 */
let offsetMs = 0;
let lastSync = 0;
let inflight: Promise<void> | null = null;

async function measure(): Promise<number | null> {
  const t0 = Date.now();
  const { data, error } = await (supabase as any).rpc('server_now');
  const t1 = Date.now();
  if (error || !data) return null;
  const server = new Date(data as string).getTime();
  if (Number.isNaN(server)) return null;
  return { offset: server - (t0 + t1) / 2, rtt: t1 - t0 } as any;
}

export function syncServerClock(force = false): Promise<void> {
  if (!force && Date.now() - lastSync < 60_000) return Promise.resolve();
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      // Take the lowest-latency of 3 samples for the tightest estimate.
      let best: { offset: number; rtt: number } | null = null;
      for (let i = 0; i < 3; i++) {
        const s = (await measure()) as any;
        if (s && (!best || s.rtt < best.rtt)) best = s;
      }
      if (best) { offsetMs = best.offset; lastSync = Date.now(); }
    } catch { /* keep previous offset */ } finally { inflight = null; }
  })();
  return inflight;
}

/** Current time on the server's timeline (ms). */
export function serverNow(): number {
  return Date.now() + offsetMs;
}
