import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Bookmark, Users, Play, Send, Trophy, RefreshCw, Sparkles, MoreVertical, Pencil, Trash2, X, Star, ChevronDown, ChevronUp, Award, AlertTriangle, Check, Flame, Flag, Loader2, Crown } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { usePickSuggestion } from '@/hooks/usePickSuggestion';
import { useClubAI } from '@/hooks/useClubAI';
import { cn } from '@/lib/utils';
import { useDraftUpdates } from '@/hooks/useRealtimeSubscription';
import { useItemEnrichments, useEnrichDraftPicks } from '@/hooks/useItemEnrichments';
import EnrichedItemCard, { EnrichedItemSkeleton } from '@/components/EnrichedItemCard';
import ImagePickerDialog from '@/components/draft/ImagePickerDialog';
import { useDraftResults } from '@/hooks/useDraftResults';
import { Skeleton } from '@/components/ui/skeleton';
import { getDerivedDraftTurn } from '@/lib/draftTurn';
import { getSeasonJoinEligibility } from '@/lib/draft/seasonEligibility';
import { Confetti } from '@/components/Confetti';
import { OnTheClockTimer } from '@/components/draft/OnTheClockTimer';
import { DraftOrderStrip } from '@/components/draft/DraftOrderStrip';
import { PickAnnouncement } from '@/components/draft/PickAnnouncement';
import { DraftStatsCard } from '@/components/draft/DraftStatsCard';
import { findMvpPick, findScoringStreaks, computePickTimings, formatDuration } from '@/lib/draftStats';
import { useCountUp, useFirstSeen } from '@/lib/draft/animations';
import {
  useCurrentSeason,
  useSeasonEntries,
  useIsCommissioner,
  addDraftToSeason,
  removeDraftFromSeason,
  recalculateSeasonStandings,
  advancePlayoffs,
} from '@/hooks/useDraftSeasons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PlayoffHeaderBanner } from '@/components/draft/PlayoffHeaderBanner';
import { PlayoffBadge } from '@/components/draft/PlayoffBadge';
import { PlayoffMatchupHero } from '@/components/draft/PlayoffMatchupHero';
import { getPlayoffRoundShort, getPlayoffRoundName } from '@/lib/playoffStyle';
import { DraftAiContextCard } from '@/components/draft/DraftAiContextCard';
import { JudgingScopeButton } from '@/components/draft/JudgingScopeButton';
import { DraftChannelInviteButton } from '@/components/draft/DraftChannelInviteButton';

interface Participant {
  id: string;
  user_id: string;
  pick_order: number;
  profiles?: { display_name: string };
}

interface Pick {
  id: string;
  user_id: string;
  pick_text: string;
  pick_number: number;
  round: number;
  picked_at?: string;
  profiles?: { display_name: string };
}

function PickCount({ value }: { value: number }) {
  const animated = useCountUp(value, 500);
  return <>{Math.round(animated)}</>;
}

