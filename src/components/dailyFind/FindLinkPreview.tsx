import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Globe } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface Preview { title: string | null; description: string | null; image_url: string | null; site_name: string | null }

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
export function FindLinkPreview({ url, compact, className }: { url: string; compact?: boolean; className?: string }) {
  const { data, isLoading } = useLinkPreview(url);
  const host = hostOf(url);
  const title = readableText(data?.title ?? null);
  const description = readableText(data?.description ?? null);

  const openButton = (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[hsl(var(--drop-accent)/0.35)] bg-[hsl(var(--drop-paper-strong))] px-3 text-xs font-bold text-[hsl(var(--drop-accent))] hover:bg-[hsl(var(--drop-accent)/0.12)]"
    >
      Open <ExternalLink className="h-3.5 w-3.5" />
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
    <div className={cn('overflow-hidden rounded-xl border border-[hsl(var(--drop-edge))] bg-[hsl(var(--drop-paper-strong))]', className)}>
      {data.image_url && (
        <img
          src={data.image_url}
          alt=""
          loading="lazy"
          decoding="async"
           className={cn('w-full object-cover', compact ? 'h-44 sm:h-56' : 'h-60')}
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      )}
      <div className="space-y-1.5 p-3">
         <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--drop-accent))]">
          <Globe className="h-3 w-3" /> {data.site_name || host}
        </p>
        <p className="drop-card-title text-xl leading-tight">{title}</p>
        {description && (
          <p className={cn('text-sm leading-relaxed text-muted-foreground', compact && 'line-clamp-3')}>{description}</p>
        )}
        <div className="flex justify-end pt-1">{openButton}</div>
      </div>
    </div>
  );
}
