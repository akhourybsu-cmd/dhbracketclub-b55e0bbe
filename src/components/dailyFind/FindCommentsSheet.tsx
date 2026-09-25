import { useState } from 'react';
import { Loader2, MessageCircle, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { useAddFindComment, useDeleteFindComment, useFindComments } from '@/hooks/useDailyFinds';
import type { DailyFind } from '@/lib/dailyFind';

interface Props { open: boolean; onOpenChange: (open: boolean) => void; find: DailyFind }

export function FindCommentsSheet({ open, onOpenChange, find }: Props) {
  const { user } = useAuth();
  const { isClubAdmin } = useClub();
  const comments = useFindComments(open ? find.id : undefined);
  const addComment = useAddFindComment();
  const deleteComment = useDeleteFindComment();
  const [body, setBody] = useState('');
  const commentCount = comments.data?.length ?? find.comments?.[0]?.count ?? 0;

  const submit = () => {
    if (!body.trim()) return;
    addComment.mutate({ findId: find.id, body }, {
      onSuccess: () => setBody(''),
      onError: (error: Error) => toast.error(error.message),
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="drop-page drop-comments-sheet flex max-h-[82dvh] flex-col rounded-t-2xl border-x-0 border-b-0 p-0 sm:left-1/2 sm:max-w-xl sm:-translate-x-1/2 sm:rounded-2xl sm:border">
        <div className="drop-sheet-handle" aria-hidden="true" />
        <SheetHeader className="border-b border-[hsl(var(--drop-edge))] px-5 pb-4 pt-2 text-left">
          <SheetTitle className="flex items-center gap-2"><MessageCircle className="h-5 w-5 text-[hsl(var(--drop-accent))]" /> Comments <span className="text-sm font-semibold text-muted-foreground">{commentCount}</span></SheetTitle>
          <SheetDescription className="line-clamp-1">On “{find.title}”</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {comments.isLoading && <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--drop-accent))]" /></div>}
          {comments.isError && <div className="rounded-lg border border-destructive/30 p-4 text-center text-sm"><p>Comments could not load.</p><Button variant="outline" size="sm" className="mt-3" onClick={() => comments.refetch()}>Try again</Button></div>}
          {(comments.data ?? []).map(comment => {
            const name = comment.profiles?.display_name ?? 'Member';
            return (
              <div key={comment.id} className="drop-comment-row flex gap-2.5">
                <Avatar className="h-8 w-8 flex-none"><AvatarImage src={comment.profiles?.avatar_url ?? undefined} /><AvatarFallback className="text-[10px]">{name.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                <div className="drop-comment-bubble min-w-0 flex-1 rounded-lg px-3 py-2.5">
                  <div className="flex items-center gap-2"><p className="text-xs font-bold">{name}</p><p className="text-[10px] text-muted-foreground">{new Date(comment.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                    {(comment.user_id === user?.id || isClubAdmin) && <Button type="button" variant="ghost" size="icon" className="ml-auto h-8 w-8" onClick={() => deleteComment.mutate({ id: comment.id, findId: find.id })} aria-label="Delete comment"><Trash2 className="h-3.5 w-3.5" /></Button>}
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed">{comment.body}</p>
                </div>
              </div>
            );
          })}
          {!comments.isLoading && !comments.isError && comments.data?.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No comments yet. Start the conversation.</p>}
        </div>
        <form onSubmit={event => { event.preventDefault(); submit(); }} className="drop-comment-composer flex gap-2 border-t border-[hsl(var(--drop-edge))] p-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">
          <Input value={body} onChange={event => setBody(event.target.value.slice(0, 1000))} placeholder="Add a comment…" className="h-11 flex-1 bg-[hsl(var(--drop-paper-strong))]" />
          <Button type="submit" size="icon" className="drop-primary h-11 w-11 flex-none" disabled={!body.trim() || addComment.isPending} aria-label="Post comment">{addComment.isPending ? <Loader2 className="animate-spin" /> : <Send />}</Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}