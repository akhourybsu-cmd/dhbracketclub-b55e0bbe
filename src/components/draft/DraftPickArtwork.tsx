import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { draftArtworkSources, type DraftArtworkSource } from '@/lib/draft/artwork';

interface DraftPickArtworkProps {
  artwork?: DraftArtworkSource;
  label: string;
  /** Detailed stages use bounded catalog artwork rather than a tiny thumbnail. */
  detail?: boolean;
  contain?: boolean;
  eager?: boolean;
  className?: string;
  imageClassName?: string;
}

export function DraftPickArtwork({ artwork, label, detail = false, contain = false, eager = false, className, imageClassName }: DraftPickArtworkProps) {
  const sources = draftArtworkSources(artwork, detail);
  return <ArtworkSession key={`${label}:${sources.join('|')}`} sources={sources} label={label} contain={contain} eager={eager} className={className} imageClassName={imageClassName} />;
}

function ArtworkSession({ sources, label, contain, eager, className, imageClassName }: Omit<DraftPickArtworkProps, 'artwork' | 'detail'> & { sources: string[] }) {
  const [failed, setFailed] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const source = sources.find((url) => !failed.includes(url));
  const initials = label.trim().split(/\s+/).slice(0, 2).map((part) => Array.from(part)[0]).join('').toUpperCase() || 'DA';
  return (
    <span className={cn('da-pick-art relative block h-full w-full overflow-hidden', className)} data-art-state={!source ? 'unavailable' : loaded ? 'ready' : 'loading'} aria-busy={!!source && !loaded}>
      <span className="da-art-fallback absolute inset-0 flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-primary/15 via-muted/70 to-background" role={source ? undefined : 'img'} aria-label={source ? undefined : `Artwork unavailable for ${label}`} aria-hidden={source ? true : undefined}>
        <span className="font-extrabold tracking-tight text-foreground/55">{initials}</span>
        {!source && <ImageOff className="h-3 w-3 text-muted-foreground/55" aria-hidden="true" />}
      </span>
      {source && <img
        src={source}
        alt={label}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
        className={cn('relative h-full w-full transition-opacity duration-200 motion-reduce:transition-none', contain ? 'object-contain' : 'object-cover', loaded ? 'opacity-100' : 'opacity-0', imageClassName)}
        onLoad={() => setLoaded(true)}
        onError={() => { setLoaded(false); setFailed((previous) => [...previous, source]); }}
      />}
    </span>
  );
}
