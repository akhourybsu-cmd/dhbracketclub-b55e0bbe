import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Globe } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface Preview { title: string | null; description: string | null; image_url: string | null; site_name: string | null }

function hostOf(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
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

  const openButton = (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[hsl(var(--drop-accent)/0.11)] px-3 text-xs font-bold text-[hsl(var(--drop-accent))] hover:bg-[hsl(var(--drop-accent)/0.18)]"
    >
      Open <ExternalLink className="h-3.5 w-3.5" />
    </a>
  );

  if (isLoading) {
    return <div className={cn('h-24 animate-pulse rounded-xl border border-border/50 bg-muted/40', className)} />;
  }

  if (!data) {
    return (
       <div className={cn('flex items-center gap-2 rounded-xl border border-[hsl(var(--drop-accent)/0.22)] bg-muted/30 p-3', className)}>
        <Globe className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 break-all text-sm font-semibold">{host}</span>
        {openButton}
      </div>
    );
  }

  return (
    <div className={cn('overflow-hidden rounded-xl border border-[hsl(var(--drop-accent)/0.22)] bg-muted/20', className)}>
      {data.image_url && (
        <img
          src={data.image_url}
          alt=""
          loading="lazy"
          decoding="async"
          className={cn('w-full object-cover', compact ? 'h-36' : 'h-52')}
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      )}
      <div className="space-y-1.5 p-3">
         <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--drop-accent))]">
          <Globe className="h-3 w-3" /> {data.site_name || host}
        </p>
        <p className="text-sm font-bold leading-snug">{data.title}</p>
        {data.description && (
          <p className={cn('text-sm leading-relaxed text-muted-foreground', compact && 'line-clamp-3')}>{data.description}</p>
        )}
        <div className="flex justify-end pt-1">{openButton}</div>
      </div>
    </div>
  );
}
