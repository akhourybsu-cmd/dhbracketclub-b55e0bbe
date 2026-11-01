import { useState } from 'react';
import { ArrowLeft, ArrowUpRight, Crown, Equal, RotateCw, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { ShowdownMatchDetail, ShowdownRecord } from '@/lib/showdown/types';
import { PrismBoard } from './PrismBoard';
import { ShowdownAvatar } from './ShowdownChrome';

export function ShowdownResults({ detail, viewerId, rivalry, onRematch, busy, error }: {
  detail: ShowdownMatchDetail;
  viewerId: string;
  rivalry?: ShowdownRecord | null;
  onRematch: () => void;
  busy: boolean;
  error?: string | null;
}) {
  const [inspecting, setInspecting] = useState<number | null>(null);
  const [inspectedPlayer, setInspectedPlayer] = useState<'me' | 'opponent'>('me');
  const { challenge, rounds } = detail;
  const career = rivalry ?? detail.rivalry;
  if (challenge.status !== 'completed' || !challenge.players.every(player => player.finished_at)) return null;
  const me = challenge.players.find(player => player.user_id === viewerId);
  const opponent = challenge.players.find(player => player.user_id !== viewerId);
  if (!me || !opponent) return null;
  const draw = challenge.outcome === 'draw';
  const won = challenge.winner_id === viewerId;
  const selectedRound = rounds.find(round => round.round_number === inspecting);
  const selectedAttempt = inspectedPlayer === 'me' ? selectedRound?.me : selectedRound?.opponent;
  const selectedPerson = inspectedPlayer === 'me' ? me : opponent;
  const tieExplanation = me.total_score !== opponent.total_score
    ? 'The higher three-round score wins.'
    : me.solved_count !== opponent.solved_count
      ? 'Scores tied. More solved puzzles decided the match.'
      : me.rotations !== opponent.rotations
        ? 'Scores and solved puzzles tied. Fewer total rotations decided the match.'
        : 'Same score. Same solved rounds. Same rotations. A true draw.';
  return <div className="sd-results" data-testid="showdown-results">
    <header className="sd-results-hero">
      {draw ? <Equal aria-hidden="true" /> : <Trophy aria-hidden="true" />}
      <p className="sd-eyebrow">PRISM BREAK · FINAL</p>
      <h1>{draw ? 'Perfectly matched.' : won ? 'Victory.' : 'Rival takes the light.'}</h1>
      <p>{draw ? 'Draw' : `${challenge.players.find(player => player.user_id === challenge.winner_id)?.display_name ?? 'The higher-scoring player'} wins`} · {tieExplanation}</p>
    </header>
    <div className="sd-scoreboard" aria-label="Final scores">
      {[me, opponent].map(player => <article className="sd-score-player" key={player.user_id} data-winner={challenge.winner_id === player.user_id}>
        {challenge.winner_id === player.user_id && <Crown aria-label="Winner" />}
        <ShowdownAvatar name={player.display_name} url={player.avatar_url} />
        <h2>{player.display_name}{player.user_id === viewerId && <small>You</small>}</h2>
        <div className="sd-score-total">{player.total_score ?? 0}</div>
        <small>{player.solved_count ?? 0} / 3 solved</small>
        <small>{player.rotations ?? 0} rotations</small>
      </article>)}
    </div>
    <section className="sd-round-table" aria-label="Round scores">
      <div className="sd-round-row sd-round-head"><span>Round</span><span>{me.display_name}</span><span>{opponent.display_name}</span></div>
      {rounds.map(round => <div className="sd-round-row" key={round.round_number}>
        <button type="button" onClick={() => { setInspecting(round.round_number); setInspectedPlayer('me'); }} aria-label={`Inspect round ${round.round_number}`}>Round {round.round_number}<ArrowUpRight size={13} aria-hidden="true" /></button>
        {[round.me, round.opponent].map((attempt, index) => <span key={index}><b>{attempt?.score ?? '—'}</b><small>{attempt?.skipped ? 'Skipped' : `${attempt?.rotations ?? 0} rotations`}</small></span>)}
      </div>)}
    </section>
    {career && <section className="sd-progress-summary" aria-label="Career head-to-head record">
      <strong>{career.wins}–{career.losses}–{career.draws}</strong>
      <p>Your Prism Break rivalry with {opponent.display_name}</p>
      <small>Wins · losses · draws across {career.played} completed {career.played === 1 ? 'match' : 'matches'}</small>
    </section>}
    {error && <p className="sd-error" role="alert">{error}</p>}
    <div className="sd-results-actions">
      <Link className="sd-button" to="/showdown?tab=history"><ArrowLeft size={16} aria-hidden="true" />Match history</Link>
      <button type="button" className="sd-button sd-primary" disabled={busy} onClick={onRematch}><RotateCw size={16} aria-hidden="true" />{busy ? 'Preparing…' : 'Rematch'}</button>
    </div>
    <details className="sd-scoring-details"><summary>How scoring works</summary><p>A solved puzzle earns 300 points plus a rounded efficiency bonus of 200 × minimum rotations ÷ your rotations, capped at 200. Skipped puzzles earn zero. Ties compare solved puzzles, then total rotations. Network speed never affects the result.</p></details>
    <Dialog open={inspecting !== null} onOpenChange={open => { if (!open) setInspecting(null); }}>
      <DialogContent className="sd-dialog sd-replay-dialog">
        <DialogHeader><DialogTitle>Round {inspecting} replay</DialogTitle><DialogDescription>{selectedRound?.title ?? 'Your completed puzzle'} · {selectedRound?.difficulty}</DialogDescription></DialogHeader>
        <div className="sd-inspector-tabs" aria-label="Final board player">
          <button type="button" aria-pressed={inspectedPlayer === 'me'} onClick={() => setInspectedPlayer('me')}>{me.display_name}</button>
          <button type="button" aria-pressed={inspectedPlayer === 'opponent'} onClick={() => setInspectedPlayer('opponent')}>{opponent.display_name}</button>
        </div>
        {selectedRound?.puzzle && selectedAttempt && <>
          <div className="sd-inspector-board"><PrismBoard puzzle={selectedRound.puzzle} actions={selectedAttempt.actions} readOnly label={`${selectedPerson.display_name}'s final board`} /></div>
          <div className="sd-inspector-detail"><span><b>{selectedAttempt.score ?? 0}</b> points</span><span><b>{selectedAttempt.rotations}</b> rotations</span><span>{selectedAttempt.skipped ? 'Skipped' : 'Solved'}</span></div>
          {selectedRound.minimum_rotations !== null && <p>Optimal solution: {selectedRound.minimum_rotations} rotations. This board is read-only.</p>}
        </>}
      </DialogContent>
    </Dialog>
  </div>;
}
