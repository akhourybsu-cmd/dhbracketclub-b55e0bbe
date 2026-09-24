import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Send, Share2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { useAddFindComment, useDailyFind, useDeleteFind, useDeleteFindComment, useFindComments } from '@/hooks/useDailyFinds';
import { FindPhoto, FindReactionBar } from '@/components/dailyFind/FindCard';
import { FindShareSheet } from '@/components/dailyFind/FindShareSheet';
import { FindLinkPreview } from '@/components/dailyFind/FindLinkPreview';
import { formatDayKey, kindMeta } from '@/lib/dailyFind';

export default function DailyFindDetailPage() {
  const { findId } = useParams();
  const { user } = useAuth();
  const { isClubAdmin } = useClub();
  const navigate = useNavigate();
  const { data: find, isLoading } = useDailyFind(findId);
  const comments = useFindComments(findId);
  const addComment = useAddFindComment();
  const delComment = useDeleteFindComment();
  const delFind = useDeleteFind();
  const [body, setBody] = useState('');
  const [shareOpen, setShareOpen] = useState(false);

  if (isLoading) return <div className="member-page lg:mx-auto lg:max-w-2xl"><Skeleton className="h-96 rounded-2xl" /></div>;
  if (!find) return (
    <div className="member-page p-8 text-center">
       <p className="text-muted-foreground">This Drop isn't available.</p>
       <Button asChild variant="outline" className="mt-4"><Link to="/finds">Back to The Drop</Link></Button>
    </div>
  );

  const meta = kindMeta(find.kind);
  const name = find.profiles?.display_name ?? 'Member';
  const canDelete = find.user_id === user?.id || isClubAdmin;

  const post = () => {
    if (!body.trim()) return;
    addComment.mutate({ findId: find.id, body }, { onSuccess: () => setBody(''), onError: (e: Error) => toast.error(e.message) });
  };

  return (
    <div className="drop-page member-page lg:mx-auto lg:max-w-2xl">
      <div className="page-toolbar">
         <Link to="/finds" className="back-link"><ArrowLeft className="h-4 w-4" /> The Drop</Link>
        <div className="page-toolbar-actions">
          <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => setShareOpen(true)} aria-label="Share"><Share2 /></Button>
          {canDelete && (
            <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Delete" onClick={() => {
               if (!confirm('Delete this Drop?')) return;
               delFind.mutate(find, { onSuccess: () => { toast.success('Drop deleted'); navigate('/finds'); }, onError: (e: Error) => toast.error(e.message) });
            }}><Trash2 /></Button>
          )}
        </div>
      </div>

       <article className={`drop-card drop-surface drop-kind-${find.kind === 'article' ? 'read' : find.kind === 'photo' ? 'saw' : 'learned'} overflow-hidden rounded-2xl border`}>
        {find.image_path && <FindPhoto path={find.image_path} className="max-h-[60vh] w-full [&_img]:object-contain [&_img]:max-h-[60vh]" />}
        <div className="p-5">
          <div className="flex items-center gap-2.5">
            <Avatar className="h-9 w-9"><AvatarImage src={find.profiles?.avatar_url ?? undefined} /><AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
             <div className="flex-1"><p className="text-sm font-bold">Dropped by {name}</p><p className="text-xs text-muted-foreground">{formatDayKey(find.find_date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p></div>
             <span className="drop-kind-tab">{meta.label}</span>
          </div>
          <h1 className="mt-4 text-2xl font-black leading-tight tracking-tight">{find.title}</h1>
          {find.note && <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/85">{find.note}</p>}
          {find.url && <FindLinkPreview url={find.url} className="mt-4" />}
          {find.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
               {find.tags.map(t => <Link key={t} to={`/finds?tab=search`} className="text-sm font-semibold text-[hsl(var(--drop-accent))]">#{t}</Link>)}
            </div>
          )}
          <div className="mt-4"><FindReactionBar find={find} /></div>
        </div>
      </article>

      <section className="mt-5">
        <h2 className="mb-3 px-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground">Comments</h2>
        <div className="space-y-3">
          {(comments.data ?? []).map(c => (
            <div key={c.id} className="flex gap-2.5">
              <Avatar className="h-8 w-8"><AvatarImage src={c.profiles?.avatar_url ?? undefined} /><AvatarFallback className="text-xs">{(c.profiles?.display_name ?? '?').slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
              <div className="min-w-0 flex-1 rounded-2xl bg-muted/40 px-3 py-2">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold">{c.profiles?.display_name ?? 'Member'}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                  {(c.user_id === user?.id || isClubAdmin) && (
                    <button type="button" aria-label="Delete comment" onClick={() => delComment.mutate({ id: c.id, findId: find.id })} className="ml-auto text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  )}
                </div>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">{c.body}</p>
              </div>
            </div>
          ))}
          {comments.data?.length === 0 && <p className="px-1 text-sm text-muted-foreground">No comments yet — start the conversation.</p>}
        </div>
        <form onSubmit={e => { e.preventDefault(); post(); }} className="mt-4 flex gap-2">
          <Input value={body} onChange={e => setBody(e.target.value.slice(0, 1000))} placeholder="Add a comment" className="h-11" />
          <Button type="submit" size="icon" className="h-11 w-11 flex-shrink-0" disabled={!body.trim() || addComment.isPending} aria-label="Post comment">
            {addComment.isPending ? <Loader2 className="animate-spin" /> : <Send />}
          </Button>
        </form>
      </section>
      <FindShareSheet open={shareOpen} onOpenChange={setShareOpen} find={find} />
    </div>
  );
}
