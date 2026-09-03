import { useNavigate, useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Trash2, Quote } from 'lucide-react';
import { format } from 'date-fns';
import { useLoreEntry, useDeleteLoreEntry } from '@/hooks/useLoreEntries';
import { useAuth } from '@/contexts/AuthContext';
import { LoreTypeBadge, LoreStatusBadge } from '@/components/lore/LoreTypeBadge';
import { LoreReactionBar } from '@/components/lore/LoreReactionBar';
import { LoreContributions } from '@/components/lore/LoreContributions';
import { toast } from 'sonner';

export default function LoreDetailPage() {
  const { loreId } = useParams<{ loreId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: entry, isLoading } = useLoreEntry(loreId);
  const { mutate: del, isPending: deleting } = useDeleteLoreEntry();

  if (isLoading) {
    return (
      <div className="member-page lg:max-w-[760px] lg:mx-auto">
        <div className="h-4 w-20 skeleton-shimmer rounded mb-6" />
        <div className="glass-card p-5 h-64 skeleton-shimmer" />
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="member-page text-center py-12">
        <p className="text-sm text-muted-foreground">Lore not found</p>
        <Link to="/lore" className="inline-block mt-4 text-primary text-sm font-bold">← Back to Lore</Link>
      </div>
    );
  }

  const isOwner = user?.id === entry.created_by;

  const onDelete = () => {
    if (!confirm('Delete this lore entry?')) return;
    del(entry.id, {
      onSuccess: () => {
        toast.success('Lore deleted');
        navigate('/lore');
      },
      onError: (e: any) => toast.error(e?.message || 'Could not delete'),
    });
  };

  // Long-form article — re-narrow to 760px on lg so prose stays
  // comfortable to read instead of stretching to the desktop shell.
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="member-page lg:max-w-[760px] lg:mx-auto">
      <Link to="/lore" className="back-link">
        <ArrowLeft /> Lore
      </Link>

      <div className="glass-card p-5 sm:p-6 relative overflow-hidden">
        <div
          className="absolute inset-x-0 top-0 h-px pointer-events-none"
          style={{ background: 'linear-gradient(90deg, transparent, hsl(var(--lore) / 0.5), transparent)' }}
        />
        <div className="relative z-10">
          <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
            <div className="flex items-center gap-2">
              <LoreTypeBadge type={entry.type} />
              <LoreStatusBadge status={entry.status} />
            </div>
            {isOwner && (
              <button
                onClick={onDelete}
                disabled={deleting}
                className="p-2.5 -m-1 rounded-md text-muted-foreground/60 hover:text-destructive transition-colors min-w-[44px] min-h-[44px] inline-flex items-center justify-center"
                aria-label="Delete lore"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          {entry.type === 'quote' && (
            <Quote className="w-7 h-7 mb-2 opacity-50" style={{ color: 'hsl(var(--lore))' }} />
          )}

          <h1 className="text-[1.6rem] sm:text-[1.85rem] font-extrabold tracking-tight leading-tight mb-4">
            {entry.type === 'quote' ? `"${entry.title}"` : entry.title}
          </h1>

          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70 mb-4 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{entry.profiles?.display_name || 'Someone'}</span>
            <span aria-hidden>·</span>
            <span className="font-mono">{format(new Date(entry.created_at), 'MMM d, yyyy')}</span>
            {entry.era && (
              <>
                <span aria-hidden>·</span>
                <span className="font-mono">{entry.era}</span>
              </>
            )}
          </div>

          {entry.image_url && (
            <img
              src={entry.image_url}
              alt=""
              loading="lazy"
              className="w-full rounded-xl mb-4 border border-border/40"
            />
          )}

          <p className="text-[14px] leading-relaxed text-foreground/90 whitespace-pre-wrap mb-5">
            {entry.context}
          </p>

          {entry.tags && entry.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-5">
              {entry.tags.map((t) => (
                <span
                  key={t}
                  className="text-[10px] font-bold px-2 py-1 rounded-md font-mono"
                  style={{ background: 'hsl(var(--lore) / 0.12)', color: 'hsl(var(--lore))' }}
                >#{t}</span>
              ))}
            </div>
          )}

          <div className="border-t border-border/30 pt-4 mt-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground mb-3">Reactions</p>
            <LoreReactionBar loreId={entry.id} reactions={entry.reactions || []} />
          </div>

          <LoreContributions loreId={entry.id} />
        </div>
      </div>
    </motion.div>
  );
}
