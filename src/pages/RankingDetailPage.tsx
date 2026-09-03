import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { BarChart3, ArrowLeft, Send, Users, Trophy, ChevronDown, ChevronUp, RefreshCw, Sparkles, MoreVertical, Pencil, Trash2, X, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRankingUpdates } from '@/hooks/useRealtimeSubscription';
import { useItemEnrichments, useEnrichRanking } from '@/hooks/useItemEnrichments';
import EnrichedItemCard, { EnrichedItemSkeleton } from '@/components/EnrichedItemCard';
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

interface RankingItem {
  id: string;
  label: string;
  position: number;
}

export default function RankingDetailPage() {
  const { rankingId } = useParams<{ rankingId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ranking, setRanking] = useState<any>(null);
  const [items, setItems] = useState<RankingItem[]>([]);
  const [myOrder, setMyOrder] = useState<RankingItem[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [mySubmission, setMySubmission] = useState<any>(null);
  const [aggregated, setAggregated] = useState<{ item: RankingItem; avgRank: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTopic, setEditTopic] = useState('');
  const [saving, setSaving] = useState(false);

  const itemIds = items.map(i => i.id);
  const { enrichments, loading: enrichmentsLoading, fetchEnrichments } = useItemEnrichments(itemIds);
  const { enriching, enrichRanking } = useEnrichRanking();

  const isCreator = ranking?.created_by === user?.id;

  const fetchData = useCallback(async () => {
    if (!rankingId || !user) return;

    const [{ data: rankData }, { data: itemData }] = await Promise.all([
      supabase.from('rankings').select('*, competitions(title, status), profiles:created_by(display_name)').eq('id', rankingId).single(),
      supabase.from('ranking_items').select('*').eq('ranking_id', rankingId).order('position'),
    ]);

    if (rankData) {
      setRanking(rankData);
      setEditTopic(rankData.topic);
    }
    if (itemData) {
      setItems(itemData);
      setMyOrder([...itemData]);
    }

    const { data: subs } = await supabase
      .from('ranking_submissions')
      .select('*, profiles:user_id(display_name)')
      .eq('ranking_id', rankingId);

    if (subs && subs.length > 0) {
      setSubmissions(subs);
      const mine = subs.find(s => s.user_id === user.id);
      if (mine) {
        setMySubmission(mine);
        setShowResults(true);
      }

      const subIds = subs.map(s => s.id);
      const { data: entries } = await supabase
        .from('ranking_submission_entries')
        .select('*')
        .in('submission_id', subIds);

      if (entries && itemData) {
        const rankSums = new Map<string, { total: number; count: number }>();
        entries.forEach(e => {
          const existing = rankSums.get(e.item_id) || { total: 0, count: 0 };
          rankSums.set(e.item_id, { total: existing.total + e.rank, count: existing.count + 1 });
        });

        const agg = itemData.map(item => ({
          item,
          avgRank: rankSums.has(item.id) ? rankSums.get(item.id)!.total / rankSums.get(item.id)!.count : item.position + 1,
        })).sort((a, b) => a.avgRank - b.avgRank);

        setAggregated(agg);

        if (mine) {
          const myEntries = entries.filter(e => e.submission_id === mine.id).sort((a, b) => a.rank - b.rank);
          const ordered = myEntries.map(e => itemData.find(i => i.id === e.item_id)).filter(Boolean) as RankingItem[];
          if (ordered.length > 0) setMyOrder(ordered);
        }
      }
    }

    setLoading(false);
  }, [rankingId, user]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (items.length) fetchEnrichments(); }, [items.length, fetchEnrichments]);

  useRankingUpdates(rankingId, fetchData);

  const moveItem = (fromIdx: number, direction: 'up' | 'down') => {
    if (mySubmission) return;
    const toIdx = direction === 'up' ? fromIdx - 1 : fromIdx + 1;
    if (toIdx < 0 || toIdx >= myOrder.length) return;
    const newOrder = [...myOrder];
    [newOrder[fromIdx], newOrder[toIdx]] = [newOrder[toIdx], newOrder[fromIdx]];
    setMyOrder(newOrder);
  };

  const handleSubmit = async () => {
    if (!user || !rankingId || mySubmission) return;
    setSubmitting(true);
    try {
      const { data: sub, error: subErr } = await supabase
        .from('ranking_submissions')
        .insert({ ranking_id: rankingId, user_id: user.id })
        .select()
        .single();
      if (subErr) throw subErr;

      const entries = myOrder.map((item, i) => ({
        submission_id: sub.id,
        item_id: item.id,
        rank: i + 1,
      }));
      const { error: entErr } = await supabase.from('ranking_submission_entries').insert(entries);
      if (entErr) throw entErr;

      await supabase.from('activity_feed').insert({
        actor_user_id: user.id,
        event_type: 'ranking_submitted',
        target_type: 'ranking',
        target_id: rankingId,
        metadata: { topic: ranking?.topic },
      });

      toast.success('Ranking submitted! 🏆');
      setMySubmission(sub);
      setShowResults(true);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReEnrich = async () => {
    if (!rankingId) return;
    const result = await enrichRanking(rankingId);
    if (result) {
      toast.success(`Enriched ${result.enriched_count} items`);
      fetchEnrichments();
    }
  };

  const handleDelete = async () => {
    if (!rankingId || !isCreator) return;
    setDeleting(true);
    try {
      const subIds = submissions.map(s => s.id);
      if (subIds.length > 0) {
        await supabase.from('ranking_submission_entries').delete().in('submission_id', subIds);
        await supabase.from('ranking_submissions').delete().eq('ranking_id', rankingId);
      }
      await supabase.from('item_enrichments').delete().in('item_id', items.map(i => i.id));
      await supabase.from('ranking_items').delete().eq('ranking_id', rankingId);
      const { error } = await supabase.from('rankings').delete().eq('id', rankingId);
      if (error) throw error;
      if (ranking?.competition_id) {
        await supabase.from('competitions').delete().eq('id', ranking.competition_id);
      }
      toast.success('Ranking deleted');
      navigate('/rankings');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!rankingId || !editTopic.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('rankings').update({ topic: editTopic.trim() }).eq('id', rankingId);
      if (error) throw error;
      if (ranking?.competition_id) {
        await supabase.from('competitions').update({ title: editTopic.trim() }).eq('id', ranking.competition_id);
      }
      toast.success('Ranking updated');
      setEditing(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!rankingId || !isCreator) return;
    const newStatus = ranking.status === 'open' ? 'closed' : 'open';
    try {
      const { error } = await supabase.from('rankings').update({ status: newStatus }).eq('id', rankingId);
      if (error) throw error;
      toast.success(`Ranking ${newStatus === 'open' ? 'reopened' : 'closed'}`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    }
  };

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="loading-spinner-ring" />
        <p className="loading-spinner-text">Loading ranking…</p>
      </div>
    );
  }

  if (!ranking) {
    return <div className="text-center py-16 text-muted-foreground font-medium text-sm">Ranking not found.</div>;
  }

  const isOpen = ranking.status === 'open';
  const hasEnrichments = enrichments.size > 0;

  return (
    <div className="member-page max-w-md mx-auto">
      <Link to="/rankings" className="back-link">
        <ArrowLeft /> Back to Rankings
      </Link>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {editing ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editTopic}
                  onChange={(e) => setEditTopic(e.target.value)}
                  className="form-input text-lg font-extrabold"
                  autoFocus
                />
                <Button size="sm" onClick={handleSaveEdit} disabled={saving} className="h-11 shrink-0 rounded-xl">
                  {saving ? '…' : 'Save'}
                </Button>
                <button onClick={() => { setEditing(false); setEditTopic(ranking.topic); }} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/60 hover:text-foreground" aria-label="Cancel editing">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <h1 className="text-[1.4rem] font-extrabold tracking-tight leading-tight">{ranking.topic}</h1>
            )}
            <p className="text-[11px] text-muted-foreground/60 font-medium mt-1">
              by {ranking.profiles?.display_name} • {items.length} items
              {ranking.category && (
                <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider"
                  style={{ background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}>
                  <Sparkles className="w-2.5 h-2.5" />{ranking.category}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <ShareButton contentType="ranking" contentId={rankingId!} title={ranking.topic} />
            {isCreator && (
              <button
                onClick={handleReEnrich}
                disabled={enriching}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground/60 transition-colors hover:bg-muted/60 hover:text-primary disabled:opacity-40"
                title="Re-enrich items"
                aria-label="Refresh item details"
              >
                <RefreshCw className={cn("w-4 h-4", enriching && "animate-spin")} />
              </button>
            )}
            <span className={cn("status-pill", isOpen ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground')}>
              {isOpen ? 'Open' : 'Closed'}
            </span>
            {isCreator && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground/60 transition-colors hover:bg-muted/60 hover:text-foreground" aria-label="Ranking actions">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setEditing(true)}>
                    <Pencil className="w-3.5 h-3.5 mr-2" /> Edit Topic
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleToggleStatus}>
                    <Clock className="w-3.5 h-3.5 mr-2" /> {isOpen ? 'Close Ranking' : 'Reopen Ranking'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="text-destructive focus:text-destructive">
                    <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Ranking
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <div className="stat-card py-2 flex-1">
            <Users className="w-3 h-3 text-primary" />
            <span className="stat-value text-xs">{submissions.length}</span>
            <span className="stat-label">Ranked</span>
          </div>
          <div className="stat-card py-2 flex-1">
            <BarChart3 className="w-3 h-3" style={{ color: 'hsl(var(--accent))' }} />
            <span className="stat-value text-xs">{items.length}</span>
            <span className="stat-label">Items</span>
          </div>
        </div>
      </motion.div>

      {/* Enrichment loading state */}
      {enriching && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl"
          style={{ background: 'hsl(var(--primary) / 0.08)', border: '1px solid hsl(var(--primary) / 0.15)' }}
        >
          <Sparkles className="w-4 h-4 text-primary animate-pulse" />
          <span className="text-[11px] font-semibold text-primary">Enriching items with AI…</span>
        </motion.div>
      )}

      {/* Tab toggle */}
      {submissions.length > 0 && (
        <div className="flex gap-1.5 mb-5 p-1 bg-muted/50 rounded-xl">
          <button
            onClick={() => setShowResults(false)}
            className={cn(
              "flex-1 min-h-11 py-2.5 rounded-lg text-xs font-semibold transition-all",
              !showResults ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground"
            )}
          >
            {mySubmission ? 'My Ranking' : 'Submit Ranking'}
          </button>
          <button
            onClick={() => setShowResults(true)}
            className={cn(
              "flex-1 min-h-11 py-2.5 rounded-lg text-xs font-semibold transition-all",
              showResults ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground"
            )}
          >
            Group Results
          </button>
        </div>
      )}

      {/* ═══ My Ranking / Reorder ═══ */}
      {!showResults && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <div className="glass-card overflow-hidden mb-5">
            <div className="px-4 py-3 border-b border-border/25">
              <p className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-wider">
                {mySubmission ? 'Your submitted ranking' : 'Reorder items, then submit'}
              </p>
            </div>
            <div className="divide-y divide-border/20">
              {enrichmentsLoading && !hasEnrichments ? (
                Array.from({ length: Math.min(items.length, 5) }).map((_, i) => (
                  <EnrichedItemSkeleton key={i} compact />
                ))
              ) : (
                myOrder.map((item, idx) => (
                  <EnrichedItemCard
                    key={item.id}
                    label={item.label}
                    rank={idx + 1}
                    enrichment={enrichments.get(item.id)}
                    compact={!hasEnrichments}
                    actions={
                      !mySubmission && isOpen ? (
                        <div className="flex flex-shrink-0 gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); moveItem(idx, 'up'); }}
                            disabled={idx === 0}
                            className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground/60 transition-colors hover:bg-muted/60 hover:text-foreground disabled:opacity-20"
                            aria-label={`Move ${item.label} up`}
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); moveItem(idx, 'down'); }}
                            disabled={idx === myOrder.length - 1}
                            className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground/60 transition-colors hover:bg-muted/60 hover:text-foreground disabled:opacity-20"
                            aria-label={`Move ${item.label} down`}
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : undefined
                    }
                  />
                ))
              )}
            </div>
          </div>

          {!mySubmission && isOpen && (
            <Button onClick={handleSubmit} disabled={submitting} className="w-full h-12 rounded-xl font-bold btn-press gap-2 text-[13px]">
              <Send className="w-4 h-4" />
              {submitting ? 'Submitting…' : 'Submit My Ranking'}
            </Button>
          )}

          {mySubmission && (
            <div className="text-center py-3">
              <p className="text-[11px] text-success font-bold">✓ Submitted {new Date(mySubmission.submitted_at).toLocaleDateString()}</p>
            </div>
          )}
        </motion.div>
      )}

      {/* ═══ Group Results ═══ */}
      {showResults && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <div className="glass-card arena-edge overflow-hidden mb-5">
            <div className="px-4 py-3 border-b border-border/25 relative z-10">
              <p className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-wider">
                Group consensus • {submissions.length} submission{submissions.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="divide-y divide-border/20 relative z-10">
              {aggregated.map((entry, idx) => (
                <EnrichedItemCard
                  key={entry.item.id}
                  label={entry.item.label}
                  rank={idx + 1}
                  enrichment={enrichments.get(entry.item.id)}
                  actions={
                    <span className="text-[10px] font-mono text-muted-foreground/70 flex-shrink-0">
                      avg {entry.avgRank.toFixed(1)}
                    </span>
                  }
                />
              ))}
            </div>
          </div>

          {/* Individual submissions */}
          {submissions.length > 0 && (
            <>
              <div className="section-divider mb-3">
                <h3 className="section-header mb-0">Individual Rankings</h3>
              </div>
              <div className="space-y-3">
                {submissions.map((sub: any) => (
                  <div key={sub.id} className="glass-card p-4">
                    <p className="text-[12px] font-bold mb-2">{sub.profiles?.display_name || 'Unknown'}</p>
                    <p className="text-[10px] text-muted-foreground/70">
                      Submitted {new Date(sub.submitted_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </motion.div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this ranking?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the ranking, all items, all submissions, and enrichment data. This action cannot be undone.
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
