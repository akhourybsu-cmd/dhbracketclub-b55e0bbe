import { useMemo, useRef, useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Lightweight, dependency-free emoji picker. A curated set (not the full
 * Unicode table) grouped into categories, with keyword search. Position-
 * agnostic panel — the caller wraps it in a positioned container and handles
 * open/close + outside-click.
 */

interface Emoji { e: string; k: string }
interface Category { id: string; tab: string; label: string; emojis: Emoji[] }

const CATEGORIES: Category[] = [
  {
    id: 'smileys', tab: '😀', label: 'Smileys',
    emojis: [
      { e: '😀', k: 'grin happy smile' }, { e: '😃', k: 'happy smile joy' }, { e: '😄', k: 'happy laugh' },
      { e: '😁', k: 'grin beam' }, { e: '😆', k: 'laugh haha' }, { e: '😅', k: 'sweat laugh nervous' },
      { e: '🤣', k: 'rofl rolling laugh' }, { e: '😂', k: 'joy tears laugh cry' }, { e: '🙂', k: 'slight smile' },
      { e: '🙃', k: 'upside down silly' }, { e: '😉', k: 'wink' }, { e: '😊', k: 'blush smile' },
      { e: '😇', k: 'innocent angel halo' }, { e: '😍', k: 'heart eyes love' }, { e: '🥰', k: 'love hearts adore' },
      { e: '😘', k: 'kiss blow' }, { e: '😜', k: 'tongue wink silly' }, { e: '🤪', k: 'zany crazy' },
      { e: '🤨', k: 'raised eyebrow skeptical' }, { e: '😎', k: 'cool sunglasses' }, { e: '🤩', k: 'star struck wow' },
      { e: '🥳', k: 'party celebrate birthday' }, { e: '😏', k: 'smirk' }, { e: '😐', k: 'neutral meh straight face' },
      { e: '😒', k: 'unamused meh' }, { e: '😞', k: 'sad disappointed' }, { e: '😔', k: 'pensive sad' },
      { e: '😢', k: 'cry sad tear' }, { e: '😭', k: 'sob cry bawl' }, { e: '😤', k: 'huff frustrated' },
      { e: '😠', k: 'angry mad' }, { e: '😡', k: 'rage angry mad' }, { e: '🤬', k: 'cursing swear angry' },
      { e: '🤯', k: 'mind blown shocked' }, { e: '😳', k: 'flushed embarrassed' }, { e: '🥺', k: 'pleading puppy eyes' },
      { e: '😬', k: 'grimace awkward' }, { e: '🙄', k: 'eye roll' }, { e: '😴', k: 'sleep tired zzz' },
      { e: '🤤', k: 'drool' }, { e: '🤒', k: 'sick thermometer' }, { e: '🤮', k: 'vomit sick' },
      { e: '🥶', k: 'cold freezing' }, { e: '🥵', k: 'hot sweating' }, { e: '🤔', k: 'thinking hmm' },
      { e: '🤫', k: 'shush quiet secret' }, { e: '🤭', k: 'giggle oops' }, { e: '😱', k: 'scream shocked fear' },
    ],
  },
  {
    id: 'gestures', tab: '👍', label: 'Gestures',
    emojis: [
      { e: '👍', k: 'thumbs up yes like approve' }, { e: '👎', k: 'thumbs down no dislike' }, { e: '👌', k: 'ok perfect' },
      { e: '🤌', k: 'pinched italian' }, { e: '✌️', k: 'peace victory' }, { e: '🤞', k: 'fingers crossed luck' },
      { e: '🤟', k: 'love you' }, { e: '🤘', k: 'rock horns' }, { e: '🤙', k: 'call shaka hang loose' },
      { e: '👏', k: 'clap applause bravo' }, { e: '🙌', k: 'raise hands praise celebrate' }, { e: '👐', k: 'open hands' },
      { e: '🙏', k: 'pray thanks please' }, { e: '🤝', k: 'handshake deal' }, { e: '💪', k: 'muscle strong flex' },
      { e: '✍️', k: 'writing' }, { e: '👋', k: 'wave hello hi bye' }, { e: '🖐️', k: 'hand five' },
      { e: '✋', k: 'stop high five' }, { e: '👊', k: 'fist bump punch' }, { e: '🤛', k: 'fist left' },
      { e: '🫡', k: 'salute respect' }, { e: '🫶', k: 'heart hands love' }, { e: '👀', k: 'eyes looking watch' },
    ],
  },
  {
    id: 'hearts', tab: '❤️', label: 'Hearts',
    emojis: [
      { e: '❤️', k: 'red heart love' }, { e: '🧡', k: 'orange heart' }, { e: '💛', k: 'yellow heart' },
      { e: '💚', k: 'green heart' }, { e: '💙', k: 'blue heart' }, { e: '💜', k: 'purple heart' },
      { e: '🖤', k: 'black heart' }, { e: '🤍', k: 'white heart' }, { e: '🤎', k: 'brown heart' },
      { e: '💔', k: 'broken heart sad' }, { e: '❣️', k: 'heart exclamation' }, { e: '💕', k: 'two hearts love' },
      { e: '💞', k: 'revolving hearts' }, { e: '💓', k: 'beating heart' }, { e: '💗', k: 'growing heart' },
      { e: '💖', k: 'sparkling heart' }, { e: '💘', k: 'cupid arrow heart' }, { e: '💝', k: 'gift heart' },
      { e: '🔥', k: 'fire lit hot flame' }, { e: '⭐', k: 'star' }, { e: '🌟', k: 'glowing star sparkle' },
      { e: '✨', k: 'sparkles shiny' }, { e: '💯', k: 'hundred perfect keep it 100' }, { e: '🎉', k: 'party tada celebrate' },
    ],
  },
  {
    id: 'things', tab: '🎮', label: 'Fun',
    emojis: [
      { e: '🎮', k: 'game controller gaming' }, { e: '🏆', k: 'trophy win champion' }, { e: '🥇', k: 'gold medal first' },
      { e: '⚽', k: 'soccer football' }, { e: '🏀', k: 'basketball' }, { e: '🏈', k: 'football nfl' },
      { e: '⚾', k: 'baseball' }, { e: '🎯', k: 'dart target bullseye' }, { e: '🎲', k: 'dice game' },
      { e: '🃏', k: 'joker card' }, { e: '🎭', k: 'theater masks drama' }, { e: '🎵', k: 'music note' },
      { e: '🎶', k: 'music notes' }, { e: '🍕', k: 'pizza food' }, { e: '🍔', k: 'burger food' },
      { e: '🌮', k: 'taco food' }, { e: '🍺', k: 'beer drink' }, { e: '🍻', k: 'cheers beers' },
      { e: '🥂', k: 'cheers champagne toast' }, { e: '☕', k: 'coffee' }, { e: '🎂', k: 'cake birthday' },
      { e: '🚀', k: 'rocket launch fast' }, { e: '💡', k: 'idea lightbulb' }, { e: '⚡', k: 'lightning bolt fast' },
      { e: '💰', k: 'money bag cash' }, { e: '🎁', k: 'gift present' }, { e: '📌', k: 'pin' },
      { e: '✅', k: 'check done yes' }, { e: '❌', k: 'x cross no wrong' }, { e: '❓', k: 'question' },
      { e: '❗', k: 'exclamation' }, { e: '👑', k: 'crown king queen' }, { e: '💀', k: 'skull dead dying' },
      { e: '👻', k: 'ghost boo' }, { e: '🤖', k: 'robot bot' }, { e: '👽', k: 'alien' },
    ],
  },
];

// Filter out any placeholder rows (defensive against typos in the data table).
const ALL: Emoji[] = CATEGORIES.flatMap(c => c.emojis).filter(x => x.k.length > 0 || /\p{Emoji}/u.test(x.e));

export function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState(CATEGORIES[0].id);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { searchRef.current?.focus(); }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return ALL.filter(x => x.k.includes(q) || x.e === q);
  }, [query]);

  const shown = results ?? CATEGORIES.find(c => c.id === cat)!.emojis;

  return (
    <div
      className="w-[300px] max-w-[calc(100vw-24px)] rounded-2xl bg-popover/95 backdrop-blur-lg border border-border/20 shadow-2xl overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Search */}
      <div className="p-2 border-b border-border/15">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search emoji"
            className="chat-mobile-input w-full h-8 pl-8 pr-2 rounded-lg bg-muted/40 border border-border/20 text-[13px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30 placeholder:text-muted-foreground/45"
          />
        </div>
      </div>

      {/* Category tabs (hidden while searching) */}
      {!results && (
        <div className="flex items-center gap-0.5 px-2 pt-1.5">
          {CATEGORIES.map(c => (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              aria-label={c.label}
              className={cn(
                'flex-1 h-8 rounded-lg text-lg leading-none transition-colors',
                cat === c.id ? 'bg-primary/15' : 'hover:bg-muted/40',
              )}
            >
              {c.tab}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      <div className="max-h-[220px] overflow-y-auto p-2">
        {shown.length === 0 ? (
          <p className="text-center text-[12px] text-muted-foreground/60 py-6">No emoji found</p>
        ) : (
          <div className="grid grid-cols-8 gap-0.5">
            {shown.map((x, i) => (
              <button
                key={`${x.e}-${i}`}
                onClick={() => onSelect(x.e)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-xl leading-none hover:bg-muted/50 transition-colors active:scale-90"
              >
                {x.e}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
