/* eslint-disable react-refresh/only-export-components -- The widgets share their scoped query key with cartridge result screens. */
import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { getArcadeLeaderboard, type ArcadeBoard, type ArcadeBoardEntry, type ArcadePeriod, type ArcadeScope, type ArcadeVerifiedResult } from '@/lib/arcade/client';
import './arcadeStandings.css';

const periods: { id: ArcadePeriod; label: string }[] = [
  { id: 'all_time', label: 'All Time' },
  { id: 'week', label: 'This Week' },
  { id: 'today', label: 'Today' },
];
const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' });
const points = new Intl.NumberFormat('en-US');
const keys = (scope: ArcadeScope | null, member?: string) =>
  ['arcade-board', member, scope?.clubId, scope?.gameKey, scope?.rulesetVersion] as const;

export function useArcadeBoard(scope: ArcadeScope | null, period: ArcadePeriod = 'all_time') {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...keys(scope, user?.id), period],
    queryFn: () => getArcadeLeaderboard(scope!, period),
    enabled: Boolean(user?.id && scope),
    staleTime: 30_000,
    retry: false,
  });
}

export function useRefreshArcadeBoards() {
  const client = useQueryClient();
  const { user } = useAuth();
  return useCallback((scope: ArcadeScope, board?: ArcadeBoard) => {
    const prefix = keys(scope, user?.id);
    // Period boundaries and other players' scores may have changed during this run.
    if (board) client.setQueryData([...prefix, board.period], board);
    void client.invalidateQueries({ queryKey: prefix });
  }, [client, user?.id]);
}

export function PersonalBestCard({ entry }: { entry?: ArcadeBoardEntry | null }) {
  if (!entry) return null;
  return <p className="arcade-record"><span>Personal best</span> <strong>{points.format(entry.score)}</strong> <small>Club #{entry.rank}</small></p>;
}

export function RankChangeResult({ result }: { result: ArcadeVerifiedResult }) {
  const movement = result.rankChange;
  return <div className="arcade-placement" aria-label="Verified club result">
    <b>Club #{result.rank}</b>
    <span>{result.isPersonalBest ? 'New personal best' : `Best ${points.format(result.personalBest)}`}</span>
    {movement != null && movement !== 0 && <span>{movement > 0 ? 'Up' : 'Down'} {Math.abs(movement)} {Math.abs(movement) === 1 ? 'place' : 'places'}</span>}
  </div>;
}

function Scores({ rows, label }: { rows: ArcadeBoardEntry[]; label: string }) {
  return <ol className="arcade-scores" aria-label={label}>
    {rows.map(row => <li key={row.rank} value={row.rank} className={row.isMe ? 'arcade-score-current' : undefined}>
      <b className="arcade-place">#{row.rank}</b>
      {row.avatarUrl ? <img src={row.avatarUrl} alt="" loading="lazy" width="26" height="26" /> : <span className="arcade-avatar" aria-hidden="true">{row.displayName.trim().charAt(0) || '·'}</span>}
      <span className="arcade-who">
        <strong>{row.displayName}</strong>{row.isMe && <small> You</small>}
        <time dateTime={row.achievedAt}>{dateFormat.format(new Date(row.achievedAt))}</time>
      </span>
      <span className="arcade-points"><b>{points.format(row.score)}</b><small>Wave {row.wave}</small></span>
    </li>)}
  </ol>;
}

export function ArcadeLeaderboard({ scope }: { scope: ArcadeScope }) {
  const [period, setPeriod] = useState<ArcadePeriod>('all_time');
  const board = useArcadeBoard(scope, period);
  const rows = board.data?.entries ?? [];
  const top = rows.filter(row => row.rank <= 25);
  const nearby = rows.filter(row => row.rank > 25);
  return <section className="arcade-board" aria-label="Club leaderboard">
    <h2>Club leaderboard</h2>
    <div className="arcade-periods" role="group" aria-label="Score period">
      {periods.map(({ id, label }) => <button key={id} type="button" aria-pressed={period === id} onClick={() => setPeriod(id)}>{label}</button>)}
    </div>
    {board.isError ? <div role="status"><p>Couldn’t load the board.</p><button type="button" onClick={() => void board.refetch()}>Try again</button></div>
      : !board.data ? <p role="status">{board.fetchStatus === 'paused' ? 'Connect to view club scores.' : 'Reading scores…'}</p>
      : !rows.length ? <p>Set the first score with a ranked run.</p>
      : <div className="arcade-score-scroll" tabIndex={0} aria-label="Rankings">
          <Scores rows={top} label="Top scores" />
          {nearby.length > 0 && <><h3>Your position</h3><Scores rows={nearby} label="Around your rank" /></>}
        </div>}
  </section>;
}
