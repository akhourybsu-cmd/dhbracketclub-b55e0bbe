import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Trash2, X, Loader2, Pencil, Star } from 'lucide-react';
import { toast } from 'sonner';
import { MarketStatusBar } from '@/components/portfolioWars/MarketStatusBar';
import { usePwQuotes, usePwSymbolSearch } from '@/hooks/usePwLeague';
import { usePwWatchlists, usePwWatchlistMutations } from '@/hooks/usePwDesk';
import { money, pct } from '@/lib/portfolioWars/market';

/** Personal watchlists: named lists of symbols with live prices. */
export default function PwWatchlistsPage() {
  const navigate = useNavigate();
  const { data: lists, isLoading } = usePwWatchlists();
  const { createList, renameList, deleteList, addSymbol, removeSymbol } = usePwWatchlistMutations();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [newListName, setNewListName] = useState('');
  const [creating, setCreating] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [term, setTerm] = useState('');

  const active = useMemo(
    () => (lists ?? []).find((l) => l.id === activeId) ?? (lists ?? [])[0],
    [lists, activeId],
  );

  const symbols = active?.items.map((i) => i.symbol) ?? [];
  const { data: quotes } = usePwQuotes(symbols, symbols.length > 0);
  const { data: results, isFetching: searching } = usePwSymbolSearch(term);

  const submitNewList = async () => {
    if (!newListName.trim()) return;
    try {
      const id = await createList.mutateAsync(newListName);
      setActiveId(id);
      setNewListName('');
      setCreating(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create that list');
    }
  };

  const submitRename = async () => {
    if (!renamingId || !renameValue.trim()) return setRenamingId(null);
    try {
      await renameList.mutateAsync({ id: renamingId, name: renameValue });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not rename that list');
    }
    setRenamingId(null);
  };

  const add = async (symbol: string) => {
    if (!active) return;
    try {
      await addSymbol.mutateAsync({ watchlistId: active.id, symbol });
      setTerm('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not add that stock');
    }
  };

  return (
    <div className="space-y-3 pb-6">
      <MarketStatusBar />

      {/* Lists */}
      <section className="glass-card rounded-2xl p-3 space-y-2">
        <div className="flex items-center gap-2">
          <h1 className="text-[11px] font-black uppercase tracking-[0.16em] text-white/60 flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5" /> Watchlists
          </h1>
          <button
            type="button" onClick={() => setCreating((v) => !v)}
            className="ml-auto h-9 px-3 rounded-lg flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] btn-press"
            style={{
              background: 'hsl(var(--pw-bull) / 0.16)',
              border: '1px solid hsl(var(--pw-bull) / 0.4)',
              color: 'hsl(var(--pw-bull))',
            }}
          >
            <Plus className="w-3.5 h-3.5" /> New list
          </button>
        </div>

        {creating && (
          <div className="flex items-center gap-2">
            <input
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitNewList(); }}
              placeholder="List name"
              aria-label="New watchlist name"
              autoFocus
              className="flex-1 h-10 rounded-xl px-3 text-sm font-semibold text-white bg-black/30 outline-none"
              style={{ border: '1px solid hsl(var(--pw-bull) / 0.22)' }}
            />
            <button
              type="button" onClick={submitNewList} disabled={createList.isPending}
              className="h-10 px-4 rounded-xl text-[11px] font-black uppercase tracking-[0.14em] btn-press disabled:opacity-45"
              style={{
                background: 'hsl(var(--pw-bull) / 0.2)',
                border: '1px solid hsl(var(--pw-bull) / 0.5)',
                color: 'hsl(var(--pw-bull))',
              }}
            >
              Save
            </button>
          </div>
        )}

        {isLoading && <p className="text-[12px] text-white/50 px-1 py-2">Loading your lists…</p>}
        {!isLoading && !lists?.length && (
          <p className="text-[12px] text-white/60 px-1 py-2">
            Create a list to follow stocks you're eyeing before you buy.
          </p>
        )}

        {!!lists?.length && (
          <div className="flex items-center gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {lists.map((l) => {
              const isActive = active?.id === l.id;
              return (
                <button
                  key={l.id} type="button" onClick={() => setActiveId(l.id)}
                  className="shrink-0 h-9 px-3 rounded-lg text-[11px] font-black uppercase tracking-[0.14em] btn-press"
                  style={{
                    background: isActive ? 'hsl(var(--pw-bull) / 0.16)' : 'hsl(var(--pw-surface) / 0.5)',
                    border: `1px solid hsl(var(--pw-bull) / ${isActive ? 0.5 : 0.12})`,
                    color: isActive ? 'hsl(var(--pw-bull))' : 'hsl(0 0% 100% / 0.55)',
                  }}
                >
                  {l.name} · {l.items.length}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {!!active && (
        <>
          {/* Add symbols */}
          <section className="glass-card rounded-2xl p-3 space-y-2">
            <div className="flex items-center gap-2">
              {renamingId === active.id ? (
                <input
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitRename(); }}
                  onBlur={submitRename}
                  aria-label="Rename watchlist"
                  autoFocus
                  className="flex-1 h-9 rounded-lg px-3 text-sm font-bold text-white bg-black/30 outline-none"
                  style={{ border: '1px solid hsl(var(--pw-bull) / 0.3)' }}
                />
              ) : (
                <h2 className="flex-1 text-sm font-black text-white truncate">{active.name}</h2>
              )}
              <button
                type="button"
                onClick={() => { setRenamingId(active.id); setRenameValue(active.name); }}
                aria-label="Rename list"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-white/50 btn-press"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!window.confirm(`Delete "${active.name}"?`)) return;
                  deleteList.mutate(active.id);
                  setActiveId(null);
                }}
                aria-label="Delete list"
                className="w-9 h-9 rounded-lg flex items-center justify-center btn-press"
                style={{ color: 'hsl(var(--pw-bear))' }}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <label className="relative block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Add a stock to this list"
                className="w-full h-11 rounded-xl pl-9 pr-9 text-sm font-semibold text-white bg-black/30 outline-none"
                style={{ border: '1px solid hsl(var(--pw-bull) / 0.22)' }}
              />
              {!!term && (
                <button
                  type="button" onClick={() => setTerm('')} aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-white/50"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </label>

            {!!term && (
              <ul className="max-h-56 overflow-y-auto space-y-1">
                {searching && <li className="text-xs text-white/50 px-2 py-2">Searching…</li>}
                {!searching && !results?.length && (
                  <li className="text-xs text-white/50 px-2 py-2">No matches on US exchanges.</li>
                )}
                {(results ?? []).map((r) => (
                  <li key={r.symbol}>
                    <button
                      type="button" onClick={() => add(r.symbol)}
                      className="w-full text-left rounded-lg px-3 py-2 flex items-center gap-2 btn-press"
                      style={{ background: 'hsl(var(--pw-surface) / 0.55)', border: '1px solid hsl(var(--pw-bull) / 0.12)' }}
                    >
                      <span className="text-sm font-black text-white">{r.symbol}</span>
                      <span className="text-[11px] text-white/55 truncate">{r.name}</span>
                      <Plus className="w-4 h-4 ml-auto shrink-0" style={{ color: 'hsl(var(--pw-bull))' }} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Rows */}
          <section className="glass-card rounded-2xl p-2">
            {!active.items.length && (
              <p className="text-[12px] text-white/60 px-2 py-4 text-center">
                Nothing on this list yet. Search above to add a stock.
              </p>
            )}
            <ul className="space-y-1">
              {active.items.map((item) => {
                const q = quotes?.[item.symbol];
                const price = Number(q?.price ?? 0);
                const prev = Number(q?.prev_close ?? 0);
                const change = price && prev ? ((price - prev) / prev) * 100 : null;
                return (
                  <li key={item.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => navigate(`/portfolio-wars/stock/${item.symbol}`)}
                      className="flex-1 min-w-0 rounded-xl px-3 h-14 flex items-center gap-3 btn-press text-left"
                      style={{ background: 'hsl(var(--pw-surface) / 0.5)', border: '1px solid hsl(var(--pw-bull) / 0.1)' }}
                    >
                      <span className="text-sm font-black text-white">{item.symbol}</span>
                      <span className="ml-auto text-sm font-black tabular-nums text-white">
                        {price ? money(price) : <Loader2 className="w-4 h-4 animate-spin" />}
                      </span>
                      {change != null && (
                        <span
                          className="text-[12px] font-bold tabular-nums w-16 text-right"
                          style={{ color: change >= 0 ? 'hsl(var(--pw-bull))' : 'hsl(var(--pw-bear))' }}
                        >
                          {pct(change)}
                        </span>
                      )}
                    </button>
                    <button
                      type="button" onClick={() => removeSymbol.mutate(item.id)}
                      aria-label={`Remove ${item.symbol}`}
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-white/40 btn-press"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}

      <Link
        to="/portfolio-wars/trade"
        className="block text-center text-[11px] font-black uppercase tracking-[0.16em] text-white/50 py-2"
      >
        Go to the trade desk
      </Link>
    </div>
  );
}
