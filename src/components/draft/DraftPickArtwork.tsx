import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { draftArtworkSources, type DraftArtworkSource } from '@/lib/draft/artwork';
import { draftInitials } from '@/lib/draft/presentation';

interface DraftPickArtworkProps {
  artwork?: DraftArtworkSource;
  label: string;
  /** Detailed stages use bounded catalog artwork rather than a tiny thumbnail. */
  detail?: boolean;
  contain?: boolean;
  eager?: boolean;
  className?: string;
  imageClassName?: string;
  onStateChange?: (state: DraftArtworkState) => void;
}

export type DraftArtworkState = 'loading' | 'ready' | 'unavailable';

export function DraftPickArtwork({ artwork, label, detail = false, contain = false, eager = false, className, imageClassName, onStateChange }: DraftPickArtworkProps) {
  const sources = draftArtworkSources(artwork, detail);
  return <ArtworkSession key={JSON.stringify([label, sources])} sources={sources} label={label} contain={contain} eager={eager} className={className} imageClassName={imageClassName} onStateChange={onStateChange} />;
}

function ArtworkSession({ sources, label, contain, eager, className, imageClassName, onStateChange }: Omit<DraftPickArtworkProps, 'artwork' | 'detail'> & { sources: string[] }) {
  const [failed, setFailed] = useState<string[]>([]);
  const [loadedSource, setLoadedSource] = useState<string | null>(null);
  const source = sources.find((url) => !failed.includes(url));
  const currentSource = useRef(source);
  currentSource.current = source;
  const image = useRef<HTMLImageElement | null>(null);
  const active = useRef(true);
  const loaded = !!source && loadedSource === source;
  const state: DraftArtworkState = !source ? 'unavailable' : loaded ? 'ready' : 'loading';
  const ownsImage = useCallback((node: HTMLImageElement, requested: string) => (
    active.current && currentSource.current === requested && image.current === node && node.isConnected
  ), []);
  const ready = useCallback((node: HTMLImageElement, requested: string) => {
    if (ownsImage(node, requested) && node.naturalWidth > 0 && node.naturalHeight > 0)
      setLoadedSource(requested);
  }, [ownsImage]);
  const unavailable = useCallback((node: HTMLImageElement, requested: string) => {
    if (!ownsImage(node, requested)) return;
    setLoadedSource(null);
    setFailed((previous) => previous.includes(requested) ? previous : [...previous, requested]);
  }, [ownsImage]);
  useLayoutEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  useLayoutEffect(() => {
    const node = image.current;
    // Cached images can finish before React subscribes to their load event.
    if (node && source && node.complete) {
      if (node.naturalWidth > 0 && node.naturalHeight > 0) ready(node, source);
      else unavailable(node, source);
    }
  }, [source, ready, unavailable]);
  useLayoutEffect(() => { onStateChange?.(state); }, [onStateChange, state]);
  const initials = draftInitials(label, 'DA');
  return (
    <span className={cn('da-pick-art relative block h-full w-full overflow-hidden bg-background/30', className)} data-art-state={state} data-art-fit={contain ? 'contain' : 'cover'} aria-busy={state === 'loading'}>
      {!loaded && <span className="da-art-fallback absolute inset-0 flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-primary/15 via-muted/70 to-background" role={source ? undefined : 'img'} aria-label={source ? undefined : `Artwork unavailable for ${label}`} aria-hidden={source ? true : undefined}>
        <span className="font-extrabold tracking-tight text-foreground/55">{initials}</span>
        {!source && <ImageOff className="h-3 w-3 text-muted-foreground/55" aria-hidden="true" />}
      </span>}
      {source && <img
        key={source}
        ref={image}
        src={source}
        alt={label}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
        className={cn('absolute inset-0 block h-full w-full', contain ? 'object-contain' : 'object-cover', imageClassName)}
        style={{ visibility: loaded ? 'visible' : 'hidden' }}
        onLoad={(event) => {
          if (event.currentTarget.naturalWidth > 0 && event.currentTarget.naturalHeight > 0) ready(event.currentTarget, source);
          else unavailable(event.currentTarget, source);
        }}
        onError={(event) => unavailable(event.currentTarget, source)}
      />}
    </span>
  );
}
