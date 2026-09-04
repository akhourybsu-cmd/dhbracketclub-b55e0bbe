import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { BarChart3, Plus, ArrowRight, Users, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { memberData, memberErrorMessage } from '@/lib/memberData';
import { MemberLoadError } from '@/components/member/MemberLoadError';
import type { Database } from '@/integrations/supabase/types';

type RankingListItem = Database['public']['Tables']['rankings']['Row'] & {
  competitions?: { title: string; status: string } | null;
  profiles?: { display_name: string } | null;
};

export default function RankingsListPage() {
  const { user } = useAuth();
  const [rankings, setRankings] = useState<RankingListItem[]>([]);
  const [submissionCounts, setSubmissionCounts] = useState<Map<string, number>>(new Map());
  const [mySubmissions, setMySubmissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRankings = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const data = await memberData(supabase
        .from('rankings')
        .select('*, competitions(title, status), profiles:created_by(display_name)')
        .order('created_at', { ascending: false }), 'rankings');

      if (data) {
        setRankings(data);
        const rankingIds = data.map(r => r.id);

        if (rankingIds.length > 0) {
          const [subs, mySubs] = await Promise.all([
            memberData(supabase.from('ranking_submissions').select('ranking_id').in('ranking_id', rankingIds), 'ranking totals'),
            memberData(supabase.from('ranking_submissions').select('ranking_id').eq('user_id', user.id).in('ranking_id', rankingIds), 'your rankings'),
          ]);

          if (subs) {
            const counts = new Map<string, number>();
            subs.forEach(s => counts.set(s.ranking_id, (counts.get(s.ranking_id) || 0) + 1));
            setSubmissionCounts(counts);
          }
          if (mySubs) {
            setMySubmissions(new Set(mySubs.map(s => s.ranking_id)));
          }
        }
      }
    } catch (cause) {
      setError(memberErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { void fetchRankings(); }, [fetchRankings]);

  return (
    <div className="member-page" aria-busy={loading}>
      <div className="page-toolbar">
        <div className="page-header mb-0">
          <div className="page-header-icon"><BarChart3 /></div>
          <div>
            <h1 className="page-header-title">Rankings</h1>
            <p className="page-header-subtitle">Power rankings & tier lists</p>
          </div>
        </div>
        <Button asChild size="sm" className="page-action gap-1.5 btn-press">
          <Link to="/rankings/create">
            <Plus className="w-4 h-4" /> Create
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2.5">
          {[1, 2].map(i => (
            <div key={i} className="glass-card p-5">
              <div className="h-4 rounded-lg w-1/3 mb-2.5 skeleton-shimmer" />
              <div className="h-3 rounded-lg w-1/2 skeleton-shimmer" />
            </div>
          ))}
        </div>
      ) : error ? (
        <MemberLoadError message={error} onRetry={() => void fetchRankings()} />
      ) : rankings.length === 0 ? (
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="empty-state">
          <div className="empty-state-icon"><BarChart3 /></div>
          <p className="empty-state-title">No rankings yet</p>
          <p className="empty-state-desc mb-6">Create a ranking to get your crew's takes.</p>
          <Button asChild className="font-bold rounded-xl gap-2 btn-press">
            <Link to="/rankings/create">
              <Plus className="w-4 h-4" /> Create Ranking
            </Link>
          </Button>
        </motion.div>
      ) : (
        <div className="space-y-2 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-3">
          {rankings.map((r, i) => {
            const count = submissionCounts.get(r.id) || 0;
            const submitted = mySubmissions.has(r.id);
            return (
              <motion.div key={r.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 + i * 0.04 }}>
                <Link to={`/rankings/${r.id}`} className="block group">
                  <div className="glass-card min-h-[72px] p-4 hover-lift cursor-pointer">
                    <div className="flex items-center justify-between relative z-10">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{
                          background: 'linear-gradient(135deg, hsl(var(--accent) / 0.15), hsl(var(--accent) / 0.04))',
                        }}>
                          <BarChart3 className="w-5 h-5" style={{ color: 'hsl(var(--accent))' }} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm truncate">{r.topic}</h3>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-muted-foreground/70 font-medium">{r.item_count} items</span>
                            <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/15" />
                            <span className="text-[10px] text-muted-foreground/70 flex items-center gap-0.5 font-medium">
                              <Users className="w-2.5 h-2.5" /> {count} ranked
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {submitted ? (
                          <span className="status-pill bg-success/10 text-success"><CheckCircle2 className="w-3 h-3 mr-0.5" />Done</span>
                        ) : (
                          <span className={cn("status-pill", r.status === 'open' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground')}>
                            {r.status === 'open' ? 'Open' : 'Closed'}
                          </span>
                        )}
                        <ArrowRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-muted-foreground transition-all" />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
