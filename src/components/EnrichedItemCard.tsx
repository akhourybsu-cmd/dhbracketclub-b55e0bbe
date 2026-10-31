import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { RefreshCw } from 'lucide-react';
import type { ItemEnrichment } from '@/hooks/useItemEnrichments';
import { DraftPickArtwork } from '@/components/draft/DraftPickArtwork';
import { artworkUrl, draftArtworkCandidates } from '@/lib/draft/artwork';

interface EnrichedItemCardProps {
  label: string;
  rank: number;
  enrichment?: ItemEnrichment;
  showRank?: boolean;
  compact?: boolean;
  onClick?: () => void;
  onImageClick?: () => void;
  actions?: React.ReactNode;
  className?: string;
}

function MetadataSubtitle({ enrichment }: { enrichment?: ItemEnrichment }) {
  if (!enrichment?.metadata) return null;
  const m = enrichment.metadata;
  const parts: string[] = [];

  if (m.year) parts.push(String(m.year));
  if (m.director) parts.push(m.director);
  if (m.author) parts.push(m.author);
  if (m.artist) parts.push(m.artist);
  if (m.genre) parts.push(typeof m.genre === 'string' ? m.genre : Array.isArray(m.genre) ? m.genre[0] : '');
  if (m.network) parts.push(m.network);
  if (m.cuisine) parts.push(m.cuisine);
  if (m.type) parts.push(String(m.type));
  if (m.known_for) parts.push(m.known_for);

  const validParts = parts.filter(Boolean).slice(0, 3);
  if (!validParts.length) return null;

  return (
    <span className="text-[10px] text-muted-foreground/60 font-medium block mt-0.5 break-words">
      {validParts.join(' · ')}
    </span>
  );
}

export default function EnrichedItemCard({
  label,
  rank,
  enrichment,
  showRank = true,
  compact = false,
  onClick,
  onImageClick,
  actions,
  className,
}: EnrichedItemCardProps) {
  const reduce = useReducedMotion();
  const isLowConfidence = enrichment?.status === 'low_confidence';
  const options = enrichment ? draftArtworkCandidates(enrichment, label) : [];
  const currentUrl = artworkUrl(enrichment?.image_url) ?? artworkUrl(enrichment?.thumbnail_url);
  const hasImageCandidates = !!onImageClick && options.length > (currentUrl ? 1 : 0);

  return (
    <motion.div
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "da-pick-card flex items-center gap-3 px-3 py-2.5 group rounded-xl",
        "transition-colors duration-150 hover:bg-muted/20",
        // Faint gold wash so the leader reads as the top pick at a glance.
        rank === 1 && showRank && "bg-gradient-to-r from-gold/[0.06] via-transparent to-transparent",
        onClick && "cursor-pointer active:bg-primary/5",
        className
      )}
      onClick={onClick}
    >
      {/* Rank badge — podium medals for the top 3, muted pill below. */}
      {showRank && (
        rank <= 3 ? (
          <div className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-extrabold flex-shrink-0 border",
            rank === 1 && "bg-gold/20 text-gold border-gold/45 shadow-[0_0_12px_hsl(var(--gold)/0.28)]",
            rank === 2 && "bg-silver/20 text-silver border-silver/45",
            rank === 3 && "bg-bronze/20 text-bronze border-bronze/45",
          )}>
            {rank}
          </div>
        ) : (
          <div className="w-7 h-7 rounded-full bg-muted/50 text-muted-foreground flex items-center justify-center text-[10px] font-extrabold flex-shrink-0">
            {rank}
          </div>
        )
      )}

      {/* Image thumbnail */}
      {hasImageCandidates ? (
        <button
          type="button"
          className={cn('da-pick-art-button relative min-h-11 min-w-11 flex-shrink-0 overflow-hidden rounded-xl ring-1 ring-border/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary', compact ? 'h-11 w-11' : 'h-12 w-12')}
          aria-label={`Choose artwork for ${label}`}
          onClick={(event) => { event.stopPropagation(); onImageClick?.(); }}
        >
          <DraftPickArtwork artwork={enrichment} label={label} />
          <span className="absolute bottom-0 right-0 rounded-tl-md bg-background/85 p-1"><RefreshCw className="h-2.5 w-2.5 text-foreground/80" aria-hidden="true" /></span>
        </button>
      ) : (
        <span className={cn('relative flex-shrink-0 overflow-hidden rounded-xl ring-1 ring-border/50', compact ? 'h-11 w-11' : 'h-12 w-12')}>
          <DraftPickArtwork artwork={enrichment} label={label} />
        </span>
      )}

      {/* Content */}
      <div className="da-pick-card-copy flex-1 min-w-0">
        <span className={cn(
          "text-[13px] font-semibold block break-words",
          rank === 1 && showRank && "text-gold"
        )}>
          {label}
        </span>
        <MetadataSubtitle enrichment={enrichment} />
        {isLowConfidence && <span className="text-[9px] font-semibold text-muted-foreground">Artwork match unconfirmed</span>}
      </div>

      {/* Actions slot */}
      {actions && (
        <div className="da-pick-card-actions flex-shrink-0">
          {actions}
        </div>
      )}
    </motion.div>
  );
}

// ─── Skeleton loading card ───
export function EnrichedItemSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <div className="w-6 h-6 rounded-lg skeleton-shimmer" />
      <div className={cn(
        "rounded-lg skeleton-shimmer flex-shrink-0",
        compact ? "w-10 h-10" : "w-12 h-12"
      )} />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 rounded-md skeleton-shimmer w-3/4" />
        <div className="h-2.5 rounded-md skeleton-shimmer w-1/2" />
      </div>
    </div>
  );
}
