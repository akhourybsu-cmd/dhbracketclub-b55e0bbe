import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Loader2, MessageCircle, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { useClub } from "@/contexts/ClubContext";
import {
  useAddFindComment,
  useDeleteFindComment,
  useFindComments,
} from "@/hooks/useDailyFinds";
import type { DailyFind } from "@/lib/dailyFind";
import { useDropSheetViewport } from "./useDropSheetViewport";
import "./dropSheets.css";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  find: DailyFind;
}

export function FindCommentsSheet({ open, onOpenChange, find }: Props) {
  const { user } = useAuth();
  const { club } = useClub();
  return (
    <FindCommentsSession
      key={`${user?.id}:${club?.id}:${find.id}`}
      open={open}
      onOpenChange={onOpenChange}
      find={find}
    />
  );
}

/** Keep drafts and pending callbacks inside the account that opened them. */
function FindCommentsSession({ open, onOpenChange, find }: Props) {
  const { user } = useAuth();
  const { isClubAdmin } = useClub();
  const comments = useFindComments(open ? find.id : undefined);
  const addComment = useAddFindComment();
  const deleteComment = useDeleteFindComment();
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [posting, setPosting] = useState(false);
  const [status, setStatus] = useState("");
  const alive = useRef(true);
  const submitLock = useRef(false);
  const composing = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const followLatest = useRef(true);
  const commentCount = comments.data?.length ?? find.comments?.[0]?.count ?? 0;
  useDropSheetViewport(open);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input || !open) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(112, Math.max(44, input.scrollHeight))}px`;
  }, [body, open]);

  useEffect(() => {
    if (open) followLatest.current = true;
  }, [open]);
  useEffect(() => {
    const list = listRef.current;
    if (open && list && followLatest.current)
      list.scrollTop = list.scrollHeight;
  }, [open, comments.data?.length]);

  const submit = () => {
    const sent = body.trim();
    if (!open || !sent || submitLock.current || composing.current) return;
    submitLock.current = true;
    setPosting(true);
    setError("");
    setStatus("");
    addComment.mutate(
      { findId: find.id, body: sent },
      {
        onSuccess: () => {
          if (!alive.current) return;
          setBody((current) => (current.trim() === sent ? "" : current));
          followLatest.current = true;
          setStatus("Comment posted.");
        },
        onError: () => {
          if (alive.current)
            setError("Couldn’t post. Your comment is ready to retry.");
        },
        onSettled: () => {
          if (!alive.current) return;
          submitLock.current = false;
          setPosting(false);
        },
      },
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        ref={contentRef}
        side="bottom"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          contentRef.current?.focus();
        }}
        className="drop-page drop-comments-sheet drop-social-sheet flex flex-col rounded-t-2xl border-x-0 border-b-0 p-0 sm:left-1/2 sm:right-auto sm:w-full sm:max-w-xl sm:-translate-x-1/2 sm:rounded-2xl sm:border"
      >
        <div className="drop-sheet-handle" aria-hidden="true" />
        <SheetHeader className="flex-none border-b border-border/50 px-5 pb-3 pt-2 text-left">
          <SheetTitle className="flex items-center gap-2 text-base">
            Comments{" "}
            <span className="text-sm font-medium text-muted-foreground">
              {commentCount}
            </span>
          </SheetTitle>
          <SheetDescription className="line-clamp-1 text-xs">
            {find.title}
          </SheetDescription>
        </SheetHeader>
        <div
          ref={listRef}
          className="drop-comments-list flex-1 space-y-4 px-4 py-4"
          onScroll={(event) => {
            const el = event.currentTarget;
            followLatest.current =
              el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          }}
          aria-label="Drop comments"
        >
          {comments.isLoading && (
            <div
              className="flex h-24 items-center justify-center"
              role="status"
              aria-label="Loading comments"
            >
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          )}
          {comments.isError && (
            <div className="rounded-xl bg-muted/40 p-4 text-center text-sm">
              <p>Comments couldn’t load.</p>
              <Button
                variant="outline"
                className="mt-3 h-11"
                onClick={() => comments.refetch()}
              >
                Try again
              </Button>
            </div>
          )}
          {(comments.data ?? []).map((comment) => {
            const name = comment.profiles?.display_name || "Member";
            return (
              <div key={comment.id} className="drop-comment-row flex gap-2.5">
                <Avatar className="mt-1 h-8 w-8 flex-none">
                  <AvatarImage
                    src={comment.profiles?.avatar_url ?? undefined}
                    alt=""
                  />
                  <AvatarFallback className="text-[10px]">
                    {name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex min-h-6 items-center gap-2">
                    <p className="truncate text-xs font-bold" title={name}>
                      {name}
                    </p>
                    <time
                      dateTime={comment.created_at}
                      className="flex-none whitespace-nowrap text-[10px] text-muted-foreground"
                    >
                      {new Date(comment.created_at).toLocaleDateString(
                        undefined,
                        { month: "short", day: "numeric" },
                      )}
                    </time>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                    {comment.body}
                  </p>
                </div>
                {(comment.user_id === user?.id || isClubAdmin) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={deleteComment.isPending}
                    className="h-11 w-11 flex-none self-start text-muted-foreground"
                    onClick={() =>
                      deleteComment.mutate(
                        { id: comment.id, findId: find.id },
                        {
                          onError: () => {
                            if (alive.current)
                              toast.error(
                                "Couldn’t remove that comment. Try again.",
                              );
                          },
                        },
                      )
                    }
                    aria-label="Delete comment"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            );
          })}
          {!comments.isLoading &&
            !comments.isError &&
            !comments.data?.length && (
              <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
                <MessageCircle className="h-6 w-6 opacity-50" />
                <p>No comments yet. Say something.</p>
              </div>
            )}
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          className="drop-comment-composer border-t border-border/50 p-3 pb-[max(.75rem,env(safe-area-inset-bottom))]"
        >
          {error && (
            <p role="alert" className="mb-2 text-xs text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Textarea
              ref={inputRef}
              rows={1}
              maxLength={1000}
              aria-label="Add a comment"
              value={body}
              onChange={(event) => {
                setBody(event.target.value.slice(0, 1000));
                setError("");
                setStatus("");
              }}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  (event.ctrlKey || event.metaKey) &&
                  !event.shiftKey &&
                  !event.altKey &&
                  !event.nativeEvent.isComposing &&
                  event.nativeEvent.keyCode !== 229 &&
                  !composing.current
                ) {
                  event.preventDefault();
                  submit();
                }
              }}
              onCompositionStart={() => {
                composing.current = true;
              }}
              onCompositionEnd={() => {
                composing.current = false;
              }}
              placeholder="Add a comment…"
              className="drop-comment-input flex-1 rounded-2xl bg-muted/30 px-4 text-base"
            />
            <Button
              type="submit"
              size="icon"
              className="drop-primary h-11 w-11 flex-none rounded-full"
              disabled={!body.trim() || posting || addComment.isPending}
              aria-label="Post comment"
            >
              {posting || addComment.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p role="status" className="sr-only" aria-live="polite">
            {status}
          </p>
        </form>
      </SheetContent>
    </Sheet>
  );
}
