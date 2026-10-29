import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Check, Loader2, Trophy, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { chatToast as toast } from '@/lib/chatToast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { getSeasonJoinEligibility } from '@/lib/draft/seasonEligibility';

interface DraftInviteCardProps {
  draftId: string;
}

interface DraftInviteDetails {
  topic: string;
  num_rounds: number;
  status: string;
  created_by: string;
  profiles?: { display_name?: string | null } | null;
}

export function DraftInviteCard({ draftId }: DraftInviteCardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<DraftInviteDetails | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [isParticipant, setIsParticipant] = useState(false);
  const [isPlayoff, setIsPlayoff] = useState(false);
  const [seasonRosterLocked, setSeasonRosterLocked] = useState(false);
  const [seasonEligible, setSeasonEligible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [draftRes, participantsRes, playoffRes, eligibility] = await Promise.all([
      supabase.from('drafts').select('topic, num_rounds, status, created_by, profiles:created_by(display_name)').eq('id', draftId).maybeSingle(),
      supabase.from('draft_participants').select('user_id, pick_order').eq('draft_id', draftId).order('pick_order', { ascending: false }),
      (supabase as any).from('draft_season_entries').select('is_playoff').eq('draft_id', draftId).eq('is_playoff', true).maybeSingle(),
      getSeasonJoinEligibility(draftId, user.id).catch(() => ({ isSeasonDraft: false, rosterLocked: false, eligible: true })),
    ]);
    setDraft((draftRes.data as DraftInviteDetails | null) ?? null);
    const participants = participantsRes.data ?? [];
    setParticipantCount(participants.length);
    setIsParticipant(participants.some(participant => participant.user_id === user.id));
    setIsPlayoff(Boolean(playoffRes.data));
    setSeasonRosterLocked(eligibility.rosterLocked);
    setSeasonEligible(eligibility.eligible);
    setLoading(false);
  }, [draftId, user]);

  useEffect(() => { void load(); }, [load]);

  const joinDraft = async () => {
    if (!user || !draft || joining) return;
    if (draft.status !== 'setup' || isPlayoff) {
      navigate(`/drafts/${draftId}`);
      return;
    }
    setJoining(true);
    const { data: latest } = await supabase
      .from('draft_participants')
      .select('pick_order')
      .eq('draft_id', draftId)
      .order('pick_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await supabase.from('draft_participants').insert({
      draft_id: draftId,
      user_id: user.id,
      pick_order: (latest?.pick_order ?? 0) + 1,
    });
    if (error) {
      if (error.code === '23505') {
        await load();
        toast.success('You are already in this draft');
      } else {
        toast.error(error.message || 'Could not join draft');
      }
      setJoining(false);
      return;
    }
    setIsParticipant(true);
    setParticipantCount(count => count + 1);
    setJoining(false);
    toast.success('Joined the draft!');
  };

  if (loading) {
    return <div className="mt-2 h-32 max-w-[320px] animate-pulse rounded-lg border border-border/40 bg-secondary/40" />;
  }
  if (!draft) return null;

  const canJoin = draft.status === 'setup' && !isPlayoff && !isParticipant && seasonEligible;

  return (
    <div className="mt-2 max-w-[320px] overflow-hidden rounded-lg border border-primary/30 bg-background text-foreground shadow-md">
      <div className="border-b border-border/40 bg-primary/10 px-4 py-3">
        <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase text-primary">
          <Trophy className="h-3.5 w-3.5" /> Draft Arena Invite
        </div>
        <h3 className="mt-1.5 break-words text-[15px] font-extrabold leading-snug">{draft.topic}</h3>
        <p className="mt-1 text-[11px] text-muted-foreground">Hosted by {draft.profiles?.display_name || 'a club member'}</p>
      </div>
      <div className="flex items-center gap-4 px-4 py-3 text-[11px] font-semibold text-muted-foreground">
        <span>{draft.num_rounds} rounds</span>
        <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {participantCount} joined</span>
      </div>
      <div className="px-3 pb-3">
        {canJoin ? (
          <Button type="button" onClick={joinDraft} disabled={joining} className="w-full">
            {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
            Join draft
          </Button>
        ) : seasonRosterLocked && !seasonEligible && !isParticipant ? (
          <div className="rounded-md border border-border/60 bg-secondary/50 px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground">
            Season roster locked
          </div>
        ) : (
          <Button type="button" variant="secondary" onClick={() => navigate(`/drafts/${draftId}`)} className="w-full">
            {isParticipant && <Check className="h-4 w-4 text-primary" />}
            {isParticipant ? 'Open draft' : draft.status === 'complete' ? 'View results' : 'View draft'}
            <ArrowRight className="ml-auto h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}