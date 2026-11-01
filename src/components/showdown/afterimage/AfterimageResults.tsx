import { useState } from 'react';
import { ArrowLeft, ArrowUpRight, Check, Crown, Equal, RotateCw, Sparkles, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { ShowdownMatchDetail, ShowdownRecord, ShowdownRoundState } from '@/lib/showdown/types';
import type { AfterimageSceneView } from '@/lib/showdown/afterimage/types';
import { ShowdownAvatar } from '../ShowdownChrome';
import { AfterimageArt } from './AfterimageArt';
import { AfterimageScene } from './AfterimageScene';
import './afterimageResults.css';

type ResultsProps = {
  detail: ShowdownMatchDetail;
  viewerId: string;
  rivalry?: ShowdownRecord | null;
  onRematch: () => void;
  busy: boolean;
  error?: string | null;
};

/** Only the completed-match view contains answer maps. Never infer a live rival's score. */
export function AfterimageResults({ detail, viewerId, rivalry, onRematch, busy, error }: ResultsProps) {
  const [inspecting, setInspecting] = useState<number | null>(null);
  const [inspectedPlayer, setInspectedPlayer] = useState<'me' | 'opponent'>('me');
  const [view, setView] = useState<'original' | 'recall'>('recall');
  const { challenge, rounds } = detail;
  if (challenge.game_key !== 'afterimage' || challenge.status !== 'completed' || !challenge.players.every(player => player.finished_at)) return null;
  const me = challenge.players.find(player => player.user_id === viewerId);
  const opponent = challenge.players.find(player => player.user_id !== viewerId);
  if (!me || !opponent) return null;
  const career = rivalry ?? detail.rivalry;
  const draw = challenge.outcome === 'draw';
  const won = challenge.winner_id === viewerId;
  const winner = challenge.players.find(player => player.user_id === challenge.winner_id);
  const perfects = (side: 'me' | 'opponent') => rounds.filter(round => round[side]?.perfect === true).length;
  const myPerfect = me.perfect_count ?? perfects('me');
  const rivalPerfect = opponent.perfect_count ?? perfects('opponent');
  const tieExplanation = me.total_score !== opponent.total_score
    ? 'The higher three-scene score wins.'
    : myPerfect !== rivalPerfect
      ? 'Scores tied. More perfect scenes decided the match.'
      : 'Same score. Same perfect scenes. A true draw.';
  const correctTotal = (side: 'me' | 'opponent') => {
    if (rounds.some(round => round[side]?.correct_count == null)) return '—';
    return rounds.reduce((sum, round) => sum + (round[side]?.correct_count ?? 0), 0);
  };
  const requiredTotal = rounds.reduce((sum, round) => sum + (round.scene?.slots.length ?? 0), 0);
  const selectedRound = rounds.find(round => round.round_number === inspecting);
  const selectedAttempt = inspectedPlayer === 'me' ? selectedRound?.me : selectedRound?.opponent;
  const selectedPerson = inspectedPlayer === 'me' ? me : opponent;

  return <div className="sd-results air-results" data-testid="showdown-results">
    <header className="sd-results-hero air-results-hero">
      <div className="air-medallion">{draw ? <Equal aria-hidden="true" /> : <Trophy aria-hidden="true" />}</div>
      <p className="sd-eyebrow">AFTERIMAGE · FINAL</p>
      <h1>{draw ? 'A shared impression.' : won ? 'A moment to remember.' : 'A worthy rival.'}</h1>
      <p>{draw ? 'Draw' : `${winner?.display_name ?? 'The higher-scoring player'} wins`} · {tieExplanation}</p>
    </header>
    <div className="sd-scoreboard air-scoreboard" aria-label="Final scores">
      {[me, opponent].map((player, index) => <article className="sd-score-player air-score-player" key={player.user_id} data-winner={challenge.winner_id === player.user_id}>
        {challenge.winner_id === player.user_id && <Crown aria-label="Winner" />}
        <ShowdownAvatar name={player.display_name} url={player.avatar_url} />
        <h2>{player.display_name}<small>{index === 0 ? 'You' : 'Rival'}</small></h2>
        <div className="sd-score-total">{player.total_score ?? '—'}<span> / 375</span></div>
        <small><Sparkles size={12} aria-hidden="true" />{index === 0 ? myPerfect : rivalPerfect} / 3 perfect scenes</small>
        <small><Check size={12} aria-hidden="true" />{correctTotal(index === 0 ? 'me' : 'opponent')}{requiredTotal > 0 ? ` / ${requiredTotal}` : ''} correct placements</small>
      </article>)}
    </div>
    <section className="sd-round-table air-round-table" aria-label="Round scores">
      <div className="sd-round-row sd-round-head"><span>Scene</span><span>{me.display_name}</span><span>{opponent.display_name}</span></div>
      {rounds.map(round => <div className="sd-round-row" key={round.round_number}>
        <button type="button" onClick={() => { setInspecting(round.round_number); setInspectedPlayer('me'); setView('recall'); }} aria-label={`Inspect round ${round.round_number}`}>Round {round.round_number}<ArrowUpRight size={13} aria-hidden="true" /><small>{round.difficulty}</small></button>
        {[round.me, round.opponent].map((attempt, index) => <span key={index}><b>{attempt?.score ?? '—'}</b><span className="air-points-cap"> / 125</span><small>{attempt?.skipped ? 'Skipped' : attempt?.perfect ? 'Perfect scene' : `${attempt?.correct_count ?? '—'} / ${round.scene?.slots.length ?? '—'} correct`}</small></span>)}
      </div>)}
    </section>
    {career && <section className="sd-progress-summary air-rivalry" aria-label="Career head-to-head record">
      <strong>{career.wins}–{career.losses}–{career.draws}</strong>
      <p>Your Afterimage rivalry with {opponent.display_name}</p>
      <small>Wins · losses · draws across {career.played} completed {career.played === 1 ? 'match' : 'matches'}</small>
    </section>}
    {error && <p className="sd-error" role="alert">{error}</p>}
    <div className="sd-results-actions">
      <Link className="sd-button" to="/showdown?game=afterimage&tab=history"><ArrowLeft size={16} aria-hidden="true" />Match history</Link>
      <button type="button" className="sd-button sd-primary" disabled={busy} onClick={onRematch}><RotateCw size={16} aria-hidden="true" />{busy ? 'Preparing…' : 'Rematch'}</button>
    </div>
    <details className="sd-scoring-details"><summary>How scoring works</summary><p>Each scene earns a rounded accuracy score of 100 × correct placements ÷ missing objects, plus 25 points for a perfect scene. Skipped scenes earn zero. Tied scores compare perfect scenes, then end in a draw. Time and device speed never affect your score.</p></details>
    <Dialog open={inspecting !== null} onOpenChange={open => { if (!open) setInspecting(null); }}>
      <DialogContent className="sd-dialog sd-afterimage air-review-dialog">
        <DialogHeader><DialogTitle>Round {inspecting} review</DialogTitle><DialogDescription>{selectedRound?.title ?? 'Completed scene'} · {selectedRound?.difficulty}. Compare the original with each rival’s final placement.</DialogDescription></DialogHeader>
        <div className="sd-inspector-tabs" aria-label="Recall player">
          <button type="button" aria-pressed={inspectedPlayer === 'me'} onClick={() => setInspectedPlayer('me')}>{me.display_name}</button>
          <button type="button" aria-pressed={inspectedPlayer === 'opponent'} onClick={() => setInspectedPlayer('opponent')}>{opponent.display_name}</button>
        </div>
        {selectedRound?.scene?.phase === 'review' && selectedRound.scene.answers?.length && selectedAttempt
          ? <SceneReview scene={selectedRound.scene} attempt={selectedAttempt} name={selectedPerson.display_name} view={view} setView={setView} />
          : <p role="status">The completed scene review is unavailable. Close this review and refresh the match to try again.</p>}
      </DialogContent>
    </Dialog>
  </div>;
}

function SceneReview({ scene, attempt, name, view, setView }: { scene: AfterimageSceneView; attempt: ShowdownRoundState; name: string; view: 'original' | 'recall'; setView: (view: 'original' | 'recall') => void }) {
  // Answer maps arrive only in a completed review. Both renderers remain read-only.
  const answers = scene.answers ?? [];
  const missing = new Set(answers.map(answer => answer.object_id));
  const expectedBySlot = new Map(answers.map(answer => [answer.slot_id, answer.object_id]));
  const placements = Object.fromEntries((attempt.placements ?? []).map(placement => [placement.slot_id, placement.object_id]));
  const feedback = Object.fromEntries(scene.slots.map(slot => [slot.id, !placements[slot.id] ? 'empty' : placements[slot.id] === expectedBySlot.get(slot.id) ? 'correct' : 'wrong'])) as Record<string, 'correct' | 'wrong' | 'empty'>;
  const { answers: _answers, ...publicScene } = scene;
  const recall: AfterimageSceneView = { ...publicScene, phase: 'reconstruct', objects: scene.objects.filter(object => !missing.has(object.id)) };
  const original: AfterimageSceneView = { ...publicScene, objects: scene.objects, slots: [], tray: [] };
  const used = new Set(Object.values(placements));
  const distractors = scene.tray.filter(piece => !missing.has(piece.id));
  const unusedDistractors = distractors.filter(piece => !used.has(piece.id));
  return <div className="air-review">
    <div className="sd-inspector-tabs air-view-tabs" aria-label="Scene comparison view">
      <button type="button" aria-pressed={view === 'original'} onClick={() => setView('original')}>Original scene</button>
      <button type="button" aria-pressed={view === 'recall'} onClick={() => setView('recall')}>Recall placement</button>
    </div>
    <div className="air-comparison" data-view={view}>
      <figure className="air-original"><figcaption>Original scene<small>The scene you studied</small></figcaption><AfterimageScene scene={original} readOnly mode="study" label="Original scene arrangement" /></figure>
      <figure className="air-recall"><figcaption>{name}’s recall<small>{attempt.skipped ? 'Skipped scene' : `${attempt.correct_count ?? '—'} / ${scene.slots.length} correct placements`}</small></figcaption><AfterimageScene scene={recall} placements={placements} feedback={feedback} readOnly mode="results" label={`${name}'s final scene placement`} /></figure>
    </div>
    <div className="air-review-receipt"><span><b>{attempt.score ?? '—'}</b> / 125 points</span><span>{attempt.skipped ? 'Skipped' : attempt.perfect ? <><Sparkles size={14} aria-hidden="true" />Perfect scene</> : `${attempt.correct_count ?? '—'} / ${scene.slots.length} correct`}</span></div>
    <p className="air-review-legend"><span><i data-state="correct" />Correct</span><span><i data-state="wrong" />Wrong object</span><span><i data-state="empty" />Empty slot</span></p>
    {distractors.length > 0 && <section className="air-distractors" aria-label="Unused distractors"><h3>Unused distractors <small>{unusedDistractors.length} / {distractors.length} correctly left out</small></h3>{unusedDistractors.length > 0 ? <div>{unusedDistractors.map(piece => <span key={piece.id}><AfterimageArt assetId={piece.assetId} decorative /><small>{piece.label}</small></span>)}</div> : <p>All distractors were placed in this attempt.</p>}</section>}
    <p className="air-readonly-note">Final placements are locked. Neither player can change this result.</p>
  </div>;
}
