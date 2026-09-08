import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, Crown, Flame } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveSeason, useSeasonStandings } from '@/hooks/usePickem';
import { TurfBackdrop } from '@/components/pickem/TurfBackdrop';
import { PickemShell } from '@/components/pickem/PickemShell';
import { cn } from '@/lib/utils';

export default function PickemStandingsPage() {
  const { user } = useAuth();
  const { season } = useActiveSeason();
  const { standings, loading } = useSeasonStandings(season?.id);

  const top3 = standings.slice(0, 3);
  const rest = standings.slice(3);
  const me = standings.find((standing) => standing.user_id === user?.id);
  const leader = standings[0];
  const gamesBack = me && leader ? Math.max(0, leader.total_correct - me.total_correct) : 0;

  return (
    <PickemShell>
    <div className="space-y-4 pb-6">

      {/* Hero header — turf */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <TurfBackdrop className="px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-gold/15 border border-gold/40">
              <Trophy className="w-5 h-5 text-gold" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-gold/95">Standings Race</p>
              <h1 className="text-[22px] font-extrabold tracking-tight leading-tight truncate text-white">
                {season?.name ?? 'Standings'}
              </h1>
              <p className="text-[11px] text-white/60 truncate flex items-center gap-1 mt-0.5">
                <Flame className="w-3 h-3 text-gold" /> Climb the standings
              </p>
            </div>
          </div>
        </TurfBackdrop>
      </motion.div>

      {me && (
        <div className="glass-card p-3.5">
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">Your Season Pulse</p>
            <span className="text-[11px] font-extrabold text-gold">#{me.rank ?? '–'} overall</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <PulseStat label="Accuracy" value={`${Math.round((me.accuracy || 0) * 100)}%`} />
            <PulseStat label="From lead" value={gamesBack === 0 ? 'Leader' : `${gamesBack} back`} />
            <PulseStat label="Week wins" value={String(me.weekly_wins)} />
          </div>
        </div>
      )}

      {loading ? (
        <div className="glass-card p-6">
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded-lg skeleton-shimmer" />
            ))}
          </div>
        </div>
      ) : standings.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Trophy className="w-7 h-7 mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-sm font-bold">No standings yet</p>
          <p className="text-xs text-muted-foreground mt-1">Standings appear once the first week is scored.</p>
        </div>
      ) : (
        <>
          {/* Podium — 2-1-3 layout */}
          {top3.length >= 1 && (
            <div className="grid grid-cols-3 gap-2 items-end">
              {/* 2nd */}
              <Podium standing={top3[1]} place={2} isMe={top3[1]?.user_id === user?.id} height="h-24" />
              {/* 1st */}
              <Podium standing={top3[0]} place={1} isMe={top3[0]?.user_id === user?.id} height="h-32" featured />
              {/* 3rd */}
              <Podium standing={top3[2]} place={3} isMe={top3[2]?.user_id === user?.id} height="h-20" />
            </div>
          )}

          {/* Rest */}
          {rest.length > 0 && (
            <div className="glass-card overflow-hidden">
              <div className="p-3 border-b border-border/20">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">Full Standings</p>
              </div>
              <div className="divide-y divide-border/10">
                {rest.map((s, i) => {
                  const isMe = s.user_id === user?.id;
                  const rank = s.rank ?? i + 4;
                  return (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i * 0.04, 0.3) }}
                      className={cn(
                        'flex items-center gap-3 px-4 py-3.5',
                        isMe && 'bg-gold/5 border-l-2 border-l-gold',
                      )}>
                      <div className="w-7 text-center text-[12px] font-extrabold tabular-nums text-muted-foreground">
                        #{rank}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-extrabold truncate">{(s.profiles as any)?.display_name ?? 'Unknown'}</p>
                        <p className="text-[10px] text-muted-foreground tabular-nums">
                          {s.total_correct}/{s.total_picked} · {Math.round((s.accuracy || 0) * 100)}%
                          {s.weekly_wins > 0 && <> · {s.weekly_wins}W</>}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-extrabold tabular-nums leading-none">{s.total_correct}</p>
                        <p className="text-[9px] text-muted-foreground/70 uppercase tracking-wider mt-0.5">correct</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
    </PickemShell>
  );
}

function Podium({ standing, place, isMe, height, featured }: {
  standing?: any; place: 1 | 2 | 3; isMe: boolean; height: string; featured?: boolean;
}) {
  if (!standing) return <div className={cn('rounded-xl bg-muted/10 border border-border/20', height)} />;

  const accent =
    place === 1 ? { color: 'hsl(var(--gold))', bg: 'hsl(var(--gold) / 0.14)', border: 'hsl(var(--gold) / 0.35)', shadow: 'var(--shadow-gold)' }
    : place === 2 ? { color: 'hsl(var(--silver))', bg: 'hsl(var(--silver) / 0.10)', border: 'hsl(var(--silver) / 0.30)', shadow: '0 0 12px hsl(var(--silver) / 0.12)' }
    : { color: 'hsl(var(--bronze))', bg: 'hsl(var(--bronze) / 0.12)', border: 'hsl(var(--bronze) / 0.30)', shadow: '0 0 12px hsl(var(--bronze) / 0.12)' };

  const medal = place === 1 ? '🥇' : place === 2 ? '🥈' : '🥉';
  const name = standing.profiles?.display_name ?? 'Unknown';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: place === 1 ? 0.1 : place === 2 ? 0.15 : 0.2, type: 'spring', stiffness: 220, damping: 22 }}
      className={cn(
        'rounded-xl px-2 pt-3 pb-3 flex flex-col items-center justify-end text-center relative overflow-hidden',
        height,
        isMe && 'ring-2 ring-gold/50',
      )}
      style={{
        background: `linear-gradient(180deg, ${accent.bg}, transparent 80%), hsl(var(--card))`,
        border: `1px solid ${accent.border}`,
        boxShadow: accent.shadow,
      }}
    >
      {featured && <Crown className="w-4 h-4 absolute top-2 right-2" style={{ color: accent.color }} />}
      <div className="text-2xl mb-0.5 leading-none">{medal}</div>
      <p className="text-[11px] font-extrabold truncate w-full leading-tight" title={name}>{name}</p>
      <p className="text-[18px] font-extrabold tabular-nums leading-none mt-1" style={{ color: accent.color }}>
        {standing.total_correct}
      </p>
      <p className="text-[8px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground/70 mt-0.5">correct</p>
    </motion.div>
  );
}

function PulseStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/30 bg-muted/20 px-2 py-2.5 text-center">
      <p className="text-[13px] font-extrabold tabular-nums">{value}</p>
      <p className="text-[8px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
