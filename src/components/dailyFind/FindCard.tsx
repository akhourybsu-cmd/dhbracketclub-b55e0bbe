import { memo, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, MessageCircle, RotateCcw, Share2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useClub } from "@/contexts/ClubContext";
import { useFindImage, useToggleFindReaction } from "@/hooks/useDailyFinds";
import { FIND_REACTIONS, type DailyFind } from "@/lib/dailyFind";
import { pauseDropPlayback } from "@/lib/dropPlayback";
import { FindShareSheet } from "./FindShareSheet";
import { FindLinkPreview } from "./FindLinkPreview";
import { FindCommentsSheet } from "./FindCommentsSheet";
import { toast } from "sonner";
import "./dropSocial.css";

export function FindPhoto({
  path,
  className,
}: {
  path: string | null;
  className?: string;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [nearViewport, setNearViewport] = useState(false);
  const image = useFindImage(path, nearViewport);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") {
      setNearViewport(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setNearViewport(entry.isIntersecting),
      { rootMargin: "600px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [path]);
  useEffect(() => setFailed(false), [path, image.url]);
  if (!path) return null;
  return (
    <div ref={frame} className={"drop-social-photo " + (className || "")}>
      {image.error || failed ? (
        <button
          className="drop-photo-retry"
          onClick={() => {
            setFailed(false);
            image.retry();
          }}
        >
          <RotateCcw size={18} />
          Load photo
        </button>
      ) : image.url ? (
        <img
          src={image.url}
          alt="Shared photo"
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          className="drop-photo-placeholder"
          role="status"
          aria-label="Loading photo"
        />
      )}
    </div>
  );
}
export function FindReactionBar({
  find,
  compact,
}: {
  find: DailyFind;
  compact?: boolean;
}) {
  const { user } = useAuth(),
    toggle = useToggleFindReaction();
  const reactions = find.reactions || [];
  return (
    <div className="drop-social-reactions">
      {(compact ? ["❤️"] : FIND_REACTIONS).map((emoji) => {
        const count = reactions.filter((r) => r.emoji === emoji).length,
          has = reactions.some(
            (r) => r.emoji === emoji && r.user_id === user?.id,
          );
        return (
          <button
            key={emoji}
            aria-label={"React " + emoji}
            aria-pressed={has}
            disabled={toggle.isPending}
            onClick={() =>
              toggle.mutate(
                { findId: find.id, emoji, has },
                { onError: (error: Error) => toast.error(error.message) },
              )
            }
          >
            {emoji}
            {count > 0 && <span>{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
function timeLabel(value: string) {
  const date = new Date(value),
    minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (!Number.isFinite(minutes)) return "";
  if (minutes < 1) return "Just now";
  if (minutes < 60) return minutes + "m";
  if (minutes < 1440) return Math.floor(minutes / 60) + "h";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function FindCardInner({
  find,
  expanded = false,
  onComments,
}: {
  find: DailyFind;
  index?: number;
  immersive?: boolean;
  expanded?: boolean;
  onComments?: () => void;
}) {
  const { user } = useAuth(),
    toggle = useToggleFindReaction();
  const { club } = useClub();
  const [showMore, setShowMore] = useState(expanded);
  const [shareOpen, setShareOpen] = useState(false),
    [commentsOpen, setCommentsOpen] = useState(false),
    [visitedComments, setVisitedComments] = useState(false);
  useEffect(() => {
    setShowMore(expanded);
    setShareOpen(false);
    setCommentsOpen(false);
    setVisitedComments(false);
  }, [find.id, user?.id, club?.id, expanded]);
  const name = find.profiles?.display_name || "Member",
    reactions = find.reactions || [];
  const likes = reactions.filter((r) => r.emoji === "❤️").length,
    liked = reactions.some((r) => r.emoji === "❤️" && r.user_id === user?.id);
  const commentCount = find.comments?.[0]?.count || 0;
  const long = (find.note?.length || 0) > 220;
  const note =
    find.note && !showMore && long ? find.note.slice(0, 220) + "…" : find.note;
  const openComments = () => {
    pauseDropPlayback();
    if (onComments) onComments();
    else {
      setVisitedComments(true);
      setCommentsOpen(true);
    }
  };
  return (
    <article className="drop-social-card" data-drop-id={find.id}>
      <header className="drop-social-author">
        <Avatar className="h-10 w-10">
          <AvatarImage src={find.profiles?.avatar_url || undefined} alt="" />
          <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <Link
          className="drop-social-author-info"
          to={"/finds/" + find.id}
          aria-label={"Open Drop: " + find.title + ". Shared by " + name}
        >
          <strong>{name}</strong>
          <time
            dateTime={find.created_at}
            title={new Date(find.created_at).toLocaleString()}
          >
            {timeLabel(find.created_at)}
          </time>
        </Link>
      </header>
      <div className="drop-social-caption">
        <h2>{find.title}</h2>
        {note && <p>{note}</p>}
        {long && !expanded && (
          <button
            className="drop-social-expand"
            onClick={() => setShowMore((value) => !value)}
          >
            {showMore ? "Less" : "More"}
          </button>
        )}
        {!!find.tags?.length && (
          <div className="drop-social-tags">
            {find.tags.slice(0, 3).map((tag) => (
              <Link
                key={tag}
                to={"/finds?tag=" + encodeURIComponent(tag)}
                onClick={() => pauseDropPlayback()}
              >
                #{tag}
              </Link>
            ))}
          </div>
        )}
      </div>
      {find.image_path && <FindPhoto path={find.image_path} />}
      {find.url && <FindLinkPreview url={find.url} />}
      <footer className="drop-social-actions">
        <button
          aria-label={(liked ? "Unlike" : "Like") + " Drop"}
          aria-pressed={liked}
          aria-busy={toggle.isPending || undefined}
          disabled={toggle.isPending}
          onClick={() =>
            toggle.mutate(
              { findId: find.id, emoji: "❤️", has: liked },
              { onError: (error: Error) => toast.error(error.message) },
            )
          }
        >
          <Heart size={21} fill={liked ? "currentColor" : "none"} />
          <span>{likes || "Like"}</span>
        </button>
        <button aria-label="Open comments" onClick={openComments}>
          <MessageCircle size={21} />
          <span>{commentCount || "Comment"}</span>
        </button>
        <button
          aria-label="Share this Drop"
          onClick={() => {
            pauseDropPlayback();
            setShareOpen(true);
          }}
        >
          <Share2 size={20} />
          <span>Share</span>
        </button>
      </footer>
      {commentCount > 0 && (
        <button className="drop-social-comment-link" onClick={openComments}>
          View{" "}
          {commentCount === 1 ? "comment" : "all " + commentCount + " comments"}
        </button>
      )}
      {shareOpen && (
        <FindShareSheet
          open={shareOpen}
          onOpenChange={setShareOpen}
          find={find}
        />
      )}
      {visitedComments && (
        <FindCommentsSheet
          open={commentsOpen}
          onOpenChange={setCommentsOpen}
          find={find}
        />
      )}
    </article>
  );
}
export const FindCard = memo(FindCardInner);
