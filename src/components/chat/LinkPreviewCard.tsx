import { useState, useEffect, memo } from 'react';
import { ExternalLink, Play, Music, Image as ImageIcon, Globe, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import type { ParsedLink } from '@/lib/linkParser';
import { isSafeUrl } from '@/lib/linkParser';
import { getDraftIdFromUrl } from '@/lib/draftInvite';
import { DraftInviteCard } from './DraftInviteCard';
import { getPickemShareTarget } from '@/lib/pickemShare';
import { PickemShareCard } from './PickemShareCard';
import { getFindShareTarget } from '@/lib/dailyFind';
import { DailyFindShareCard } from './DailyFindShareCard';

interface LinkPreviewData {
  title?: string;
  description?: string;
  image_url?: string;
  site_name?: string;
}

interface LinkPreviewCardProps {
  link: ParsedLink;
  messageId: string;
  authorId: string;
  authorName?: string | null;
}

function LinkPreviewCardInner({ link, messageId, authorId, authorName }: LinkPreviewCardProps) {
  if (!isSafeUrl(link.url)) return null;

  const draftId = getDraftIdFromUrl(link.url);
  if (draftId) return <DraftInviteCard draftId={draftId} />;
  const pickemTarget = getPickemShareTarget(link.url);
  if (pickemTarget) return <PickemShareCard {...pickemTarget} authorId={authorId} authorName={authorName} />;

  const findId = getFindShareTarget(link.url);
  if (findId) return <DailyFindShareCard findId={findId} />;

  switch (link.contentType) {
    case 'image':
      return <ImagePreview url={link.url} />;
    case 'youtube':
      return <YouTubePreview link={link} messageId={messageId} />;
    case 'spotify':
      return <SpotifyPreview link={link} messageId={messageId} />;
    case 'link':
      return <GenericLinkPreview link={link} messageId={messageId} />;
    default:
      return null;
  }
}

export const LinkPreviewCard = memo(LinkPreviewCardInner);

/* ═══ IMAGE PREVIEW ═══ */
function ImagePreview({ url }: { url: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (error) return null;

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="block mt-2 group">
      <div className="relative overflow-hidden rounded-xl border border-border/15 max-w-[320px]">
        {!loaded && (
          <div className="w-full h-[180px] bg-muted/20 animate-pulse flex items-center justify-center">
            <ImageIcon className="w-5 h-5 text-muted-foreground/30" />
          </div>
        )}
        <img
          src={url}
          alt="Shared image"
          className={cn(
            "max-w-full max-h-[300px] object-cover transition-transform duration-200 group-hover:scale-[1.02]",
            !loaded && "hidden"
          )}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
        />
      </div>
    </a>
  );
}

/* ═══ YOUTUBE PREVIEW ═══ */
function YouTubePreview({ link, messageId }: { link: ParsedLink; messageId: string }) {
  const [title, setTitle] = useState<string | null>(null);
  const thumbnailUrl = link.embedId ? `https://img.youtube.com/vi/${link.embedId}/mqdefault.jpg` : '';

  useEffect(() => {
    if (!link.embedId) return;
    let cancelled = false;
    async function fetchTitle() {
      // Check cache first
      const { data: cached } = await supabase
        .from('message_link_previews' as any)
        .select('title, site_name')
        .eq('message_id', messageId)
        .eq('url', link.url)
        .maybeSingle();
      if (cancelled) return;
      if (cached && (cached as any).title) { setTitle((cached as any).title); return; }

      // Fetch via edge function
      try {
        const { data } = await supabase.functions.invoke('fetch-link-preview', { body: { url: link.url } });
        if (cancelled) return;
        if (data?.title) {
          setTitle(data.title);
          (supabase as any).from('message_link_previews').upsert({
            message_id: messageId, url: link.url, content_type: 'youtube',
            title: data.title, description: data.description, image_url: data.image_url, site_name: data.site_name,
          }, { onConflict: 'message_id,url' }).then(() => {});
        }
      } catch {}
    }
    fetchTitle();
    return () => { cancelled = true; };
  }, [link.url, link.embedId, messageId]);

  if (!link.embedId) return <PlainLink url={link.url} />;

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      className="block mt-2 group"
    >
      <div className="relative overflow-hidden rounded-xl border border-border/15 max-w-[320px] bg-black/20">
        <div className="relative">
          <img
            src={thumbnailUrl}
            alt="YouTube video"
            className="w-full aspect-video object-cover transition-transform duration-200 group-hover:scale-[1.02]"
            loading="lazy"
            decoding="async"
          />
          {/* Play button overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-[#FF0000] flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <Play className="w-5 h-5 text-white fill-white ml-0.5" />
            </div>
          </div>
        </div>
        <div className="px-3 py-2.5 bg-card/80">
          {title && (
            <p className="text-[12px] font-semibold text-foreground/85 leading-tight line-clamp-2 mb-1 group-hover:text-primary transition-colors">
              {title}
            </p>
          )}
          <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground/60 font-medium">
            <svg viewBox="0 0 90 20" className="w-[50px] h-[11px] opacity-60"><path fill="currentColor" d="M27.97 19.65l-1.46-5.42h-5.73l-1.46 5.42h-3.57L21.82.35h4.21l6.07 19.3h-4.13zm-4.29-16l-2.12 7.88h4.24L23.68 3.65zM45.05.35v3.04h-4.87v16.26h-3.57V3.39h-4.87V.35h13.31zM53.2 15.21c0 1.39-.44 2.55-1.33 3.29-.89.74-2.09 1.15-3.65 1.15s-2.87-.34-3.83-1.02V15.3c.7.5 1.46.85 2.22 1.07.76.23 1.43.35 2.01.35.82 0 1.42-.17 1.78-.49.36-.32.55-.76.55-1.28 0-.38-.12-.72-.37-1.01-.25-.29-.58-.57-.97-.81-.39-.24-.97-.57-1.76-.98-.73-.37-1.33-.73-1.78-1.07-.45-.34-.82-.76-1.13-1.26-.3-.5-.45-1.12-.45-1.85 0-1.3.43-2.32 1.29-3.04.86-.72 2-.08 3.42-1.08 1.03 0 2.04.2 3.02.6v3.13c-.89-.73-1.98-1.1-3.22-1.1-.72 0-1.27.15-1.62.45-.35.3-.53.68-.53 1.16 0 .36.1.67.31.93.2.26.49.5.87.72.37.22.96.53 1.76.93 1.18.6 2.02 1.22 2.55 1.87.53.65.86 1.47.86 2.47z"/></svg>
          </div>
        </div>
      </div>
    </a>
  );
}

/* ═══ SPOTIFY PREVIEW ═══ */
function SpotifyPreview({ link, messageId }: { link: ParsedLink; messageId: string }) {
  const [title, setTitle] = useState<string | null>(null);

  useEffect(() => {
    if (!link.embedType || !link.embedId) return;
    let cancelled = false;
    async function fetchTitle() {
      const { data: cached } = await supabase
        .from('message_link_previews' as any)
        .select('title')
        .eq('message_id', messageId)
        .eq('url', link.url)
        .maybeSingle();
      if (cancelled) return;
      if (cached && (cached as any).title) { setTitle((cached as any).title); return; }

      try {
        const { data } = await supabase.functions.invoke('fetch-link-preview', { body: { url: link.url } });
        if (cancelled) return;
        if (data?.title) {
          setTitle(data.title);
          (supabase as any).from('message_link_previews').upsert({
            message_id: messageId, url: link.url, content_type: 'spotify',
            title: data.title, description: data.description, image_url: data.image_url, site_name: data.site_name,
          }, { onConflict: 'message_id,url' }).then(() => {});
        }
      } catch {}
    }
    fetchTitle();
    return () => { cancelled = true; };
  }, [link.url, link.embedType, link.embedId, messageId]);

  const VALID_EMBED_TYPES = ['track', 'album', 'playlist', 'artist', 'episode', 'show'];
  if (!link.embedType || !link.embedId || !VALID_EMBED_TYPES.includes(link.embedType)) return <PlainLink url={link.url} />;

  const embedUrl = `https://open.spotify.com/embed/${link.embedType}/${link.embedId}?utm_source=generator&theme=0`;
  const isCompact = link.embedType === 'track';

  return (
    <div className="mt-2 max-w-[320px]" onClick={e => e.stopPropagation()}>
      {title && (
        <p className="text-[11px] font-semibold text-foreground/80 leading-tight line-clamp-1 mb-1 flex items-center gap-1.5">
          <Music className="w-3 h-3 text-[#1DB954] flex-shrink-0" />
          {title}
        </p>
      )}
      <div className="overflow-hidden rounded-xl border border-border/15">
        <iframe
          src={embedUrl}
          width="100%"
          height={isCompact ? 80 : 152}
          frameBorder="0"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          className="block"
          style={{ borderRadius: 0 }}
        />
      </div>
    </div>
  );
}

/* ═══ GENERIC LINK PREVIEW ═══ */
function GenericLinkPreview({ link, messageId }: { link: ParsedLink; messageId: string }) {
  const [preview, setPreview] = useState<LinkPreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchPreview() {
      // First check if we already have cached preview data
      const { data: cached } = await supabase
        .from('message_link_previews' as any)
        .select('title, description, image_url, site_name')
        .eq('message_id', messageId)
        .eq('url', link.url)
        .maybeSingle();

      if (cancelled) return;

      if (cached && (cached as any).title) {
        setPreview(cached as any);
        setLoading(false);
        return;
      }

      // Fetch from edge function
      try {
        const { data, error } = await supabase.functions.invoke('fetch-link-preview', {
          body: { url: link.url },
        });

        if (cancelled) return;

        if (error || !data?.title) {
          setFailed(true);
          setLoading(false);
          return;
        }

        setPreview(data);
        setLoading(false);

        // Cache the result (fire and forget, upsert to avoid duplicates)
        (supabase as any).from('message_link_previews').upsert({
          message_id: messageId,
          url: link.url,
          content_type: 'link',
          title: data.title,
          description: data.description,
          image_url: data.image_url,
          site_name: data.site_name,
        }, { onConflict: 'message_id,url' }).then(() => {});
      } catch {
        if (!cancelled) {
          setFailed(true);
          setLoading(false);
        }
      }
    }

    fetchPreview();
    return () => { cancelled = true; };
  }, [link.url, messageId]);

  if (failed) return <PlainLink url={link.url} />;

  if (loading) {
    return (
      <div className="mt-2 max-w-[320px] rounded-xl border border-border/10 bg-muted/8 p-3 flex items-center gap-2">
        <Loader2 className="w-3.5 h-3.5 text-muted-foreground/40 animate-spin" />
        <span className="text-[10px] text-muted-foreground/40">Loading preview…</span>
      </div>
    );
  }

  if (!preview) return <PlainLink url={link.url} />;

  let hostname = '';
  try { hostname = new URL(link.url).hostname.replace(/^www\./, ''); } catch {}

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      className="block mt-2 group"
    >
      <div className="max-w-[320px] rounded-xl border border-border/15 overflow-hidden bg-card/60 hover:bg-card/80 transition-colors">
        {preview.image_url && (
          <img
            src={preview.image_url}
            alt=""
            className="w-full h-[140px] object-cover"
            loading="lazy"
            decoding="async"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}
        <div className="px-3 py-2.5 space-y-0.5">
          <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground/50 font-medium">
            <Globe className="w-2.5 h-2.5" />
            {preview.site_name || hostname}
          </div>
          {preview.title && (
            <p className="text-[12px] font-semibold text-foreground/85 leading-tight line-clamp-2 group-hover:text-primary transition-colors">
              {preview.title}
            </p>
          )}
          {preview.description && (
            <p className="text-[10px] text-muted-foreground/60 leading-snug line-clamp-2">
              {preview.description}
            </p>
          )}
        </div>
      </div>
    </a>
  );
}

/* ═══ PLAIN LINK FALLBACK ═══ */
function PlainLink({ url }: { url: string }) {
  let hostname = '';
  try { hostname = new URL(url).hostname.replace(/^www\./, ''); } catch {}

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      className="inline-flex items-center gap-1 mt-1 text-[11px] text-primary/70 hover:text-primary transition-colors"
    >
      <ExternalLink className="w-3 h-3" />
      {hostname || url}
    </a>
  );
}
