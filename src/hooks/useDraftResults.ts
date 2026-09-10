import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { recalculateSeasonStandings } from '@/hooks/useDraftSeasons';
import { isAiRateLimited, AI_RATE_LIMIT_MESSAGE } from '@/lib/aiQuota';
import { isCompleteDraftReport } from '@/lib/draft/resultIntegrity';

interface PickRating {
  pick_id: string;
  pick_text: string;
  score: number;
  explanation: string;
}

export interface DraftResult {
  id: string;
  draft_id: string;
  user_id: string;
  rank: number;
  total_score: number;
  pick_ratings: PickRating[];
  summary: string | null;
  points_awarded: number;
  created_at: string;
}

export function useDraftResults(draftId: string | undefined) {
  const [results, setResults] = useState<DraftResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [hasResults, setHasResults] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [resultsVerificationFailed, setResultsVerificationFailed] = useState(false);

  const fetchResults = useCallback(async () => {
    if (!draftId) return false;
    setLoading(true);
    try {
      const [resultsResponse, participantsResponse, picksResponse] = await Promise.all([
        supabase.from('draft_results' as any).select('*').eq('draft_id', draftId).order('rank'),
        supabase.from('draft_participants').select('user_id').eq('draft_id', draftId),
        supabase.from('draft_picks').select('id, user_id').eq('draft_id', draftId),
      ]);
      if (resultsResponse.error) throw resultsResponse.error;
      if (participantsResponse.error) throw participantsResponse.error;
      if (picksResponse.error) throw picksResponse.error;

      const typed = (resultsResponse.data || []) as unknown as DraftResult[];
      const complete = isCompleteDraftReport(
        typed,
        (participantsResponse.data || []).map(participant => participant.user_id),
        picksResponse.data || [],
      );
      setResultsVerificationFailed(false);
      setResults(typed);
      setHasResults(complete);
      if (complete) {
        setGenerationError(null);
      } else if (typed.length > 0) {
        setGenerationError(current => current || 'The saved report is incomplete. Regenerate it to restore every score.');
      } else {
        setGenerationError(null);
      }
      return complete;
    } catch (err) {
      console.error('Failed to fetch draft results:', err);
      setResultsVerificationFailed(true);
      setGenerationError('The saved draft report could not be verified. Check your connection, then retry.');
      return false;
    } finally {
      setLoading(false);
    }
  }, [draftId]);

  useEffect(() => {
    setResults([]);
    setHasResults(false);
    setGenerationError(null);
    setResultsVerificationFailed(false);
  }, [draftId]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const generateResults = useCallback(async () => {
    if (!draftId) return;

    // Guard against concurrent/duplicate report generation
    if (hasResults) {
      console.log('Results already exist, skipping generation');
      return;
    }

    setGenerating(true);
    setGenerationError(null);
    try {
      const { data, error } = await supabase.functions.invoke('rate-draft', {
        body: { draft_id: draftId },
      });

      if (isAiRateLimited(data, error)) {
        setGenerationError(AI_RATE_LIMIT_MESSAGE);
        toast.error(AI_RATE_LIMIT_MESSAGE);
        return;
      }
      if (error) throw error;

      if (data?.error) {
        setGenerationError(data.error);
        toast.error(data.error);
        return;
      }

      const complete = await fetchResults();
      if (!complete) throw new Error('The generated report was incomplete. Your previous scores were preserved.');
      toast.success('Draft Report generated! 🏆');

      // Auto-recalculate season standings if draft belongs to a season (client-side fallback)
      try {
        const { data: entry } = await supabase
          .from('draft_season_entries' as any)
          .select('season_id')
          .eq('draft_id', draftId)
          .maybeSingle();
        if ((entry as any)?.season_id) {
          await recalculateSeasonStandings((entry as any).season_id);
        }
      } catch (seasonErr) {
        console.error('Client-side season recalc failed (non-fatal):', seasonErr);
      }
    } catch (err: any) {
      const msg = err?.message || 'Failed to generate report';
      setGenerationError(msg);
      toast.error(msg);
      console.error('Generate results error:', err);
    } finally {
      setGenerating(false);
    }
  }, [draftId, fetchResults, hasResults]);

  const regenerateResults = useCallback(async () => {
    if (!draftId) return;
    setGenerating(true);
    setGenerationError(null);
    try {
      const { data, error } = await supabase.functions.invoke('rate-draft', {
        body: { draft_id: draftId },
      });
      if (isAiRateLimited(data, error)) {
        setGenerationError(AI_RATE_LIMIT_MESSAGE);
        toast.error(AI_RATE_LIMIT_MESSAGE);
        return;
      }
      if (error) throw error;
      if (data?.error) {
        setGenerationError(data.error);
        toast.error(data.error);
        return;
      }
      const complete = await fetchResults();
      if (!complete) throw new Error('The regenerated report was incomplete. Your previous scores were preserved.');
      toast.success('Draft Report regenerated! 🏆');
      try {
        const { data: entry } = await supabase
          .from('draft_season_entries' as any)
          .select('season_id')
          .eq('draft_id', draftId)
          .maybeSingle();
        if ((entry as any)?.season_id) {
          await recalculateSeasonStandings((entry as any).season_id);
        }
      } catch (seasonErr) {
        console.error('Client-side season recalc failed (non-fatal):', seasonErr);
      }
    } catch (err: any) {
      const msg = err?.message || 'Failed to regenerate report';
      setGenerationError(msg);
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  }, [draftId, fetchResults]);

  return {
    results,
    loading,
    generating,
    hasResults,
    generationError,
    resultsVerificationFailed,
    generateResults,
    regenerateResults,
    fetchResults,
  };
}
