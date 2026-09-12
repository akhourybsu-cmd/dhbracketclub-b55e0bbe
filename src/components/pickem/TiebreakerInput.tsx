import { useEffect, useState } from 'react';
import { Star, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { TeamLogo } from './TeamLogo';
import type { NflGame } from '@/hooks/usePickem';

type Props = {
  game?: NflGame;
  predicted?: number | null;
  actual?: number | null;
  onChange: (value: number) => void;
  locked?: boolean;
};

export function TiebreakerInput({ game, predicted, actual, onChange, locked = false }: Props) {
  const [value, setValue] = useState<string>(predicted?.toString() ?? '');
  useEffect(() => { setValue(predicted?.toString() ?? ''); }, [predicted]);

  if (!game) return null;

  return (
    <div className="nfl-tiebreaker relative overflow-hidden p-4 mt-1">
      <div className="nfl-surface-rule" />

      <div className="flex items-center gap-1.5 mb-3">
        <Star className="w-3.5 h-3.5 text-gold fill-gold" />
        <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-gold">Tiebreaker</p>
        {locked && <Lock className="w-3 h-3 text-muted-foreground ml-auto" />}
      </div>

      <div className="flex items-center gap-2 mb-3 p-2 rounded-xl bg-background/40">
        <TeamLogo team={game.away_team} size={26} />
        <span className="text-[12px] font-extrabold">{game.away_team?.abbr}</span>
        <span className="text-[9px] font-extrabold tracking-wider text-muted-foreground/60">VS</span>
        <TeamLogo team={game.home_team} size={26} />
        <span className="text-[12px] font-extrabold">{game.home_team?.abbr}</span>
        <span className="text-[10px] text-muted-foreground/70 ml-auto">
          {format(new Date(game.kickoff_at), 'EEE h:mm a')}
        </span>
      </div>

      <label className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground/80 block mb-1.5">
        Predict total combined points
      </label>
      <Input
        type="number"
        inputMode="numeric"
        min={0}
        max={200}
        value={value}
        disabled={locked}
        placeholder="e.g. 47"
        onChange={(e) => {
          const v = e.target.value;
          setValue(v);
          const n = parseInt(v, 10);
          if (!isNaN(n) && n >= 0 && n <= 200) onChange(n);
        }}
        className="text-base font-extrabold h-11 tabular-nums"
      />
      {actual != null && (
        <p className="text-[11px] mt-2 text-muted-foreground">
          Actual total: <span className="font-extrabold text-foreground tabular-nums">{actual}</span>
          {predicted != null && <> · Off by <span className="font-extrabold tabular-nums">{Math.abs(actual - predicted)}</span></>}
        </p>
      )}
      {actual == null && predicted != null && (
        <p className="text-[10px] mt-2 font-bold text-success">Saved · {predicted} total points</p>
      )}
    </div>
  );
}
