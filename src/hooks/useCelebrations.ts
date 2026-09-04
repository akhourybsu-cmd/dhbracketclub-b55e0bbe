// Birthdays & Milestones — React data hooks
//
// Wraps the three plugin tables (member_birthdays, club_milestones,
// club_celebration_settings) and a few derived views. Everything is
// scoped to the current user's active club (read from ClubContext);
// callers don't pass a clubId. RLS gates row visibility, so the hook
// just queries and trusts the policies.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import {
  formatMonthDay, isTodayMD, isTodayDate, nextOccurrenceOf, daysUntil,
} from '@/lib/celebrations/dates';
import { memberData } from '@/lib/memberData';

/* ─── Types ─────────────────────────────────────────────────────── */

export type CelebrationVisibility = 'club' | 'admins_only' | 'hidden';
export type MilestoneRecurrence = 'none' | 'yearly';
export type MilestoneType = 'club_anniversary' | 'member_anniversary' | 'achievement' | 'custom';

export interface MemberBirthday {
  id: string;
  club_id: string;
  user_id: string;
  birth_month: number;
  birth_day: number;
  birth_year: number | null;
  show_age: boolean;
  visibility: CelebrationVisibility;
  reminder_opt_in: boolean;
  created_at: string;
  updated_at: string;
  /** Joined profile — present when read via the listing query. */
  profile?: { display_name: string; avatar_url: string | null } | null;
}

export interface ClubMilestone {
  id: string;
  club_id: string;
  user_id: string | null;
  title: string;
  description: string | null;
  milestone_date: string; // YYYY-MM-DD
  recurrence: MilestoneRecurrence;
  type: MilestoneType;
  created_by: string;
  visibility: CelebrationVisibility;
  created_at: string;
  updated_at: string;
  profile?: { display_name: string; avatar_url: string | null } | null;
}

export interface CelebrationSettings {
  club_id: string;
  show_on_home: boolean;
  show_in_connect: boolean;
  show_on_profiles: boolean;
  reminder_days_before: number;
  day_of_reminder: boolean;
  allow_members_to_add_birthdays: boolean;
  allow_members_to_create_milestones: boolean;
  admins_can_manage_all: boolean;
  auto_generate_connect_prompts: boolean;
  created_at: string;
  updated_at: string;
}

/** Default settings used when a club has no row yet. Matches the DB defaults. */
export const DEFAULT_CELEBRATION_SETTINGS: Omit<CelebrationSettings, 'club_id' | 'created_at' | 'updated_at'> = {
  show_on_home: true,
  show_in_connect: true,
  show_on_profiles: true,
  reminder_days_before: 7,
  day_of_reminder: true,
  allow_members_to_add_birthdays: true,
  allow_members_to_create_milestones: false,
  admins_can_manage_all: true,
  auto_generate_connect_prompts: true,
};

/* ─── Settings hook ─────────────────────────────────────────────── */

export function useCelebrationSettings() {
  const { club, isClubAdmin } = useClub();
  const [settings, setSettings] = useState<CelebrationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!club) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await memberData((supabase as any)
        .from('club_celebration_settings')
        .select('*')
        .eq('club_id', club.id)
        .maybeSingle(), 'Load celebration settings');
      setSettings((data as CelebrationSettings) ?? null);
    } catch (error) {
      console.warn('[useCelebrationSettings] load error', error);
    } finally {
      setLoading(false);
    }
  }, [club?.id]);

  useEffect(() => { load(); }, [load]);

  /** Effective settings — falls back to defaults if no row exists yet. */
  const effective = useMemo<Omit<CelebrationSettings, 'created_at' | 'updated_at' | 'club_id'> | null>(() => {
    if (!club) return null;
    if (settings) {
      const { created_at, updated_at, club_id, ...rest } = settings;
      return rest;
    }
    return DEFAULT_CELEBRATION_SETTINGS;
  }, [club, settings]);

  /** Admin-only: upsert settings. */
  const save = useCallback(
    async (patch: Partial<Omit<CelebrationSettings, 'club_id' | 'created_at' | 'updated_at'>>) => {
      if (!club || !isClubAdmin) return;
      setSaving(true);
      const next = { ...DEFAULT_CELEBRATION_SETTINGS, ...(settings ?? {}), ...patch, club_id: club.id };
      // Optimistic
      setSettings(s => ({ ...(s ?? ({ ...next, created_at: '', updated_at: '' } as CelebrationSettings)), ...patch }));
      try {
        await memberData((supabase as any)
          .from('club_celebration_settings')
          .upsert(next, { onConflict: 'club_id' })
          .select('club_id'), 'Save celebration settings');
      } catch (error) {
        console.warn('[useCelebrationSettings] save error', error);
        // Reload to recover
        void load();
      } finally {
        setSaving(false);
      }
    },
    [club, isClubAdmin, settings, load],
  );

  return { settings: effective, loading, saving, save, refresh: load };
}

