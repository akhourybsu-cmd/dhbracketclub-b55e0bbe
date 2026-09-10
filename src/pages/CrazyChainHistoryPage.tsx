import { motion } from 'framer-motion';
import { Check, CircleDashed, Flame, History, Link2, ShieldCheck, X } from 'lucide-react';
import { useActiveSeason } from '@/hooks/usePickem';
import { useCrazyChainStandings, useMyCrazyChainHistory, type CrazyChainEntry } from '@/hooks/useCrazyChain';
import { useAuth } from '@/contexts/AuthContext';
import { TurfBackdrop } from '@/components/pickem/TurfBackdrop';

export default function CrazyChainHistoryPage() {
  const { user } = useAuth();
  const { season } = useActiveSeason();
  const { entries, loading, error } = useMyCrazyChainHistory(season?.id);
  const { standings } = useCrazyChainStandings(season?.id);
  const standing = standings.find(row => row.user_id === user?.id);

  return (
    <div className="space-y-4 pb-7">
      <TurfBackdrop className="p-5">
        <p className="pk-section-label flex items-center gap-1.5"><History className="w-3 h-3 text-gold" /> Season Chronicle</p>
        <h1 className="text-[26px] font-black text-white mt-2">My Crazy Chains</h1>
        <div className="grid grid-cols-3 gap-2 mt-4">
          <HistoryStat label="Current" value={standing?.current_chain || 0} />
          <HistoryStat label="Best" value={standing?.best_chain || 0} />
          <HistoryStat label="Perfect" value={standing?.perfect_weeks || 0} />
        </div>
      </TurfBackdrop>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-32 rounded-xl pk-skeleton" />)}</div>
      ) : error ? (
        <div className="glass-card p-5 text-center text-[11px] text-muted-foreground">{error}</div>
      ) : entries.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Link2 className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-[13px] font-extrabold">Your first chain starts here</p>
          <p className="text-[10px] text-muted-foreground mt-1">Build a weekly card to begin your season history.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry, index) => (
            <motion.article
              key={entry.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.04, 0.2) }}
              className="glass-card overflow-hidden"
            >
              <div className="px-3.5 py-3 flex items-center gap-3 border-b border-white/5">
                <CardIcon entry={entry} />
                <div className="flex-1">
                  <p className="text-[12px] font-extrabold">{entry.week_label || `Week ${entry.week_number || '—'}`}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">{entry.links_risked} link{entry.links_risked === 1 ? '' : 's'} risked</p>
                </div>
                <div className="text-right">
                  <p className={`text-[11px] font-black uppercase ${entry.status === 'won' ? 'text-emerald-300' : entry.status === 'lost' ? 'text-red-300' : 'text-gold'}`}>{entry.status}</p>
                  {entry.status === 'won' && <p className="text-[9px] text-muted-foreground">+{entry.links_won} chain</p>}
                </div>
              </div>
              <div className="divide-y divide-white/5">
                {entry.legs.map(leg => (
                  <div key={leg.id} className="px-3.5 py-2.5 flex items-center gap-2.5">
                    {leg.status === 'hit' ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : leg.status === 'miss' ? <X className="w-3.5 h-3.5 text-red-300" /> : leg.status === 'void' ? <CircleDashed className="w-3.5 h-3.5 text-muted-foreground" /> : <Flame className="w-3.5 h-3.5 text-gold" />}
                    <p className="text-[10px] font-semibold flex-1 min-w-0 truncate">{leg.display_text}</p>
                    <span className="text-[8px] uppercase tracking-wider text-muted-foreground font-black">{leg.status}</span>
                  </div>
                ))}
              </div>
            </motion.article>
          ))}
        </div>
      )}

      <div className="glass-card p-3.5 flex items-center gap-3">
        <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0" />
        <p className="text-[9px] leading-relaxed text-muted-foreground">Skipped weeks do not appear here and do not break an active chain. Voided cards also leave the chain unchanged.</p>
      </div>
    </div>
  );
}

function HistoryStat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl bg-black/25 border border-white/10 p-2.5 text-center"><p className="text-[19px] text-white font-black tabular-nums">{value}</p><p className="text-[7px] text-white/45 uppercase tracking-widest font-black">{label}</p></div>;
}

function CardIcon({ entry }: { entry: CrazyChainEntry }) {
  const classes = entry.status === 'won' ? 'bg-emerald-400/10 border-emerald-300/25 text-emerald-300' : entry.status === 'lost' ? 'bg-red-400/10 border-red-300/25 text-red-300' : 'bg-gold/10 border-gold/25 text-gold';
  return <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${classes}`}>{entry.status === 'won' ? <Check className="w-4 h-4" /> : entry.status === 'lost' ? <X className="w-4 h-4" /> : <Flame className="w-4 h-4" />}</div>;
}
