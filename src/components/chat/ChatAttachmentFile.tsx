import { useEffect, useState } from 'react';
import { FileText, FileArchive, Film, Music, File as FileIcon, Download, Loader2, RefreshCw } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { resolveAttachmentUrl, attachmentDisplayName, pathFromPrivateUrl } from '@/lib/chatAttachments';

function extOf(url: string): string {
  const path = pathFromPrivateUrl(url) || url;
  const m = path.match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : '';
}

function iconFor(ext: string): LucideIcon {
  if (['mp4', 'mov', 'webm'].includes(ext)) return Film;
  if (['mp3', 'wav', 'm4a'].includes(ext)) return Music;
  if (ext === 'zip') return FileArchive;
  if (['pdf', 'txt', 'csv', 'json', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) return FileText;
  return FileIcon;
}

/**
 * Non-image chat attachment (PDF, video, doc, archive, …). Resolves a
 * short-lived signed URL on tap and opens it in a new tab. The display name
 * rides along in the sentinel URL's `#n=` fragment.
 */
export function ChatAttachmentFile({ url }: { url: string }) {
  const [loading, setLoading] = useState(false);
  const [resolved, setResolved] = useState<string | null>(null);
  const [errored, setErrored] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const ext = extOf(url);
  const Icon = iconFor(ext);
  const name = attachmentDisplayName(url) || `Attachment${ext ? '.' + ext : ''}`;
  const isVideo = ['mp4', 'mov', 'webm'].includes(ext);
  const isAudio = ['mp3', 'wav', 'm4a'].includes(ext);
  const isPlayable = isVideo || isAudio;

  useEffect(() => {
    if (!isPlayable) return;
    let cancelled = false;
    setLoading(true);
    setErrored(false);
    resolveAttachmentUrl(url).then(signed => {
      if (cancelled) return;
      setResolved(signed);
      setErrored(!signed);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [attempt, isPlayable, url]);

  const open = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    const signed = resolved || await resolveAttachmentUrl(url);
    setLoading(false);
    if (signed) window.open(signed, '_blank', 'noopener,noreferrer');
  };

  if (isPlayable) {
    return (
      <div className="w-full max-w-[340px] overflow-hidden rounded-xl border border-border/15 bg-card/60" onClick={event => event.stopPropagation()}>
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-[18px] w-[18px] text-primary/80" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-semibold text-foreground/90">{name}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground/60">{isVideo ? 'Video' : 'Audio'} · {ext}</p>
          </div>
          <button
            type="button"
            onClick={open}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground/55 transition-colors hover:bg-muted/40 hover:text-foreground"
            aria-label={`Download ${name}`}
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
        {loading && (
          <div className="flex h-16 items-center justify-center border-t border-border/10 text-muted-foreground/55">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        )}
        {errored && !loading && (
          <button
            type="button"
            onClick={() => setAttempt(value => value + 1)}
            className="flex h-16 w-full items-center justify-center gap-2 border-t border-border/10 text-[11px] font-semibold text-muted-foreground/65 hover:bg-muted/20"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Retry media
          </button>
        )}
        {resolved && !loading && isVideo && (
          <video
            src={resolved}
            controls
            playsInline
            preload="metadata"
            className="max-h-[280px] w-full border-t border-border/10 bg-black object-contain"
            aria-label={name}
          />
        )}
        {resolved && !loading && isAudio && (
          <div className="border-t border-border/10 px-3 py-3">
            <audio src={resolved} controls preload="metadata" className="h-10 w-full" aria-label={name} />
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={open}
      className="flex items-center gap-2.5 max-w-[280px] rounded-xl border border-border/15 bg-card/60 hover:bg-card/80 transition-colors px-3 py-2.5 text-left"
    >
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon className="w-[18px] h-[18px] text-primary/80" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-semibold text-foreground/90 truncate">{name}</p>
        <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">{ext || 'file'}</p>
      </div>
      {loading
        ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/60 flex-shrink-0" />
        : <Download className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />}
    </button>
  );
}
