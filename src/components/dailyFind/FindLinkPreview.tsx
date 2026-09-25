import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Globe, Play } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { classifyUrl, isSafeUrl } from '@/lib/linkParser';
import { Button } from '@/components/ui/button';

interface Preview { title: string | null; description: string | null; image_url: string | null; site_name: string | null; content_type?: string | null }

function hostOf(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

function readableText(value: string | null) {
  if (!value || typeof document === 'undefined') return value;
  const textarea = document.createElement('textarea');
  textarea.innerHTML = value;
  return textarea.value;
}

export function useLinkPreview(url: string | null | undefined) {
  return useQuery({
    queryKey: ['link-preview', url],
    enabled: !!url && /^https?:\/\//i.test(url),
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('fetch-link-preview', { body: { url } });
      if (error || !data?.title) return null;
      return data as Preview;
    },
  });
}

/**
 * Rich, in-app summary of a link (image, title, description, source) with an
 * explicit "Open" action so readers get the gist without leaving the app.
 */
function YouTubeDropEmbed({ url, embedId, preview, immersive, className }: {
  url: string; embedId: string; preview: Preview | null | undefined; immersive?: boolean; className?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const isShort = /youtube\.com\/shorts\//i.test(url);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !playing) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry && entry.intersectionRatio < 0.45) setPlaying(false);
    }, { threshold: [0, 0.45, 1] });
    observer.observe(root);
    return () => observer.disconnect();
  }, [playing]);

  const poster = preview?.image_url || `https://img.youtube.com/vi/${embedId}/hqdefault.jpg`;
  return (
    <div ref={rootRef} className={cn('drop-video relative overflow-hidden bg-muted', isShort ? 'drop-video-short' : 'drop-video-wide', immersive && 'drop-media-immersive', className)} onClick={e => e.stopPropagation()}>
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${embedId}?autoplay=1&rel=0&playsinline=1`}
          title={readableText(preview?.title ?? null) || 'YouTube video'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      ) : (
        <>
          <img src={poster} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
          <div className="drop-media-scrim absolute inset-0" />
          <Button type="button" size="icon" onClick={() => setPlaying(true)} className="drop-play absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full" aria-label="Play video">
            <Play className="h-7 w-7 fill-current" />
          </Button>
          <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
            <p className="text-xs font-bold uppercase text-primary-foreground/80">YouTube</p>
            {preview?.title && <p className="drop-card-title mt-1 line-clamp-2 text-xl leading-tight text-primary-foreground sm:text-2xl">{readableText(preview.title)}</p>}
          </div>
        </>
      )}
      <a href={url} target="_blank" rel="noopener noreferrer" className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-foreground" aria-label="Open on YouTube">
        <ExternalLink className="h-4 w-4" />
      </a>
    </div>
  );
}

type Social = { provider: string; src: string; tall: boolean };
/** Allowlisted short-video providers → official embed URLs (no arbitrary embed HTML). */
export function socialEmbed(url: string): Social | null {
  let u: URL; try { u = new URL(url); } catch { return null; }
  const h = u.hostname.replace(/^(www\.|m\.|mobile\.)/, '');
  const path = u.pathname;
  let m: RegExpMatchArray | null;
  if (h.endsWith('tiktok.com') && (m = path.match(/\/video\/(\d+)/))) return { provider: 'TikTok', src: `https://www.tiktok.com/embed/v2/${m[1]}`, tall: true };
  if (h === 'instagram.com' && (m = path.match(/\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/))) return { provider: 'Instagram', src: `https://www.instagram.com/${m[1] === 'p' ? 'p' : 'reel'}/${m[2]}/embed`, tall: true };
  if ((h === 'x.com' || h === 'twitter.com') && (m = path.match(/\/status\/(\d+)/))) return { provider: 'X', src: `https://platform.twitter.com/embed/Tweet.html?id=${m[1]}&dnt=true`, tall: true };
  if ((h === 'facebook.com' || h === 'fb.watch') && (/\/(videos|reel|watch|share\/[vr])/.test(path) || h === 'fb.watch' || u.searchParams.has('v')))
    return { provider: 'Facebook', src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`, tall: /\/reel|share\/r/.test(path) };
  return null;
}

function SocialDropEmbed({ url, social, preview, immersive, className }: { url: string; social: Social; preview: Preview | null | undefined; immersive?: boolean; className?: string }) {
  const [playing, setPlaying] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !playing) return;
    const observer = new IntersectionObserver(([e]) => { if (e && e.intersectionRatio < 0.45) setPlaying(false); }, { threshold: [0, 0.45, 1] });
    observer.observe(root);
    return () => observer.disconnect();
  }, [playing]);
  const title = readableText(preview?.title ?? null);
  return (
    <div ref={rootRef} className={cn('drop-video relative overflow-hidden bg-muted', social.tall ? 'drop-video-short' : 'drop-video-wide', immersive && 'drop-media-immersive', className)} onClick={e => e.stopPropagation()}>
      {playing ? (
        <iframe src={social.src} title={title || `${social.provider} video`} allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share" allowFullScreen className="absolute inset-0 h-full w-full border-0 bg-background" />
      ) : (
        <>
          {preview?.image_url && <img src={preview.image_url} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />}
          <div className="drop-media-scrim absolute inset-0" />
          <Button type="button" size="icon" onClick={() => setPlaying(true)} className="drop-play absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full" aria-label={`Play ${social.provider} video`}>
            <Play className="h-7 w-7 fill-current" />
          </Button>
          <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
            <p className="text-xs font-bold uppercase text-primary-foreground/80">{social.provider}</p>
            {title && <p className="drop-card-title mt-1 line-clamp-2 text-xl leading-tight text-primary-foreground sm:text-2xl">{title}</p>}
          </div>
        </>
      )}
      <a href={url} target="_blank" rel="noopener noreferrer" className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-foreground" aria-label={`Open on ${social.provider}`}>
        <ExternalLink className="h-4 w-4" />
      </a>
    </div>
  );
}

export function FindLinkPreview({ url, compact, immersive, className }: { url: string; compact?: boolean; immersive?: boolean; className?: string }) {
  const { data, isLoading } = useLinkPreview(url);
  const host = hostOf(url);
  const social = socialEmbed(url);
  const title = readableText(data?.title ?? null);
  const description = readableText(data?.description ?? null);
  const parsed = classifyUrl(url);

  if (!isSafeUrl(url)) return null;
  if (parsed.contentType === 'youtube' && parsed.embedId) {
    return <YouTubeDropEmbed url={url} embedId={parsed.embedId} preview={data} immersive={immersive} className={className} />;
  }

  if (social) return <SocialDropEmbed url={url} social={social} preview={data} immersive={immersive} className={className} />;

  const openButton = (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[hsl(var(--drop-accent)/0.35)] bg-[hsl(var(--drop-paper-strong))] px-3 text-xs font-bold text-[hsl(var(--drop-accent))] hover:bg-[hsl(var(--drop-accent)/0.12)]"
    >
      {immersive ? 'Read the full story' : 'Open'} <ExternalLink className="h-3.5 w-3.5" />
    </a>
  );

  if (isLoading) {
      return <div className={cn('h-28 animate-pulse rounded-xl border border-[hsl(var(--drop-edge))] bg-[hsl(var(--drop-paper-strong))]', className)} />;
  }

  if (!data) {
    return (
       <div className={cn('flex items-center gap-2 rounded-xl border border-[hsl(var(--drop-edge))] bg-[hsl(var(--drop-paper-strong))] p-3', className)}>
        <Globe className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 break-all text-sm font-semibold">{host}</span>
        {openButton}
      </div>
    );
  }

  return (
    <div className={cn('overflow-hidden rounded-xl border border-[hsl(var(--drop-edge))] bg-[hsl(var(--drop-paper-strong))]', immersive && 'drop-article-story', className)}>
      {data.image_url && (
        <img
          src={data.image_url}
          alt=""
          loading="lazy"
          decoding="async"
            className={cn('w-full object-cover', immersive ? 'drop-article-image' : compact ? 'h-44 sm:h-56' : 'h-60')}
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      )}
      <div className={cn('space-y-1.5 p-3', immersive && 'p-5 sm:p-6')}>
         <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--drop-accent))]">
          <Globe className="h-3 w-3" /> {data.site_name || host}
        </p>
        <p className={cn('drop-card-title text-xl leading-tight', immersive && 'text-3xl sm:text-4xl')}>{title}</p>
        {description && (
          <p className={cn('text-sm leading-relaxed text-muted-foreground', compact && 'line-clamp-3')}>{description}</p>
        )}
        <div className="flex justify-end pt-1">{openButton}</div>
      </div>
    </div>
  );
}
