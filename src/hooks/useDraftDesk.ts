import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { QUERY_TIMEOUT_MS, withTimeout } from '@/lib/asyncGuards';

export interface DraftDeskItem {
  id: string;
  draft_id: string;
  user_id: string;
  title: string;
  notes: string | null;
  position: number;
  is_favorite: boolean;
  is_on_deck: boolean;
  created_at: string;
  updated_at: string;
}

export function useDraftDesk(draftId?: string, userId?: string) {
  const [items, setItems] = useState<DraftDeskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);

  const refresh = useCallback(async () => {
    if (!draftId || !userId) { setItems([]); setLoading(false); return; }
    setError(null);
    try {
      const query = (supabase as any).from('draft_desk_items').select('*').eq('draft_id', draftId).order('position').order('created_at');
      const { data, error: queryError } = await withTimeout<any>(query, QUERY_TIMEOUT_MS, 'draft desk');
      if (queryError) throw queryError;
      setItems((data ?? []) as DraftDeskItem[]);
    } catch (err: any) {
      setError(err?.message || 'Could not load your draft desk.');
    } finally {
      setLoading(false);
    }
  }, [draftId, userId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const add = useCallback(async (title: string, notes?: string) => {
    if (!draftId || !userId) return;
    const temp: DraftDeskItem = {
      id: `temp-${crypto.randomUUID()}`, draft_id: draftId, user_id: userId,
      title: title.trim(), notes: notes?.trim() || null, position: itemsRef.current.length,
      is_favorite: false, is_on_deck: itemsRef.current.length === 0,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    const snapshot = itemsRef.current;
    setItems([...snapshot, temp]);
    try {
      const { data, error: insertError } = await (supabase as any).from('draft_desk_items').insert({
        draft_id: draftId, user_id: userId, title: temp.title, notes: temp.notes,
        position: temp.position, is_on_deck: temp.is_on_deck,
      }).select().single();
      if (insertError) throw insertError;
      setItems(current => current.map(item => item.id === temp.id ? data as DraftDeskItem : item));
    } catch (err) {
      setItems(snapshot);
      throw err;
    }
  }, [draftId, userId]);

  const patch = useCallback(async (id: string, values: Partial<Pick<DraftDeskItem, 'title' | 'notes' | 'is_favorite' | 'is_on_deck' | 'position'>>) => {
    const snapshot = itemsRef.current;
    let next = snapshot.map(item => item.id === id ? { ...item, ...values } : values.is_on_deck ? { ...item, is_on_deck: false } : item);
    next = [...next].sort((a, b) => a.position - b.position);
    setItems(next);
    try {
      if (values.is_on_deck) {
        const { error: clearError } = await (supabase as any).from('draft_desk_items').update({ is_on_deck: false }).eq('draft_id', draftId).neq('id', id);
        if (clearError) throw clearError;
      }
      const { error: updateError } = await (supabase as any).from('draft_desk_items').update(values).eq('id', id);
      if (updateError) throw updateError;
    } catch (err) {
      setItems(snapshot);
      throw err;
    }
  }, [draftId]);

  const remove = useCallback(async (id: string) => {
    const snapshot = itemsRef.current;
    setItems(snapshot.filter(item => item.id !== id));
    try {
      const { error: deleteError } = await (supabase as any).from('draft_desk_items').delete().eq('id', id);
      if (deleteError) throw deleteError;
    } catch (err) { setItems(snapshot); throw err; }
  }, []);

  const move = useCallback(async (id: string, direction: -1 | 1) => {
    const current = itemsRef.current;
    const index = current.findIndex(item => item.id === id);
    const swap = index + direction;
    if (index < 0 || swap < 0 || swap >= current.length) return;
    const next = [...current];
    [next[index], next[swap]] = [next[swap], next[index]];
    const ranked = next.map((item, position) => ({ ...item, position }));
    setItems(ranked);
    try {
      const results = await Promise.all(ranked.map(item => (supabase as any).from('draft_desk_items').update({ position: item.position }).eq('id', item.id)));
      const failed = results.find(result => result.error);
      if (failed?.error) throw failed.error;
    } catch (err) { setItems(current); throw err; }
  }, []);

  return { items, loading, error, refresh, add, patch, remove, move };
}