/* ─── My birthday hook ──────────────────────────────────────────── */

export function useMyBirthday() {
  const { user } = useAuth();
  const { club } = useClub();
  const [birthday, setBirthday] = useState<MemberBirthday | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user || !club) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await memberData((supabase as any)
        .from('member_birthdays')
        .select('*')
        .eq('club_id', club.id)
        .eq('user_id', user.id)
        .maybeSingle(), 'Load your birthday');
      setBirthday((data as MemberBirthday) ?? null);
    } catch (error) {
      console.warn('[useMyBirthday] load error', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, club?.id]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(
    async (payload: Pick<MemberBirthday, 'birth_month' | 'birth_day'> & Partial<MemberBirthday>) => {
      if (!user || !club) return;
      setSaving(true);
      const row = {
        club_id: club.id,
        user_id: user.id,
        birth_month: payload.birth_month,
        birth_day: payload.birth_day,
        birth_year: payload.birth_year ?? null,
        show_age: payload.show_age ?? false,
        visibility: payload.visibility ?? 'club',
        reminder_opt_in: payload.reminder_opt_in ?? true,
      };
      try {
        const data = await memberData((supabase as any)
          .from('member_birthdays')
          .upsert(row, { onConflict: 'club_id,user_id' })
          .select()
          .single(), 'Save birthday');
        if (data) setBirthday(data as MemberBirthday);
        return true;
      } catch (error) {
        console.warn('[useMyBirthday] save error', error);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [user, club],
  );

  const remove = useCallback(async () => {
    if (!user || !club || !birthday) return;
    setSaving(true);
    try {
      await memberData((supabase as any)
        .from('member_birthdays')
        .delete()
        .eq('id', birthday.id)
        .select('id'), 'Remove birthday');
      setBirthday(null);
    } catch (error) {
      console.warn('[useMyBirthday] remove error', error);
    } finally {
      setSaving(false);
    }
  }, [user, club, birthday]);

  return { birthday, loading, saving, save, remove };
}

/* ─── Club birthdays (visible to caller) ────────────────────────── */

export function useClubBirthdays() {
  const { club } = useClub();
  const [rows, setRows] = useState<MemberBirthday[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!club) { setLoading(false); return; }
    setLoading(true);
    // RLS filters down to rows the caller can see (own + club-visible + admin-only-if-admin).
    try {
      const data = await memberData((supabase as any)
        .from('member_birthdays')
        .select('*, profile:user_id(display_name, avatar_url)')
        .eq('club_id', club.id), 'Load club birthdays');
      setRows(((data as MemberBirthday[]) ?? []).filter(r => r.visibility !== 'hidden'));
    } catch (error) {
      console.warn('[useClubBirthdays] load error', error);
    } finally {
      setLoading(false);
    }
  }, [club?.id]);

  useEffect(() => { load(); }, [load]);

  return { birthdays: rows, loading, refresh: load };
}

/* ─── Club milestones (visible to caller) ───────────────────────── */

export function useClubMilestones() {
  const { club } = useClub();
  const [rows, setRows] = useState<ClubMilestone[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!club) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await memberData((supabase as any)
        .from('club_milestones')
        .select('*, profile:user_id(display_name, avatar_url)')
        .eq('club_id', club.id)
        .order('milestone_date', { ascending: true }), 'Load club milestones');
      setRows(((data as ClubMilestone[]) ?? []).filter(r => r.visibility !== 'hidden'));
    } catch (error) {
      console.warn('[useClubMilestones] load error', error);
    } finally {
      setLoading(false);
    }
  }, [club?.id]);

  useEffect(() => { load(); }, [load]);

  const create = useCallback(
    async (payload: Omit<ClubMilestone, 'id' | 'club_id' | 'created_by' | 'created_at' | 'updated_at' | 'profile'>) => {
      if (!club) return null;
      const { data: userRow } = await (supabase as any).auth.getUser();
      const userId = userRow?.user?.id;
      if (!userId) return null;
      const row = { ...payload, club_id: club.id, created_by: userId };
      try {
        const data = await memberData((supabase as any)
          .from('club_milestones')
          .insert(row)
          .select('*, profile:user_id(display_name, avatar_url)')
          .single(), 'Create milestone');
        setRows(prev => [...prev, data as ClubMilestone]);
        return data as ClubMilestone;
      } catch (error) {
        console.warn('[useClubMilestones] create error', error);
        return null;
      }
    },
    [club],
  );

  const update = useCallback(
    async (id: string, patch: Partial<Omit<ClubMilestone, 'id' | 'club_id' | 'created_at' | 'updated_at' | 'created_by' | 'profile'>>) => {
      try {
        const data = await memberData((supabase as any)
          .from('club_milestones')
          .update(patch)
          .eq('id', id)
          .select('*, profile:user_id(display_name, avatar_url)')
          .single(), 'Update milestone');
        setRows(prev => prev.map(r => r.id === id ? (data as ClubMilestone) : r));
        return data as ClubMilestone;
      } catch (error) {
        console.warn('[useClubMilestones] update error', error);
        return null;
      }
    },
    [],
  );

  const remove = useCallback(async (id: string) => {
    try {
      await memberData((supabase as any).from('club_milestones').delete().eq('id', id).select('id'), 'Delete milestone');
      setRows(prev => prev.filter(r => r.id !== id));
    } catch (error) {
      console.warn('[useClubMilestones] remove error', error);
    }
  }, []);

  return { milestones: rows, loading, refresh: load, create, update, remove };
}

