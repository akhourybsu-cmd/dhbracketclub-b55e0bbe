// DH Club Chat — GIF picker bottom-sheet
//
// Portaled to document.body to escape transform contexts (PageTransition
// wraps every route). Trending shown when the search box is empty;
// debounced search-as-you-type otherwise. Tap a tile → send immediately
// (matches iMessage / WhatsApp GIF behavior). No upload step: the Tenor
// URL is public + already on a CDN, so it's inserted directly into the
// message content where the existing image-URL renderer picks it up.

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, Search, Loader2, ImagePlay } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  fetchTrendingGifs,
  searchGifs,
  isGifProviderConfigured,
  type GifResult,
} from '@/lib/gifProvider';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called with the GIF's medium-size URL when the user picks one. */
  onSelect: (url: string) => void;
  /** Club accent for the sheet border + glow. */
  accent?: string;
}

const DEBOUNCE_MS = 350;

export function GifPicker({ open, onClose, onSelect, accent = '152 72% 46%' }: Props) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const configured = isGifProviderConfigured();

  // Debounce — typing pauses the search until the user stops for 350ms.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  // Reset state when the sheet closes; fetch trending or search on (re)open.
  useEffect(() => {
    if (!open) {
      setQuery('');
      setDebouncedQuery('');
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }
    if (!configured) {
      setError('GIFs aren\'t configured for this build. Add VITE_TENOR_API_KEY to enable.');
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    const promise = debouncedQuery
      ? searchGifs(debouncedQuery, ctrl.signal)
      : fetchTrendingGifs(ctrl.signal);
    promise
      .then(r => {
        setResults(r);
        setLoading(false);
      })
      .catch(e => {
        if ((e as Error).name === 'AbortError') return;
        setError('Couldn\'t load GIFs. Try again.');
        setLoading(false);
      });
    return () => ctrl.abort();
  }, [open, debouncedQuery, configured]);

  if (!open || typeof document === 'undefined') return null;

  const handlePick = (g: GifResult) => {
    onSelect(g.fullUrl);
    onClose();
  };

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[70] flex items-end justify-center"
      style={{
        background: 'hsl(218 50% 3% / 0.65)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 32, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 12, opacity: 0 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-md max-h-[80dvh] rounded-t-2xl flex flex-col overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, hsl(var(--card)), hsl(var(--background)))',
          border: `1px solid hsl(${accent} / 0.32)`,
          boxShadow: `0 -10px 30px -8px hsl(${accent} / 0.32)`,
          paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))',
        }}
      >
        {/* Header — search + close */}
        <div
          className="flex items-center gap-2 px-4 py-3 border-b flex-shrink-0"
          style={{ borderColor: `hsl(${accent} / 0.22)` }}
        >
          <ImagePlay
            className="w-3.5 h-3.5 flex-shrink-0"
            style={{ color: `hsl(${accent})` }}
            aria-hidden="true"
          />
          <p
            className="text-[10px] font-extrabold uppercase tracking-[0.22em] mr-1"
            style={{ color: `hsl(${accent})` }}
          >
            GIFs
          </p>
          <div className="flex-1 relative">
            <Search
              className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/55 pointer-events-none"
              aria-hidden="true"
            />
            <Input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search…"
              className="chat-mobile-input h-9 pl-8 text-sm bg-muted/25 border-border/30"
              aria-label="Search GIFs"
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close GIF picker"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground/60 hover:text-foreground active:scale-90 transition flex-shrink-0"
            style={{ background: 'hsl(var(--muted) / 0.4)' }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Eyebrow */}
        <div className="px-4 pt-2 pb-1 flex-shrink-0">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground/55">
            {debouncedQuery ? `Results for “${debouncedQuery}”` : 'Trending'}
          </p>
        </div>

        {/* Grid / states */}
        <div className="flex-1 overflow-y-auto px-3 pb-3" style={{ scrollbarWidth: 'none' }}>
          {error ? (
            <div className="text-center py-12 text-[12px] text-muted-foreground/70 leading-relaxed px-4">
              {error}
            </div>
          ) : loading && results.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground/60">
              <Loader2 className="w-4 h-4 animate-spin" aria-label="Loading GIFs" />
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-12 text-[12px] text-muted-foreground/70">
              {debouncedQuery ? 'No GIFs found. Try a different search.' : 'No trending GIFs right now.'}
            </div>
          ) : (
            <div className="columns-2 gap-2" style={{ columnFill: 'balance' }}>
              {results.map(g => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => handlePick(g)}
                  className="w-full mb-2 block rounded-lg overflow-hidden border border-border/15 bg-muted/20 active:scale-[0.97] transition break-inside-avoid"
                  aria-label={g.title}
                >
                  <img
                    src={g.previewUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    width={g.width}
                    height={g.height}
                    className="w-full h-auto block"
                  />
                </button>
              ))}
            </div>
          )}

          <p className="text-[8.5px] text-center text-muted-foreground/40 mt-2 mb-1 uppercase tracking-[0.18em] font-bold">
            Powered by Tenor
          </p>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