export default function DraftDetailPage() {
  const { draftId } = useParams<{ draftId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<any>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickText, setPickText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [enrichingPickIds, setEnrichingPickIds] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pickToRemove, setPickToRemove] = useState<Pick | null>(null);
  const [removingPick, setRemovingPick] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTopic, setEditTopic] = useState('');
  const [saving, setSaving] = useState(false);
  const [imagePickerPick, setImagePickerPick] = useState<Pick | null>(null);
  const [editingPickId, setEditingPickId] = useState<string | null>(null);
  const [editPickText, setEditPickText] = useState('');
  const [savingPick, setSavingPick] = useState(false);
  const [expandedResultUser, setExpandedResultUser] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiShown = useRef(false);
  const pickInputRef = useRef<HTMLInputElement>(null);
  const [announcement, setAnnouncement] = useState<{ displayName: string; pickText: string; round: number; pickNumber: number } | null>(null);
  const [seasonActionBusy, setSeasonActionBusy] = useState(false);
  const [seasonRosterLocked, setSeasonRosterLocked] = useState(false);
  const [seasonJoinEligible, setSeasonJoinEligible] = useState(true);

  const { season } = useCurrentSeason();
  const { entries: seasonEntries, refetch: refetchSeasonEntries } = useSeasonEntries(season?.id);
  const isCommissioner = useIsCommissioner(season);
  const seasonEntry = seasonEntries.find(e => e.draft_id === draftId);
  const isPlayoffDraft = !!seasonEntry?.is_playoff;

  // Playoff match info (round + series state for champion banner)
  const [playoffMatch, setPlayoffMatch] = useState<any>(null);
  const [finalsSeriesWins, setFinalsSeriesWins] = useState<Record<string, number>>({});
  const playoffsAdvanced = useRef(false);

  const { results: draftResults, loading: resultsLoading, generating: resultsGenerating, hasResults, generateResults, regenerateResults, fetchResults } = useDraftResults(draftId);

  const [autoTriggered, setAutoTriggered] = useState(false);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [disputeDialogPick, setDisputeDialogPick] = useState<{ pick_id: string; pick_text: string; score: number; explanation: string } | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [submittingDispute, setSubmittingDispute] = useState(false);
  const [resolvingDisputeId, setResolvingDisputeId] = useState<string | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{ id: string; pickText: string; reason: string } | null>(null);
  const [rejectRationale, setRejectRationale] = useState('');
  const [rejectingDispute, setRejectingDispute] = useState(false);
  const [expandedRationales, setExpandedRationales] = useState<Set<string>>(new Set());
  const pickIds = picks.map(p => p.id);
  const freshPickIds = useFirstSeen(pickIds);
  const { enrichments, loading: enrichmentsLoading, fetchEnrichments } = useItemEnrichments(pickIds, 'draft_pick');
  const { enriching, enrichDraftPicks } = useEnrichDraftPicks();

  const existingPickTexts = picks.map(p => p.pick_text);
  const { aiEnabled } = useClubAI();
  const { suggestion, localDuplicate, setText, runCheck, needsCheck, clearSuggestion } = usePickSuggestion(
    draft?.topic || '',
    null, // no sub-category — title-only judging
    existingPickTexts,
    draft?.ai_context || null,
    draft?.ai_context_override || null,
  );

  const fetchData = useCallback(async () => {
    if (!draftId || !user) return;

    const [{ data: draftData }, { data: partData }, { data: pickData }, eligibility] = await Promise.all([
      supabase.from('drafts').select('*, competitions(title, status), profiles:created_by(display_name)').eq('id', draftId).single(),
      supabase.from('draft_participants').select('*, profiles:user_id(display_name)').eq('draft_id', draftId).order('pick_order'),
      supabase.from('draft_picks').select('*, profiles:user_id(display_name)').eq('draft_id', draftId).order('pick_number'),
      getSeasonJoinEligibility(draftId, user.id).catch(() => ({ isSeasonDraft: false, rosterLocked: false, eligible: true })),
    ]);

    if (draftData) {
      setDraft(draftData);
      setEditTopic(draftData.topic);
    }
    if (partData) setParticipants(partData);
    if (pickData) setPicks(pickData);
    setSeasonRosterLocked(eligibility.rosterLocked);
    setSeasonJoinEligible(eligibility.eligible);
    setLoading(false);
  }, [draftId, user]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (picks.length) fetchEnrichments(); }, [picks.length, fetchEnrichments]);

  // Detect new picks for announcement banner
  const prevPickCountRef = useRef(0);
  useEffect(() => {
    if (picks.length > prevPickCountRef.current && prevPickCountRef.current > 0) {
      const latestPick = picks[picks.length - 1]; // picks are ordered by pick_number
      if (latestPick && latestPick.user_id !== user?.id) {
        setAnnouncement({
          displayName: latestPick.profiles?.display_name || 'Someone',
          pickText: latestPick.pick_text,
          round: latestPick.round,
          pickNumber: latestPick.pick_number,
        });
      }
    }
    prevPickCountRef.current = picks.length;
  }, [picks.length, user?.id]);

  // Realtime: auto-refresh on picks, participants, or draft status changes
  const { status: realtimeStatus } = useDraftUpdates(draftId, fetchData);

  const isCreator = draft?.created_by === user?.id;
  const [isAppAdmin, setIsAppAdmin] = useState(false);
  const isParticipant = participants.some(p => p.user_id === user?.id);
  const canManage = isCreator || isAppAdmin;

  useEffect(() => {
    if (!user?.id) return;
    supabase.rpc('is_app_admin', { _user_id: user.id }).then(({ data }) => {
      setIsAppAdmin(!!data);
    });
  }, [user?.id]);

  // Auto-generate report when draft is complete and no results exist (any participant can trigger)
  useEffect(() => {
    if (draft?.status === 'complete' && !hasResults && !resultsLoading && !resultsGenerating && !autoTriggered && isParticipant) {
      setAutoTriggered(true);
      generateResults();
    }
  }, [draft?.status, hasResults, resultsLoading, resultsGenerating, autoTriggered, isParticipant, generateResults]);

  // Confetti on first results load
  useEffect(() => {
    if (hasResults && !confettiShown.current) {
      confettiShown.current = true;
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [hasResults]);

  // Fetch playoff match info for this draft (if it's a playoff draft)
  useEffect(() => {
    if (!draftId || !isPlayoffDraft || !season?.id) return;
    let cancelled = false;
    (async () => {
      const { data: match } = await supabase
        .from('draft_playoff_matches' as any)
        .select('*')
        .eq('draft_id', draftId)
        .maybeSingle();
      if (cancelled || !match) return;
      setPlayoffMatch(match);
      if ((match as any).round === 'final') {
        const { data: finals } = await supabase
          .from('draft_playoff_matches' as any)
          .select('winner_user_id, status')
          .eq('season_id', season.id)
          .eq('round', 'final');
        if (cancelled) return;
        const wins: Record<string, number> = {};
        (finals || []).forEach((f: any) => {
          if (f.status === 'complete' && f.winner_user_id) {
            wins[f.winner_user_id] = (wins[f.winner_user_id] || 0) + 1;
          }
        });
        setFinalsSeriesWins(wins);
      }
    })();
    return () => { cancelled = true; };
  }, [draftId, isPlayoffDraft, season?.id, hasResults, draft?.status]);

  // Auto-advance playoffs whenever a playoff draft is complete (idempotent server-side)
  useEffect(() => {
    if (!isPlayoffDraft || !season?.id || playoffsAdvanced.current) return;
    if (draft?.status !== 'complete' || !hasResults) return;
    playoffsAdvanced.current = true;
    advancePlayoffs(season.id).catch(err => console.error('advancePlayoffs failed:', err));
  }, [isPlayoffDraft, season?.id, draft?.status, hasResults]);

  // Fetch disputes for this draft
  const fetchDisputes = useCallback(async () => {
    if (!draftId) return;
    const { data } = await supabase
      .from('draft_pick_disputes' as any)
      .select('*')
      .eq('draft_id', draftId)
      .order('created_at', { ascending: false });
    if (data) setDisputes(data as any[]);
  }, [draftId]);

  useEffect(() => {
    if (hasResults) fetchDisputes();
  }, [hasResults, fetchDisputes]);

  const handleSubmitDispute = async () => {
    if (!disputeDialogPick || !disputeReason.trim() || !user || !draftId) return;
    setSubmittingDispute(true);
    try {
      const { error } = await supabase.from('draft_pick_disputes' as any).insert({
        draft_id: draftId,
        pick_id: disputeDialogPick.pick_id,
        user_id: user.id,
        reason: disputeReason.trim(),
      } as any);
      if (error) throw error;
      toast.success('Dispute submitted for review');
      setDisputeDialogPick(null);
      setDisputeReason('');
      fetchDisputes();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit dispute');
    } finally {
      setSubmittingDispute(false);
    }
  };

  const handleResolveDispute = async (disputeId: string) => {
    setResolvingDisputeId(disputeId);
    try {
      const { data, error } = await supabase.functions.invoke('resolve-pick-dispute', {
        body: { dispute_id: disputeId },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      const scoreChange = data.old_score !== data.new_score
        ? `Score: ${data.old_score} → ${data.new_score}`
        : 'Score unchanged';
      toast.success(`Pick re-evaluated! ${scoreChange}`);
      fetchDisputes();
      fetchResults();
    } catch (err: any) {
      toast.error(err.message || 'Failed to resolve dispute');
    } finally {
      setResolvingDisputeId(null);
    }
  };

  const handleDismissDispute = async (disputeId: string) => {
    try {
      const { error } = await supabase
        .from('draft_pick_disputes' as any)
        .update({ status: 'dismissed', resolved_at: new Date().toISOString(), resolved_by: user?.id } as any)
        .eq('id', disputeId);
      if (error) throw error;
      toast.success('Dispute dismissed');
      fetchDisputes();
    } catch (err: any) {
      toast.error(err.message || 'Failed to dismiss dispute');
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectDialog || !rejectRationale.trim()) return;
    setRejectingDispute(true);
    try {
      const { error } = await supabase
        .from('draft_pick_disputes' as any)
        .update({
          status: 'rejected',
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id,
          commissioner_rationale: rejectRationale.trim(),
        } as any)
        .eq('id', rejectDialog.id);
      if (error) throw error;
      toast.success('Dispute rejected');
      setRejectDialog(null);
      setRejectRationale('');
      fetchDisputes();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject dispute');
    } finally {
      setRejectingDispute(false);
    }
  };

  const toggleRationale = (id: string) => {
    setExpandedRationales(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };


  const derivedTurn = getDerivedDraftTurn(
    draft || { num_rounds: 1 },
    participants,
    picks.length
  );
  const currentPicker = derivedTurn.current_pick_user_id
    ? participants.find(p => p.user_id === derivedTurn.current_pick_user_id) || null
    : null;
  const isMyTurn = derivedTurn.current_pick_user_id === user?.id;
  const currentRound = derivedTurn.current_round ?? 1;
  const currentPickNumber = derivedTurn.current_pick_number ?? (picks.length + 1);
  const isDraftComplete = draft?.status === 'complete' || (draft && participants.length > 0 && currentRound > draft.num_rounds);
  const isInProgress = draft?.status === 'in_progress';
  const isSetup = draft?.status === 'setup';
  const hasEnrichments = enrichments.size > 0;

  const handleStartDraft = async () => {
    if (!draftId) return;
    if (!canManage) {
      toast.error("You don't have permission to start this draft");
      return;
    }
    if (participants.length < 2) {
      toast.error('Need at least 2 participants');
      return;
    }
    setStarting(true);
    try {
      // Randomize participant order (Fisher-Yates shuffle)
      const shuffled = [...participants];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      // Clear all pick_orders to negative temps to avoid unique constraint violations
      for (let idx = 0; idx < shuffled.length; idx++) {
        const { error: clearErr } = await supabase
          .from('draft_participants')
          .update({ pick_order: -(idx + 1) })
          .eq('id', shuffled[idx].id);
        if (clearErr) {
          console.error('Failed to clear pick_order for participant', shuffled[idx].id, clearErr);
          throw clearErr;
        }
      }

      // Now set the real shuffled pick_orders
      for (let idx = 0; idx < shuffled.length; idx++) {
        const { error: orderErr } = await supabase
          .from('draft_participants')
          .update({ pick_order: idx + 1 })
          .eq('id', shuffled[idx].id);
        if (orderErr) {
          console.error('Failed to update pick_order for participant', shuffled[idx].id, orderErr);
          throw orderErr;
        }
      }

      const { error } = await supabase.from('drafts').update({
        status: 'in_progress',
        current_round: 1,
        current_pick_number: 1,
        current_pick_user_id: shuffled[0].user_id,
      }).eq('id', draftId);
      if (error) {
        console.error('Failed to update draft status', error);
        throw error;
      }
      toast.success('Draft started! Order randomized 🎲');
      fetchData();
    } catch (err: any) {
      console.error('handleStartDraft error:', err);
      toast.error(err.message || 'Failed to start draft');
    } finally {
      setStarting(false);
    }
  };

  const handleMakePick = async () => {
    if (!user || !draftId || !pickText.trim() || !isMyTurn) return;

    // Hard duplicate check (case-insensitive, matches edge function normalization)
    const normalized = pickText.trim().toLowerCase();
    const isDuplicate = picks.some(p => p.pick_text.trim().toLowerCase() === normalized);
    if (isDuplicate) {
      toast.error('This has already been picked!');
      return;
    }

    // AI-on-submit: fire the advisory spell-check/relevance check AT MOST ONCE
    // per pick (never per keystroke). If it surfaces something actionable and we
    // haven't shown it for this exact text yet, hold submission so the user can
    // review; submitting the same text again proceeds. Skipped entirely when the
    // club has AI turned off, so no wasted round-trip.
    if (aiEnabled && needsCheck(pickText)) {
      const result = await runCheck(pickText);
      if (result && (result.corrected_text || result.is_irrelevant || result.is_duplicate)) {
        return; // banner is now shown via `suggestion`; user reviews, then re-submits
      }
    }

    // Cancel any in-flight check so its result doesn't flicker after we submit.
    clearSuggestion();

    setSubmitting(true);
    try {
      const pickNumber = picks.length + 1;
      const { data: newPick, error } = await supabase.from('draft_picks').insert({
        draft_id: draftId,
        user_id: user.id,
        pick_text: pickText.trim(),
        pick_number: pickNumber,
        round: currentRound,
      }).select().single();
      if (error) throw error;

      // Check if draft is complete after this pick
      const totalExpected = participants.length * draft.num_rounds;
      if (pickNumber >= totalExpected) {
        await supabase.from('drafts').update({ status: 'complete' }).eq('id', draftId);
        await supabase.from('activity_feed').insert({
          actor_user_id: user.id,
          event_type: 'draft_completed',
          target_type: 'draft',
          target_id: draftId,
          metadata: { topic: draft?.topic },
        });
        // Auto-generate report immediately
        setAutoTriggered(true);
        generateResults();
        // Enrich ALL picks in one batched call now that the draft is complete —
        // replaces the previous per-pick enrichment that fired an AI call on
        // every single pick. No-ops server-side if the club has AI turned off.
        enrichDraftPicks(draftId).then(() => fetchEnrichments()).catch(() => {});
        // Kick off playoff advancement immediately if this is a playoff draft (idempotent)
        if (isPlayoffDraft && season?.id) {
          advancePlayoffs(season.id).catch(err => console.error('advancePlayoffs failed:', err));
        }
      } else {
        // Compute next picker once — reused for both DB update and push notification
        const sortedParticipants = [...participants].sort((a, b) => a.pick_order - b.pick_order);
        const nextRound = Math.floor(pickNumber / participants.length);
        const nextPos = pickNumber % participants.length;
        const nextOrderIdx = nextRound % 2 === 0 ? nextPos : participants.length - 1 - nextPos;
        const nextPicker = sortedParticipants[nextOrderIdx];

        await supabase.from('drafts').update({
          current_pick_number: pickNumber + 1,
          current_round: nextRound + 1,
          current_pick_user_id: nextPicker?.user_id || null,
        }).eq('id', draftId);

        if (
          nextPicker &&
          nextPicker.user_id !== user.id // never push self for own action (snake-draft edge of round)
        ) {
          supabase.functions.invoke('send-push-notification', {
            body: {
              type: 'draft',
              title: '🎯 Your Turn to Pick!',
              message: `It's your turn in "${draft.topic}" — Round ${nextRound + 1}`,
              url: `/drafts/${draftId}`,
              sender_user_id: user.id,
              target_user_id: nextPicker.user_id,
            },
          }).catch(() => {});
        }
      }

      setPickText('');
      clearSuggestion();
      toast.success('Pick made! 🔥');

      fetchData();

      // Per-pick AI enrichment removed to cut Lovable-AI-gateway spend: it used
      // to fire one enrichment call for every single pick. Enrichment now runs
      // once as a batch when the draft completes (above), and admins can refresh
      // on demand via the "re-enrich" control (handleReEnrich).
    } catch (err: any) {
      toast.error(err.message || 'Failed to pick');
    } finally {
      setSubmitting(false);
      // Restore focus after key-driven remount of pick input
      requestAnimationFrame(() => pickInputRef.current?.focus());
    }
  };

  const handleReEnrich = async () => {
    if (!draftId) return;
    const result = await enrichDraftPicks(draftId);
    if (result) {
      toast.success(`Enriched ${result.enriched_count} picks`);
      fetchEnrichments();
    }
  };

  const handleDelete = async () => {
    if (!draftId || !canManage) return;
    setDeleting(true);
    try {
      const pIds = picks.map(p => p.id);
      if (pIds.length > 0) {
        await supabase.from('item_enrichments').delete().in('item_id', pIds);
      }
      await supabase.from('draft_results' as any).delete().eq('draft_id', draftId);
      await supabase.from('draft_picks').delete().eq('draft_id', draftId);
      await supabase.from('draft_participants').delete().eq('draft_id', draftId);

      // Check season membership before deleting entry so we can recalc after
      const { data: seasonEntryData } = await supabase
        .from('draft_season_entries' as any)
        .select('season_id')
        .eq('draft_id', draftId)
        .maybeSingle();
      const deletedSeasonId = (seasonEntryData as any)?.season_id;

      await supabase.from('draft_season_entries' as any).delete().eq('draft_id', draftId);
      const { error } = await supabase.from('drafts').delete().eq('id', draftId);
      if (error) throw error;
      if (draft?.competition_id) {
        await supabase.from('competitions').delete().eq('id', draft.competition_id);
      }

      // Recalculate season standings if draft was in a season
      if (deletedSeasonId) {
        recalculateSeasonStandings(deletedSeasonId).catch(err =>
          console.error('Season recalc after deletion failed:', err)
        );
      }

      toast.success('Draft deleted');
      navigate('/drafts');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!draftId || !editTopic.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('drafts').update({ topic: editTopic.trim() }).eq('id', draftId);
      if (error) throw error;
      if (draft?.competition_id) {
        await supabase.from('competitions').update({ title: editTopic.trim() }).eq('id', draft.competition_id);
      }
      toast.success('Draft updated');
      setEditing(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleStartEditPick = (pick: Pick) => {
    setEditingPickId(pick.id);
    setEditPickText(pick.pick_text);
  };

  const handleCancelEditPick = () => {
    setEditingPickId(null);
    setEditPickText('');
  };

  const handleSavePickEdit = async () => {
    if (!editingPickId || !editPickText.trim()) return;
    setSavingPick(true);
    try {
      const { error } = await supabase.from('draft_picks').update({ pick_text: editPickText.trim() }).eq('id', editingPickId);
      if (error) throw error;
      // Reset enrichment so it re-matches with new text
      await supabase.from('item_enrichments').update({
        status: 'pending',
        matched_name: null,
        image_url: null,
        thumbnail_url: null,
        metadata: {},
        confidence: 0,
      }).eq('item_id', editingPickId).eq('item_type', 'draft_pick');
      setEditingPickId(null);
      setEditPickText('');
      toast.success('Pick updated');
      fetchData();
      fetchEnrichments();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update pick');
    } finally {
      setSavingPick(false);
    }
  };

  const handleRemovePick = async () => {
    if (!pickToRemove || !draftId || !user) return;
    const pick = pickToRemove;
    const canRemove = user.id === pick.user_id || canManage;
    if (!canRemove) return;

    setRemovingPick(true);
    try {
      // 1. Delete enrichment for this pick
      await supabase.from('item_enrichments').delete().eq('item_id', pick.id);

      // 2. Delete the pick
      const { error: delErr } = await supabase.from('draft_picks').delete().eq('id', pick.id);
      if (delErr) throw delErr;

      // 3. Renumber subsequent picks
      const subsequentPicks = picks
        .filter(p => p.pick_number > pick.pick_number)
        .sort((a, b) => a.pick_number - b.pick_number);

      for (const sp of subsequentPicks) {
        const newNum = sp.pick_number - 1;
        const newRound = Math.floor((newNum - 1) / participants.length) + 1;
        await supabase.from('draft_picks').update({
          pick_number: newNum,
          round: newRound,
        }).eq('id', sp.id);
      }

      // 4. Recalculate draft state — rewind to the removed pick's slot
      const newTotal = picks.length - 1;
      const newCurrentPickNumber = pick.pick_number; // this slot is now empty
      const totalExpected = participants.length * draft.num_rounds;

      if (newTotal >= totalExpected) {
        // Still complete even after removal
        await supabase.from('drafts').update({
          current_pick_number: newCurrentPickNumber,
          current_round: Math.floor((newCurrentPickNumber - 1) / participants.length) + 1,
        }).eq('id', draftId);
      } else {
        // Calculate who should pick at this slot
        const pickIdx = newCurrentPickNumber - 1; // 0-based
        const round = Math.floor(pickIdx / participants.length);
        const posInRound = pickIdx % participants.length;
        const orderIdx = round % 2 === 0 ? posInRound : participants.length - 1 - posInRound;
        const sorted = [...participants].sort((a, b) => a.pick_order - b.pick_order);
        const repicker = sorted[orderIdx];

        await supabase.from('drafts').update({
          status: 'in_progress',
          current_pick_number: newCurrentPickNumber,
          current_round: round + 1,
          current_pick_user_id: repicker?.user_id || null,
        }).eq('id', draftId);

        const repickerName = repicker?.profiles?.display_name || 'the player';
        toast.success(`Pick removed. It's now ${repickerName}'s turn to repick.`);
      }

      setPickToRemove(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove pick');
    } finally {
      setRemovingPick(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="loading-spinner-ring" />
        <p className="loading-spinner-text">Loading draft…</p>
      </div>
    );
  }

  if (!draft) {
    return <div className="text-center py-16 text-muted-foreground font-medium text-sm">Draft not found.</div>;
  }

  // Group picks by user for results
  const picksByUser = new Map<string, Pick[]>();
  picks.forEach(p => {
    const list = picksByUser.get(p.user_id) || [];
    list.push(p);
    picksByUser.set(p.user_id, list);
  });

  // Computed stats for results
  const mvpPick = hasResults ? findMvpPick(draftResults) : null;
  const streaks = hasResults ? findScoringStreaks(draftResults, picks) : new Map();
  const timings = computePickTimings(picks);

  return (
    // Live-draft view fills the desktop shell (up to 1100px from
    // DraftArenaLayout). The completion-report block further below
    // re-caps itself at 760px so long-form content stays readable.
    <div className="max-w-md mx-auto lg:max-w-none lg:mx-0">
      <Confetti active={showConfetti} />
      {/* Header — playoff drafts get a premium matchup hero */}
      {isPlayoffDraft && playoffMatch ? (
        (() => {
          const playerA = participants.find(p => p.user_id === playoffMatch.user_a);
          const playerB = participants.find(p => p.user_id === playoffMatch.user_b);
          const aPicks = picks.filter(p => p.user_id === playoffMatch.user_a).length;
          const bPicks = picks.filter(p => p.user_id === playoffMatch.user_b).length;
          const totalExpected = participants.length * (draft?.num_rounds || 1);
          return (
            <PlayoffMatchupHero
              round={playoffMatch.round}
              matchNumber={playoffMatch.match_number}
              seasonName={season?.name || season?.season_label || null}
              topic={draft.topic}
              status={isSetup ? 'setup' : isDraftComplete ? 'complete' : 'in_progress'}
              isMyTurn={isMyTurn}
              isParticipant={isParticipant}
              currentPickerUserId={derivedTurn.current_pick_user_id}
              currentRound={currentRound}
              totalRounds={draft.num_rounds}
              totalPicksMade={picks.length}
              totalPicksExpected={totalExpected}
              playerA={{
                userId: playoffMatch.user_a,
                name: playerA?.profiles?.display_name || null,
                seed: playoffMatch.seed_a,
                picksMade: aPicks,
              }}
              playerB={{
                userId: playoffMatch.user_b,
                name: playerB?.profiles?.display_name || null,
                seed: playoffMatch.seed_b,
                picksMade: bPicks,
              }}
              finalsWins={finalsSeriesWins}
              canEditTopic={canManage && !editing}
              onEditTopic={() => setEditing(true)}
              shareSlot={
                <>
                  <JudgingScopeButton
                    aiContext={(draft as any).ai_context || null}
                    aiContextOverride={(draft as any).ai_context_override || null}
                  />
                  <DraftChannelInviteButton
                    draftId={draftId!}
                    topic={draft.topic}
                    rounds={draft.num_rounds}
                    participantCount={participants.length}
                    className="h-8 w-8 rounded-md text-muted-foreground/60 hover:text-primary"
                  />
                </>
              }
              refreshSlot={
                canManage && picks.length > 0 ? (
                  <button
                    onClick={handleReEnrich}
                    disabled={enriching}
                    className="p-1.5 rounded-md text-muted-foreground/60 hover:text-primary transition-colors disabled:opacity-40"
                    title="Re-enrich picks"
                    aria-label="Re-enrich picks"
                  >
                    <RefreshCw className={cn('w-4 h-4', enriching && 'animate-spin')} />
                  </button>
                ) : null
              }
              menuSlot={
                canManage ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="p-1.5 rounded-md text-muted-foreground/60 hover:text-foreground transition-colors"
                        aria-label="More actions"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditing(true)}>
                        <Pencil className="w-3.5 h-3.5 mr-2" /> Edit Topic
                      </DropdownMenuItem>
                      {isCommissioner && seasonEntry && (
                        <DropdownMenuItem
                          onClick={async () => {
                            setSeasonActionBusy(true);
                            try {
                              await removeDraftFromSeason(draftId!);
                              await recalculateSeasonStandings(season!.id);
                              toast.success('Removed from season');
                              refetchSeasonEntries();
                            } catch (err: any) { toast.error(err.message); }
                            finally { setSeasonActionBusy(false); }
                          }}
                        >
                          <X className="w-3.5 h-3.5 mr-2" /> Remove from Season
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="text-destructive focus:text-destructive">
                        <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Draft
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null
              }
            />
          );
        })()
      ) : (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
          <div
            className="rounded-2xl p-3.5 sm:p-4"
            style={{
              background: 'linear-gradient(160deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%)',
              border: '1px solid hsl(var(--border) / 0.5)',
            }}
          >
            {/* Eyebrow — status + category, small and quiet */}
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span
                className={cn(
                  isSetup && 'da-status-setup',
                  isInProgress && !isDraftComplete && 'da-status-live',
                  isDraftComplete && 'da-status-complete',
                )}
              >
                {isSetup ? 'Setup' : isInProgress && !isDraftComplete ? 'In Progress' : 'Complete'}
              </span>
              {/* Sub-category chip removed — drafts are judged on the title alone. */}
            </div>

            {/* Title — full width, its own line */}
            {editing ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editTopic}
                  onChange={(e) => setEditTopic(e.target.value)}
                  className="form-input text-lg font-extrabold"
                  autoFocus
                />
                <Button size="sm" onClick={handleSaveEdit} disabled={saving} className="shrink-0">
                  {saving ? '…' : 'Save'}
                </Button>
                <button onClick={() => { setEditing(false); setEditTopic(draft.topic); }} className="p-1.5 text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <h1 className="text-[1.5rem] sm:text-[1.75rem] font-extrabold tracking-tight leading-[1.15] text-balance">
                {draft.topic}
              </h1>
            )}

            <p className="text-[11px] text-muted-foreground/60 font-medium mt-1">
              by {draft.profiles?.display_name} • {draft.num_rounds} rounds
            </p>

            {/* Action bar — nestled under the title, separated by a hairline */}
            <div className="flex items-center gap-1 mt-2.5 pt-2.5 border-t border-border/40">
              <JudgingScopeButton
                aiContext={(draft as any).ai_context || null}
                aiContextOverride={(draft as any).ai_context_override || null}
              />
              <DraftChannelInviteButton
                draftId={draftId!}
                topic={draft.topic}
                rounds={draft.num_rounds}
                participantCount={participants.length}
                className="h-8 w-8 text-muted-foreground/60 hover:text-primary"
              />
              {canManage && picks.length > 0 && (
                <button
                  onClick={handleReEnrich}
                  disabled={enriching}
                  className="p-2 rounded-lg text-muted-foreground/60 hover:text-primary transition-colors disabled:opacity-40"
                  title="Re-enrich picks"
                >
                  <RefreshCw className={cn("w-4 h-4", enriching && "animate-spin")} />
                </button>
              )}
              <div className="flex-1" />
              {canManage && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-2 rounded-lg text-muted-foreground/60 hover:text-foreground transition-colors" aria-label="More actions">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditing(true)}>
                      <Pencil className="w-3.5 h-3.5 mr-2" /> Edit Topic
                    </DropdownMenuItem>
                    {isCommissioner && seasonEntry && (
                      <DropdownMenuItem onClick={async () => {
                        setSeasonActionBusy(true);
                        try {
                          await removeDraftFromSeason(draftId!);
                          await recalculateSeasonStandings(season!.id);
                          toast.success('Removed from season');
                          refetchSeasonEntries();
                        } catch (err: any) { toast.error(err.message); }
                        finally { setSeasonActionBusy(false); }
                      }}>
                        <X className="w-3.5 h-3.5 mr-2" /> Remove from Season
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="text-destructive focus:text-destructive">
                      <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Draft
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 mt-2">
            <div className="stat-card py-2 flex-1">
              <Users className="w-3 h-3" style={{ color: 'hsl(var(--gold))' }} />
              <span className="stat-value text-xs">{participants.length}</span>
              <span className="stat-label">Players</span>
            </div>
            <div className="stat-card py-2 flex-1">
              <Bookmark className="w-3 h-3" style={{ color: 'hsl(var(--gold))' }} />
              <span className="stat-value text-xs">{picks.length}</span>
              <span className="stat-label">Picks</span>
            </div>
            <div className="stat-card py-2 flex-1">
              <Trophy className="w-3 h-3" style={{ color: 'hsl(var(--gold))' }} />
              <span className="stat-value text-xs">{currentRound > draft.num_rounds ? draft.num_rounds : currentRound}</span>
              <span className="stat-label">Round</span>
            </div>
          </div>


          {seasonEntry ? (
            <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg" style={{ background: 'hsl(var(--gold) / 0.08)', border: '1px solid hsl(var(--gold) / 0.15)' }}>
              <Award className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(var(--gold))' }} />
              <span className="text-[11px] font-bold" style={{ color: 'hsl(var(--gold))' }}>Season Draft #{seasonEntry.week_number}</span>
            </div>
          ) : isCommissioner && season ? (
            <button
              onClick={async () => {
                setSeasonActionBusy(true);
                try {
                  const num = await addDraftToSeason(season.id, draftId!);
                  await recalculateSeasonStandings(season.id);
                  toast.success(`Added as Season Draft #${num}`);
                  refetchSeasonEntries();
                } catch (err: any) { toast.error(err.message); }
                finally { setSeasonActionBusy(false); }
              }}
              disabled={seasonActionBusy}
              className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg text-[11px] font-bold transition-colors btn-press w-full justify-center"
              style={{ background: 'hsl(var(--gold) / 0.1)', color: 'hsl(var(--gold))', border: '1px dashed hsl(var(--gold) / 0.3)' }}
            >
              <Award className="w-4 h-4" /> {seasonActionBusy ? 'Adding…' : 'Add to Season'}
            </button>
          ) : null}

          {!isParticipant && user && (
            <div className="da-pill mt-2 self-start" style={{ background: 'hsl(160 30% 9% / 0.7)', color: 'hsl(45 95% 65%)', borderColor: 'hsl(45 80% 50% / 0.22)' }}>
              <span>👁</span>
              <span>Spectating</span>
            </div>
          )}
        </motion.div>
      )}

      {/* Inline topic editor for playoff drafts (hero pencil opens this) */}
      {isPlayoffDraft && editing && (
        <div className="flex items-center gap-2 mb-4 px-1">
          <Input
            value={editTopic}
            onChange={(e) => setEditTopic(e.target.value)}
            className="form-input text-sm font-extrabold"
            autoFocus
          />
          <Button size="sm" onClick={handleSaveEdit} disabled={saving} className="shrink-0">
            {saving ? '…' : 'Save'}
          </Button>
          <button
            onClick={() => { setEditing(false); setEditTopic(draft.topic); }}
            className="p-1.5 text-muted-foreground hover:text-foreground"
            aria-label="Cancel edit"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Enrichment loading state */}
      {enriching && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl"
          style={{ background: 'hsl(45 95% 55% / 0.10)', border: '1px solid hsl(45 95% 55% / 0.22)' }}
        >
          <Sparkles className="w-4 h-4 animate-pulse" style={{ color: 'hsl(var(--gold))' }} />
          <span className="text-[11px] font-semibold" style={{ color: 'hsl(45 95% 70%)' }}>Enriching picks with AI…</span>
        </motion.div>
      )}

      {/* ═══ Setup Phase ═══ */}
      {isSetup && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <div className="glass-card p-5 mb-5">
            <p className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-3">Participants</p>
            <div className="space-y-2">
              {participants.map((p, idx) => (
                <div key={p.id} className="flex items-center gap-3 py-2">
                  <span className="text-[11px] font-extrabold text-muted-foreground/60 w-5 text-right font-mono">{idx + 1}</span>
                  <span className="text-[13px] font-semibold">{p.profiles?.display_name || 'Unknown'}</span>
                  {p.user_id === draft.created_by && (
                    <span
                      className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md"
                      style={{
                        background: 'hsl(45 95% 55% / 0.14)',
                        border: '1px solid hsl(45 95% 55% / 0.34)',
                        color: 'hsl(45 95% 68%)',
                      }}
                    >Host</span>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground/60 mt-3">Share this draft link to invite others. Order will be randomized when the draft starts.</p>
          </div>

          {!isParticipant && user && !isPlayoffDraft && seasonJoinEligible && (
            <Button
              onClick={async () => {
                try {
                  const nextOrder = participants.length + 1;
                  const { error } = await supabase.from('draft_participants').insert({
                    draft_id: draftId!,
                    user_id: user.id,
                    pick_order: nextOrder,
                  });
                  if (error) throw error;
                  toast.success('Joined the draft!');
                  fetchData();
                } catch (err: any) {
                  toast.error(err.message || 'Failed to join');
                }
              }}
              className="w-full h-12 rounded-xl font-bold btn-press gap-2 text-[13px] mb-3"
              variant="outline"
            >
              <Users className="w-4 h-4" />
              Join Draft
            </Button>
          )}

          {!isParticipant && user && seasonRosterLocked && !seasonJoinEligible && (
            <div className="mb-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-center">
              <p className="text-[12px] font-bold text-foreground">Season roster locked</p>
              <p className="mt-1 text-[10px] text-muted-foreground">Only players already participating in this season can join this draft.</p>
            </div>
          )}

          {canManage && (
            <button
              type="button"
              onClick={handleStartDraft}
              disabled={starting || participants.length < 2}
              className={cn(
                "w-full h-12 rounded-xl font-black uppercase tracking-[0.14em] btn-press inline-flex items-center justify-center gap-2 text-[13px] transition-all disabled:cursor-not-allowed",
                participants.length >= 2 && !starting && "draft-start-pulse",
              )}
              style={{
                color: starting || participants.length < 2 ? 'hsl(45 60% 78%)' : 'hsl(160 40% 6%)',
                background: starting || participants.length < 2
                  ? 'linear-gradient(135deg, hsl(45 35% 22%), hsl(40 30% 16%))'
                  : 'linear-gradient(135deg, hsl(45 100% 65%), hsl(40 95% 50%))',
                border: '1px solid hsl(45 95% 55% / 0.55)',
                boxShadow: starting || participants.length < 2
                  ? 'inset 0 1px 0 hsl(45 60% 60% / 0.18)'
                  : '0 6px 20px hsl(45 95% 40% / 0.5), inset 0 1px 0 hsl(45 100% 90% / 0.65)',
                opacity: starting || participants.length < 2 ? 0.85 : 1,
              }}
            >
              <Play className="w-4 h-4" />
              {starting ? 'Starting…' : 'Start Draft'}
            </button>
          )}
        </motion.div>
      )}

      {/* ═══ Live Draft ═══ */}
      {isInProgress && !isDraftComplete && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          {/* Pick announcement — spans full width on lg, sits above the
              2-col grid so a fresh pick still reads as a broadcast moment
              instead of being trapped in one column. */}
          <PickAnnouncement pick={announcement} onHide={() => setAnnouncement(null)} />

          {/* Live-draft 2-column layout on lg+:
                LEFT  (420px, sticky)  — turn hero + pick input + AI suggestion
                RIGHT (1fr, scrolls)   — pick history
              Mobile/tablet (<lg) is unchanged — pure single-column stack. */}
          <div className="lg:grid lg:grid-cols-[420px_1fr] lg:gap-5 lg:items-start">
          <div className="lg:sticky lg:top-3">

          {/* Current turn banner */}
          {isPlayoffDraft ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, y: 6, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', stiffness: 220, damping: 22 }}
              className="relative overflow-hidden rounded-2xl mb-5"
              style={{
                background: isMyTurn
                  ? 'radial-gradient(120% 100% at 50% 0%, hsl(45 93% 52% / 0.22), transparent 60%), hsl(var(--card))'
                  : 'linear-gradient(180deg, hsl(var(--card)), hsl(var(--card) / 0.9))',
                border: isMyTurn ? '1px solid hsl(45 93% 52% / 0.55)' : '1px solid hsl(var(--border))',
                boxShadow: isMyTurn
                  ? '0 0 28px -6px hsl(45 93% 52% / 0.55), inset 0 1px 0 hsl(45 93% 52% / 0.25)'
                  : '0 4px 16px -8px hsl(0 0% 0% / 0.3)',
              }}
            >
              {isMyTurn && (
                <div
                  className="absolute inset-x-0 top-0 h-px animate-pulse"
                  style={{ background: 'linear-gradient(90deg, transparent, hsl(45 93% 52%), transparent)' }}
                />
              )}
              <div className="relative px-4 py-3.5 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1.5">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 px-1.5 py-[3px] rounded-full text-[9px] font-extrabold uppercase tracking-[0.2em]',
                      isMyTurn ? '' : 'text-muted-foreground/70',
                    )}
                    style={
                      isMyTurn
                        ? { background: 'hsl(45 93% 52% / 0.2)', color: 'hsl(45 93% 52%)', border: '1px solid hsl(45 93% 52% / 0.5)' }
                        : { background: 'hsl(var(--muted) / 0.5)' }
                    }
                  >
                    {isMyTurn && (
                      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'hsl(45 93% 52%)', boxShadow: '0 0 6px hsl(45 93% 52%)' }} />
                    )}
                    On the Clock
                  </span>
                </div>
                {isMyTurn ? (
                  <>
                    <p className="text-[20px] font-extrabold tracking-tight leading-tight" style={{ color: 'hsl(45 93% 52%)' }}>
                      It's your pick
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 mt-0.5">
                      Round {currentRound} · Pick #{currentPickNumber}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-0.5">Waiting on</p>
                    <p className="text-[17px] font-extrabold tracking-tight leading-tight">
                      {currentPicker?.profiles?.display_name || 'Unknown'}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-wider mt-0.5">
                      Round {currentRound} · Pick #{currentPickNumber}
                    </p>
                  </>
                )}
                <OnTheClockTimer
                  lastPickAt={picks.length > 0 ? (picks[picks.length - 1] as any)?.picked_at : null}
                  draftStartedAt={draft?.updated_at}
                  variant="ring"
                  size={104}
                />

              </div>
            </motion.div>
          ) : (
            <AnimatePresence mode="wait">
              {(() => {
            const accent = isMyTurn ? '45 93% 52%' : '152 72% 46%';
            const pickerName = currentPicker?.profiles?.display_name || 'Unknown';
            const initials = pickerName.split(' ').map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
            return (
              <motion.div
                key={`hero-${isMyTurn ? 'mine' : pickerName}-${currentPickNumber}`}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 240, damping: 22 }}
                exit={{ opacity: 0, y: 6, transition: { duration: 0.15 } }}
                className="relative overflow-hidden rounded-2xl mb-5"
                style={{
                  background: `radial-gradient(120% 100% at 50% 0%, hsl(${accent} / 0.16), transparent 65%), hsl(var(--card))`,
                  border: `1px solid hsl(${accent} / ${isMyTurn ? '0.45' : '0.22'})`,
                  boxShadow: isMyTurn
                    ? `0 0 28px -6px hsl(${accent} / 0.45), inset 0 1px 0 hsl(${accent} / 0.2)`
                    : `0 4px 16px -8px hsl(${accent} / 0.28), inset 0 1px 0 hsl(${accent} / 0.08)`,
                }}
              >
                {/* breathing radial wash */}
                <div
                  aria-hidden
                  className="absolute inset-0 pointer-events-none draft-hero-breath"
                  style={{
                    background: `radial-gradient(60% 80% at 50% 30%, hsl(${accent} / 0.18), transparent 70%)`,
                  }}
                />
                {/* top edge rule */}
                <div
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-px"
                  style={{ background: `linear-gradient(90deg, transparent, hsl(${accent} / 0.7), transparent)` }}
                />
                <div className="relative z-10 px-4 py-4 flex flex-col items-center text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-2">
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-[3px] rounded-full text-[9px] font-extrabold uppercase tracking-[0.2em]"
                      style={{
                        background: `hsl(${accent} / 0.18)`,
                        color: `hsl(${accent})`,
                        border: `1px solid hsl(${accent} / 0.4)`,
                      }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full animate-pulse"
                        style={{ background: `hsl(${accent})`, boxShadow: `0 0 6px hsl(${accent})` }}
                      />
                      On the Clock
                    </span>
                  </div>
                  <div className="flex items-center justify-center gap-2.5 mb-1">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-extrabold flex-shrink-0"
                      style={{
                        background: `linear-gradient(135deg, hsl(${accent} / 0.28), hsl(${accent} / 0.08))`,
                        color: `hsl(${accent})`,
                        border: `1px solid hsl(${accent} / 0.4)`,
                        boxShadow: `0 0 10px hsl(${accent} / 0.3)`,
                      }}
                    >
                      {initials}
                    </div>
                    {isMyTurn ? (
                      <motion.p
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: [0.95, 1.04, 1], opacity: 1 }}
                        transition={{ duration: 0.45, ease: 'easeOut' }}
                        className="text-[18px] font-extrabold tracking-tight leading-tight"
                        style={{ color: `hsl(${accent})` }}
                      >
                        It's your pick
                      </motion.p>
                    ) : (
                      <p className="text-[16px] font-extrabold tracking-tight leading-tight">
                        {pickerName}
                      </p>
                    )}
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                    Round {currentRound} · Pick #{currentPickNumber}
                  </p>
                  <OnTheClockTimer
                    lastPickAt={picks.length > 0 ? (picks[picks.length - 1] as any)?.picked_at : null}
                    draftStartedAt={draft?.updated_at}
                  />
                </div>
              </motion.div>
            );
              })()}
            </AnimatePresence>
          )}

          {/* Snake order preview — lets players see where they sit without
              counting picks by hand. */}
          {!isPlayoffDraft && (
            <DraftOrderStrip
              participants={participants as any}
              picksMade={picks.length}
              currentPickNumber={currentPickNumber}
              numRounds={draft.num_rounds}
              currentUserId={user?.id}
            />
          )}



          {/* Pick input */}
          {isMyTurn && (
            <div className="mb-5">
              <motion.div
                key={`pick-input-${picks.length}`}
                initial={{ scale: 0.96, opacity: 0.6 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                className="flex gap-2"
              >
                <Input
                  ref={pickInputRef}
                  value={pickText}
                  onChange={e => {
                    setPickText(e.target.value);
                    setText(e.target.value);
                  }}
                  placeholder="Enter your pick…"
                  maxLength={100}
                  className="form-input flex-1"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && pickText.trim() && !submitting && !localDuplicate) {
                      handleMakePick();
                    }
                  }}
                />
                <Button
                  onClick={handleMakePick}
                  disabled={submitting || !pickText.trim() || localDuplicate}
                  title={localDuplicate ? 'This pick has already been taken' : undefined}
                  className="h-11 px-4 rounded-xl font-bold btn-press"
                >
                  <Send className={cn("w-4 h-4", submitting && "animate-pulse")} />
                </Button>
              </motion.div>


              {/* Spell-check / relevance suggestion */}
              <AnimatePresence>
                {suggestion && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -4, height: 0 }}
                    className="overflow-hidden"
                  >
                    {suggestion.corrected_text && (
                      <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20 text-xs">
                        <Sparkles className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        <span className="text-foreground/80 flex-1">
                          Did you mean <button 
                            onClick={() => {
                              setPickText(suggestion.corrected_text!);
                              setText(suggestion.corrected_text!);
                              clearSuggestion();
                            }}
                            className="font-bold text-primary hover:underline"
                          >
                            {suggestion.corrected_text}
                          </button>?
                        </span>
                        <button onClick={clearSuggestion} className="text-muted-foreground/50 hover:text-foreground transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {suggestion.is_duplicate && (
                      <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-xs">
                        <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
                        <span className="text-foreground/80 flex-1">
                          {suggestion.relevance_note || 'This pick may already have been taken.'}
                        </span>
                        <button onClick={clearSuggestion} className="text-muted-foreground/50 hover:text-foreground transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {suggestion.is_irrelevant && !suggestion.is_duplicate && (
                      <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-500/10 border border-orange-500/20 text-xs">
                        <AlertTriangle className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
                        <span className="text-foreground/80 flex-1">
                          {suggestion.relevance_note || `This might not be relevant to "${draft?.topic}".`}
                        </span>
                        <button onClick={clearSuggestion} className="text-muted-foreground/50 hover:text-foreground transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          </div>{/* /lg sticky left column */}

          <div className="lg:min-w-0">
          {/* Pick history — enriched cards */}
          {picks.length > 0 && (
            <div
              className="overflow-hidden rounded-2xl"
              style={
                isPlayoffDraft
                  ? {
                      background: 'linear-gradient(180deg, hsl(var(--card)), hsl(var(--card) / 0.92))',
                      border: '1px solid hsl(45 93% 52% / 0.22)',
                      boxShadow: '0 6px 24px -12px hsl(45 93% 52% / 0.28)',
                    }
                  : undefined
              }
            >
              <div
                className={cn(
                  'px-4 py-3 flex items-center justify-between gap-2',
                  !isPlayoffDraft && 'border-b border-border/25',
                )}
                style={
                  isPlayoffDraft
                    ? { borderBottom: '1px solid hsl(45 93% 52% / 0.18)' }
                    : undefined
                }
              >
                <div className="flex items-center gap-1.5">
                  {isPlayoffDraft && (
                    <Trophy className="w-3 h-3" style={{ color: 'hsl(45 93% 52%)' }} strokeWidth={2.5} />
                  )}
                  <p
                    className="text-[11px] font-extrabold uppercase tracking-[0.18em]"
                    style={isPlayoffDraft ? { color: 'hsl(45 93% 52%)' } : undefined}
                  >
                    {isPlayoffDraft ? 'Battle Timeline' : 'Pick History'}
                  </p>
                </div>
                <span className="font-mono text-[10px] font-extrabold tabular-nums text-muted-foreground/70">
                  <PickCount value={picks.length} /> {picks.length === 1 ? 'pick' : 'picks'}
                </span>
              </div>
              {/* Wrap the scrollable list in a positioned container so we
                  can layer a soft fade-mask at the bottom. The mask is a
                  pointer-events-none overlay that fades the last few
                  pixels of content into the card background — gives users
                  a clear "more below" cue without adding chrome. Only
                  shown when there are enough picks to actually scroll. */}
              <div className="relative">
              <div className="divide-y divide-border/20 max-h-96 overflow-y-auto">
                <AnimatePresence initial={false}>
                  {(() => {
                    const reversed = [...picks].reverse();
                    const freshIds = freshPickIds;
                    let lastRound: number | null = null;
                    const nodes: React.ReactNode[] = [];
                    reversed.forEach((pick) => {
                      // Round divider — inserted when round changes top→bottom (newer first).
                      if (lastRound !== null && pick.round !== lastRound) {
                        nodes.push(
                          <div key={`rd-${lastRound}`} className="draft-round-divider">
                            <span>Round {lastRound}</span>
                          </div>,
                        );
                      }
                      lastRound = pick.round;
                      const isEnriching = enrichingPickIds.has(pick.id);
                      const enrichment = enrichments.get(pick.id);
                      const isFresh = freshIds.has(pick.id);
                      nodes.push(
                        <motion.div
                          key={pick.id}
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          layout
                          className={cn(isFresh && 'draft-pick-fresh')}
                        >
                          {isEnriching && !enrichment ? (
                            <EnrichedItemSkeleton compact />
                          ) : editingPickId === pick.id ? (
                            <div className="flex items-center gap-2 px-3 py-3 w-full">
                              <Input
                                value={editPickText}
                                onChange={(e) => setEditPickText(e.target.value)}
                                className="h-10 text-sm flex-1 min-w-0"
                                autoFocus
                                onKeyDown={(e) => { if (e.key === 'Enter') handleSavePickEdit(); if (e.key === 'Escape') handleCancelEditPick(); }}
                              />
                              <Button size="sm" onClick={handleSavePickEdit} disabled={savingPick || !editPickText.trim()} className="h-10 w-10 p-0 flex-shrink-0">
                                <Check className="w-4 h-4" />
                              </Button>
                              <button onClick={handleCancelEditPick} className="h-10 w-10 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground active:bg-muted/50 transition-colors flex-shrink-0">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <EnrichedItemCard
                              label={pick.pick_text}
                              rank={pick.pick_number}
                              enrichment={enrichment}
                              showRank
                              compact={!hasEnrichments}
                              onImageClick={enrichment && (enrichment.metadata?.image_candidates as any[])?.length > 0
                                ? () => setImagePickerPick(pick)
                                : undefined}
                              actions={
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <span className="text-[10px] text-muted-foreground/60 text-right">
                                    <span className="block font-medium">{pick.profiles?.display_name}</span>
                                    <span className="font-mono">Rd {pick.round}</span>
                                  </span>
                                  {(canManage || pick.user_id === user?.id) && (
                                    <div className="flex items-center gap-0.5">
                                      {/* Default opacity bumped from /50 → /70 so
                                          the affordance reads on touch devices
                                          where there's no hover state to reveal it. */}
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleStartEditPick(pick); }}
                                        className="p-2 rounded-md text-muted-foreground/70 hover:text-primary active:text-primary active:bg-primary/10 transition-colors"
                                        title="Edit pick"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setPickToRemove(pick); }}
                                        className="p-2 rounded-md text-muted-foreground/70 hover:text-destructive active:text-destructive active:bg-destructive/10 transition-colors"
                                        title="Remove pick"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              }
                            />
                          )}
                        </motion.div>,
                      );
                    });
                    return nodes;
                  })()}
                </AnimatePresence>
              </div>
              {/* Fade mask — only render when there are enough rows to
                  actually be cut off (>5 picks at typical row height). */}
              {picks.length > 5 && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-10"
                  style={{
                    background: 'linear-gradient(to top, hsl(var(--card)) 0%, hsl(var(--card) / 0) 100%)',
                  }}
                />
              )}
              </div>{/* /scroll mask wrapper */}
            </div>
          )}
          </div>{/* /lg right column */}
          </div>{/* /lg 2-col grid wrapper */}
        </motion.div>
      )}

      {/* ═══ Complete — Results ═══ */}
      {/* Long-form report: cap at 760px on desktop. Without this, the
          podium + MVP banner + stats card stretch across the full 1100px
          shell and feel sparse. The content is a story, not a dashboard,
          so it stays single-column on every breakpoint. */}
      {(isDraftComplete || draft.status === 'complete') && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:max-w-[760px] lg:mx-auto"
        >
          {/* ─── Playoff completion banners ─── */}
          {isPlayoffDraft && playoffMatch?.winner_user_id && (() => {
            const winnerId = playoffMatch.winner_user_id;
            const winnerParticipant = participants.find(p => p.user_id === winnerId);
            const winnerName = winnerParticipant?.profiles?.display_name || 'Champion';
            const round = playoffMatch.round;
            const isChampion = round === 'final' && (finalsSeriesWins[winnerId] || 0) >= 2;
            const seriesA = finalsSeriesWins[playoffMatch.user_a] || 0;
            const seriesB = finalsSeriesWins[playoffMatch.user_b] || 0;
            const nextRoundLabel =
              round === 'qf' ? 'Semifinals' :
              round === 'sf' ? 'Finals' :
              round === 'third_place' ? '🥉 Bronze Medal' :
              round === 'final' ? `Series ${Math.max(seriesA, seriesB)}-${Math.min(seriesA, seriesB)}` : '';

            if (isChampion) {
              return (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 18 }}
                  className="relative overflow-hidden rounded-2xl p-5 mb-5 text-center"
                  style={{
                    background: 'linear-gradient(135deg, hsl(45, 93%, 52% / 0.18), hsl(38, 92%, 50% / 0.10))',
                    border: '1px solid hsl(45, 93%, 52% / 0.45)',
                    boxShadow: '0 10px 40px -10px hsl(45, 93%, 52% / 0.45)',
                  }}
                >
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1" style={{ color: 'hsl(45, 93%, 52%)' }}>
                    {season?.season_label || 'Season'} Champion
                  </div>
                  <div className="text-2xl font-extrabold mb-1 flex items-center justify-center gap-2">
                    <Trophy className="w-6 h-6" style={{ color: 'hsl(45, 93%, 52%)' }} />
                    <span>{winnerName}</span>
                    <Trophy className="w-6 h-6" style={{ color: 'hsl(45, 93%, 52%)' }} />
                  </div>
                  <div className="text-[12px] text-muted-foreground font-semibold">
                    Clinched the Finals {Math.max(seriesA, seriesB)}–{Math.min(seriesA, seriesB)}
                  </div>
                </motion.div>
              );
            }

            return (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl p-3 mb-4 text-center"
                style={{
                  background: 'hsl(var(--primary) / 0.08)',
                  border: '1px solid hsl(var(--primary) / 0.25)',
                }}
              >
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary mb-0.5">
                  {round === 'qf' ? 'Play-In' : round === 'sf' ? 'Semifinal' : round === 'final' ? 'Finals Game' : 'Bronze Match'} • Won
                </div>
                <div className="text-[13px] font-bold">
                  {winnerName} {round === 'third_place' ? 'takes 3rd Place' : `advances to ${nextRoundLabel}`}
                </div>
              </motion.div>
            );
          })()}

          <div className="text-center mb-5">
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'hsl(var(--gold))' }}>Draft Complete 🎉</p>
          </div>

          {/* Judging Scope / AI Context */}
          <DraftAiContextCard
            draftId={draftId!}
            aiContext={(draft as any).ai_context || null}
            aiContextOverride={(draft as any).ai_context_override || null}
            canManage={canManage}
            hasResults={hasResults}
            regenerating={resultsGenerating}
            onSaved={fetchData}
            onRegenerate={regenerateResults}
          />

          {/* AI Report Section */}
          {resultsGenerating ? (
            <div className="da-glass p-6 mb-5">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 animate-pulse" style={{ color: 'hsl(var(--gold))' }} />
                <p className="text-sm font-bold" style={{ color: 'hsl(var(--gold))' }}>Generating draft report…</p>
              </div>
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-12 w-full rounded-xl" />
                  </div>
                ))}
              </div>
            </div>
          ) : hasResults ? (
            <div className="mb-5">
              {/* Trophy Podium */}
              <div className="glass-card p-4 pt-5 mb-4 relative overflow-hidden">
                {/* Warm gold wash behind the winner's plinth */}
                <div
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-28 pointer-events-none"
                  style={{ background: 'radial-gradient(58% 100% at 50% 0%, hsl(var(--gold) / 0.14), transparent 72%)' }}
                />
                <div className="relative flex items-center justify-center gap-1.5 mb-4">
                   <Trophy className="w-4 h-4" style={{ color: 'hsl(var(--gold))' }} />
                   <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">Draft Rankings</p>
                </div>
                <div className="relative flex items-end justify-center gap-2.5">
                  {(() => {
                    const top3 = draftResults.slice(0, Math.min(3, draftResults.length));
                    // Medal color per 0-based rank index, with a bronze fallback.
                    const medalVars = ['var(--gold)', 'var(--silver)', 'var(--bronze)'];
                    const heights = ['h-28', 'h-24', 'h-[76px]'];
                    // Visual order: 2nd, 1st, 3rd (podium style)
                    const visualOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;
                    return visualOrder.map((r) => {
                      if (!r) return null;
                      const rIdx = r.rank - 1; // 0-based rank index for colors
                      const c = medalVars[rIdx] || medalVars[2];
                      const isWinner = rIdx === 0;
                      const p = participants.find(pp => pp.user_id === r.user_id);
                      const name = p?.profiles?.display_name || 'Unknown';
                      const initials = name.split(' ').map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
                      return (
                        <motion.div
                          key={r.user_id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: rIdx * 0.15 }}
                          className="flex flex-col items-center flex-1 max-w-[112px]"
                        >
                          {/* Crown reserves its height on every column so the plinths stay bottom-aligned */}
                          {isWinner ? (
                            <Crown className="w-4 h-4 mb-1" style={{ color: `hsl(${c})`, filter: `drop-shadow(0 0 6px hsl(${c} / 0.7))` }} />
                          ) : (
                            <div className="h-4 mb-1" aria-hidden />
                          )}
                          <div
                            className="rounded-full flex items-center justify-center font-extrabold mb-1.5 border-2"
                            style={{
                              width: isWinner ? 46 : 40,
                              height: isWinner ? 46 : 40,
                              fontSize: isWinner ? 14 : 12,
                              background: `linear-gradient(135deg, hsl(${c} / 0.30), hsl(${c} / 0.08))`,
                              color: `hsl(${c})`,
                              borderColor: `hsl(${c} / 0.5)`,
                              boxShadow: isWinner ? `0 0 16px hsl(${c} / 0.4)` : 'none',
                            }}
                          >
                            {initials}
                          </div>
                          <div className="text-[11px] font-bold truncate w-full text-center mb-1.5 px-0.5">
                            {name}
                          </div>
                          <div
                            className={cn("w-full rounded-t-xl flex flex-col items-center justify-start pt-2 pb-2", heights[rIdx] || heights[2])}
                            style={{
                              background: `linear-gradient(180deg, hsl(${c} / 0.24), hsl(${c} / 0.05))`,
                              borderTop: `2px solid hsl(${c})`,
                              boxShadow: 'inset 0 1px 0 hsl(0 0% 100% / 0.05)',
                            }}
                          >
                            <span className="font-black leading-none" style={{ fontSize: isWinner ? 30 : 24, color: `hsl(${c})` }}>
                              {r.rank}
                            </span>
                            <span className="text-[13px] font-extrabold mt-auto">{Number(r.total_score).toFixed(1)}</span>
                            <span className="text-[9px] font-bold text-muted-foreground/70">+{r.points_awarded} pts</span>
                          </div>
                        </motion.div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* MVP Pick highlight */}
              {mvpPick && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="rounded-xl px-4 py-3 mb-4 flex items-center gap-3"
                  style={{
                    background: 'linear-gradient(135deg, hsl(var(--gold) / 0.12), hsl(var(--gold) / 0.04))',
                    border: '2px solid hsl(var(--gold) / 0.3)',
                  }}
                >
                  <Star className="w-5 h-5 flex-shrink-0" style={{ color: 'hsl(var(--gold))' }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'hsl(var(--gold))' }}>MVP Pick</p>
                    <p className="text-[13px] font-extrabold truncate">{mvpPick.pickText}</p>
                    <p className="text-[10px] text-muted-foreground/70">
                      {mvpPick.score.toFixed(1)} — {participants.find(p => p.user_id === mvpPick.userId)?.profiles?.display_name || 'Unknown'}
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Draft Stats Card */}
              <DraftStatsCard picks={picks} results={draftResults} participants={participants} />

              {/* Detailed Results */}
              <div className="space-y-3">
                {draftResults.map((result, idx) => {
                  const participant = participants.find(p => p.user_id === result.user_id);
                  const isExpanded = expandedResultUser === result.user_id;
                  const pickRatings = (result.pick_ratings || []) as { pick_id: string; pick_text: string; score: number; explanation: string }[];
                  const bestPick = pickRatings.length > 0 ? pickRatings.reduce((a, b) => a.score >= b.score ? a : b) : null;
                  const worstPick = pickRatings.length > 1 ? pickRatings.reduce((a, b) => a.score <= b.score ? a : b) : null;
                  const userStreak = streaks.get(result.user_id);
                  const userAvgTime = timings?.userAvgs.get(result.user_id);

                  return (
                    <motion.div
                      key={result.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="glass-card overflow-hidden"
                    >
                      <button
                        className="w-full px-4 py-3 flex items-center gap-2 text-left"
                        onClick={() => setExpandedResultUser(isExpanded ? null : result.user_id)}
                      >
                        <div className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-extrabold flex-shrink-0 border",
                          idx === 0 && "bg-gold/20 text-gold border-gold/45 shadow-[0_0_10px_hsl(var(--gold)/0.25)]",
                          idx === 1 && "bg-silver/20 text-silver border-silver/45",
                          idx === 2 && "bg-bronze/20 text-bronze border-bronze/45",
                          idx > 2 && "bg-muted/50 text-muted-foreground border-transparent",
                        )}>
                          {result.rank}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-[13px] font-bold flex items-center gap-1.5 min-w-0">
                            <span className="truncate">{participant?.profiles?.display_name || 'Unknown'}</span>
                            {userStreak && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0" style={{ background: 'hsl(var(--gold) / 0.12)', color: 'hsl(var(--gold))' }}>
                                <Flame className="w-2.5 h-2.5" /> {userStreak}🔥
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] text-muted-foreground/60">
                            Score: {Number(result.total_score).toFixed(1)} • +{result.points_awarded} pts
                            {userAvgTime ? ` • ⏱ ${formatDuration(userAvgTime)} avg` : ''}
                          </span>
                        </div>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground/60 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground/60 flex-shrink-0" />}
                      </button>

                      {/* Best & Worst picks preview */}
                      {!isExpanded && bestPick && (
                        <div className="px-4 pb-3 flex flex-wrap gap-2 text-[10px]">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-success/10 text-success font-semibold">
                            <Star className="w-3 h-3" /> Best: {bestPick.pick_text} ({bestPick.score.toFixed(1)})
                          </span>
                          {worstPick && worstPick.pick_id !== bestPick.pick_id && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-destructive/10 text-destructive font-semibold">
                              ↓ Worst: {worstPick.pick_text} ({worstPick.score.toFixed(1)})
                            </span>
                          )}
                        </div>
                      )}

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            {result.summary && (
                              <div className="px-4 py-2 border-t border-border/25">
                                <p className="text-[11px] text-muted-foreground italic">{result.summary}</p>
                              </div>
                            )}
                            <div className="divide-y divide-border/15 border-t border-border/25">
                              {pickRatings.map((pr) => {
                                const pickAllDisputes = disputes.filter(d => d.pick_id === pr.pick_id);
                                const pendingDispute = pickAllDisputes.find(d => d.status === 'pending');
                                // Latest non-pending dispute for status pill (rejected/resolved/dismissed)
                                const latestClosed = pickAllDisputes
                                  .filter(d => d.status !== 'pending')
                                  .sort((a, b) => (b.resolved_at || b.created_at || '').localeCompare(a.resolved_at || a.created_at || ''))[0];
                                const rejectedDispute = pickAllDisputes.find(d => d.status === 'rejected' && d.commissioner_rationale);
                                const rationaleOpen = rejectedDispute ? expandedRationales.has(rejectedDispute.id) : false;
                                return (
                                <div key={pr.pick_id} className="px-4 py-2.5">
                                  <div className="flex items-start gap-3">
                                    <div className={cn(
                                      "flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-[12px] font-extrabold border",
                                      pr.score >= 8 && "bg-gold/15 text-gold border-gold/40",
                                      pr.score >= 6 && pr.score < 8 && "bg-success/15 text-success border-success/30",
                                      pr.score >= 4 && pr.score < 6 && "bg-warning/15 text-warning border-warning/30",
                                      pr.score < 4 && "bg-destructive/15 text-destructive border-destructive/30",
                                    )}>
                                      {pr.score.toFixed(1)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[12px] font-semibold">{pr.pick_text}</p>
                                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">{pr.explanation}</p>
                                      {(pendingDispute || latestClosed) && (
                                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                          {pendingDispute && (
                                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-5 border-warning/60 text-warning bg-warning/10">
                                              Disputed
                                            </Badge>
                                          )}
                                          {!pendingDispute && latestClosed?.status === 'resolved' && (
                                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-5 border-success/60 text-success bg-success/10">
                                              Dispute Resolved
                                            </Badge>
                                          )}
                                          {!pendingDispute && latestClosed?.status === 'dismissed' && (
                                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-5 border-muted-foreground/40 text-muted-foreground bg-muted/30">
                                              Dispute Dismissed
                                            </Badge>
                                          )}
                                          {!pendingDispute && latestClosed?.status === 'rejected' && (
                                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-5 border-warning/50 text-warning bg-warning/5">
                                              Dispute Rejected
                                            </Badge>
                                          )}
                                          {rejectedDispute && (
                                            <button
                                              onClick={(e) => { e.stopPropagation(); toggleRationale(rejectedDispute.id); }}
                                              className="text-[9px] font-semibold text-muted-foreground/80 hover:text-foreground underline-offset-2 hover:underline"
                                            >
                                              {rationaleOpen ? 'Hide' : 'View'} Commissioner Rationale
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      {isParticipant && !pendingDispute && (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); setDisputeDialogPick(pr); }}
                                          className="p-2.5 -m-1 rounded-md text-muted-foreground/40 hover:text-warning active:text-warning transition-colors"
                                          aria-label="Dispute this rating"
                                        >
                                          <Flag className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  {rejectedDispute && rationaleOpen && (
                                    <div className="mt-2 ml-12 p-2.5 rounded-lg bg-muted/40 border border-border/40">
                                      <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70 mb-1">
                                        Commissioner Rationale
                                      </p>
                                      <p className="text-[11px] leading-snug whitespace-pre-wrap">{rejectedDispute.commissioner_rationale}</p>
                                      {rejectedDispute.reason && (
                                        <p className="text-[9px] text-muted-foreground/60 mt-2 italic">Original dispute: "{rejectedDispute.reason}"</p>
                                      )}
                                    </div>
                                  )}
                                </div>
                                );
                              })}
                            </div>

                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>

              {/* Commissioner Dispute Resolution Panel */}
              {canManage && disputes.filter(d => d.status === 'pending').length > 0 && (
                <div className="glass-card p-4 mt-4">
                  <h3 className="text-[13px] font-bold mb-3 flex items-center gap-2">
                    <Flag className="w-4 h-4 text-warning" /> Pending Disputes ({disputes.filter(d => d.status === 'pending').length})
                  </h3>
                  <div className="space-y-3">
                    {disputes.filter(d => d.status === 'pending').map(dispute => {
                      const pickInfo = draftResults.flatMap(r => (r.pick_ratings as any[]).map((pr: any) => pr)).find((pr: any) => pr.pick_id === dispute.pick_id);
                      return (
                        <div key={dispute.id} className="da-subcard p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-semibold">{pickInfo?.pick_text || 'Unknown pick'}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {draft?.topic} · Current score: {pickInfo?.score?.toFixed(1) || '?'}
                              </p>
                            </div>
                          </div>
                          {pickInfo?.explanation && (
                            <p className="text-[10px] text-muted-foreground/70">AI rationale: {pickInfo.explanation}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground/80 italic">User dispute: "{dispute.reason}"</p>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleResolveDispute(dispute.id)}
                              disabled={resolvingDisputeId === dispute.id}
                              className="h-7 text-[10px] gap-1"
                            >
                              {resolvingDisputeId === dispute.id ? (
                                <><RefreshCw className="w-3 h-3 animate-spin" /> Resolving…</>
                              ) : (
                                <><Sparkles className="w-3 h-3" /> Resolve</>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDismissDispute(dispute.id)}
                              className="h-7 text-[10px]"
                            >
                              Dismiss
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { setRejectDialog({ id: dispute.id, pickText: pickInfo?.pick_text || 'Unknown pick', reason: dispute.reason }); setRejectRationale(''); }}
                              className="h-7 text-[10px] border-warning/50 text-warning hover:bg-warning/10"
                            >
                              Reject
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}


              {/* Regenerate button — admin only */}
              {isAppAdmin && (
                <Button
                  onClick={regenerateResults}
                  variant="outline"
                  className="w-full mt-4 h-10 rounded-xl text-[12px] font-semibold gap-2"
                  disabled={resultsGenerating}
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", resultsGenerating && "animate-spin")} />
                  Regenerate Report
                </Button>
              )}
            </div>
          ) : (
            <div className="glass-card p-6 mb-5 text-center">
              <Sparkles className="w-8 h-8 text-primary mx-auto mb-2 animate-pulse" />
              <p className="text-[13px] font-bold mb-1">
                {autoTriggered ? 'Generating Draft Report…' : 'Draft Report'}
              </p>
              <p className="text-[11px] text-muted-foreground/60 mb-3">
                {autoTriggered ? 'AI is analyzing every pick. This takes a moment.' : 'The report is being prepared.'}
              </p>
              {isParticipant && !autoTriggered && (
                <Button onClick={() => { setAutoTriggered(true); generateResults(); }} className="rounded-xl font-bold gap-2 btn-press">
                  <Sparkles className="w-4 h-4" /> Generate Report
                </Button>
              )}
              {autoTriggered && (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-10 w-full rounded-xl" />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Original pick lists by participant */}
          <div className="space-y-3">
            {[...participants].sort((a, b) => a.pick_order - b.pick_order).map((p, idx) => {
              const userPicks = picksByUser.get(p.user_id) || [];
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="glass-card overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-border/25 flex items-center gap-2 relative z-10">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-extrabold bg-muted/50 text-muted-foreground">
                      {p.pick_order}
                    </div>
                    <span className="text-[13px] font-bold">{p.profiles?.display_name || 'Unknown'}</span>
                    <span className="text-[10px] text-muted-foreground/60 ml-auto font-mono">{userPicks.length} picks</span>
                  </div>
                  <div className="divide-y divide-border/15 relative z-10">
                    {userPicks.sort((a, b) => a.round - b.round).map(pick => {
                      const enrichment = enrichments.get(pick.id);
                      return editingPickId === pick.id ? (
                          <div className="flex items-center gap-2 px-3 py-3 w-full" key={pick.id}>
                            <Input
                              value={editPickText}
                              onChange={(e) => setEditPickText(e.target.value)}
                              className="h-10 text-sm flex-1 min-w-0"
                              autoFocus
                              onKeyDown={(e) => { if (e.key === 'Enter') handleSavePickEdit(); if (e.key === 'Escape') handleCancelEditPick(); }}
                            />
                            <Button size="sm" onClick={handleSavePickEdit} disabled={savingPick || !editPickText.trim()} className="h-10 w-10 p-0 flex-shrink-0">
                              <Check className="w-4 h-4" />
                            </Button>
                            <button onClick={handleCancelEditPick} className="h-10 w-10 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground active:bg-muted/50 transition-colors flex-shrink-0">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <EnrichedItemCard
                            key={pick.id}
                            label={pick.pick_text}
                            rank={pick.round}
                            enrichment={enrichment}
                            showRank
                            compact={!hasEnrichments}
                            onImageClick={enrichment && (enrichment.metadata?.image_candidates as any[])?.length > 0
                              ? () => setImagePickerPick(pick)
                              : undefined}
                            actions={
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <span className="text-[10px] font-mono text-muted-foreground/70">
                                  Rd {pick.round}
                                </span>
                                {canManage && (
                                  <div className="flex items-center gap-0.5">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleStartEditPick(pick); }}
                                      className="p-2 rounded-md text-muted-foreground/50 hover:text-primary active:text-primary active:bg-primary/10 transition-colors"
                                      title="Edit pick"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setPickToRemove(pick); }}
                                      className="p-2 rounded-md text-muted-foreground/50 hover:text-destructive active:text-destructive active:bg-destructive/10 transition-colors"
                                      title="Remove pick"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            }
                          />
                        );
                    })}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the draft, all picks, participants, and enrichment data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove pick confirmation */}
      <AlertDialog open={!!pickToRemove} onOpenChange={(open) => { if (!open) setPickToRemove(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this pick?</AlertDialogTitle>
            <AlertDialogDescription>
              "{pickToRemove?.pick_text}" by {pickToRemove?.profiles?.display_name} will be removed.
              {isInProgress && !isDraftComplete && ' They will get to repick in this slot.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemovePick} disabled={removingPick} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {removingPick ? 'Removing…' : 'Remove Pick'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image picker dialog */}
      {imagePickerPick && enrichments.get(imagePickerPick.id) && (
        <ImagePickerDialog
          open={!!imagePickerPick}
          onOpenChange={(open) => { if (!open) setImagePickerPick(null); }}
          pickName={imagePickerPick.pick_text}
          enrichment={enrichments.get(imagePickerPick.id)!}
          onImageSelected={() => {
            fetchEnrichments();
            setImagePickerPick(null);
          }}
        />
      )}

      {/* Dispute Dialog */}
      <Dialog open={!!disputeDialogPick} onOpenChange={(open) => { if (!open) { setDisputeDialogPick(null); setDisputeReason(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dispute Pick Rating</DialogTitle>
            <DialogDescription>
              Explain why you think this rating is incorrect. An admin will review and may trigger an AI re-evaluation.
            </DialogDescription>
          </DialogHeader>
          {disputeDialogPick && (
            <div className="space-y-4">
              <div className="da-subcard p-3">
                <p className="text-[13px] font-semibold">{disputeDialogPick.pick_text}</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Current score: {disputeDialogPick.score.toFixed(1)} — {disputeDialogPick.explanation}
                </p>
              </div>
              <Textarea
                placeholder="Why do you think this rating is wrong? (e.g., the AI made a factual error, overlooked an important quality, etc.)"
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                className="min-h-[100px]"
                maxLength={500}
              />
              <p className="text-[10px] text-muted-foreground text-right">{disputeReason.length}/500</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDisputeDialogPick(null); setDisputeReason(''); }}>Cancel</Button>
            <Button onClick={handleSubmitDispute} disabled={submittingDispute || !disputeReason.trim()}>
              {submittingDispute ? 'Submitting…' : 'Submit Dispute'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dispute Dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={(open) => { if (!open) { setRejectDialog(null); setRejectRationale(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Dispute</DialogTitle>
            <DialogDescription>
              Provide a rationale that explains why this dispute is being rejected. It will be visible to the participant on their pick.
            </DialogDescription>
          </DialogHeader>
          {rejectDialog && (
            <div className="space-y-4">
              <div className="da-subcard p-3">
                <p className="text-[13px] font-semibold">{rejectDialog.pickText}</p>
                <p className="text-[11px] text-muted-foreground mt-1 italic">User dispute: "{rejectDialog.reason}"</p>
              </div>
              <Textarea
                placeholder="Explain why the dispute is being rejected (visible to the participant)…"
                value={rejectRationale}
                onChange={(e) => setRejectRationale(e.target.value)}
                className="min-h-[110px]"
                maxLength={1000}
              />
              <p className="text-[10px] text-muted-foreground text-right">{rejectRationale.length}/1000</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectDialog(null); setRejectRationale(''); }}>Cancel</Button>
            <Button
              onClick={handleConfirmReject}
              disabled={rejectingDispute || !rejectRationale.trim()}
              className="bg-warning text-warning-foreground hover:bg-warning/90"
            >
              {rejectingDispute ? 'Rejecting…' : 'Confirm Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
