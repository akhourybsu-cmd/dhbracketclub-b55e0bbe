import { supabase } from '@/integrations/supabase/client';
import { QUERY_TIMEOUT_MS, withTimeout } from '@/lib/asyncGuards';
import type { LiveDraftSettings } from '@/lib/draft/liveDraft';

export interface LiveRoomSummary {
  id: string;
  topic: string;
  status: string;
  num_rounds: number;
  created_by: string;
  created_at: string;
  kiosk_code: string | null;
}

export interface ResolvedLiveRoom {
  id: string;
  topic: string;
  status: string;
}

export const LIVE_ROOM_UNAVAILABLE_MESSAGE = 'That live room is unavailable. Check the code and your active club.';
const LIVE_ROOMS_LOAD_ERROR = 'Live drafts could not be loaded. Try again.';
const LIVE_LOBBY_SAVE_ERROR = 'Live lobby settings could not be saved. Try again.';
// The same unambiguous alphabet used by newKioskCode; do not guess 0/O or 1/I.
const LIVE_CODE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/;
const SUMMARY_FIELDS = 'id,topic,status,num_rounds,created_by,created_at,kiosk_code';

export function normalizeLiveCode(value: string): string {
  return value.trim().toUpperCase();
}

/** Resolve a destination only. Joining still uses the room's existing rules. */
export async function resolveLiveRoom(code: string, clubId: string): Promise<ResolvedLiveRoom> {
  const normalized = normalizeLiveCode(code);
  const club = clubId.trim();
  if (!LIVE_CODE.test(normalized) || !club) throw new Error(LIVE_ROOM_UNAVAILABLE_MESSAGE);
  try {
    const { data, error } = await withTimeout(
      supabase.from('drafts').select('id,topic,status')
        .eq('club_id', club).eq('is_live', true).eq('kiosk_code', normalized).maybeSingle(),
      QUERY_TIMEOUT_MS,
      'live room lookup',
    );
    if (error || !data) throw new Error(LIVE_ROOM_UNAVAILABLE_MESSAGE);
    return { id: data.id, topic: data.topic, status: data.status };
  } catch {
    // Invalid, absent, unauthorized and failed lookups disclose the same result.
    throw new Error(LIVE_ROOM_UNAVAILABLE_MESSAGE);
  }
}

/** Authenticated, RLS-protected club list. A code does not grant membership. */
export async function fetchLiveRooms(clubId: string): Promise<LiveRoomSummary[]> {
  const club = clubId.trim();
  if (!club) throw new Error(LIVE_ROOMS_LOAD_ERROR);
  try {
    const { data, error } = await withTimeout(
      supabase.from('drafts').select(SUMMARY_FIELDS)
        .eq('club_id', club).eq('is_live', true)
        .order('created_at', { ascending: false }).limit(50),
      QUERY_TIMEOUT_MS,
      'live rooms list',
    );
    if (error) throw error;
    return (data ?? []).map(room => ({
      id: room.id, topic: room.topic, status: room.status, num_rounds: room.num_rounds,
      created_by: room.created_by, created_at: room.created_at, kiosk_code: room.kiosk_code,
    }));
  } catch {
    throw new Error(LIVE_ROOMS_LOAD_ERROR);
  }
}

/** Setup-only settings keep the ceremony flag and synchronized model atomic. */
export async function saveLiveLobbySettings(draftId: string, clubId: string, settings: LiveDraftSettings): Promise<void> {
  const id = draftId.trim();
  const club = clubId.trim();
  if (!id || !club) throw new Error(LIVE_LOBBY_SAVE_ERROR);
  try {
    const { data, error } = await withTimeout(
      supabase.from('drafts')
        .update({ live_settings: { ...settings }, ceremony_enabled: settings.ceremony })
        .eq('id', id).eq('club_id', club).eq('status', 'setup')
        .select('id').single(),
      QUERY_TIMEOUT_MS,
      'live lobby settings save',
    );
    if (error || !data) throw new Error(LIVE_LOBBY_SAVE_ERROR);
  } catch {
    throw new Error(LIVE_LOBBY_SAVE_ERROR);
  }
}
