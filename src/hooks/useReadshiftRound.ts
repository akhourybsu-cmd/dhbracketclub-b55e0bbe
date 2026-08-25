// READSHIFT — loads the current round + the caller's phase-appropriate
// private state. Private data (Signal, own answer, own guesses) comes from
// own-row RLS; the anonymized read cards + author pool come from the
// SECURITY DEFINER RPCs. Nothing here can see another player's secrets.
import { useCallback, useEffect, useState } from 'react';
import { withTimeout, QUERY_TIMEOUT_MS, HYDRATE_TIMEOUT_MS } from '@/lib/asyncGuards';
import * as api from '@/lib/readshift/api';
import type { RsGame, RsRound, RsSignalAssignment, RsAnswer, RsReadCard, RsGuess, RsRoundResult, RsRoundAward, RsComment } from '@/lib/readshift/dbTypes';

export interface RoundState {
  round: RsRound | null;
  assignment: RsSignalAssignment | null;
  myAnswer: RsAnswer | null;
  readCards: RsReadCard[];
  authorPool: string[];
  myGuesses: RsGuess[];
  progress: { submitted: number; total: number };
  result: RsRoundResult | null;
  awards: RsRoundAward[];
  comments: RsComment[];
  error: string | null;
}

const EMPTY: RoundState = { round: null, assignment: null, myAnswer: null, readCards: [], authorPool: [], myGuesses: [], progress: { submitted: 0, total: 0 }, result: null, awards: [], comments: [], error: null };

export function useReadshiftRound(game: RsGame | null) {
  const [state, setState] = useState<RoundState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const gameId = game?.id;
  const phase = game?.phase;
  const roundNo = game?.current_round;

  const refresh = useCallback(async () => {
    if (!game || !gameId || !roundNo || !['shift', 'read', 'reveal'].includes(game.phase)) {
      setState(EMPTY); setLoading(false); return;
    }
    try {
      const round = await withTimeout(api.getRound(gameId, roundNo), QUERY_TIMEOUT_MS, 'rs round');
      if (!round) { setState({ ...EMPTY, error: 'Round data is not available yet.' }); setLoading(false); return; }
      const assignment = await withTimeout(api.getMyAssignment(round.id), QUERY_TIMEOUT_MS, 'rs assignment');
      const next: RoundState = { ...EMPTY, round, assignment };

      if (game.phase === 'shift') {
        const [myAnswer, progress] = await withTimeout(Promise.all([
          api.getMyAnswer(round.id), api.getShiftProgress(round.id),
        ]), HYDRATE_TIMEOUT_MS, 'rs shift');
        next.myAnswer = myAnswer; next.progress = progress;
      } else if (game.phase === 'read') {
        const [readCards, authorPool, myGuesses, progress, myAnswer] = await withTimeout(Promise.all([
          api.getReadCards(round.id), api.getRoundAuthors(round.id), api.getMyGuesses(round.id), api.getReadProgress(round.id), api.getMyAnswer(round.id),
        ]), HYDRATE_TIMEOUT_MS, 'rs read');
        next.readCards = readCards; next.authorPool = authorPool; next.myGuesses = myGuesses; next.progress = progress; next.myAnswer = myAnswer;
      } else if (game.phase === 'reveal') {
        const [result, awards, comments] = await withTimeout(Promise.all([
          api.getRoundResult(round.id), api.getRoundAwards(round.id), api.getComments(round.id),
        ]), HYDRATE_TIMEOUT_MS, 'rs reveal');
        next.result = result; next.awards = awards; next.comments = comments;
      }
      setState(next);
    } catch (err) {
      console.error('[useReadshiftRound] refresh failed', err);
      setState((prev) => ({ ...prev, error: err instanceof Error ? err.message : 'Failed to load this round.' }));
    } finally {
      setLoading(false);
    }
  }, [game, gameId, roundNo, phase]);

  useEffect(() => { setLoading(true); void refresh(); }, [refresh]);
  return { ...state, loading, refresh };
}
