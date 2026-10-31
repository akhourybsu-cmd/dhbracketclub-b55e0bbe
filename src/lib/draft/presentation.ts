interface GraphemeSegmenter {
  segment(value: string): Iterable<{ segment: string }>;
}
const Segmenter = (Intl as typeof Intl & {
  Segmenter?: new (locale?: string, options?: { granularity: 'grapheme' }) => GraphemeSegmenter;
}).Segmenter;
const graphemes = Segmenter ? new Segmenter(undefined, { granularity: 'grapheme' }) : null;

/** Avatar text only. Never normalize identifiers, picks or judging inputs. */
export function draftInitials(name?: string | null, fallback = '?'): string {
  return name?.normalize('NFC').trim().split(/\s+/).filter(Boolean).slice(0, 2)
    .map((word) => graphemes?.segment(word)[Symbol.iterator]().next().value?.segment ?? Array.from(word)[0])
    .join('').toUpperCase() || fallback;
}
