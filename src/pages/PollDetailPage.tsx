import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { MessageCircle, ArrowLeft, Users, Check, Clock, Wifi, MoreVertical, Pencil, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDistanceToNow } from 'date-fns';
import { usePollVoteUpdates } from '@/hooks/useRealtimeSubscription';
import ShareButton from '@/components/ShareButton';
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
import { MemberLoadError } from '@/components/member/MemberLoadError';
import { memberData, memberErrorMessage } from '@/lib/memberData';

interface PollOption {
  id: string;
  label: string;
  position: number;
}

export default function PollDetailPage() {
  const { pollId } = useParams<{ pollId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [poll, setPoll] = useState<any>(null);
  const [options, setOptions] = useState<PollOption[]>([]);
  const [votes, setVotes] = useState<any[]>([]);
  const [myVote, setMyVote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [voting, setVoting] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editQuestion, setEditQuestion] = useState('');
  const [saving, setSaving] = useState(false);

  const isCreator = poll?.created_by === user?.id;

  const fetchData = useCallback(async () => {
    if (!pollId || !user) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const [pollData, optData, voteData] = await Promise.all([
        memberData(supabase.from('polls').select('*, competitions(title, status), profiles:created_by(display_name)').eq('id', pollId).single(), 'Load poll'),
        memberData(supabase.from('poll_options').select('*').eq('poll_id', pollId).order('position'), 'Load poll options'),
        memberData(supabase.from('poll_votes').select('*, profiles:user_id(display_name)').eq('poll_id', pollId), 'Load poll votes'),
      ]);

      setPoll(pollData);
      setEditQuestion(pollData.question);
      setOptions(optData ?? []);
      const nextVotes = voteData ?? [];
      setVotes(nextVotes);
      const mine = nextVotes.find(v => v.user_id === user.id);
      if (mine) {
        setMyVote(mine.option_id);
        setSelectedOption(mine.option_id);
      } else {
        setMyVote(null);
      }
    } catch (loadError) {
      setError(memberErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [pollId, user]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  // Auto-close poll if past closes_at and still marked open in DB
  useEffect(() => {
    if (poll && poll.status === 'open' && poll.closes_at && new Date(poll.closes_at) < new Date()) {
      void memberData(supabase.from('polls').update({ status: 'closed' }).eq('id', poll.id).select('id'), 'Close expired poll')
        .then(() => fetchData())
        .catch(() => {});
    }
  }, [fetchData, poll]);

  // Realtime: auto-refresh when anyone votes
  usePollVoteUpdates(pollId, fetchData);

  const handleVote = async () => {
    if (!user || !pollId || !selectedOption || myVote) return;
    setVoting(true);
    try {
      await memberData(supabase.from('poll_votes').insert({
        poll_id: pollId,
        option_id: selectedOption,
        user_id: user.id,
      }).select('id'), 'Cast poll vote');

      void memberData(supabase.from('activity_feed').insert({
        actor_user_id: user.id,
        event_type: 'poll_voted',
        target_type: 'poll',
        target_id: pollId,
        metadata: { question: poll?.question },
      }).select('id'), 'Log poll vote').catch(() => {});

      toast.success('Vote cast! 🗳️');
      setMyVote(selectedOption);
      void fetchData();
    } catch (voteError) {
      toast.error(memberErrorMessage(voteError));
    } finally {
      setVoting(false);
    }
  };

  const handleDelete = async () => {
    if (!pollId || !isCreator) return;
    setDeleting(true);
    try {
      // Delete votes, options, then poll
      await memberData(supabase.from('poll_votes').delete().eq('poll_id', pollId).select('id'), 'Delete poll votes');
      await memberData(supabase.from('poll_options').delete().eq('poll_id', pollId).select('id'), 'Delete poll options');
      await memberData(supabase.from('polls').delete().eq('id', pollId).select('id'), 'Delete poll');
      // Delete competition
      if (poll?.competition_id) {
        await memberData(supabase.from('competitions').delete().eq('id', poll.competition_id).select('id'), 'Delete poll competition');
      }
      toast.success('Poll deleted');
      navigate('/polls');
    } catch (deleteError) {
      toast.error(memberErrorMessage(deleteError));
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!pollId || !editQuestion.trim()) return;
    setSaving(true);
    try {
      await memberData(supabase.from('polls').update({ question: editQuestion.trim() }).eq('id', pollId).select('id'), 'Update poll');
      // Update competition title too
      if (poll?.competition_id) {
        await memberData(supabase.from('competitions').update({ title: editQuestion.trim() }).eq('id', poll.competition_id).select('id'), 'Update poll competition');
      }
      toast.success('Poll updated');
      setEditing(false);
      void fetchData();
    } catch (saveError) {
      toast.error(memberErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!pollId || !isCreator) return;
    const newStatus = poll.status === 'open' ? 'closed' : 'open';
    try {
      await memberData(supabase.from('polls').update({ status: newStatus }).eq('id', pollId).select('id'), 'Update poll status');
      toast.success(`Poll ${newStatus === 'open' ? 'reopened' : 'closed'}`);
      void fetchData();
    } catch (statusError) {
      toast.error(memberErrorMessage(statusError));
    }
  };

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="loading-spinner-ring" />
        <p className="loading-spinner-text">Loading poll…</p>
      </div>
    );
  }

  if (error) {
    return <div className="member-page max-w-3xl mx-auto"><MemberLoadError message={error} onRetry={() => { setLoading(true); void fetchData(); }} /></div>;
  }

  if (!poll) {
    return <div className="text-center py-16 text-muted-foreground font-medium text-sm">Poll not found.</div>;
  }

  const totalVotes = votes.length;
  const isExpired = poll.closes_at && new Date(poll.closes_at) < new Date();
  const isOpen = poll.status === 'open' && !isExpired;
  const hasVoted = !!myVote;


  // Count votes per option
  const voteCounts = new Map<string, number>();
  votes.forEach(v => voteCounts.set(v.option_id, (voteCounts.get(v.option_id) || 0) + 1));

  // Find the winning option(s)
  const maxVotes = Math.max(...options.map(o => voteCounts.get(o.id) || 0), 0);

  return (
    <div className="member-page max-w-3xl mx-auto" aria-busy={voting || deleting || saving}>
      <Link to="/polls" className="back-link">
        <ArrowLeft /> Back to Polls
      </Link>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {editing ? (
              <div className="flex items-center gap-2">
                <Input
                  aria-label="Poll question"
                  value={editQuestion}
                  onChange={(e) => setEditQuestion(e.target.value)}
                  className="form-input text-lg font-extrabold"
                  autoFocus
                />
                <Button size="sm" onClick={handleSaveEdit} disabled={saving} className="h-11 shrink-0 rounded-xl">
                  {saving ? '…' : 'Save'}
                </Button>
                <button onClick={() => { setEditing(false); setEditQuestion(poll.question); }} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/60 hover:text-foreground" aria-label="Cancel editing">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <h1 className="text-[1.4rem] font-extrabold tracking-tight leading-tight">{poll.question}</h1>
            )}
            <p className="text-[11px] text-muted-foreground/60 font-medium mt-1">
              by {poll.profiles?.display_name} • {formatDistanceToNow(new Date(poll.created_at), { addSuffix: true })}
            </p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <ShareButton contentType="poll" contentId={pollId!} title={poll.question} />
            <span className={cn("status-pill", isOpen ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground')}>
              {isOpen ? 'Open' : 'Closed'}
            </span>
            {isCreator && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground/60 transition-colors hover:bg-muted/60 hover:text-foreground" aria-label="Poll actions">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setEditing(true)}>
                    <Pencil className="w-3.5 h-3.5 mr-2" /> Edit Question
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleToggleStatus}>
                    <Clock className="w-3.5 h-3.5 mr-2" /> {isOpen ? 'Close Poll' : 'Reopen Poll'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="text-destructive focus:text-destructive">
                    <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Poll
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <div className="stat-card py-2 flex-1">
            <Users className="w-3 h-3" style={{ color: 'hsl(var(--warning))' }} />
            <span className="stat-value text-xs">{totalVotes}</span>
            <span className="stat-label">Votes</span>
          </div>
          <div className="stat-card py-2 flex-1">
            <MessageCircle className="w-3 h-3" style={{ color: 'hsl(var(--warning))' }} />
            <span className="stat-value text-xs">{options.length}</span>
            <span className="stat-label">Options</span>
          </div>
        </div>
      </motion.div>

      {/* Options / Results */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <div className="space-y-2 mb-5">
          {options.map((opt, idx) => {
            const count = voteCounts.get(opt.id) || 0;
            const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
            const isSelected = selectedOption === opt.id;
            const isMyVote = myVote === opt.id;
            const isWinner = hasVoted && count === maxVotes && maxVotes > 0;

            return (
              <motion.button
                key={opt.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06 + idx * 0.03 }}
                onClick={() => {
                  if (!hasVoted && isOpen) setSelectedOption(opt.id);
                }}
                disabled={hasVoted || !isOpen}
                className={cn(
                  "w-full text-left glass-card p-4 relative overflow-hidden transition-all duration-200",
                  !hasVoted && isOpen && "cursor-pointer hover:border-warning/30",
                  isSelected && !hasVoted && "ring-2 ring-warning/50 border-warning/30",
                  hasVoted && "cursor-default",
                )}
              >
                {/* Background fill for results */}
                {hasVoted && (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.35, ease: 'easeOut', delay: idx * 0.025 }}
                    className="absolute inset-y-0 left-0 z-0 rounded-2xl"
                    style={{
                      background: isWinner
                        ? 'linear-gradient(90deg, hsl(var(--warning) / 0.15), hsl(var(--warning) / 0.06))'
                        : 'hsl(var(--muted) / 0.4)',
                    }}
                  />
                )}

                <div className="flex items-center gap-3 relative z-10">
                  {/* Radio / check indicator */}
                  <div className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-all",
                    isMyVote ? "border-warning bg-warning" :
                    isSelected && !hasVoted ? "border-warning" :
                    "border-muted-foreground/20"
                  )}>
                    {isMyVote && <Check className="w-3 h-3 text-background" />}
                  </div>

                  <span className={cn(
                    "flex-1 text-[13px] font-semibold",
                    isWinner && "text-warning"
                  )}>
                    {opt.label}
                  </span>

                  {hasVoted && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={cn(
                        "text-[12px] font-extrabold tabular-nums font-mono",
                        isWinner ? "text-warning" : "text-muted-foreground"
                      )}>
                        {pct}%
                      </span>
                      <span className="text-[10px] text-muted-foreground/60 font-mono">
                        {count}
                      </span>
                    </div>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Vote button */}
        {!hasVoted && isOpen && (
          <Button
            onClick={handleVote}
            disabled={voting || !selectedOption}
            className="w-full h-12 rounded-xl font-bold btn-press gap-2 text-[13px]"
            style={{
              background: selectedOption ? 'linear-gradient(135deg, hsl(var(--warning)), hsl(38 92% 42%))' : undefined,
            }}
          >
            {voting ? 'Casting…' : 'Cast Vote'}
          </Button>
        )}

        {hasVoted && (
          <div className="text-center py-3">
            <p className="text-[11px] font-bold" style={{ color: 'hsl(var(--warning))' }}>✓ You voted</p>
          </div>
        )}

        {/* Voters list */}
        {hasVoted && votes.length > 0 && (
          <div className="mt-6">
            <div className="section-divider mb-3">
              <h3 className="section-header mb-0">Voters</h3>
            </div>
            <div className="glass-card overflow-hidden">
              <div className="divide-y divide-border/20">
                {votes.map((v: any) => {
                  const optLabel = options.find(o => o.id === v.option_id)?.label;
                  return (
                    <div key={v.id} className="flex items-center justify-between px-4 py-2.5 relative z-10">
                      <span className="text-[12px] font-semibold">{v.profiles?.display_name || 'Unknown'}</span>
                      <span className="text-[10px] text-muted-foreground/70 font-medium truncate max-w-[40%] text-right">{optLabel}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this poll?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the poll, all options, and all votes. This action cannot be undone.
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
    </div>
  );
}
