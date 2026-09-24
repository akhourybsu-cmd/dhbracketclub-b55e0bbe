import { memo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ExternalLink, MessageCircle, Share2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useFindImageUrl, useToggleFindReaction } from '@/hooks/useDailyFinds';
import { FIND_REACTIONS, formatDayKey, kindMeta, type DailyFind } from '@/lib/dailyFind';
import { FindShareSheet } from './FindShareSheet';
import { toast } from 'sonner';

function domainOf(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

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
              'flex h-8 min-w-[2.5rem] items-center justify-center gap-1 rounded-full border px-2.5 text-sm transition-colors',
              has ? 'border-[hsl(var(--gold)/0.6)] bg-[hsl(var(--gold)/0.14)]' : 'border-border/50 bg-muted/30 hover:bg-muted/60',
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
  const name = find.profiles?.display_name ?? 'Member';
  const comments = find.comments?.[0]?.count ?? 0;

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 8) * 0.04, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm"
    >
      <Link to={`/finds/${find.id}`} className="block active:opacity-90">
        <header className="flex items-center gap-2.5 px-4 pt-3.5">
          <Avatar className="h-8 w-8">
            <AvatarImage src={find.profiles?.avatar_url ?? undefined} />
            <AvatarFallback className="text-xs font-bold">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold leading-tight">{name}</p>
            <p className="text-xs text-muted-foreground">{formatDayKey(find.find_date)}</p>
          </div>
          <span className="rounded-full bg-[hsl(var(--gold)/0.14)] px-2.5 py-1 text-[11px] font-bold text-foreground">
            {meta.emoji} {meta.label}
          </span>
        </header>

        {find.image_path && <FindPhoto path={find.image_path} className="mt-3 aspect-[4/3] max-h-[420px] w-full" />}

        <div className="px-4 pt-3">
          <h3 className="text-[17px] font-extrabold leading-snug tracking-tight">{find.title}</h3>
          {find.note && <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground line-clamp-4">{find.note}</p>}
          {find.url && (
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-muted/50 px-2.5 py-1.5 text-xs font-semibold text-foreground/80">
              <ExternalLink className="h-3.5 w-3.5" /> {domainOf(find.url)}
            </span>
          )}
          {find.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {find.tags.map(t => <span key={t} className="text-xs font-semibold text-[hsl(var(--gold))]">#{t}</span>)}
            </div>
          )}
        </div>
      </Link>

      <footer className="flex items-center gap-2 px-4 pb-3.5 pt-3">
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
