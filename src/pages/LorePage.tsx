import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ScrollText, Plus, Search, Dices, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useLoreEntries } from '@/hooks/useLoreEntries';
import { LoreCard } from '@/components/lore/LoreCard';
import { QuickAddLoreSheet } from '@/components/lore/QuickAddLoreSheet';
import { cn } from '@/lib/utils';

const FILTERS: { value: string; label: string; kind: 'type' | 'status' | 'all' }[] = [
  { value: 'all', label: 'All', kind: 'all' },
  { value: 'quote', label: 'Quotes', kind: 'type' },
  { value: 'inside_joke', label: 'Jokes', kind: 'type' },
  { value: 'story', label: 'Moments', kind: 'type' },
  { value: 'nickname', label: 'Nicknames', kind: 'type' },
  { value: 'bit', label: 'Bits', kind: 'type' },
  { value: 'legendary', label: '👑 Legendary', kind: 'status' },
  { value: 'cursed', label: '💀 Cursed', kind: 'status' },
];

export default function LorePage() {
  const [filter, setFilter] = useState<{ value: string; kind: 'type' | 'status' | 'all' }>(FILTERS[0]);
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const navigate = useNavigate();

  const queryFilters = useMemo(() => ({
    type: filter.kind === 'type' ? filter.value : undefined,
    status: filter.kind === 'status' ? filter.value : undefined,
    search: search.trim() || undefined,
  }), [filter, search]);

  const { data: entries, isLoading } = useLoreEntries(queryFilters);

  const featured = useMemo(() => {
    if (!entries) return [];
    const legendary = entries.filter((e) => e.status === 'legendary');
    return legendary.slice(0, 2);
  }, [entries]);

  const onRandom = () => {
    if (!entries || entries.length === 0) return;
    const pick = entries[Math.floor(Math.random() * entries.length)];
    navigate(`/lore/${pick.id}`);
  };

  return (
    <div className="member-page">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative mb-5"
      >
        <div
          className="absolute -inset-x-8 -top-14 -bottom-4 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 90% 55% at 50% -15%, hsl(var(--lore) / 0.1), transparent)' }}
        />
        <div className="relative z-10 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, hsl(var(--lore) / 0.22), hsl(var(--lore) / 0.06))', boxShadow: '0 0 16px hsl(var(--lore) / 0.18)' }}
              >
                <ScrollText className="w-4.5 h-4.5" style={{ color: 'hsl(var(--lore))' }} />
              </div>
              <p className="text-[9px] font-bold uppercase tracking-[0.25em]" style={{ color: 'hsl(var(--lore) / 0.7)' }}>
                The Archive
              </p>
            </div>
            <h1 className="text-[1.75rem] font-extrabold tracking-tight leading-none">DH Lore</h1>
            <p className="text-[12px] text-muted-foreground mt-1.5 font-medium">
              Quotes, jokes, moments & legends
            </p>
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="flex-shrink-0 inline-flex items-center gap-1.5 h-11 px-3.5 rounded-xl font-extrabold text-[12px] tracking-tight text-white btn-press"
            style={{
              background: 'linear-gradient(135deg, hsl(var(--lore)), hsl(var(--lore) / 0.8))',
              boxShadow: '0 4px 14px hsl(var(--lore) / 0.3)',
            }}
            aria-label="Add Lore"
          >
            <Plus className="w-4 h-4" /> Add Lore
          </button>
        </div>
      </motion.div>

      {/* Featured legendary */}
      {featured.length > 0 && (
        <div className="mb-5 space-y-2">
          {featured.map((entry, i) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i }}
            >
              <Link to={`/lore/${entry.id}`} className="block group">
                <div
                  className="glass-card p-4 relative overflow-hidden"
                  style={{
                    border: '1px solid hsl(var(--lore) / 0.3)',
                    boxShadow: '0 0 24px hsl(var(--lore) / 0.12)',
                  }}
                >
                  <div
                    className="absolute inset-x-0 top-0 h-px"
                    style={{ background: 'linear-gradient(90deg, transparent, hsl(var(--lore) / 0.6), transparent)' }}
                  />
                  <div className="relative z-10">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Sparkles className="w-3 h-3" style={{ color: 'hsl(var(--gold))' }} />
                      <span className="text-[9px] font-extrabold uppercase tracking-[0.18em] font-mono" style={{ color: 'hsl(var(--gold))' }}>
                        Legendary
                      </span>
                    </div>
                    <p className="text-[15px] font-extrabold tracking-tight leading-snug line-clamp-2">
                      {entry.type === 'quote' ? `"${entry.title}"` : entry.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1 truncate">
                      {entry.profiles?.display_name} · {entry.era || 'Era unknown'}
                    </p>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      {/* Search + Random */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search lore..."
            className="form-input pl-9 h-11"
          />
        </div>
        <button
          onClick={onRandom}
          disabled={!entries || entries.length === 0}
          className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center btn-press disabled:opacity-40"
          style={{
            background: 'hsl(var(--lore) / 0.12)',
            border: '1px solid hsl(var(--lore) / 0.3)',
            color: 'hsl(var(--lore))',
          }}
          aria-label="Random Lore"
          title="Random Lore"
        >
          <Dices className="w-5 h-5" />
        </button>
      </div>

      {/* Filter chips */}
      <div className="flex gap-1.5 mb-5 overflow-x-auto scrollbar-none -mx-4 px-4 pb-1">
        {FILTERS.map((f) => {
          const active = filter.value === f.value;
          return (
            <button
              key={f.value}
              onClick={() => setFilter(f)}
              className={cn(
                'flex-shrink-0 px-3.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all btn-press min-h-11',
                active
                  ? 'text-white'
                  : 'text-muted-foreground bg-[hsl(var(--surface-elevated))] border border-border/40',
              )}
              style={active ? { background: 'hsl(var(--lore))', boxShadow: '0 0 16px hsl(var(--lore) / 0.25)' } : undefined}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Entries list */}
      {isLoading ? (
        <div className="space-y-2.5">
          {[1, 2, 3].map((i) => <div key={i} className="glass-card p-4 h-28 skeleton-shimmer" />)}
        </div>
      ) : entries && entries.length > 0 ? (
        <div className="space-y-2.5">
          {entries.map((e, i) => <LoreCard key={e.id} entry={e} index={i} />)}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-10 text-center"
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg, hsl(var(--lore) / 0.18), hsl(var(--lore) / 0.04))' }}
          >
            <ScrollText className="w-6 h-6" style={{ color: 'hsl(var(--lore))' }} />
          </div>
          <p className="text-sm font-bold mb-1">
            {search || filter.value !== 'all' ? 'No lore here yet' : 'Start the archive'}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed mb-5">
            {search || filter.value !== 'all'
              ? 'Try a different filter or search.'
              : 'Save quotes, inside jokes, and iconic moments.'}
          </p>
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex min-h-11 items-center gap-2 font-extrabold rounded-xl px-4 py-2.5 text-[13px] text-white btn-press"
            style={{
              background: 'linear-gradient(135deg, hsl(var(--lore)), hsl(var(--lore) / 0.8))',
              boxShadow: '0 4px 14px hsl(var(--lore) / 0.3)',
            }}
          >
            <Plus className="w-4 h-4" /> Add First Lore
          </button>
        </motion.div>
      )}

      <QuickAddLoreSheet open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