/* ─── Derived: combined upcoming view ───────────────────────────── */

export type UpcomingKind = 'birthday' | 'milestone';
export interface UpcomingCelebration {
  kind: UpcomingKind;
  /** Stable id (birthday row id or milestone id). */
  id: string;
  /** Next occurrence date (already computed). */
  nextDate: Date;
  /** Calendar-day diff from today (0 = today, 1 = tomorrow). */
  daysAway: number;
  /** Display title (member name for birthdays, milestone.title for milestones). */
  title: string;
  /** Optional subline (formatted date, milestone description, etc). */
  subline?: string;
  /** Underlying row for callers that need more detail. */
  birthday?: MemberBirthday;
  milestone?: ClubMilestone;
}

/**
 * Combined "Upcoming" sort across visible birthdays + milestones.
 *   • Birthdays recur yearly, anchored on month/day
 *   • Milestones with recurrence='yearly' recur on their month/day
 *   • One-time milestones (recurrence='none') only appear if their date
 *     is in the future (or today)
 */
export function useUpcomingCelebrations(limit: number = 10) {
  const { birthdays, loading: bLoading } = useClubBirthdays();
  const { milestones, loading: mLoading } = useClubMilestones();
  const loading = bLoading || mLoading;

  const all = useMemo<UpcomingCelebration[]>(() => {
    const out: UpcomingCelebration[] = [];
    const now = new Date();

    for (const b of birthdays) {
      const next = nextOccurrenceOf(b.birth_month, b.birth_day, now);
      const days = daysUntil(next, now);
      out.push({
        kind: 'birthday',
        id: b.id,
        nextDate: next,
        daysAway: days,
        title: b.profile?.display_name ?? 'A member',
        subline: formatMonthDay(b.birth_month, b.birth_day),
        birthday: b,
      });
    }

    for (const m of milestones) {
      const d = new Date(m.milestone_date);
      if (m.recurrence === 'yearly') {
        const next = nextOccurrenceOf(d.getMonth() + 1, d.getDate(), now);
        out.push({
          kind: 'milestone',
          id: m.id,
          nextDate: next,
          daysAway: daysUntil(next, now),
          title: m.title,
          subline: m.description ?? undefined,
          milestone: m,
        });
      } else {
        // one-time — only if today or future
        const daysFromToday = daysUntil(d, now);
        if (daysFromToday >= 0) {
          out.push({
            kind: 'milestone',
            id: m.id,
            nextDate: d,
            daysAway: daysFromToday,
            title: m.title,
            subline: m.description ?? undefined,
            milestone: m,
          });
        }
      }
    }

    return out.sort((a, b) => a.daysAway - b.daysAway).slice(0, limit);
  }, [birthdays, milestones, limit]);

  return { upcoming: all, loading };
}

/** Convenience — what's today, if anything. */
export function useTodayCelebrations() {
  const { upcoming, loading } = useUpcomingCelebrations(50);
  const today = useMemo(
    () => upcoming.filter(c => c.daysAway === 0),
    [upcoming],
  );
  return { today, loading };
}

/** True iff there's at least one birthday OR milestone the user can see. */
export function useHasAnyCelebrations() {
  const { birthdays, loading: bLoading } = useClubBirthdays();
  const { milestones, loading: mLoading } = useClubMilestones();
  return {
    hasAny: birthdays.length > 0 || milestones.length > 0,
    loading: bLoading || mLoading,
  };
}

/** Filter milestones into past vs upcoming based on `now`. */
export function partitionMilestonesByTime(milestones: ClubMilestone[], now: Date = new Date()) {
  const past: ClubMilestone[] = [];
  const upcoming: ClubMilestone[] = [];
  for (const m of milestones) {
    if (m.recurrence === 'yearly') {
      // Recurring milestones never go "past"
      upcoming.push(m);
      continue;
    }
    const d = new Date(m.milestone_date);
    if (isTodayDate(d, now) || daysUntil(d, now) > 0) upcoming.push(m);
    else past.push(m);
  }
  return { past, upcoming };
}

/** Returns true if (month, day) is today — re-exported for components. */
export { isTodayMD };
