import type { ItemEnrichment } from '@/hooks/useItemEnrichments';

export interface DraftArtworkSource {
  image_url?: string | null;
  thumbnail_url?: string | null;
}

export interface DraftArtworkCandidate {
  url: string;
  thumbnail: string;
  source: string;
  label: string;
}

/** Images are remote artwork or owned assets, never executable URL schemes. */
export function artworkUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const candidate = value.trim();
  if (candidate.startsWith('/') && !candidate.startsWith('//')) return candidate;
  try {
    const url = new URL(candidate);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

/** Ask established image CDNs for useful detail without downloading originals. */
export function detailedArtworkUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.hostname === 'image.tmdb.org') url.pathname = url.pathname.replace(/\/t\/p\/w\d+\//, '/t/p/w500/');
    if (url.hostname.endsWith('.mzstatic.com')) url.pathname = url.pathname.replace(/\/(?:60|100|200)x(?:60|100|200)(bb[^/]*)$/, '/600x600$1');
    if (url.hostname === 'covers.openlibrary.org') url.pathname = url.pathname.replace(/-[SM](\.(?:jpg|png))$/, '-L$1');
    if (url.hostname === 'images.igdb.com') url.pathname = url.pathname.replace(/\/t_thumb\//, '/t_cover_big/');
    return url.href;
  } catch {
    return value;
  }
}

/** Only retry the same selected artwork; another search hit may be another entity. */
export function draftArtworkSources(artwork?: DraftArtworkSource, detail = false): string[] {
  const full = artworkUrl(artwork?.image_url);
  const thumbnail = artworkUrl(artwork?.thumbnail_url);
  const preferred = detail ? [full && detailedArtworkUrl(full), full, thumbnail && detailedArtworkUrl(thumbnail), thumbnail] : [thumbnail, full];
  return [...new Set(preferred.filter((url): url is string => Boolean(url)))];
}

export function draftArtworkCandidates(
  enrichment: Pick<ItemEnrichment, 'image_url' | 'thumbnail_url' | 'source_provider' | 'metadata'>,
  label: string,
): DraftArtworkCandidate[] {
  const result: DraftArtworkCandidate[] = [];
  const seen = new Set<string>();
  const append = (value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    const candidate = value as Record<string, unknown>;
    const url = artworkUrl(candidate.url);
    if (!url || seen.has(url)) return;
    seen.add(url);
    result.push({
      url,
      thumbnail: artworkUrl(candidate.thumbnail) ?? url,
      source: typeof candidate.source === 'string' && candidate.source.trim() ? candidate.source.trim().slice(0, 80) : 'Artwork',
      label: typeof candidate.label === 'string' && candidate.label.trim() ? candidate.label.trim().slice(0, 240) : label,
    });
  };
  if (enrichment.image_url || enrichment.thumbnail_url) append({
    url: enrichment.image_url || enrichment.thumbnail_url,
    thumbnail: enrichment.thumbnail_url || enrichment.image_url,
    source: enrichment.source_provider || 'Current',
    label,
  });
  const candidates: unknown = enrichment.metadata?.image_candidates;
  if (Array.isArray(candidates)) candidates.slice(0, 120).forEach(append);
  return result;
}

export function artworkProviderLabel(provider: string): string {
  const names: Record<string, string> = {
    tmdb: 'TMDB', itunes: 'Apple', openlibrary: 'Open Library',
    wikipedia: 'Wikipedia', pexels: 'Pexels', themealdb: 'TheMealDB',
    thesportsdb: 'TheSportsDB', musicbrainz: 'MusicBrainz', deezer: 'Deezer',
    igdb: 'IGDB', manual: 'Selected artwork', ai: 'Artwork',
  };
  return names[provider.toLowerCase()] ?? provider;
}
