import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { QUERY_TIMEOUT_MS, withTimeout } from '@/lib/asyncGuards';
import { buildUserScopedPath, mimeForExt, validateImageFile } from '@/lib/uploadValidation';
import { localDayKey, type DailyFind, type FindKind } from '@/lib/dailyFind';

const BUCKET = 'daily-finds';
const SELECT = '*, profiles:user_id(id, display_name, avatar_url), reactions:daily_find_reactions(emoji, user_id), comments:daily_find_comments(count)';
const db = supabase as any;

async function run<T>(q: PromiseLike<{ data: T; error: any }>, label: string): Promise<T> {
  const { data, error } = await withTimeout(Promise.resolve(q), QUERY_TIMEOUT_MS, label);
  if (error) throw new Error(error.message || `${label} failed`);
  return data;
}

/** All club finds in a date range (inclusive day keys). */
export function useDailyFinds(range: { from: string; to: string }) {
  const { club } = useClub();
  return useQuery({
    queryKey: ['daily-finds', club?.id, range.from, range.to],
    enabled: !!club?.id,
    queryFn: async () => {
      const data = await run(db.from('daily_finds').select(SELECT)
        .eq('club_id', club!.id).gte('find_date', range.from).lte('find_date', range.to)
        .order('find_date', { ascending: false }).order('created_at', { ascending: false }).limit(500), 'Load finds');
      return (data ?? []) as DailyFind[];
    },
  });
}

/** Full-archive search by text or tag. */
export function useSearchFinds(term: string, tag: string | null) {
  const { club } = useClub();
  const active = term.trim().length >= 2 || !!tag;
  return useQuery({
    queryKey: ['daily-finds-search', club?.id, term, tag],
    enabled: !!club?.id && active,
    queryFn: async () => {
      let q = db.from('daily_finds').select(SELECT).eq('club_id', club!.id);
      const t = term.trim().replace(/[%,()]/g, ' ');
      if (t.length >= 2) q = q.or(`title.ilike.%${t}%,note.ilike.%${t}%`);
      if (tag) q = q.contains('tags', [tag]);
      const data = await run(q.order('find_date', { ascending: false }).limit(100), 'Search finds');
      return (data ?? []) as DailyFind[];
    },
  });
}

export function useDailyFind(id: string | undefined) {
  return useQuery({
    queryKey: ['daily-find', id],
    enabled: !!id,
    queryFn: async () => (await run(db.from('daily_finds').select(SELECT).eq('id', id).maybeSingle(), 'Load find')) as DailyFind | null,
  });
}

export function useFindComments(findId: string | undefined) {
  return useQuery({
    queryKey: ['daily-find-comments', findId],
    enabled: !!findId,
    queryFn: async () => (await run(db.from('daily_find_comments')
      .select('id, body, created_at, user_id, profiles:user_id(display_name, avatar_url)')
      .eq('find_id', findId).order('created_at'), 'Load comments')) as {
        id: string; body: string; created_at: string; user_id: string;
        profiles: { display_name: string; avatar_url: string | null } | null;
      }[],
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return (findId?: string) => {
    qc.invalidateQueries({ queryKey: ['daily-finds'] });
    qc.invalidateQueries({ queryKey: ['daily-finds-search'] });
    if (findId) {
      qc.invalidateQueries({ queryKey: ['daily-find', findId] });
      qc.invalidateQueries({ queryKey: ['daily-find-comments', findId] });
    }
  };
}

export interface NewFindInput {
  kind: FindKind;
  title: string;
  note?: string;
  url?: string;
  tags: string[];
  image?: File | null;
}

export function useCreateFind() {
  const { user } = useAuth();
  const { club } = useClub();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: NewFindInput) => {
      if (!user || !club) throw new Error('Not signed in');
      let image_path: string | null = null;
      if (input.image) {
        const v = validateImageFile(input.image, { maxBytes: 10 * 1024 * 1024, label: 'Photo' });
        if (!v.ok) throw new Error(v.error);
        const path = `${club.id}/${buildUserScopedPath(user.id, v.ext!)}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, input.image, {
          contentType: input.image.type || mimeForExt(v.ext!), upsert: false,
        });
        if (error) throw new Error('Photo upload failed');
        image_path = path;
      }
      const { data, error } = await db.from('daily_finds').insert({
        club_id: club.id, user_id: user.id, find_date: localDayKey(),
        kind: input.kind, title: input.title.trim(), note: input.note?.trim() || null,
        url: input.url?.trim() || null, image_path, tags: input.tags,
      }).select('id').single();
      if (error) {
        if (image_path) void supabase.storage.from(BUCKET).remove([image_path]);
        throw new Error(error.message);
      }
      return data as { id: string };
    },
    onSuccess: () => invalidate(),
  });
}

export function useDeleteFind() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (find: DailyFind) => {
      await run(db.from('daily_finds').delete().eq('id', find.id), 'Delete find');
      if (find.image_path) void supabase.storage.from(BUCKET).remove([find.image_path]);
    },
    onSuccess: () => invalidate(),
  });
}

export function useToggleFindReaction() {
  const { user } = useAuth();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ findId, emoji, has }: { findId: string; emoji: string; has: boolean }) => {
      if (!user) throw new Error('Not signed in');
      if (has) await run(db.from('daily_find_reactions').delete().eq('find_id', findId).eq('user_id', user.id).eq('emoji', emoji), 'Remove reaction');
      else await run(db.from('daily_find_reactions').insert({ find_id: findId, user_id: user.id, emoji }), 'Add reaction');
    },
    onSuccess: (_d, v) => invalidate(v.findId),
  });
}

export function useAddFindComment() {
  const { user } = useAuth();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ findId, body }: { findId: string; body: string }) => {
      if (!user) throw new Error('Not signed in');
      await run(db.from('daily_find_comments').insert({ find_id: findId, user_id: user.id, body: body.trim() }), 'Post comment');
    },
    onSuccess: (_d, v) => invalidate(v.findId),
  });
}

export function useDeleteFindComment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id }: { id: string; findId: string }) => { await run(db.from('daily_find_comments').delete().eq('id', id), 'Delete comment'); },
    onSuccess: (_d, v) => invalidate(v.findId),
  });
}

// Signed photo URLs (private bucket), cached per path.
const urlCache = new Map<string, { url: string; exp: number }>();
export function useFindImageUrl(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(() => (path && urlCache.get(path)?.url) || null);
  useEffect(() => {
    if (!path) { setUrl(null); return; }
    const hit = urlCache.get(path);
    if (hit && hit.exp > Date.now() + 60_000) { setUrl(hit.url); return; }
    let alive = true;
    void supabase.storage.from(BUCKET).createSignedUrl(path, 3600).then(({ data }) => {
      if (!alive || !data?.signedUrl) return;
      urlCache.set(path, { url: data.signedUrl, exp: Date.now() + 3600_000 });
      setUrl(data.signedUrl);
    });
    return () => { alive = false; };
  }, [path]);
  return url;
}
