import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { TeamLogo } from '@/components/pickem/TeamLogo';
import type { NflGame, NflPick, NflTeam, NflWeek } from '@/hooks/usePickem';

interface PickemShareCardProps {
  weekId: string;
  weekNumber: number;
  authorId: string;
  authorName?: string | null;
}

interface PickemCardData {
  week: NflWeek;
  games: NflGame[];
  picks: NflPick[];
  teams: NflTeam[];
  tiebreaker: number | null;
}

export function PickemShareCard({ weekId, weekNumber, authorId, authorName }: PickemShareCardProps) {
  const navigate = useNavigate();
  const [data, setData] = useState<PickemCardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([
      supabase.from('nfl_weeks').select('*').eq('id', weekId).maybeSingle(),
      supabase.from('nfl_games').select('*').eq('week_id', weekId).order('kickoff_at'),
      supabase.from('nfl_picks').select('*').eq('week_id', weekId).eq('user_id', authorId),
      supabase.from('nfl_tiebreakers').select('predicted_total').eq('week_id', weekId).eq('user_id', authorId).maybeSingle(),
    ]).then(async ([weekResult, gamesResult, picksResult, tiebreakResult]) => {
      if (cancelled || !weekResult.data || gamesResult.error || picksResult.error) return;
      const games = (gamesResult.data ?? []) as NflGame[];
      const teamIds = [...new Set(games.flatMap(game => [game.away_team_id, game.home_team_id]))];
      const teamsResult = teamIds.length > 0
        ? await supabase.from('nfl_teams').select('*').in('id', teamIds)
        : { data: [] };
      if (cancelled) return;
      setData({
        week: weekResult.data as NflWeek,
        games,
        picks: (picksResult.data ?? []) as NflPick[],
        teams: (teamsResult.data ?? []) as NflTeam[],
        tiebreaker: (tiebreakResult.data as { predicted_total?: number } | null)?.predicted_total ?? null,
      });
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [authorId, weekId]);

  const teamMap = useMemo(() => new Map(data?.teams.map(team => [team.id, team]) ?? []), [data?.teams]);

  if (loading) return <div className="mt-2 h-48 max-w-[330px] animate-pulse rounded-lg border border-border/40 bg-secondary/40" />;
  if (!data) return null;

  const pickMap = new Map(data.picks.map(pick => [pick.game_id, pick]));
  const correct = data.picks.filter(pick => pick.is_correct === true).length;
  const settled = data.picks.filter(pick => pick.is_correct !== null).length;

  return (
    <article className="mt-2 max-w-[330px] overflow-hidden rounded-lg border border-primary/30 bg-background text-foreground shadow-md" onClick={event => event.stopPropagation()}>
      <header className="border-b border-border/40 bg-primary/10 px-3.5 py-3">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase text-primary">
            <ShieldCheck className="h-3.5 w-3.5" /> Verified Pick’em Card
          </span>
          {settled > 0 && <span className="text-[10px] font-bold tabular-nums text-muted-foreground">{correct}/{settled} correct</span>}
        </div>
        <h3 className="mt-1 text-[15px] font-extrabold">{authorName || 'Club member'} · {data.week.label}</h3>
      </header>
      <div className="divide-y divide-border/25">
        {data.games.map(game => {
          const pick = pickMap.get(game.id);
          const selected = pick ? teamMap.get(pick.picked_team_id) : undefined;
          return (
            <div key={game.id} className="flex min-h-11 items-center gap-2 px-3 py-2">
              <span className="w-16 shrink-0 text-[10px] font-semibold text-muted-foreground">
                {teamMap.get(game.away_team_id)?.abbr ?? 'AWY'} @ {teamMap.get(game.home_team_id)?.abbr ?? 'HME'}
              </span>
              <TeamLogo team={selected} size={24} />
              <span className="min-w-0 flex-1 truncate text-[12px] font-extrabold">{selected?.abbr ?? 'No pick'}</span>
              {pick?.is_correct === true && <CheckCircle2 className="h-4 w-4 text-primary" />}
              {pick?.is_correct === false && <XCircle className="h-4 w-4 text-destructive" />}
            </div>
          );
        })}
      </div>
      <footer className="space-y-2 border-t border-border/40 px-3 py-3">
        {data.tiebreaker !== null && <p className="text-[10px] font-semibold text-muted-foreground">Tiebreaker · {data.tiebreaker} total points</p>}
        <Button type="button" size="sm" variant="secondary" className="w-full" onClick={() => navigate(`/pickem/week/${weekNumber}`)}>
          View picks <ArrowRight className="ml-auto" />
        </Button>
      </footer>
    </article>
  );
}