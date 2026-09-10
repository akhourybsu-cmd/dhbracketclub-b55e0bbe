import { Check, Clock3, History, Link2, X } from 'lucide-react';
import { format } from 'date-fns';
import { useActiveSeason, useTeams } from '@/hooks/usePickem';
import { useCrazyChainStandings, useMyCrazyChainHistory, useMyCrazyChainGameCards } from '@/hooks/useCrazyChain';
import { useAuth } from '@/contexts/AuthContext';
import { TurfBackdrop } from '@/components/pickem/TurfBackdrop';
import { Button } from '@/components/ui/button';
export default function CrazyChainHistoryPage() {
  const {user}=useAuth();
  const {season}=useActiveSeason();
  const {teams}=useTeams();
  const {entries,loading,error,refetch}=useMyCrazyChainHistory(season?.id);
  const {cards,error:cardsError,refetch:refreshCards}=useMyCrazyChainGameCards(undefined,season?.id);
  const {standings}=useCrazyChainStandings(season?.id);
  const standing=standings.find(row=>row.user_id===user?.id);
  return <div className="member-page space-y-4 pb-7">
    <TurfBackdrop className="p-5">
      <p className="pk-section-label flex items-center gap-2"><History className="w-3 h-3 text-gold" /> Game-by-game history</p>
      <h1 className="text-2xl font-black text-white mt-2">My Crazy Chains</h1>
      <div className="grid grid-cols-3 gap-2 mt-4">
        {[['Current',standing?.current_chain||0],['Best',standing?.best_chain||0],['Perfect games',standing?.perfect_games||0]].map(([label,value])=>
          <div key={label} className="rounded-xl bg-black/25 p-3 text-center"><p className="text-xl text-white font-black">{value}</p><p className="text-[10px] text-white/65">{label}</p></div>)}
      </div>
    </TurfBackdrop>
    <p className="text-xs text-muted-foreground">Results refresh every 30 seconds. Each game is scored separately; chain steps follow kickoff order. Simultaneous games are checked together, with any miss breaking that step.</p>
    {loading ? <div className="h-32 rounded-xl pk-skeleton" /> : error || cardsError ?
      <div className="glass-card p-4"><p role="alert" className="text-sm">{error || cardsError}</p><Button variant="outline" className="mt-3" onClick={()=>void Promise.all([refetch(),refreshCards()])}>Retry</Button></div>
      : !cards.length ? <div className="glass-card p-6 text-center"><Link2 className="w-6 h-6 mx-auto mb-2 text-primary" /><p className="text-sm">Save predictions for a game to start your history.</p></div>
      : [...cards].reverse().map(card=>{
        const entry=entries.find(e=>e.id===card.entry_id);
        const away=teams.find(team=>team.id===card.away_team_id)?.abbr || 'Away';
        const home=teams.find(team=>team.id===card.home_team_id)?.abbr || 'Home';
        return <article key={card.entry_id+card.game_id} className="glass-card overflow-hidden">
          <div className="p-3.5 border-b border-border flex items-start justify-between gap-3">
            <div><h2 className="text-sm font-bold">{away} @ {home}</h2><p className="text-xs text-muted-foreground mt-1">Week {card.week_number} · {format(new Date(card.kickoff_at),'MMM d, h:mm a')}</p></div>
            <div className="text-right text-xs"><p className="font-bold">{card.voids===card.links_risked ? 'Voided · chain preserved' : card.status==='locked' ? card.game_status==='final' ? 'Stats pending' : 'Awaiting game' : card.status==='won' ? 'Perfect game' : card.status==='lost' ? 'Game missed' : 'Void'}</p>
              <p className="text-muted-foreground mt-1">{card.hits} hit · {card.misses} miss · {card.pending} pending</p></div>
          </div>
          <div className="divide-y divide-border">{entry?.legs.filter(leg=>leg.game_id===card.game_id).map(leg=>
            <div key={leg.id} className="px-3.5 py-3 flex items-start gap-3 text-xs">
              {leg.status==='hit' ? <Check className="w-4 h-4 shrink-0 text-primary" /> : leg.status==='miss' ? <X className="w-4 h-4 shrink-0 text-destructive" /> : <Clock3 className="w-4 h-4 shrink-0 text-muted-foreground" />}
              <div className="flex-1 min-w-0"><p>{leg.display_text}</p>{leg.status==='void' && <p className="text-muted-foreground mt-1">{leg.void_reason || 'Voided; no link earned and no chain penalty.'}</p>}</div><span className="text-muted-foreground shrink-0">{leg.status}{leg.actual_value!=null?' · '+leg.actual_value:''}</span>
            </div>)}</div>
        </article>;
      })}
  </div>;
}
