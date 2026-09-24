import { memo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, Camera, Clock3, Lightbulb, MessageCircle, Share2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useFindImageUrl, useToggleFindReaction } from '@/hooks/useDailyFinds';
import { FIND_REACTIONS, formatDayKey, kindMeta, type DailyFind } from '@/lib/dailyFind';
import { FindShareSheet } from './FindShareSheet';
import { FindLinkPreview } from './FindLinkPreview';
import { toast } from 'sonner';

const KIND_ICON = { learned: Lightbulb, article: BookOpen, photo: Camera } as const;
const KIND_TONE = { learned: 'drop-kind-learned', article: 'drop-kind-read', photo: 'drop-kind-saw' } as const;

export function FindPhoto({ path, className }: { path: string | null; className?: string }) {
  const url = useFindImageUrl(path);
  if (!path) return null;
  return (
    <div className={cn('overflow-hidden bg-muted/40', className)}>
      {url
        ? <img src={url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        : <div className="h-full w-full animate-pulse" />}
    </div>
  );
}

export function FindReactionBar({ find, compact }: { find: DailyFind; compact?: boolean }) {
  const { user } = useAuth();
  const toggle = useToggleFindReaction();
  const reactions = find.reactions ?? [];
  const shown = compact ? FIND_REACTIONS.filter(e => reactions.some(r => r.emoji === e)) : FIND_REACTIONS;
  const list = compact && shown.length === 0 ? FIND_REACTIONS.slice(0, 3) : shown;
  return (
    <div className="flex flex-wrap gap-1.5">
      {list.map(emoji => {
        const count = reactions.filter(r => r.emoji === emoji).length;
        const has = reactions.some(r => r.emoji === emoji && r.user_id === user?.id);
        return (
          <motion.button
            key={emoji}
            type="button"
            whileTap={{ scale: 0.85 }}
            onClick={(e) => {
              e.preventDefault(); e.stopPropagation();
              toggle.mutate({ findId: find.id, emoji, has }, { onError: (err: Error) => toast.error(err.message) });
            }}
            aria-pressed={has}
            aria-label={`React ${emoji}`}
            className={cn(
              'flex h-9 min-w-[2.75rem] items-center justify-center gap-1 rounded-full border px-2.5 text-sm transition-colors',
              has ? 'border-[hsl(var(--drop-accent)/0.6)] bg-[hsl(var(--drop-accent)/0.12)]' : 'border-border/50 bg-muted/30 hover:bg-muted/60',
            )}
          >
            <span>{emoji}</span>
            {count > 0 && <span className="text-xs font-bold tabular-nums text-foreground/80">{count}</span>}
          </motion.button>
        );
      })}
    </div>
  );
}

function FindCardInner({ find, index = 0 }: { find: DailyFind; index?: number }) {
  const [shareOpen, setShareOpen] = useState(false);
  const meta = kindMeta(find.kind);
  const KindIcon = KIND_ICON[find.kind];
  const name = find.profiles?.display_name ?? 'Member';
  const comments = find.comments?.[0]?.count ?? 0;
  const postedAt = new Date(find.created_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const ageMs = Date.now() - new Date(find.created_at).getTime();
  const fresh = Number.isFinite(ageMs) && ageMs >= 0 && ageMs < 24 * 60 * 60 * 1000;

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 8) * 0.04, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3 }}
      className={cn('drop-card drop-surface overflow-hidden border-y sm:rounded-xl sm:border', KIND_TONE[find.kind])}
    >
      <Link to={`/finds/${find.id}`} className="block active:opacity-90">
        <header className="flex items-center gap-3 px-4 pb-2 pt-4 sm:px-5">
          <Avatar className="h-10 w-10 border border-border/60"><AvatarImage src={find.profiles?.avatar_url ?? undefined} /><AvatarFallback className="text-[10px] font-bold">{name.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{name}</p><p className="flex items-center gap-1 text-[11px] text-muted-foreground"><Clock3 className="h-3 w-3" />{formatDayKey(find.find_date, { month: 'short', day: 'numeric' })} · {postedAt}</p></div>
          {fresh && <span className="drop-fresh-badge">Fresh</span>}
        </header>

        <div className="px-4 pb-1 pt-2 sm:px-5">
          <span className="drop-kind-tab"><KindIcon className="h-3.5 w-3.5" /> {meta.label}</span>
          <h3 className={cn('drop-card-title mt-3 text-[25px] leading-[1.08] sm:text-[30px]', find.kind === 'learned' && 'drop-thought-title')}>{find.title}</h3>
          {find.note && <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/75 line-clamp-4">{find.note}</p>}
          {find.image_path && <FindPhoto path={find.image_path} className={cn('-mx-4 mt-4 w-[calc(100%+2rem)] border-y border-[hsl(var(--drop-accent)/0.2)] sm:-mx-5 sm:w-[calc(100%+2.5rem)]', find.kind === 'photo' ? 'aspect-[4/5] max-h-[680px]' : 'aspect-[16/10] max-h-96')} />}
          {find.url && <FindLinkPreview url={find.url} compact className="mt-4" />}
          {find.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {find.tags.map(t => <span key={t} className="text-xs font-semibold text-[hsl(var(--drop-accent))]">#{t}</span>)}
            </div>
          )}
        </div>
      </Link>

       <footer className="flex items-center gap-2 border-t border-border/50 px-4 py-3 sm:px-5">
        <div className="min-w-0 flex-1"><FindReactionBar find={find} compact /></div>
        <Link to={`/finds/${find.id}`} aria-label="Comments" className="flex h-10 items-center gap-1 rounded-full px-3 text-sm text-muted-foreground hover:bg-muted/50">
          <MessageCircle className="h-4 w-4" />{comments > 0 && <span className="font-bold tabular-nums">{comments}</span>}
        </Link>
        <button type="button" onClick={() => setShareOpen(true)} aria-label="Share" className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/50">
          <Share2 className="h-4 w-4" />
        </button>
      </footer>
      <FindShareSheet open={shareOpen} onOpenChange={setShareOpen} find={find} />
    </motion.article>
  );
}

export const FindCard = memo(FindCardInner);
