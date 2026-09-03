import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { MessageCircle, Plus, ArrowRight, Users, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

export default function PollsListPage() {
  const { user } = useAuth();
  const [polls, setPolls] = useState<any[]>([]);
  const [voteCounts, setVoteCounts] = useState<Map<string, number>>(new Map());
  const [myVotes, setMyVotes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from('polls')
        .select('*, competitions(title, status), profiles:created_by(display_name)')
        .order('created_at', { ascending: false });

      if (data) {
        setPolls(data);
        const pollIds = data.map(p => p.id);

        if (pollIds.length > 0) {
          const [{ data: allVotes }, { data: mine }] = await Promise.all([
            supabase.from('poll_votes').select('poll_id').in('poll_id', pollIds),
            supabase.from('poll_votes').select('poll_id').eq('user_id', user.id).in('poll_id', pollIds),
          ]);

          if (allVotes) {
            const counts = new Map<string, number>();
            allVotes.forEach(v => counts.set(v.poll_id, (counts.get(v.poll_id) || 0) + 1));
            setVoteCounts(counts);
          }
          if (mine) {
            setMyVotes(new Set(mine.map(v => v.poll_id)));
          }
        }
      }
      setLoading(false);
    };
    fetch();
  }, [user]);

  return (
    <div className="member-page">
      <div className="page-toolbar">
        <div className="page-header mb-0">
          <div className="page-header-icon" style={{
            background: 'linear-gradient(135deg, hsl(var(--warning) / 0.2), hsl(var(--warning) / 0.05))',
            boxShadow: '0 0 12px hsl(var(--warning) / 0.15)',
          }}>
            <MessageCircle className="w-5 h-5" style={{ color: 'hsl(var(--warning))' }} />
          </div>
          <div>
            <h1 className="page-header-title">Polls</h1>
            <p className="page-header-subtitle">Quick votes & group decisions</p>
          </div>
        </div>
        <Link to="/polls/create">
          <Button size="sm" className="page-action gap-1.5 btn-press">
            <Plus className="w-4 h-4" /> Create
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2.5">
          {[1, 2].map(i => (
            <div key={i} className="glass-card p-5">
              <div className="h-4 rounded-lg w-2/3 mb-2.5 skeleton-shimmer" />
              <div className="h-3 rounded-lg w-1/3 skeleton-shimmer" />
            </div>
          ))}
        </div>
      ) : polls.length === 0 ? (
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="empty-state">
          <div className="empty-state-icon" style={{
            background: 'linear-gradient(135deg, hsl(var(--warning) / 0.12), hsl(var(--warning) / 0.04))',
          }}>
            <MessageCircle className="w-7 h-7" style={{ color: 'hsl(var(--warning) / 0.6)' }} />
          </div>
          <p className="empty-state-title">No polls yet</p>
          <p className="empty-state-desc mb-6">Create a poll to settle the debate.</p>
          <Link to="/polls/create">
            <Button className="font-bold rounded-xl gap-2 btn-press">
              <Plus className="w-4 h-4" /> Create Poll
            </Button>
          </Link>
        </motion.div>
      ) : (
        // Mobile/tablet: vertical list. lg+: 2-col grid so wide
        // desktops aren't a tall single column of cards.
        <div className="space-y-2 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-3">
          {polls.map((p, i) => {
            const count = voteCounts.get(p.id) || 0;
            const voted = myVotes.has(p.id);
            return (
              <motion.div key={p.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 + i * 0.04 }}>
                <Link to={`/polls/${p.id}`} className="block group">
                  <div className="glass-card min-h-[72px] p-4 hover-lift cursor-pointer">
                    <div className="flex items-center justify-between relative z-10">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{
                          background: 'linear-gradient(135deg, hsl(var(--warning) / 0.15), hsl(var(--warning) / 0.04))',
                        }}>
                          <MessageCircle className="w-5 h-5" style={{ color: 'hsl(var(--warning))' }} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm truncate">{p.question}</h3>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-muted-foreground/70 font-medium">
                              {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
                            </span>
                            <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/15" />
                            <span className="text-[10px] text-muted-foreground/70 flex items-center gap-0.5 font-medium">
                              <Users className="w-2.5 h-2.5" /> {count} vote{count !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {voted ? (
                          <span className="status-pill bg-success/10 text-success"><CheckCircle2 className="w-3 h-3 mr-0.5" />Voted</span>
                        ) : (
                          <span className={cn("status-pill", 
                            (p.status === 'open' && !(p.closes_at && new Date(p.closes_at) < new Date())) 
                              ? 'bg-success/10 text-success' 
                              : 'bg-muted text-muted-foreground'
                          )}>
                            {(p.status === 'open' && !(p.closes_at && new Date(p.closes_at) < new Date())) ? 'Open' : 'Closed'}
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
