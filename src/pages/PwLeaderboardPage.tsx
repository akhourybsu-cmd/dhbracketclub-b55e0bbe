import { Trophy } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePwSeason, usePwLeaderboard } from '@/hooks/usePwLeague';
import { money, pct, seasonLabel } from '@/lib/portfolioWars/market';

/** Season standings ranked by total portfolio value. */
export default function PwLeaderboardPage() {
  const { user } = useAuth();
  const { data: season } = usePwSeason();
  const startingCash = Number(season?.starting_cash ?? 50000);
  const { data: rows, isLoading } = usePwLeaderboard(season?.id, startingCash);

  const myRank = rows?.findIndex((r) => r.user_id === user?.id) ?? -1;

  return (
    <div className="space-y-3 pb-6">
      <header className="glass-card rounded-2xl p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">
          {season ? seasonLabel(season.year, season.quarter) : 'Season'} standings
        </p>
        <p className="text-sm text-white/70 mt-1">
          Ranked by portfolio value — everyone started at {money(startingCash, 0)}.
        </p>
        {myRank >= 0 && (
          <p className="text-[12px] font-black mt-2" style={{ color: 'hsl(var(--pw-amber))' }}>
            You are #{myRank + 1} of {rows?.length}
          </p>
        )}
      </header>

      <section className="glass-card rounded-2xl p-3">
        {isLoading ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />)}</div>
        ) : !rows?.length ? (
          <div className="text-center py-8 space-y-2">
            <Trophy className="w-6 h-6 mx-auto" style={{ color: 'hsl(var(--pw-amber))' }} />
            <p className="text-sm font-bold text-white">No traders yet</p>
            <p className="text-xs text-white/60">The board fills in as members open the game.</p>
          </div>
        ) : (
          <ol className="space-y-2">
            {rows.map((r, i) => {
              const mine = r.user_id === user?.id;
              const good = r.return_pct >= 0;
              return (
                <li
                  key={r.id}
                  className="rounded-xl px-3 py-2.5 flex items-center gap-3"
                  style={{
                    background: mine ? 'hsl(var(--pw-amber) / 0.1)' : 'hsl(var(--pw-surface) / 0.55)',
                    border: `1px solid hsl(var(--pw-${mine ? 'amber' : 'bull'}) / ${mine ? 0.35 : 0.14})`,
                  }}
                >
                  <span
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[12px] font-black tabular-nums shrink-0"
                    style={{
                      background: i < 3 ? 'hsl(var(--pw-amber) / 0.16)' : 'hsl(0 0% 100% / 0.06)',
                      color: i < 3 ? 'hsl(var(--pw-amber))' : 'hsl(0 0% 100% / 0.6)',
                    }}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white truncate">
                      {r.profile?.display_name || 'Member'}{mine ? ' · you' : ''}
                    </p>
                    <p className="text-[11px] text-white/55 truncate">
                      {r.top_holding ? `Top: ${r.top_holding.symbol}` : 'All cash'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black tabular-nums text-white">{money(Number(r.total_value))}</p>
                    <p className="text-[11px] font-bold tabular-nums" style={{ color: good ? 'hsl(var(--pw-bull))' : 'hsl(var(--pw-bear))' }}>
                      {pct(r.return_pct)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
