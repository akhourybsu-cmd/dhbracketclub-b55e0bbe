import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Plus, MessageSquare, Pin, Heart, ChevronRight, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useSoundEffect } from '@/hooks/useSoundEffect';
import { logActivity } from '@/lib/activityLogger';
import { toast } from 'sonner';
import { memberData, memberErrorMessage } from '@/lib/memberData';
import { MemberLoadError } from '@/components/member/MemberLoadError';

type Post = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  is_pinned: boolean;
  comments_count: number;
  created_at: string;
  profiles?: { display_name: string };
};

export default function PostsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { play } = useSoundEffect();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', content: '' });
  const [creating, setCreating] = useState(false);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await memberData(supabase
        .from('posts')
        .select('*, profiles:user_id(display_name)')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false }), 'discussions');

      if (data) {
        const postIds = data.map(p => p.id);
        const countMap = new Map<string, number>();
        if (postIds.length > 0) {
          const comments = await memberData(supabase
            .from('post_comments')
            .select('post_id')
            .in('post_id', postIds), 'discussion replies');
          comments?.forEach(c => countMap.set(c.post_id, (countMap.get(c.post_id) || 0) + 1));
        }
        setPosts(data.map(p => ({ ...p, comments_count: countMap.get(p.id) || 0 })));
      }
    } catch (cause) {
      setError(memberErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchPosts(); }, [fetchPosts]);

  const handleCreate = async () => {
    if (!form.title.trim() || !form.content.trim() || !user) return;
    setCreating(true);
    try {
      const data = await memberData(supabase.from('posts').insert({
        user_id: user.id,
        title: form.title.trim(),
        content: form.content.trim(),
      }).select().single(), 'create discussion');
      play('success');
      void logActivity(user.id, { event_type: 'post_created', target_type: 'post', target_id: data.id, metadata: { title: data.title } }).catch(() => {});
      setShowCreate(false);
      setForm({ title: '', content: '' });
      navigate(`/posts/${data.id}`);
    } catch {
      toast.error('Couldn’t create the discussion. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="member-page">
      <div>
        <div className="page-toolbar">
          <div className="page-header mb-0">
            <div className="page-header-icon"><FileText /></div>
            <div>
              <h1 className="page-header-title">Discussions</h1>
              <p className="page-header-subtitle">Conversations & threads</p>
            </div>
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)} className="page-action gap-1.5 text-xs">
            <Plus className="w-3.5 h-3.5" /> New Post
          </Button>
        </div>

        {/* Create form */}
        <AnimatePresence>
          {showCreate && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-6">
              <div className="glass-card p-4 space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-bold">New Discussion</h3>
                  <button onClick={() => setShowCreate(false)} className="w-11 h-11 -m-2 rounded-xl hover:bg-muted/50 flex items-center justify-center" aria-label="Close new discussion"><X className="w-4 h-4" /></button>
                </div>
                <Input aria-label="Discussion title" placeholder="Title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="h-11 text-sm rounded-xl" />
                <Textarea aria-label="Discussion message" placeholder="What's on your mind?" value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} className="text-sm min-h-[100px]" />
                <Button onClick={handleCreate} disabled={creating || !form.title.trim() || !form.content.trim()} className="w-full h-11 rounded-xl text-xs font-bold">
                  {creating ? 'Posting…' : 'Post Discussion'}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading skeletons */}
        {loading && (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="glass-card p-4">
                <div className="h-3.5 rounded-md w-2/3 skeleton-shimmer mb-2" />
                <div className="h-2.5 rounded-md w-full skeleton-shimmer mb-2" />
                <div className="flex justify-between">
                  <div className="h-2 rounded w-28 skeleton-shimmer" />
                  <div className="h-2 rounded w-10 skeleton-shimmer" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Posts list */}
        {!loading && !error && (
        <div className="space-y-2 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-3">
          {posts.map((post, i) => (
            <motion.div key={post.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <Link to={`/posts/${post.id}`} className="block group">
                <div className="glass-card p-4 transition-all duration-200 group-hover:border-primary/15">
                  <div className="relative z-10">
                    {post.is_pinned && (
                      <div className="flex items-center gap-1 text-[9px] font-bold text-premium-warm mb-1.5">
                        <Pin className="w-2.5 h-2.5" /> Pinned
                      </div>
                    )}
                    <h3 className="font-bold text-[14px] tracking-tight mb-1">{post.title}</h3>
                    <p className="text-[12px] text-foreground/65 line-clamp-2 leading-relaxed mb-2">{post.content}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60">
                        <span className="font-semibold">{post.profiles?.display_name}</span>
                        <span>·</span>
                        <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                          <MessageSquare className="w-3 h-3" /> {post.comments_count}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
        )}

        {error && !loading && <MemberLoadError message={error} onRetry={() => void fetchPosts()} />}

        {posts.length === 0 && !loading && !error && (
          <div className="empty-state">
            <div className="empty-state-icon"><FileText /></div>
            <p className="empty-state-title">No discussions yet</p>
            <p className="empty-state-desc mb-4">Start a conversation with your crew.</p>
            <Button size="sm" onClick={() => setShowCreate(true)} className="h-11 gap-1.5 font-bold rounded-xl">
              <Plus className="w-3.5 h-3.5" /> New Post
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
