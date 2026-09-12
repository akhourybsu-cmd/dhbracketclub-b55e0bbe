import { motion } from 'framer-motion';
import { Crown, Flame, Link2, Medal, ShieldCheck, Trophy, Zap } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveSeason } from '@/hooks/usePickem';
import { useCrazyChainStandings } from '@/hooks/useCrazyChain';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TurfBackdrop } from '@/components/pickem/TurfBackdrop';

export default function CrazyChainLeaderboardPage() {
  const { user } = useAuth();
  const { season } = useActiveSeason();
  const { standings, loading, error, refetch, updatedAt } = useCrazyChainStandings(season?.id);
  const leader = standings[0];

  return (
    <div className="space-y-4 pb-7">
      <TurfBackdrop className="p-5">
        <p className="pk-section-label flex items-center gap-1.5"><Trophy className="w-3 h-3 text-gold" /> Club Record Board</p>
        <h1 className="text-[26px] font-black text-white mt-2">Crazy Chain Leaders</h1>
        <p className="text-[11px] text-white/60 mt-1">Current chains lead the table. Personal best breaks ties.</p>
        <p className="text-xs text-white/65 mt-2">Updates as games resolve · {updatedAt ? 'Refreshed ' + new Date(updatedAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}) : 'Checking results'}</p>
        {leader?.rank != null && (
          <div className="pk-scoreboard mt-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center"><Crown className="w-5 h-5 text-gold" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] uppercase tracking-widest text-white/45 font-black">Chain leader</p>
              <p className="text-[14px] text-white font-black truncate">{leader.profiles?.display_name || 'Member'}</p>
            </div>
            <p className="text-[28px] font-black text-gold tabular-nums">{leader.current_chain}</p>
          </div>
        )}
      </TurfBackdrop>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3, 4].map(i => <div key={i} className="h-20 rounded-xl pk-skeleton" />)}</div>
      ) : error ? (
        <button type="button" onClick={() => void refetch()} className="glass-card p-5 w-full text-center text-sm text-muted-foreground">{error} · Retry</button>
      ) : standings.length === 0 ? (
        <div className="glass-card p-7 text-center">
          <Link2 className="w-7 h-7 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-[13px] font-extrabold">No settled chains yet</p>
          <p className="text-[10px] text-muted-foreground mt-1">The board activates after the first Crazy Chain card settles.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {standings.map((standing, index) => {
            const mine = standing.user_id === user?.id;
            // Members with no card yet are listed for visibility but never
            // ranked or medalled, and shared ranks are shown as ties.
            const idle = standing.rank == null;
            const shared = !idle && standings.filter(row => row.rank === standing.rank).length > 1;
            const medal = !idle && !shared && (standing.rank ?? 99) <= 3;
            return (
              <motion.div
                key={standing.id}
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(index * 0.035, 0.25) }}
                className={`glass-card p-3.5 flex items-center gap-3 ${mine ? 'ring-1 ring-gold/35' : ''}`}
              >
                <div className={`w-9 h-8 rounded-lg flex items-center justify-center text-[11px] font-black tabular-nums ${medal && standing.rank === 1 ? 'bg-gold/15 text-gold border border-gold/30' : 'bg-white/5 text-muted-foreground border border-white/10'}`}>
                  {medal ? <Medal className="w-4 h-4" /> : idle ? '–' : `${shared ? 'T' : ''}${standing.rank}`}
                </div>
                <Avatar className="w-9 h-9 border border-white/10">
                  <AvatarImage src={standing.profiles?.avatar_url || undefined} />
                  <AvatarFallback className="text-[10px] font-black bg-white/5">
                    {(standing.profiles?.display_name || 'M').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-extrabold truncate">{standing.profiles?.display_name || 'Member'}{mine ? ' · You' : ''}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5 flex items-center gap-2">
                    {idle ? <span>No chain card yet</span> : <><span>Best {standing.best_chain}</span><span>•</span><span>{standing.perfect_games ?? 0} perfect games</span></>}
                  </p>
                  {!!standing.pending_games && <p className="text-[10px] text-muted-foreground mt-1">{standing.pending_games} locked game(s) awaiting results</p>}
                </div>
                <div className="text-right">
                  <p className="text-[20px] font-black text-gold tabular-nums leading-none">{standing.current_chain}</p>
                  <p className="text-[7px] uppercase tracking-widest text-muted-foreground font-black mt-1">Current</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <div className="glass-card p-4 grid grid-cols-3 gap-2 text-center">
        <BoardRule icon={<Flame className="w-4 h-4 text-orange-300" />} label="Current first" />
        <BoardRule icon={<Zap className="w-4 h-4 text-gold" />} label="Best breaks ties" />
        <BoardRule icon={<ShieldCheck className="w-4 h-4 text-emerald-300" />} label="Voids don't hurt" />
      </div>
    </div>
  );
}

function BoardRule({ icon, label }: { icon: React.ReactNode; label: string }) {
  return <div className="flex flex-col items-center gap-1.5">{icon}<p className="text-[8px] uppercase tracking-wider text-muted-foreground font-bold">{label}</p></div>;
}
