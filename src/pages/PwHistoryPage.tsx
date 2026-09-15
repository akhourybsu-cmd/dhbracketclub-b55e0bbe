import { useState } from 'react';
import { History } from 'lucide-react';
import { usePwPastSeasons } from '@/hooks/usePwLeague';
import { useAllChallenges } from '@/hooks/usePortfolioWars';
import { money, seasonLabel } from '@/lib/portfolioWars/market';

/** Past quarterly seasons plus the archived weekly-pick era. */
export default function PwHistoryPage() {
  const [tab, setTab] = useState<'seasons' | 'archive'>('seasons');
  const { data: seasons, isLoading } = usePwPastSeasons();
  const { data: weeks } = useAllChallenges();

  return (
    <div className="space-y-3 pb-6">
      <header className="glass-card rounded-2xl p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">History</p>
        <p className="text-sm text-white/70 mt-1">Completed seasons and the old weekly stock-pick games.</p>
      </header>

      <div className="grid grid-cols-2 gap-2">
        {([['seasons', 'Seasons'], ['archive', 'Weekly archive']] as const).map(([key, label]) => (
          <button
            key={key} type="button" onClick={() => setTab(key)}
            className="h-10 rounded-xl text-[11px] font-black uppercase tracking-[0.14em] btn-press"
            style={{
              background: tab === key ? 'hsl(var(--pw-bull) / 0.18)' : 'hsl(var(--pw-surface) / 0.5)',
              border: `1px solid hsl(var(--pw-bull) / ${tab === key ? 0.45 : 0.14})`,
              color: tab === key ? 'hsl(var(--pw-bull))' : 'hsl(0 0% 100% / 0.55)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="glass-card rounded-2xl p-3">
        {tab === 'seasons' ? (
          isLoading ? (
            <div className="space-y-2">{[0, 1].map((i) => <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />)}</div>
          ) : !seasons?.length ? (
            <Empty text="No completed seasons yet — the current quarter is your first." />
          ) : (
            <ul className="space-y-2">
              {seasons.map((s) => (
                <li
                  key={s.id}
                  className="rounded-xl px-3 py-2.5 flex items-center gap-3"
                  style={{ background: 'hsl(var(--pw-surface) / 0.55)', border: '1px solid hsl(var(--pw-bull) / 0.14)' }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-white">{seasonLabel(s.year, s.quarter)}</p>
                    <p className="text-[11px] text-white/55">
                      {s.winner ? `Winner: ${s.winner.display_name || 'Member'}` : 'No winner recorded'}
                    </p>
                  </div>
                  {s.winner && (
                    <p className="text-sm font-black tabular-nums" style={{ color: 'hsl(var(--pw-amber))' }}>
                      {money(s.winner.total_value)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )
        ) : !weeks?.length ? (
          <Empty text="No weekly games were played." />
        ) : (
          <ul className="space-y-2">
            {weeks.map((w) => (
              <li
                key={w.id}
                className="rounded-xl px-3 py-2.5 flex items-center gap-3"
                style={{ background: 'hsl(var(--pw-surface) / 0.5)', border: '1px solid hsl(0 0% 100% / 0.08)' }}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white">Week {w.week_number} · {w.year}</p>
                  <p className="text-[11px] text-white/50">{w.week_start} → {w.week_end}</p>
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">{w.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="text-center py-8 space-y-2">
      <History className="w-6 h-6 mx-auto text-white/45" />
      <p className="text-xs text-white/60">{text}</p>
    </div>
  );
}
