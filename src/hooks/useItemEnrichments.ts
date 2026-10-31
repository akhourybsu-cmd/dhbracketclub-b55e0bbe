import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export interface ItemEnrichment {
  id: string;
  item_id: string;
  item_type: string;
  category: string | null;
  normalized_name: string | null;
  matched_name: string | null;
  image_url: string | null;
  thumbnail_url: string | null;
  source_provider: string | null;
  confidence: number;
  // Provider facts are shared with existing judging and ranking consumers.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any>;
  status: 'pending' | 'matched' | 'low_confidence' | 'placeholder' | 'manual';
}

export function useItemEnrichments(itemIds: string[], itemType = 'ranking_item') {
  const { user } = useAuth();
  const idsKey = JSON.stringify(itemIds);
  const ids = useMemo(() => JSON.parse(idsKey) as string[], [idsKey]);
  const scope = `${user?.id ?? 'guest'}:${itemType}:${idsKey}`;
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const request = useRef(0);
  const empty = useMemo(() => new Map<string, ItemEnrichment>(), []);
  const [snapshot, setSnapshot] = useState({ scope, enrichments: empty, loading: false });
  useEffect(() => () => { request.current++; }, []);

  const fetchEnrichments = useCallback(async () => {
    const generation = ++request.current;
    if (!ids.length || !user?.id) {
      setSnapshot({ scope, enrichments: new Map(), loading: false });
      return;
    }
    setSnapshot((previous) => ({ scope, enrichments: previous.scope === scope ? previous.enrichments : new Map(), loading: true }));
    try {
      const { data, error } = await supabase
        .from('item_enrichments')
        .select('*')
        .in('item_id', ids)
        .eq('item_type', itemType);

      if (error) throw error;
      const map = new Map<string, ItemEnrichment>();
      (data || []).forEach((row) => {
        const e = row as unknown as ItemEnrichment;
        map.set(e.item_id, {
          ...e,
          confidence: Number.parseFloat(String(e.confidence)) || 0,
          metadata: e.metadata || {},
        });
      });
      if (generation === request.current && currentScope.current === scope)
        setSnapshot({ scope, enrichments: map, loading: false });
    } catch (error) {
      if (generation === request.current && currentScope.current === scope)
        console.error('Failed to fetch enrichments:', error);
    } finally {
      if (generation === request.current && currentScope.current === scope)
        setSnapshot((previous) => ({ ...previous, loading: false }));
    }
  }, [ids, itemType, scope, user?.id]);

  return { enrichments: snapshot.scope === scope ? snapshot.enrichments : empty, loading: snapshot.scope === scope && snapshot.loading, fetchEnrichments };
}

export function useEnrichRanking() {
  const [enriching, setEnriching] = useState(false);

  const enrichRanking = useCallback(async (rankingId: string) => {
    setEnriching(true);
    try {
      const { data, error } = await supabase.functions.invoke('enrich-ranking', {
        body: { ranking_id: rankingId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    } catch (err) {
      console.error('Enrichment failed:', err);
      toast.error('Failed to enrich items');
      return null;
    } finally {
      setEnriching(false);
    }
  }, []);

  return { enriching, enrichRanking };
}

export function useEnrichDraftPicks() {
  const [enriching, setEnriching] = useState(false);

  const enrichDraftPicks = useCallback(async (draftId: string, pickIds?: string[]) => {
    setEnriching(true);
    try {
      const { data, error } = await supabase.functions.invoke('enrich-draft-picks', {
        body: { draft_id: draftId, pick_ids: pickIds },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    } catch (err) {
      console.error('Draft enrichment failed:', err);
      return null;
    } finally {
      setEnriching(false);
    }
  }, []);

  return { enriching, enrichDraftPicks };
}
