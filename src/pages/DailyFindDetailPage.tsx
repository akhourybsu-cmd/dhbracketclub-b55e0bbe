import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useClub } from "@/contexts/ClubContext";
import {
  useAddFindComment,
  useDailyFind,
  useDeleteFind,
  useDeleteFindComment,
  useFindComments,
} from "@/hooks/useDailyFinds";
import { FindCard } from "@/components/dailyFind/FindCard";
import { MemberLoadError } from "@/components/member/MemberLoadError";

export default function DailyFindDetailPage() {
  const { findId } = useParams();
  const { user } = useAuth();
  const { isClubAdmin } = useClub();
  const navigate = useNavigate();
  const query = useDailyFind(findId);
  const { data: find, isLoading } = query;
  const comments = useFindComments(findId);
  const addComment = useAddFindComment();
  const delComment = useDeleteFindComment();
  const delFind = useDeleteFind();
  const [body, setBody] = useState("");
  const commentInput = useRef<HTMLTextAreaElement>(null);
  const sendLock = useRef(false);

  if (isLoading)
    return (
      <div className="member-page lg:mx-auto lg:max-w-2xl">
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  if (query.isError)
    return <MemberLoadError onRetry={() => void query.refetch()} />;
  if (!find)
    return (
      <div className="member-page p-8 text-center">
        <p className="text-muted-foreground">This Drop isn't available.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/finds">Back to The Drop</Link>
        </Button>
      </div>
    );

  const canDelete = find.user_id === user?.id || isClubAdmin;

  const post = () => {
    if (!body.trim() || sendLock.current) return;
    const sent = body.trim();
    sendLock.current = true;
    addComment.mutate(
      { findId: find.id, body: sent },
      {
        onSuccess: () =>
          setBody((current) => (current.trim() === sent ? "" : current)),
        onError: (e: Error) => toast.error(e.message),
        onSettled: () => {
          sendLock.current = false;
        },
      },
    );
  };

  return (
    <div className="drop-page member-page drop-social">
      <div className="drop-tabs page-toolbar sticky top-0 z-20 mb-4 rounded-xl border px-2">
        <Link to="/finds" className="back-link">
          <ArrowLeft className="h-4 w-4" /> The Drop
        </Link>
        <div className="page-toolbar-actions">
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11"
              aria-label="Delete"
              onClick={() => {
                if (!confirm("Delete this Drop?")) return;
                delFind.mutate(find, {
                  onSuccess: () => {
                    toast.success("Drop deleted");
                    navigate("/finds");
                  },
                  onError: (e: Error) => toast.error(e.message),
                });
              }}
            >
              <Trash2 />
            </Button>
          )}
        </div>
      </div>

      <h1 className="sr-only">{find.title}</h1>
      <FindCard
        find={find}
        expanded
        onComments={() => {
          commentInput.current?.scrollIntoView({
            block: "center",
            behavior: "auto",
          });
          commentInput.current?.focus();
        }}
      />

      <section className="mt-5">
        <h2 className="mb-3 px-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground">
          Comments
        </h2>
        <div className="space-y-3">
          {comments.isLoading && <p role="status">Loading comments…</p>}
          {comments.isError && (
            <MemberLoadError compact onRetry={() => void comments.refetch()} />
          )}
          {(comments.data ?? []).map((c) => (
            <div key={c.id} className="flex gap-2.5">
              <Avatar className="h-8 w-8">
                <AvatarImage src={c.profiles?.avatar_url ?? undefined} />
                <AvatarFallback className="text-xs">
                  {(c.profiles?.display_name ?? "?").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="drop-surface min-w-0 flex-1 rounded-2xl border px-3 py-2">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold">
                    {c.profiles?.display_name ?? "Member"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(c.created_at).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                  {(c.user_id === user?.id || isClubAdmin) && (
                    <button
                      type="button"
                      aria-label="Delete comment"
                      onClick={() =>
                        delComment.mutate(
                          { id: c.id, findId: find.id },
                          {
                            onError: (error: Error) =>
                              toast.error(error.message),
                          },
                        )
                      }
                      className="ml-auto flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">
                  {c.body}
                </p>
              </div>
            </div>
          ))}
          {!comments.isLoading &&
            !comments.isError &&
            comments.data?.length === 0 && (
              <p className="px-1 text-sm text-muted-foreground">
                No comments yet — start the conversation.
              </p>
            )}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            post();
          }}
          className="drop-surface sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] mt-4 flex items-end gap-2 rounded-xl border p-2 lg:bottom-3"
        >
          <Textarea
            ref={commentInput}
            aria-label="Add a comment"
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 1000))}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                (event.ctrlKey || event.metaKey) &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                post();
              }
            }}
            placeholder="Add a comment"
            rows={2}
            maxLength={1000}
            className="min-h-11 max-h-32 min-w-0 resize-y border-0 bg-transparent text-base shadow-none"
          />
          <Button
            type="submit"
            size="icon"
            className="h-11 w-11 flex-shrink-0"
            disabled={!body.trim() || addComment.isPending}
            aria-label="Post comment"
          >
            {addComment.isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Send />
            )}
          </Button>
        </form>
      </section>
    </div>
  );
}
