import { useMemo, useState } from 'react';
import { KeyRound, Lock, LockOpen, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { NflGame } from '@/hooks/usePickem';
import { pickemGameIsOpen, pickemOverrideActive } from '../../../supabase/functions/_shared/chainGameRules';

type Props = {
  games: NflGame[];
  now: number;
  /** Refresh the slate after an unlock window changes. */
  onChanged: () => void | Promise<unknown>;
};

const WINDOWS: Array<{ label: string; hours: number }> = [
  { label: '2 hours', hours: 2 },
  { label: '12 hours', hours: 12 },
  { label: 'Until kickoff', hours: 0 },
];

/**
 * Commissioner-only panel: reopen picking on matchups whose 48-hour deadline
 * has already passed. Nothing here changes scoring — it only extends the
 * window during which members may still choose a winner.
 */
export function CommissionerUnlockCard({ games, now, onChanged }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const lockedGames = useMemo(
    () => games.filter(game => game.status === 'scheduled' && !pickemGameIsOpen(game, now)),
    [games, now],
  );
  const reopened = useMemo(
    () => games.filter(game => game.status === 'scheduled' && pickemOverrideActive(game, now)),
    [games, now],
  );

  async function setWindow(game: NflGame, hours: number) {
    setBusyId(game.id);
    const until = hours > 0
      ? new Date(now + hours * 3_600_000)
      : new Date(game.kickoff_at);
    try {
      const { error } = await supabase
        .from('nfl_games')
        .update({ pickem_unlock_until: until.toISOString() } as never)
        .eq('id', game.id);
      if (error) throw error;
      await onChanged();
      toast.success(`Picks reopen until ${format(until, 'EEE h:mm a')}`);
    } catch (error: any) {
      toast.error(error?.message || 'Could not reopen this matchup');
    } finally {
      setBusyId(null);
    }
  }

  async function clearWindow(game: NflGame) {
    setBusyId(game.id);
    try {
      const { error } = await supabase
        .from('nfl_games')
        .update({ pickem_unlock_until: null } as never)
        .eq('id', game.id);
      if (error) throw error;
      await onChanged();
      toast('Matchup locked again', { duration: 1200 });
    } catch (error: any) {
      toast.error(error?.message || 'Could not lock this matchup');
    } finally {
      setBusyId(null);
    }
  }

  if (lockedGames.length === 0 && reopened.length === 0) return null;

  return (
    <section className="glass-card p-3" aria-labelledby="pk-unlock-heading">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        className="w-full flex items-center gap-2 text-left min-h-[44px]"
        aria-expanded={open}
      >
        <span className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-4 h-4 text-primary" />
        </span>
        <span className="flex-1 min-w-0">
          <span id="pk-unlock-heading" className="block text-[12px] font-extrabold">Commissioner: pick deadlines</span>
          <span className="block text-[11px] text-muted-foreground">
            {reopened.length > 0
              ? `${reopened.length} matchup${reopened.length === 1 ? '' : 's'} reopened`
              : `${lockedGames.length} locked matchup${lockedGames.length === 1 ? '' : 's'}`}
          </span>
        </span>
        <KeyRound className="w-4 h-4 text-muted-foreground shrink-0" />
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {lockedGames.map(game => {
            const active = pickemOverrideActive(game, now);
            return (
              <div key={game.id} className="rounded-xl border border-border/40 bg-card/60 p-2.5">
                <div className="flex items-center gap-2">
                  {active
                    ? <LockOpen className="w-3.5 h-3.5 text-success shrink-0" />
                    : <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                  <p className="text-[12px] font-extrabold flex-1 min-w-0">
                    {game.away_team?.abbr ?? 'Away'} @ {game.home_team?.abbr ?? 'Home'}
                  </p>
                  <p className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                    {format(new Date(game.kickoff_at), 'EEE h:mm a')}
                  </p>
                </div>
                {active && game.pickem_unlock_until && (
                  <p className="mt-1 text-[10px] font-bold text-success">
                    Open until {format(new Date(game.pickem_unlock_until), 'EEE h:mm a')}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {WINDOWS.map(option => (
                    <button
                      key={option.label}
                      type="button"
                      disabled={busyId === game.id}
                      onClick={() => void setWindow(game, option.hours)}
                      className="min-h-[36px] px-2.5 rounded-lg border border-border/50 bg-muted/25 text-[11px] font-extrabold btn-press disabled:opacity-50"
                    >
                      {active ? `Extend ${option.label.toLowerCase()}` : option.label}
                    </button>
                  ))}
                  {active && (
                    <button
                      type="button"
                      disabled={busyId === game.id}
                      onClick={() => void clearWindow(game)}
                      className="min-h-[36px] px-2.5 rounded-lg border border-destructive/40 text-destructive text-[11px] font-extrabold btn-press disabled:opacity-50"
                    >
                      Lock again
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Reopening only lets members choose a winner again before kickoff. Scores and standings are unchanged.
          </p>
        </div>
      )}
    </section>
  );
}
