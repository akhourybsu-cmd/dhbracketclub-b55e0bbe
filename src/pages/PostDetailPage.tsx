import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { ArrowLeft, Send, Trash2, Pin } from 'lucide-react';
import ShareButton from '@/components/ShareButton';
import { format, formatDistanceToNow } from 'date-fns';
import { UserAvatar } from '@/components/chat/UserAvatar';
import { useSoundEffect } from '@/hooks/useSoundEffect';
import { toast } from 'sonner';
import { notify } from '@/lib/notify';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MemberLoadError } from '@/components/member/MemberLoadError';
import { memberData, memberErrorMessage } from '@/lib/memberData';

type Comment = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  parent_comment_id: string | null;
  profiles?: { display_name: string };
};

export default function PostDetailPage() {
  const { postId } = useParams<{ postId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { play } = useSoundEffect();
  const [post, setPost] = useState<any>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commenting, setCommenting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);

  const fetchData = useCallback(async () => {
    if (!postId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [p, c] = await Promise.all([
        memberData(supabase.from('posts').select('*, profiles:user_id(display_name)').eq('id', postId).single(), 'Load discussion'),
        memberData(supabase.from('post_comments').select('*, profiles:user_id(display_name)').eq('post_id', postId).order('created_at'), 'Load comments'),
      ]);
      setPost(p);
      setComments((c ?? []) as Comment[]);
    } catch (loadError) {
      setError(memberErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const handleComment = async () => {
    if (!newComment.trim() || !user || !postId) return;
    play('tap');
    const content = newComment.trim();
    setNewComment('');
    setCommenting(true);
    try {
      await memberData(
        supabase.from('post_comments').insert({ post_id: postId, user_id: user.id, content }).select('id'),
        'Post comment',
      );
      const data = await memberData(
        supabase.from('post_comments').select('*, profiles:user_id(display_name)').eq('post_id', postId).order('created_at'),
        'Refresh comments',
      );
      setComments((data ?? []) as Comment[]);

      // Notify post author (if not self) + prior commenters.
      if (post) {
        const priorCommenters = (data || [])
          .map((c: any) => c.user_id)
          .filter((uid: string) => uid && uid !== user.id);
        const recipients = Array.from(new Set([post.user_id, ...priorCommenters])).filter(
          (uid) => uid && uid !== user.id,
        );
        if (recipients.length > 0) {
          const senderName = user.user_metadata?.display_name || 'Someone';
          const preview = content.length > 80 ? content.slice(0, 80) + '…' : content;
          void notify({
            type: 'posts',
            title: post.user_id === user.id
              ? `${senderName} replied on their post`
              : `${senderName} commented on "${post.title || 'your post'}"`,
            message: preview,
            tag: `dh-posts-${postId}`,
            url: `/posts/${postId}`,
            senderUserId: user.id,
            targetUserIds: recipients,
          });
        }
      }
    } catch (commentError) {
      setNewComment(content);
      toast.error(memberErrorMessage(commentError));
    } finally {
      setCommenting(false);
    }
  };

  const handleDelete = async () => {
    if (!postId) return;
    setDeleting(true);
    try {
      await memberData(supabase.from('post_comments').delete().eq('post_id', postId).select('id'), 'Delete comments');
      await memberData(supabase.from('posts').delete().eq('id', postId).select('id'), 'Delete discussion');
      toast.success('Post deleted');
      navigate('/feed');
    } catch (deleteError) {
      toast.error(memberErrorMessage(deleteError));
      setDeleting(false);
    }
  };

  const togglePin = async () => {
    if (!postId || !post) return;
    play('tap');
    const snapshot = post;
    const nextPinned = !post.is_pinned;
    setPost({ ...post, is_pinned: nextPinned });
    try {
      await memberData(
        supabase.from('posts').update({ is_pinned: nextPinned }).eq('id', postId).select('id'),
        nextPinned ? 'Pin discussion' : 'Unpin discussion',
      );
    } catch (pinError) {
      setPost(snapshot);
      toast.error(memberErrorMessage(pinError));
    }
  };

  if (loading) return <div className="loading-spinner"><div className="loading-spinner-ring" /><p className="loading-spinner-text">Loading…</p></div>;
  if (error) return <div className="member-page max-w-3xl mx-auto"><MemberLoadError message={error} onRetry={() => void fetchData()} /></div>;
  if (!post) return <div className="text-center py-16 text-muted-foreground font-medium text-sm">Post not found</div>;

  const isAuthor = user?.id === post.user_id;

  return (
    <div className="member-page max-w-3xl mx-auto" aria-busy={commenting || deleting}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <button onClick={() => navigate('/feed')} className="back-link">
          <ArrowLeft className="w-3.5 h-3.5" /> Feed
        </button>

        {post.is_pinned && (
          <div className="flex items-center gap-1 text-[9px] font-bold mb-2" style={{ color: 'hsl(var(--premium-warm))' }}>
            <Pin className="w-2.5 h-2.5" /> Pinned
          </div>
        )}

        <div className="flex items-start justify-between gap-3 mb-2">
          <h1 className="text-xl font-extrabold tracking-tight">{post.title}</h1>
          <ShareButton contentType="post" contentId={postId!} title={post.title} />
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground/60 mb-4">
          <span className="font-semibold text-foreground/60">{post.profiles?.display_name}</span>
          <span>·</span>
          <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
        </div>

        <div className="text-[13px] text-foreground/80 leading-relaxed whitespace-pre-wrap mb-6">{post.content}</div>

        {isAuthor && (
          <div className="flex gap-2 mb-6">
            <Button variant="ghost" size="sm" onClick={togglePin} className="text-xs h-11 rounded-xl text-muted-foreground/70">
              <Pin className="w-3 h-3 mr-1" /> {post.is_pinned ? 'Unpin' : 'Pin'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowDeleteAlert(true)} className="text-xs h-11 rounded-xl text-destructive/70 hover:text-destructive">
              <Trash2 className="w-3 h-3 mr-1" /> Delete
            </Button>
          </div>
        )}

        {/* Comments */}
        <div className="border-t border-border/25 pt-4">
          <h3 className="text-[13px] font-bold mb-3">
            Comments {comments.length > 0 && `(${comments.length})`}
          </h3>
          <div className="space-y-3 mb-4">
            {comments.map(c => (
              <div key={c.id} className="flex gap-2.5">
                <div className="flex-shrink-0 mt-0.5">
                  <UserAvatar userId={c.user_id} name={c.profiles?.display_name || '?'} size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-foreground/80">{c.profiles?.display_name}</span>
                    <span className="text-[9px] text-muted-foreground/70">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
                  </div>
                  <p className="text-[12px] text-foreground/80 leading-relaxed">{c.content}</p>
                </div>
              </div>
            ))}
            {comments.length === 0 && <p className="text-xs text-muted-foreground/70">No comments yet</p>}
          </div>
          <div className="flex items-center gap-2">
            <Input
              aria-label="Discussion comment"
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleComment()}
              placeholder="Add a comment..."
              className="flex-1 h-11 text-xs bg-muted/50 border-border/35 rounded-xl"
            />
            <Button size="sm" onClick={handleComment} disabled={!newComment.trim() || commenting} className="h-11 w-11 p-0 rounded-xl" aria-label="Post comment">
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </motion.div>

      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Post</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{post?.title}" and all its comments. This can't be undone.
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
